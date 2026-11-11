import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

// Merged Work endpoints (#482) plus their real SQL count/pagination fix (#488).
const pin = '9b6bad46cce57cc08c3b09b7665ffe495f67455f';
const root = process.cwd();
const artifacts = resolve(process.env.PRODUCT_E2E_EVIDENCE || '.agent-runs/product-e2e', `${Date.now()}-${process.pid}`);
mkdirSync(artifacts, { recursive: true });
const fixture = mkdtempSync(join(tmpdir(), 'product-e2e-'));
const backend = join(fixture, 'api-repo');
const client = join(fixture, 'client');
const project = `product-e2e-${process.pid}-${randomBytes(4).toString('hex')}`;
const env = { ...process.env, CLIENT_DIR: client, POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex'), PRODUCT_E2E_EMAIL: 'product@example.test', PRODUCT_E2E_PASSWORD: randomBytes(24).toString('hex') };
const log = [];
let stage = 'preflight';
let started = false;
let cleaned = false;
const redact = (text) => [env.POSTGRES_PASSWORD, env.JWT_SECRET, env.REPOSITORY_ENCRYPTION_KEY, env.PRODUCT_E2E_PASSWORD].reduce((value, secret) => value.replaceAll(secret, '<redacted>'), text);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = redact(`${result.stdout || ''}${result.stderr || ''}`);
  log.push(`STAGE ${stage}\n$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  writeFileSync(join(artifacts, 'runner.txt'), log.join('\n'));
  if (!options.allowFailure) assert.equal(result.status, 0, output || String(result.error));
  return { ...result, stdout: output };
}
const composeArgs = ['compose', '-p', project, '-f', join(backend, 'compose.prod.yml')];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
async function port() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return String(value);
}
async function ready(url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  stage = 'cleanup';
  try {
    if (started) {
      run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
      for (const [command, format] of [['ps', '{{.ID}}'], ['network', '{{.ID}}'], ['volume', '{{.Name}}']]) {
        const args = command === 'ps' ? ['ps', '-a'] : [command, 'ls'];
        const result = run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', format]);
        assert.equal(result.stdout.trim(), '', `Remaining ${command} resources`);
      }
      log.push(`PASS cleanup: ${project}: zero containers, networks, volumes`);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    writeFileSync(join(artifacts, 'runner.txt'), log.join('\n'));
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  console.log(`STAGE ${stage}; evidence: ${artifacts}`);
  // The API consumes raw environment bytes, not a hex-decoded AES key.
  assert.equal(Buffer.byteLength(env.REPOSITORY_ENCRYPTION_KEY), 32, 'Repository encryption key must contain exactly 32 raw bytes');
  const browser = await chromium.launch({ headless: true });
  await browser.close();
  stage = 'fixture';
  run('git', ['clone', '--no-checkout', 'https://github.com/0Hoag/agent-ops.git', backend]);
  run('git', ['-C', backend, 'checkout', '--detach', pin]);
  assert.equal(run('git', ['-C', backend, 'rev-parse', 'HEAD']).stdout.trim(), pin);
  cpSync(root, client, { recursive: true, filter: (path) => !['node_modules', '.git', '.agent-runs', 'dist'].some((name) => path === join(root, name)) });
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  const api = `http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1`;
  const request = async (path, body, token) => {
    const response = await fetch(`${api}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    assert(response.ok, `${path}: HTTP ${response.status}`);
    return response.json();
  };
  const guard = join(client, 'src/app/router.tsx');
  const original = readFileSync(guard, 'utf8');
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const files = run('git', ['ls-files', '-z']).stdout.split('\0').filter((path) => path && !['node_modules', '.git', '.agent-runs', 'dist'].includes(path.split('/')[0]));
  writeFileSync(join(artifacts, 'client-source-hashes.json'), JSON.stringify(Object.fromEntries(files.map((path) => [path, hash(readFileSync(join(client, path)))])), null, 2));
  writeFileSync(join(artifacts, 'sources.json'), JSON.stringify({ api: pin, client: run('git', ['rev-parse', 'HEAD']).stdout.trim(), project, guard: hash(original), spec: hash(readFileSync(join(root, 'scripts/product-e2e.spec.ts'))) }, null, 2));
  stage = 'compose-up';
  started = true;
  compose('up', '-d', '--build', '--wait');
  stage = 'bootstrap';
  composeBootstrap();
  function composeBootstrap() {
    run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  }
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const org = await request('organizations', { name: 'Product E2E' }, login.token);
  assert(org.data.id, 'Organization creation must return an identity');
  const selected = await request('auth/select-organization', { organization_id: org.data.id }, login.token);
  await request('repositories', { provider: 'github', full_name: 'product/e2e', webhook_secret: randomBytes(24).toString('hex') }, selected.token);
  function test(label, allowFailure = false) {
    stage = label;
    env.PRODUCT_E2E_ARTIFACTS = join(artifacts, label);
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    return run('pnpm', ['exec', 'playwright', 'test', '--config', 'scripts/product-e2e.playwright.config.ts'], { allowFailure });
  }
  test('baseline');
  if (process.argv.includes('--control')) {
    stage = 'break-owned-route-guard';
    const needle = "return state === 'valid' ? children :";
    assert(original.includes(needle), 'Guard mutation target changed');
    const broken = original.replace(needle, 'return true ? children :');
    writeFileSync(guard, broken);
    writeFileSync(join(artifacts, 'mutation.json'), JSON.stringify({ path: 'src/app/router.tsx', original: hash(original), broken: hash(broken), replacement: 'return true ? children :' }, null, 2));
    try {
      compose('up', '-d', '--build', '--wait', 'client');
      const result = test('broken-guard', true);
      assert.equal(result.status, 1, 'Broken guard must fail the unchanged suite');
      assert.match(result.stdout, /anonymous route guard: \/board/);
    } finally {
      writeFileSync(guard, original);
    }
    stage = 'restore-owned-route-guard';
    assert.equal(hash(readFileSync(guard)), hash(original));
    compose('up', '-d', '--build', '--wait', 'client');
    await ready(`${env.PRODUCT_E2E_URL}/login`);
    test('restored');
  }
  console.log('PASS product-e2e');
} catch (error) {
  log.push(`FAIL stage=${stage}: ${redact(error.stack || String(error))}`);
  console.error(log.at(-1));
  process.exitCode = 1;
} finally {
  cleanup();
}
