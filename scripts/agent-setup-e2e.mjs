// Reuses product-e2e/review-183's isolated Compose/bootstrap lifecycle.
// Run the entire lifecycle with /Users/zeross/agent-ops/scripts/heavy.sh.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const artifacts = resolve('.agent-runs/W18-agent-setup-194');
const fixture = join(artifacts, 'fixture');
const backend = join(fixture, 'api');
const client = join(fixture, 'client');
const project = `setup-194-${process.pid}-${randomBytes(4).toString('hex')}`;
mkdirSync(fixture, { recursive: true });
const env = { ...process.env, CLIENT_DIR: client, POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex'), AGENT_RUN_TOKEN: randomBytes(24).toString('hex'), PRODUCT_E2E_EMAIL: 'setup-194@example.invalid', PRODUCT_E2E_PASSWORD: randomBytes(24).toString('hex'), GOMAXPROCS: '2' };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
const logs = [];
let started = false;
let stage = 'preflight';
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text);
function run(command, args, options = {}) {
  console.log(`STAGE ${stage}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = redact(`${result.stdout || ''}${result.stderr || ''}`);
  logs.push(`STAGE ${stage}\n$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  writeFileSync(join(artifacts, 'commands.log'), logs.join('\n'));
  assert.equal(result.status, options.expectedStatus ?? 0, output || String(result.error));
  return output.trim();
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
function browser(label, expectedStatus = 0) {
  stage = label;
  env.PRODUCT_E2E_ARTIFACTS = join(artifacts, label);
  return run('node', ['scripts/agent-setup-browser.mjs'], { expectedStatus });
}
try {
  run('git', ['clone', '--shared', '--no-checkout', '/Users/zeross/agent-ops', backend]);
  const pin = run('git', ['-C', '/Users/zeross/agent-ops', 'rev-parse', 'HEAD']);
  run('git', ['-C', backend, 'checkout', '--detach', pin]);
  mkdirSync(client, { recursive: true });
  for (const name of readdirSync(root).filter((name) => !['node_modules', '.git', '.agent-runs', 'dist'].includes(name))) {
    cpSync(join(root, name), join(client, name), { recursive: true });
  }
  const settings = join(client, 'src/modules/settings/SettingsPage.tsx');
  const fixed = readFileSync(settings, 'utf8');
  const baseline = run('git', ['show', '6bf1525350b9976432d04ed259a4b0b2c791ac14:src/modules/settings/SettingsPage.tsx']);
  writeFileSync(settings, baseline);
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  writeFileSync(join(artifacts, 'sources.json'), JSON.stringify({ api: pin, client: run('git', ['rev-parse', 'HEAD']), project, ports: [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT], baselineSettings: hash(baseline), fixedSettings: hash(fixed), browserScript: hash(readFileSync('scripts/agent-setup-browser.mjs')) }, null, 2));
  stage = 'compose-up'; started = true;
  compose('up', '-d', '--build', '--wait');
  stage = 'bootstrap';
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  const api = `http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1`;
  const request = async (path, body, token) => {
    const response = await fetch(`${api}/${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert(response.ok, `${path}: HTTP ${response.status} ${redact(await response.clone().text())}`);
    return response.json();
  };
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const org = await request('organizations', { name: 'Setup 194' }, login.token);
  const selected = await request('auth/select-organization', { organization_id: org.data.id }, login.token);
  const repo = await request('repositories', { provider: 'github', full_name: 'setup-194/disposable', webhook_secret: randomBytes(24).toString('hex') }, selected.token);
  env.SETUP_REPOSITORY = repo.data.id;
  env.SETUP_TRANSCRIPT = join(fixture, "disposable session's transcript.jsonl");
  writeFileSync(env.SETUP_TRANSCRIPT, JSON.stringify({ type: 'turn.completed', session_id: 'setup-194-disposable', timestamp: new Date().toISOString(), model: 'setup-disposable-model', usage: { input_tokens: 10, output_tokens: 5 } }) + '\n');
  const control = browser('before', 1);
  assert.match(control, /Setup must not offer a masked nonfunctional command/);
  stage = 'restore-fixed-client-same-database';
  writeFileSync(settings, fixed);
  compose('up', '-d', '--build', '--wait', 'client');
  browser('after');
  stage = 'supported-cli-ingestion';
  run('go', ['build', '-o', join(fixture, 'agentops'), './cmd/agentops'], { cwd: join(backend, 'api') });
  env.PATH = `${fixture}:${env.PATH}`;
  const command = readFileSync(join(artifacts, 'after/command.txt'), 'utf8');
  // Guard must stop before the CLI; then the identical copied command ingests.
  run('bash', ['-c', command], { env: { ...env, AGENT_RUN_TOKEN: '' }, expectedStatus: 127 });
  run('bash', ['-c', command]);
  const runs = await request(`agent-runs?repository_id=${repo.data.id}`, null, selected.token);
  writeFileSync(join(artifacts, 'ingested-runs.json'), JSON.stringify(runs, null, 2));
  assert.match(JSON.stringify(runs), /setup-194-disposable/);
  assert.match(JSON.stringify(runs), /setup-disposable-model/);
  console.log('PASS identical-input failing control, real desktop/mobile setup and copied CLI ingestion');
} catch (error) {
  logs.push(`FAIL stage=${stage}: ${redact(error.stack || String(error))}`);
  console.error(logs.at(-1)); process.exitCode = 1;
} finally {
  stage = 'cleanup';
  try {
    if (started) {
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
      for (const resource of ['container', 'network', 'volume']) {
        const args = resource === 'container' ? ['ps', '-a'] : [resource, 'ls'];
        assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']), '');
      }
      logs.push(`PASS cleanup ${project}: zero owned containers, networks and volumes`);
    }
    rmSync(fixture, { recursive: true, force: true });
  } catch (error) { logs.push(`FAIL cleanup: ${error.stack}`); process.exitCode = 1; }
  writeFileSync(join(artifacts, 'commands.log'), logs.join('\n'));
}
