// Run the entire lifecycle through /Users/zeross/agent-ops/scripts/heavy.sh.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backend = '/Users/zeross/agent-ops';
const archive = '/Users/zeross/agent-ops-client/.agent-runs/W18R10-userflows-185';
const artifacts = resolve(`.agent-runs/W18R10-userflows-185/${Date.now()}`);
const project = `w18r10-185-${process.pid}`;
mkdirSync(artifacts, { recursive: true });
for (const file of ['review-185.mjs', 'review-185-browser.mjs']) cpSync(`${root}/scripts/${file}`, `${artifacts}/${file}`);
const env = { ...process.env, CLIENT_DIR: root, W185_PROJECT: project, W185_BACKEND: backend,
  PRODUCT_E2E_EMAIL: 'userflows-185@example.invalid', W185_TIME: new Date().toISOString() };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
for (const key of secrets) env[key] = randomBytes(key === 'REPOSITORY_ENCRYPTION_KEY' ? 16 : 32).toString('hex');
const logs = [];
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 1200000, ...options });
  const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (!options.private) {
    logs.push(`$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
    writeFileSync(`${artifacts}/commands.log`, logs.join('\n')); console.log(logs.at(-1));
  }
  if (!options.allowFailure) assert.equal(result.status, 0, options.private ? 'Private database snapshot command failed' : output || String(result.error));
  return output.trim();
}
const composeArgs = ['compose', '-p', project, '-f', `${backend}/compose.prod.yml`];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
const sql = (input) => run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1', '-At'], { input });
async function port() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const value = server.address().port;
  await new Promise((done) => server.close(done)); return String(value);
}
let started = false;
let cleaned = false;
function archiveEvidence() {
  mkdirSync(archive, { recursive: true });
  cpSync(artifacts, `${archive}/${artifacts.split('/').at(-1)}`, { recursive: true });
}
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    archiveEvidence();
    if (started) {
      run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
      for (const resource of ['container', 'network', 'volume']) {
        const args = resource === 'container' ? ['ps', '-a'] : [resource, 'ls'];
        assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']), '');
      }
      logs.push(`PASS cleanup ${project}: zero owned containers, networks and volumes`);
      writeFileSync(`${artifacts}/commands.log`, logs.join('\n'));
    }
  } finally { archiveEvidence(); }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { try { cleanup(); } finally { process.exit(1); } });
try {
  env.PRODUCTION_API_PORT = await port(); env.PRODUCTION_CLIENT_PORT = await port(); env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  writeFileSync(`${artifacts}/sources.json`, JSON.stringify({ client: run('git', ['rev-parse', 'HEAD']), api: run('git', ['-C', backend, 'rev-parse', 'HEAD']), apiStatus: run('git', ['-C', backend, 'status', '--short']), project, url: env.PRODUCT_E2E_URL, time: env.W185_TIME }, null, 2));
  started = true; compose('up', '-d', '--build', '--wait');
  writeFileSync(`${artifacts}/schema.txt`, sql("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_name IN ('repositories','pull_requests') ORDER BY table_name,ordinal_position;"));
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  const post = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    assert(response.ok, `${path}: ${response.status} ${await response.clone().text()}`); return response.json();
  };
  const login = await post('auth/login', { email: env.PRODUCT_E2E_EMAIL, password: env.PRODUCT_E2E_PASSWORD });
  env.W185_ORG = (await post('organizations', { name: 'Userflows 185 A' }, login.token)).data.id;
  env.W185_OTHER = (await post('organizations', { name: 'Userflows 185 B' }, login.token)).data.id;
  const snapshot = run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'pg_dump', '-U', 'agent_ops', '--clean', '--if-exists', 'agent_ops'], { private: true });
  const mutations = [
    ['first-run.empty-checklist', 'src/modules/overview/Checklist.tsx', 'steps.filter((step) => step.complete).length', '3'],
    ['cost.top-mr', 'src/modules/usage/Evidence.tsx', 'b.cost! - a.cost!', 'a.cost! - b.cost!'],
    ['attention.gitlab-link', 'src/modules/work/page.tsx', 'href={workUrl}', 'href="https://wrong.example.invalid/merge_requests/999"'],
    ['persistence.sign-in', 'src/modules/auth/services/auth.ts', 'sessionStorage.removeItem(tokenKey);', "sessionStorage.removeItem(tokenKey); localStorage.removeItem('agent-ops-repository');"],
  ];
  const disposable = `${artifacts}/mutant-source`;
  const originals = new Map(mutations.map(([, path]) => [path, readFileSync(`${root}/${path}`, 'utf8')]));
  for (const path of run('git', ['ls-files', '-z']).split('\0').filter(Boolean)) {
    mkdirSync(dirname(`${disposable}/${path}`), { recursive: true }); cpSync(`${root}/${path}`, `${disposable}/${path}`);
  }
  for (const [name, path, before, after] of mutations) {
    const source = readFileSync(`${disposable}/${path}`, 'utf8');
    assert.equal(source.split(before).length, 2, `${name}: unique mutation anchor`);
    writeFileSync(`${disposable}/${path}`, source.replace(before, after));
  }
  writeFileSync(`${artifacts}/mutations.json`, JSON.stringify(mutations, null, 2));
  const results = {};
  for (const mode of ['production-before', 'mutant', 'production-restored']) {
    env.CLIENT_DIR = mode === 'mutant' ? disposable : root;
    if (mode !== 'production-before') compose('up', '-d', '--build', '--wait', 'client');
    sql(snapshot);
    env.PRODUCT_E2E_ARTIFACTS = `${artifacts}/${mode}`; mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    run('node', ['scripts/review-185-browser.mjs', '--setup']);
    const fixture = JSON.parse(readFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/fixture.json`, 'utf8'));
    env.W185_REPOSITORY = fixture.repository;
    const seed = `INSERT INTO pull_requests (id,repository_id,number,title,state,head_sha,branch,closes,created_at,updated_at)
      SELECT gen_random_uuid(),'${fixture.repository}',n,'Userflows MR '||n,'open',md5(n::text),'feat/userflows-'||n,'[10]'::jsonb,NOW(),NOW() FROM generate_series(1,2) n;
      INSERT INTO issues (id,repository_id,number,title,state,status) VALUES (gen_random_uuid(),'${fixture.repository}',10,'Userflows linked issue','open','todo');
      INSERT INTO pipeline_runs (id,repository_id,external_id,pr_number,sha,status,conclusion,started_at,finished_at)
      VALUES (gen_random_uuid(),'${fixture.repository}','userflows-ci',1,md5('1'),'completed','failure',NOW()-INTERVAL '1 hour',NOW());
      SELECT row_to_json(t) FROM (SELECT repository_id,pr_number,model,cost_usd,input_tokens,issue_numbers FROM agent_runs ORDER BY pr_number) t;`;
    writeFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/seed.sql`, seed);
    writeFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/sql.jsonl`, sql(seed));
    run('node', ['scripts/review-185-browser.mjs', '--flows']);
    results[mode] = JSON.parse(readFileSync(`${env.PRODUCT_E2E_ARTIFACTS}/checks.json`, 'utf8'));
  }
  writeFileSync(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  const inputs = readFileSync(`${artifacts}/production-before/inputs.json`, 'utf8');
  for (const mode of ['mutant', 'production-restored']) assert.equal(readFileSync(`${artifacts}/${mode}/inputs.json`, 'utf8'), inputs, `${mode}: identical semantic HTTP inputs (generated repository UUID normalized)`);
  for (const [name] of mutations) {
    assert.equal(results.mutant.find((check) => check.name === name)?.pass, false, `${name}: mutant must fail intended assertion`);
    assert.equal(results['production-restored'].find((check) => check.name === name)?.pass, true, `${name}: restored must pass intended assertion`);
    const path = mutations.find((item) => item[0] === name)[1];
    assert.equal(readFileSync(`${root}/${path}`, 'utf8'), originals.get(path), `${name}: production source unchanged`);
  }
  rmSync(disposable, { recursive: true });
  assert(results['production-restored'].every((check) => check.pass), 'Real matrix has failures; see checks.json. No acceptance claimed.');
} catch (error) {
  logs.push(`FAIL ${redact(error.stack ?? String(error))}`); console.error(logs.at(-1));
  writeFileSync(`${artifacts}/commands.log`, logs.join('\n')); process.exitCode = 1;
} finally { cleanup(); }
