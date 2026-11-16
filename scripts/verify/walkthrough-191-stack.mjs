// Owns only this synthetic project. Existing fixture/lifecycle helpers remain read-only.
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { seed } from './auth-fixture.mjs';

const backend = '/Users/zeross/agent-ops';
const dir = resolve('.agent-runs/W21c-walkthrough-191', `${Date.now()}-isolated`);
const archive = `/Users/zeross/agent-ops-client/.agent-runs/W21c-walkthrough-191/${dir.split('/').at(-1)}`;
mkdirSync(dir, { recursive: true });
const project = `w21c-walkthrough-191-${process.pid}`;
const env = { ...process.env, CLIENT_DIR: process.cwd(), POSTGRES_USER: 'agent_ops', POSTGRES_DB: 'agent_ops', SCM_REPOSITORIES_JSON: '[]', PRODUCT_E2E_EMAIL: 'walkthrough-191@example.invalid', PRODUCT_E2E_ARTIFACTS: dir };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
for (const key of secrets) env[key] = randomBytes(key === 'REPOSITORY_ENCRYPTION_KEY' ? 16 : 32).toString('hex');
const logs = [];
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text);
function record(text) {
  logs.push(redact(text));
  writeFileSync(`${dir}/commands.log`, logs.join('\n'));
  console.log(redact(text));
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 900000, ...options });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  record(`$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  if (result.status !== 0 && !options.allowFailure) throw new Error(`${command}: exit=${result.status} ${result.error || output}`);
  return output.trim();
}
const args = ['compose', '-p', project, '-f', `${backend}/compose.prod.yml`];
const compose = (...rest) => run('docker', [...args, ...rest]);
async function port() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return String(value);
}
let started = false;
let cleaned = false;
function archiveEvidence() { mkdirSync(archive, { recursive: true }); cpSync(dir, archive, { recursive: true }); }
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  archiveEvidence();
  try {
    if (started) {
      run('docker', [...args, 'logs', '--no-color'], { allowFailure: true });
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
    }
    for (const kind of ['container', 'network', 'volume']) {
      const list = kind === 'container' ? ['ps', '-a'] : [kind, 'ls'];
      if (run('docker', [...list, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}'])) throw new Error(`Owned ${kind} survivors`);
    }
    record(`PASS cleanup ${project}: zero owned containers, networks and volumes`);
  } finally { archiveEvidence(); }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  run('docker', ['version', '--format', '{{.Server.Version}}']);
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  env.CORS_ORIGINS = env.PRODUCT_E2E_URL;
  writeFileSync(`${dir}/sources.json`, JSON.stringify({ project, ports: [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT], client: run('git', ['rev-parse', 'HEAD']), api: run('git', ['-C', backend, 'rev-parse', 'HEAD']), status: run('git', ['status', '--short']) }, null, 2));
  started = true;
  compose('up', '-d', '--build', '--wait');
  run('docker', [...args, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  await seed(env, compose, record);
  const [fixture] = JSON.parse(env.AUTH_FIXTURE);
  const request = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}`, 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN }, body: JSON.stringify(body) });
    record(`POST ${path}: HTTP ${response.status}`);
    if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
    return response.json();
  };
  const login = await request('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  const selected = await request('auth/select-organization', { organization_id: fixture.org }, login.token);
  const price = await request('agent-run-prices', { model: 'walkthrough-priced', effective_date: '2020-01-01T00:00:00Z', input_per_million: 3, output_per_million: 15, cached_input_per_million: 0.3, cache_write_per_million: 3.75, reasoning_per_million: 15 }, selected.token);
  writeFileSync(`${dir}/price-http.json`, JSON.stringify(price, null, 2));
  for (const day of [1, 2, 8, 9]) {
    await request('agent-runs', { repository_id: fixture.repo, model: 'walkthrough-priced', harness: 'Synthetic tool', wave: 'W21 walkthrough', worker: 'Synthetic agent', branch: `walkthrough-${day}`, session_id: `walkthrough-${day}`, pr_number: day, issue_numbers: [188], started_at: new Date(Date.now() - day * 86400000 - 7200000).toISOString(), ended_at: new Date(Date.now() - day * 86400000 - 3600000).toISOString(), input_tokens: 1000000, cached_input_tokens: day < 7 ? 500000 : 100000, output_tokens: 100000 }, selected.token);
  }
  const sql = `
INSERT INTO pull_requests (id, repository_id, number, title, state, head_sha, branch, closes, merged_at, created_at, updated_at)
SELECT gen_random_uuid(), '${fixture.repo}', n, 'Synthetic delivery ' || n, CASE WHEN n = 2 THEN 'open' ELSE 'merged' END, md5(n::text), 'walkthrough-' || n, '[188]'::jsonb, CASE WHEN n <> 2 THEN NOW() - n * INTERVAL '1 day' END, NOW() - INTERVAL '14 days', NOW() - n * INTERVAL '1 day' FROM unnest(ARRAY[1,2,8,9]) n;
INSERT INTO pipeline_runs (id, repository_id, external_id, pr_number, sha, status, conclusion, started_at, finished_at)
SELECT gen_random_uuid(), '${fixture.repo}', 'walkthrough-ci-' || n, 2, md5(n::text), 'completed', 'failure', NOW() - n * INTERVAL '1 hour', NOW() - n * INTERVAL '1 hour' + INTERVAL '10 minutes' FROM generate_series(1,3) n;
SELECT json_build_object('table','agent_runs','rows',json_agg(r)) FROM (SELECT model, session_id, pr_number, input_tokens, cached_input_tokens, output_tokens, cost_usd, started_at, ended_at FROM agent_runs WHERE repository_id='${fixture.repo}' ORDER BY started_at) r;
SELECT json_build_object('table','pull_requests','rows',json_agg(r)) FROM (SELECT number,state,closes,merged_at FROM pull_requests WHERE repository_id='${fixture.repo}' ORDER BY number) r;
SELECT number,title,state,status FROM issues WHERE repository_id='${fixture.repo}';
SELECT pr_number,conclusion,count(*) FROM pipeline_runs WHERE repository_id='${fixture.repo}' GROUP BY pr_number,conclusion;
`;
  writeFileSync(`${dir}/fixture.sql`, sql);
  writeFileSync(`${dir}/persisted.txt`, run('docker', [...args, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: sql }));
  writeFileSync(`${dir}/fixture.json`, JSON.stringify({ project, fixture, scope: 'Synthetic local organizations A/B; A has 5 runs, 4 MRs, 1 issue, 3 failed pipeline attempts; B isolation control only. No upstream reconciliation.' }, null, 2));
  run('node', ['scripts/verify/walkthrough-191-browser.mjs']);
} catch (error) { record(`FAIL ${error.stack}`); process.exitCode = 1; }
finally { cleanup(); }
