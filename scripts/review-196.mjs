// Run through /Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-196.mjs.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backend = '/Users/zeross/agent-ops';
const baselineRevision = '75107c1b1b3fc014d496b0d079104345c392d08a';
const artifacts = resolve('.agent-runs/196-browser');
const afterOnly = process.argv.includes('--after-only');
const suffix = afterOnly ? '-after' : '';
mkdirSync(artifacts, { recursive: true });
if (existsSync(`${artifacts}/failure.txt`)) unlinkSync(`${artifacts}/failure.txt`);
const project = `review-196-${process.pid}`;
const env = { ...process.env, CLIENT_DIR: root, PRODUCT_E2E_EMAIL: 'review-196@example.invalid', PRODUCT_E2E_ORG: 'Review 196' };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
for (const key of secrets) env[key] = randomBytes(key === 'REPOSITORY_ENCRYPTION_KEY' ? 16 : 32).toString('hex');
const logs = [];
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text);
function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = redact(`${result.stdout || ''}${result.stderr || ''}`);
  logs.push(`$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  writeFileSync(`${artifacts}/commands${suffix}.log`, logs.join('\n'));
  if (!options.allowFailure) assert.equal(result.status, 0, output || String(result.error));
  return { status: result.status, output: output.trim() };
}
const composeArgs = ['compose', '-p', project, '-f', `${backend}/compose.prod.yml`];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
async function port() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return String(value);
}
let started = false;
let cleaned = false;
function cleanup() {
  if (!started || cleaned) return;
  cleaned = true;
  run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
  compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
  for (const kind of ['container', 'network', 'volume']) {
    const args = kind === 'container' ? ['ps', '-a'] : [kind, 'ls'];
    assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']).output, '');
  }
  writeFileSync(`${artifacts}/cleanup${suffix}.json`, JSON.stringify({ project, containers: 0, networks: 0, volumes: 0 }, null, 2));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  if (!afterOnly) {
    const baseline = `${artifacts}/baseline-source`;
    mkdirSync(baseline, { recursive: true });
    const archive = spawnSync('git', ['archive', baselineRevision], { cwd: root, maxBuffer: 100 * 1024 * 1024 });
    assert.equal(archive.status, 0);
    run('tar', ['-x', '-C', baseline], { input: archive.stdout });
    env.CLIENT_DIR = baseline;
  }
  writeFileSync(`${artifacts}/sources${suffix}.json`, JSON.stringify({ baselineRevision, client: run('git', ['rev-parse', 'HEAD']).output, status: run('git', ['status', '--short']).output, diff: run('git', ['diff', '--', 'src']).output, api: run('git', ['-C', backend, 'rev-parse', 'HEAD']).output, apiStatus: run('git', ['-C', backend, 'status', '--short']).output, project, url: env.PRODUCT_E2E_URL }, null, 2));
  started = true;
  compose('up', '-d', '--build', '--wait');
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  const seed = [];
  async function request(path, body, token) {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const text = await response.text();
    seed.push({ path, status: response.status, ...(!path.startsWith('auth/') ? { body: text } : {}) });
    writeFileSync(`${artifacts}/seed-responses${suffix}.json`, JSON.stringify(seed, null, 2));
    assert(response.ok, `${path}: ${response.status} ${redact(text)}`);
    return JSON.parse(text);
  }
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const org = await request('organizations', { name: env.PRODUCT_E2E_ORG }, login.token);
  const selected = await request('auth/select-organization', { organization_id: org.data.id }, login.token);
  const repository = await request('repositories', { provider: 'github', full_name: 'review-196/disposable', webhook_secret: randomBytes(24).toString('hex') }, selected.token);
  await request('waves', { name: 'Review 196 batch', brief: 'Disposable UI verification only. Do not launch workers.', state: 'todo' }, selected.token);
  await request('budgets', { repository_id: repository.data.id, wave: 'Review 196 batch', starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z', token_limit: 100000, usd_limit: 25 }, selected.token);
  await request('alerts/channels', { kind: 'slack', enabled: false, slack_webhook_url_env_ref: 'REVIEW_196_UNCONFIGURED_SLACK' }, selected.token);
  const checks = afterOnly ? JSON.parse(readFileSync(`${artifacts}/checks.json`, 'utf8')).filter((check) => check.phase === 'before') : [];
  for (const phase of afterOnly ? ['after'] : process.argv.includes('--baseline-only') ? ['before'] : ['before', 'after']) {
    if (phase === 'after' && !afterOnly) { env.CLIENT_DIR = root; compose('up', '-d', '--build', '--wait', 'client'); }
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/${phase}`;
    env.REVIEW_196_PHASE = phase;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    run('node', ['scripts/review-196-browser.mjs']);
    for (const rule of ['advanced-links', 'budget-id-filter']) {
      const result = run('node', ['scripts/review-183-check.mjs', env.PRODUCT_E2E_ARTIFACTS, rule], { allowFailure: true });
      checks.push({ phase, rule, ...result });
      writeFileSync(`${artifacts}/checks.json`, JSON.stringify(checks, null, 2));
    }
  }
  for (const check of checks) assert.equal(check.status, check.phase === 'before' ? 1 : 0, `${check.phase} ${check.rule}`);
  if (!process.argv.includes('--baseline-only')) {
    const actions = JSON.parse(readFileSync(`${artifacts}/after/actions.json`, 'utf8'));
    assert.deepEqual(actions.filter((action) => action.failure), [], 'All safe control exercise groups completed');
    assert.equal(actions.filter((action) => action.completed).length, 4);
  }
  console.log(process.argv.includes('--baseline-only') ? 'PASS pinned baseline fails both rules.' : 'PASS pinned baseline fails both rules; working source passes both rules.');
} catch (error) {
  writeFileSync(`${artifacts}/failure.txt`, redact(error.stack || String(error)));
  console.error(error);
  process.exitCode = 1;
} finally { cleanup(); }
