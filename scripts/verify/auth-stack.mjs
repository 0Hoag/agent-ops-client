import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { seed } from './auth-fixture.mjs';
import { settingsProfile } from './settings-fixture.mjs';

const root = process.cwd();
const backend = '/Users/zeross/agent-ops';
const settings = process.argv[2] === 'settings';
const evidence = settings ? 'W19p-settings-190' : 'W19n-browser-auth-188';
const dir = resolve(`.agent-runs/${evidence}`, String(Date.now()));
mkdirSync(dir, { recursive: true });
const project = `${settings ? 'w19p-settings-190' : 'w19n-auth-188'}-${process.pid}`;
const env = { ...process.env, CLIENT_DIR: root, POSTGRES_USER: 'agent_ops', POSTGRES_DB: 'agent_ops', SCM_REPOSITORIES_JSON: '[]', POSTGRES_PASSWORD: randomBytes(24).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex'), AGENT_RUN_TOKEN: randomBytes(24).toString('hex'), PRODUCT_E2E_EMAIL: 'auth-188@example.invalid', PRODUCT_E2E_PASSWORD: randomBytes(24).toString('hex') };
const secrets = ['POSTGRES_PASSWORD', 'JWT_SECRET', 'REPOSITORY_ENCRYPTION_KEY', 'AGENT_RUN_TOKEN', 'PRODUCT_E2E_PASSWORD'];
const logs = [];
const redact = (text) => secrets.reduce((value, key) => value.replaceAll(env[key], '<redacted>'), text).replace(/access_token=[^\s"&]+/g, 'access_token=<redacted>');
function record(text) { logs.push(redact(text)); writeFileSync(`${dir}/commands.log`, logs.join('\n')); console.log(redact(text)); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 900000, ...options });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  record(`$ ${command} ${args.join(' ')}\n${output}\nexit=${result.status}`);
  if (!options.allowFailure) assert.equal(result.status, 0, output || String(result.error));
  return { status: result.status, output };
}
const composeArgs = ['compose', '-p', project, '-f', `${backend}/compose.prod.yml`];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
let profile;
async function port() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const value = server.address().port;
  await new Promise((done) => server.close(done));
  return String(value);
}
let started = false;
let cleaned = false;
function archive() {
  const destination = `/Users/zeross/agent-ops-client/.agent-runs/${evidence}/${dir.split('/').at(-1)}`;
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(dir, destination, { recursive: true });
  console.log(`Evidence archived: ${destination}`);
}
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  let error;
  try {
    archive(); // Preserve ignored evidence before any owned stack resources are removed.
    if (started) {
      run('docker', [...composeArgs, 'logs', '--no-color'], { allowFailure: true });
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
      for (const resource of ['container', 'network', 'volume']) {
        const args = resource === 'container' ? ['ps', '-a'] : [resource, 'ls'];
        assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']).output.trim(), '');
      }
      record(`PASS cleanup ${project}: zero owned containers, networks and volumes`);
    }
  } catch (failure) { error = failure; record(`FAIL cleanup: ${failure.stack}`); }
  finally { await profile?.close(); archive(); }
  if (error) throw error;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { try { await cleanup(); } finally { process.exit(1); } });
try {
  run('docker', ['version', '--format', '{{.Server.Version}}']);
  env.PRODUCTION_API_PORT = await port();
  env.PRODUCTION_CLIENT_PORT = await port();
  env.POSTGRES_HOST_PORT = await port();
  env.PRODUCT_E2E_URL = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  env.CORS_ORIGINS = env.PRODUCT_E2E_URL;
  if (settings) profile = await settingsProfile({ env, dir, port, composeArgs, compose, record, run });
  const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', 'src', 'scripts/verify', 'docker', 'Dockerfile', 'pnpm-lock.yaml', 'rspack.config.ts', 'package.json']).output.split('\0').filter(Boolean);
  const hashes = Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
  writeFileSync(`${dir}/sources.json`, JSON.stringify({ client: run('git', ['rev-parse', 'HEAD']).output.trim(), clientStatus: run('git', ['status', '--short']).output.trim(), api: run('git', ['-C', backend, 'rev-parse', 'HEAD']).output.trim(), hashes, project, url: env.PRODUCT_E2E_URL, ports: [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT] }, null, 2));
  started = true;
  compose('up', '-d', '--build', '--wait');
  run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', env.PRODUCT_E2E_EMAIL], { input: `${env.PRODUCT_E2E_PASSWORD}\n` });
  await seed(env, compose, record);
  if (profile) await profile.seed();
  const browser = (phase, allowFailure = false) => {
    profile?.reset();
    env.PRODUCT_E2E_ARTIFACTS = `${dir}/${phase}`;
    mkdirSync(env.PRODUCT_E2E_ARTIFACTS, { recursive: true });
    const result = run('node', [`scripts/verify/${settings ? 'settings' : 'auth'}-browser.mjs`], { allowFailure });
    if (result.status === 0) profile?.verify();
    return result;
  };
  browser('production');
  const disposable = `${dir}/mutation-source`;
  for (const path of run('git', ['ls-files', '-z']).output.split('\0').filter(Boolean)) {
    mkdirSync(dirname(`${disposable}/${path}`), { recursive: true });
    cpSync(`${root}/${path}`, `${disposable}/${path}`);
  }
  const router = `${disposable}/${settings ? 'src/modules/settings/components/AgentSetupCommand.tsx' : 'src/app/router.tsx'}`;
  const original = readFileSync(router, 'utf8');
  const target = settings ? 'navigator.clipboard.writeText(command)' : 'location.pathname + location.search + location.hash';
  assert(original.includes(target), 'Mutation target must exist');
  writeFileSync(router, original.replace(target, settings ? "navigator.clipboard.writeText('broken-command')" : 'location.pathname'));
  env.CLIENT_DIR = disposable;
  compose('up', '-d', '--build', '--no-deps', '--wait', 'client');
  const control = browser('mutation', true);
  assert.equal(control.status, 1, 'Compiled mutation must fail');
  const assertion = settings ? 'SETTINGS_CLIPBOARD_EXACT_COMMAND' : 'AUTH_DEEP_LINK_FULL_DESTINATION';
  assert(control.output.includes(assertion), `Control must fail at ${assertion}`);
  record(`PASS deliberate compiled mutation rejected by ${assertion} with identical browser inputs`);
  // Restore the disposable source and recompile. The database, fixture and browser command stay identical.
  writeFileSync(router, original);
  compose('up', '-d', '--build', '--no-deps', '--wait', 'client');
  browser('restored');
  record(`PASS ${settings ? 'Settings' : 'authentication/navigation'} production + failing control + restored production`);
} catch (error) { record(`FAIL ${error.stack}`); process.exitCode = 1; }
finally { await cleanup(); }
