// Issue #148: reuse the product-e2e disposable Compose/bootstrap lifecycle.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pin = '9b6bad46cce57cc08c3b09b7665ffe495f67455f';
const artifacts = resolve(process.env.W18_EVIDENCE || '.agent-runs/W18s-evidence', `${Date.now()}`);
mkdirSync(artifacts, { recursive: true });
const fixture = mkdtempSync(join(tmpdir(), 'w18-qa-'));
const backend = join(fixture, 'api');
const client = join(fixture, 'client');
const project = `w18-qa-${process.pid}`;
const env = { ...process.env, CLIENT_DIR: client, POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex'), AGENT_RUN_TOKEN: randomBytes(24).toString('hex'), PRODUCT_E2E_EMAIL: 'qa@example.test', PRODUCT_E2E_PASSWORD: randomBytes(24).toString('hex') };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
const logs = [];
let started = false;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = secrets.reduce((text, key) => text.replaceAll(env[key], '<redacted>'), `${result.stdout || ''}${result.stderr || ''}`);
  logs.push(`$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  writeFileSync(join(artifacts, 'commands.log'), logs.join('\n'));
  if (!options.allowFailure) assert.equal(result.status, 0, output || String(result.error));
  return { status: result.status, output };
}
const composeArgs = ['compose', '-p', project, '-f', join(backend, 'compose.prod.yml')];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
async function port() {
  const server = createServer();
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return String(value);
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (started) {
    run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
    compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
    for (const resource of ['container', 'network', 'volume']) {
      const args = resource === 'container' ? ['ps', '-a'] : [resource, 'ls'];
      assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']).output.trim(), '');
    }
    for (const value of [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT]) {
      assert.equal(run('lsof', ['-nP', `-iTCP:${value}`, '-sTCP:LISTEN'], { allowFailure: true }).output.trim(), '');
    }
    console.log('PASS cleanup: zero owned containers, networks, volumes or listening servers');
  }
  rmSync(fixture, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  run('git', ['clone', '--no-checkout', 'https://github.com/0Hoag/agent-ops.git', backend]);
  run('git', ['-C', backend, 'checkout', '--detach', pin]);
  cpSync(root, client, { recursive: true, filter: (path) => !['node_modules', '.git', '.agent-runs', 'dist'].some((name) => path === join(root, name)) });
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  writeFileSync(join(artifacts, 'sources.json'), JSON.stringify({ client: run('git', ['rev-parse', 'HEAD']).output.trim(), api: pin, project, ports: [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT] }, null, 2));
  const files = run('git', ['ls-files', '-co', '--exclude-standard', '-z']).output.split('\0').filter(Boolean);
  writeFileSync(join(artifacts, 'source-hashes.json'), JSON.stringify(Object.fromEntries(files.map((path) => [path, hash(readFileSync(join(root, path)))])), null, 2));
  run('git', ['diff', '--binary', 'HEAD']);
  started = true;
  compose('up', '-d', '--build', '--wait');
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  const request = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    assert(response.ok, `${path}: HTTP ${response.status} ${await response.clone().text()}`);
    logs.push(`POST ${path}: ${response.status}`);
    return response.json();
  };
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const org = await request('organizations', { name: 'Product E2E' }, login.token);
  const selected = await request('auth/select-organization', { organization_id: org.data.id }, login.token);
  const repo = await request('repositories', { provider: 'github', full_name: 'product/e2e', webhook_secret: randomBytes(24).toString('hex') }, selected.token);
  await request('agent-run-prices', { model: 'qa-model', effective_date: '2020-01-01T00:00:00Z', input_per_million: 1, output_per_million: 0, cached_input_per_million: 0, cache_write_per_million: 0, reasoning_per_million: 0 }, selected.token);
  const runData = await request('agent-runs', { repository_id: repo.data.id, model: 'qa-model', harness: 'Claude', branch: 'feat/qa', session_id: 'qa-session', wave: 'QA batch', worker: 'QA agent', started_at: new Date(Date.now() - 7200000).toISOString(), ended_at: new Date().toISOString(), input_tokens: 1846116, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, reasoning_tokens: 0 }, selected.token);
  env.W18_RUN = runData.data.id;
  env.W18_REPOSITORY = repo.data.id;
  // Persisted fixture records, not intercepted HTTP responses. Only this fresh DB.
  run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: `
    INSERT INTO issues (id, repository_id, number, title, state, status) VALUES ('14800000-0000-4000-8000-000000000001', '${repo.data.id}', 148, 'Verify accessible product flows', 'open', 'todo');
    INSERT INTO agent_run_steps (id, run_id, sequence, started_at, input_tokens, tool_name, cache_hit, cumulative_cost_usd) VALUES ('14800000-0000-4000-8000-000000000002', '${runData.data.id}', 1, NOW(), 1846116, 'Read', true, 1.846116);
  ` });
  function test(label, allowFailure = false) {
    logs.push(`STAGE ${label}`);
    env.PRODUCT_E2E_ARTIFACTS = join(artifacts, label);
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    return run('node', ['scripts/qa-w18-browser.mjs'], { allowFailure });
  }
  test('baseline');
  if (process.argv.includes('--control')) {
    const path = join(client, 'src/modules/settings/SettingsPage.tsx');
    const original = readFileSync(path, 'utf8');
    assert(original.includes('role="tablist"'));
    const broken = original.replace('role="tablist"', 'role="navigation"');
    writeFileSync(join(artifacts, 'mutation.json'), JSON.stringify({ path: 'src/modules/settings/SettingsPage.tsx', original: hash(original), broken: hash(broken), mutation: 'Remove required tablist parent from Settings tabs' }, null, 2));
    try {
      writeFileSync(path, broken);
      compose('up', '-d', '--build', '--wait', 'client');
      const result = test('broken', true);
      assert.equal(result.status, 1);
      assert.match(result.output, /aria-required-parent/);
    } finally { writeFileSync(path, original); }
    assert.equal(hash(readFileSync(path)), hash(original));
    compose('up', '-d', '--build', '--wait', 'client');
    test('restored');
  }
  console.log(`PASS W18 QA; ${artifacts}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cleanup();
}
