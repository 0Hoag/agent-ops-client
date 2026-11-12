// Real API-backed review. Run the entire lifecycle through scripts/heavy.sh.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backend = '/Users/zeross/agent-ops';
const baselineRevision = '6bf1525350b9976432d04ed259a4b0b2c791ac14';
const artifacts = resolve('.agent-runs/W18R8-browser-183');
mkdirSync(artifacts, { recursive: true });
const project = `w18r8-183-${process.pid}`;
const env = { ...process.env, CLIENT_DIR: root, POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex'), AGENT_RUN_TOKEN: randomBytes(24).toString('hex'), PRODUCT_E2E_EMAIL: 'review-183@example.invalid', PRODUCT_E2E_PASSWORD: randomBytes(24).toString('hex'), PRODUCT_E2E_ARTIFACTS: artifacts };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
const logs = [];
let started = false;
let stage = 'preflight';
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text);
function save() { writeFileSync(`${artifacts}/commands.log`, logs.join('\n')); }
function run(command, args, options = {}) {
  console.log(`STAGE ${stage}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = redact(`${result.stdout || ''}${result.stderr || ''}`);
  logs.push(`STAGE ${stage}\n$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  save();
  if (!options.allowFailure) assert.equal(result.status, options.expectedStatus ?? 0, output || String(result.error));
  return output.trim();
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
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  stage = 'cleanup';
  if (!started) return;
  run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
  compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
  for (const resource of ['container', 'network', 'volume']) {
    const args = resource === 'container' ? ['ps', '-a'] : [resource, 'ls'];
    assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']), '');
  }
  logs.push(`PASS cleanup ${project}: zero owned containers, networks and volumes`);
  save();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  if (process.argv.includes('--compare')) {
    const baseline = `${artifacts}/baseline-source`;
    for (const path of run('git', ['ls-files', '-z']).split('\0').filter(Boolean)) {
      mkdirSync(dirname(`${baseline}/${path}`), { recursive: true });
      cpSync(`${root}/${path}`, `${baseline}/${path}`);
    }
    for (const path of ['src/modules/budgets/services/client.ts', 'src/modules/pricing/PricingPage.tsx']) {
      writeFileSync(`${baseline}/${path}`, run('git', ['show', `${baselineRevision}:${path}`]) + '\n');
    }
    env.CLIENT_DIR = baseline;
    env.W18_ASSERT_FIXES = '1';
  }
  writeFileSync(`${artifacts}/sources.json`, JSON.stringify({ client: run('git', ['rev-parse', 'HEAD']), api: run('git', ['-C', backend, 'rev-parse', 'HEAD']), apiStatus: run('git', ['-C', backend, 'status', '--short']), project, url: env.PRODUCT_E2E_URL }, null, 2));
  stage = 'compose-up';
  started = true;
  compose('up', '-d', '--build', '--wait');
  stage = 'bootstrap';
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  const request = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    logs.push(`POST ${path}: HTTP ${response.status}`); save();
    assert(response.ok, `${path}: HTTP ${response.status} ${redact(await response.clone().text())}`);
    return response.json();
  };
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const org = await request('organizations', { name: 'Review 183' }, login.token);
  const selected = await request('auth/select-organization', { organization_id: org.data.id }, login.token);
  const repo = await request('repositories', { provider: 'github', full_name: 'review-183/hosting', webhook_secret: randomBytes(24).toString('hex') }, selected.token);
  env.W18_REPOSITORY = repo.data.id;
  stage = 'seed';
  await request('agent-run-prices', { model: 'review-priced', effective_date: '2020-01-01T00:00:00Z', input_per_million: 3, output_per_million: 15, cached_input_per_million: 0.3, cache_write_per_million: 3.75, reasoning_per_million: 15 }, selected.token);
  const runs = [];
  for (let day = 0; day < 10; day++) {
    for (const priced of [true, false]) {
      const data = await request('agent-runs', { repository_id: repo.data.id, model: priced ? 'review-priced' : 'review-unpriced', harness: 'Claude', branch: `feat/hosting-${day}`, session_id: `review-${day}-${priced}`, wave: 'Hosting improvements', worker: 'Hosting agent', pr_number: day + 1, issue_numbers: [day + 1], started_at: new Date(Date.now() - day * 86400000 - 7200000).toISOString(), ended_at: new Date(Date.now() - day * 86400000 - 3600000).toISOString(), input_tokens: 1800000, cached_input_tokens: 1200000, cache_write_tokens: 10000, output_tokens: 20000, reasoning_tokens: 1000 }, selected.token);
      runs.push(data.data.id);
    }
  }
  env.W18_RUN = runs[0];
  const sql = `
    INSERT INTO pull_requests (id, repository_id, number, title, state, head_sha, branch, closes, merged_at, created_at, updated_at)
    SELECT gen_random_uuid(), '${repo.data.id}', n, 'Improve hosting deployment ' || n,
      CASE WHEN n % 3 = 0 THEN 'merged' WHEN n % 3 = 1 THEN 'open' ELSE 'closed' END,
      md5(n::text), 'feat/hosting-' || n, jsonb_build_array(n), CASE WHEN n % 3 = 0 THEN NOW() - (n % 10) * INTERVAL '1 day' END,
      NOW() - INTERVAL '14 days', NOW() - (n % 10) * INTERVAL '1 day' FROM generate_series(1, 320) n;
    INSERT INTO issues (id, repository_id, number, title, state, status)
    SELECT gen_random_uuid(), '${repo.data.id}', n, 'Hosting reliability task ' || n, 'open', 'todo' FROM generate_series(1, 40) n;
    INSERT INTO pipeline_runs (id, repository_id, external_id, pr_number, sha, status, conclusion, started_at, finished_at)
    SELECT gen_random_uuid(), '${repo.data.id}', 'review-ci-' || n, n, md5(n::text), 'completed', CASE WHEN n % 4 = 0 THEN 'failure' ELSE 'success' END, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour' FROM generate_series(1, 320) n;
    INSERT INTO agent_run_steps (id, run_id, sequence, started_at, input_tokens, tool_name, cache_hit, cumulative_cost_usd)
    VALUES (gen_random_uuid(), '${runs[0]}', 1, NOW() - INTERVAL '2 hours', 1800000, 'Read', true, 2.6475);
    SELECT 'pull_requests', count(*) FROM pull_requests UNION ALL SELECT 'issues', count(*) FROM issues UNION ALL SELECT 'agent_runs', count(*) FROM agent_runs;
  `;
  writeFileSync(`${artifacts}/seed.sql`, sql);
  run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: sql });
  stage = 'browser';
  if (process.argv.includes('--compare')) {
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/before`;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    const before = run('node', ['scripts/review-183-browser.mjs'], { expectedStatus: 1 });
    assert.match(before, /Budgets regression: expected empty state, not a blank page/);
    stage = 'build-fixed-client-same-database';
    env.CLIENT_DIR = root;
    compose('up', '-d', '--build', '--wait', 'client');
    stage = 'browser-fixed-same-database';
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/after`;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
  }
  run('node', ['scripts/review-183-browser.mjs']);
  console.log('PASS real-browser review');
} catch (error) {
  logs.push(`FAIL stage=${stage}: ${redact(error.stack || String(error))}`); save();
  console.error(logs.at(-1));
  process.exitCode = 1;
} finally { cleanup(); }
