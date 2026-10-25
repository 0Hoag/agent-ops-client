import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const root = process.cwd();
const fixture = resolve('.agent-runs/login-acceptance-api');
const artifacts = resolve('artifacts/auth-session');
const project = `client-login-${process.pid}`;
const ports = [18739, 18740, 18741]; // API, client, Postgres: owned, loopback-only.
const api = `http://127.0.0.1:${ports[0]}`;
const client = `http://127.0.0.1:${ports[1]}`;
const pin = 'c1231ada2102caea0144a0281167094731b78f17';
const env = { ...process.env, JWT_SECRET: randomBytes(32).toString('hex'), SMOKE_API_PORT: String(ports[0]), SMOKE_CLIENT_PORT: String(ports[1]), POSTGRES_HOST_PORT: String(ports[2]), POSTGRES_PUBLISH: '127.0.0.1', APP_API_URL: api };
mkdirSync(artifacts, { recursive: true });
const log = [];
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 600000, ...options });
  log.push(`$ ${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}\nexit=${result.status}`);
  assert.equal(result.status, 0, log.at(-1));
  return result.stdout.trim();
}
assert.equal(run('git', ['-C', fixture, 'rev-parse', 'HEAD']), pin);
assert.equal(run('git', ['-C', fixture, 'status', '--porcelain', '--untracked-files=no']), '');
for (const port of ports) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  assert.equal(result.stdout, '', `Port ${port} already owned by another process`);
}
const override = resolve('.agent-runs/auth-compose.yaml');
writeFileSync(override, 'services:\n  api:\n    environment:\n      JWT_EXPIRATION: 30s\n');
const composeArgs = ['compose', '-p', project, '-f', resolve(fixture, 'docker-compose.yml'), '-f', override];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
let preview;
let browser;
let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    await browser?.close();
  } finally {
    try {
      if (preview && preview.exitCode === null) {
        const exited = once(preview, 'exit');
        process.kill(-preview.pid, 'SIGTERM');
        await exited;
      }
    } finally {
      try { compose('logs', '--no-color'); }
      finally { compose('down', '--volumes', '--remove-orphans'); }
    }
  }
  const containers = run('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']);
  const volumes = run('docker', ['volume', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.Name}}']);
  assert.equal(containers, '');
  assert.equal(volumes, '');
  for (const port of ports) {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    assert.equal(result.stdout, '', `Listener remains on ${port}`);
  }
  assert.equal(run('git', ['-C', fixture, 'status', '--porcelain', '--untracked-files=no']), '');
  log.push(`CLEANUP PASS: ${project}: zero containers, volumes, listeners on ${ports.join(', ')}.`);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { cleanup().finally(() => process.exit(1)); });
const waitFor = async (url) => {
  for (let count = 0; count < 120; count++) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`Timed out: ${url}`);
};
const network = [];
try {
  compose('up', '-d', '--build', 'postgres', 'api');
  await waitFor(`${api}/readyz`);
  run('docker', [...composeArgs, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO accounts (id,email,password_hash) VALUES ('d0000000-0000-4000-8000-000000000005','login@example.test',crypt('acceptance-password',gen_salt('bf',12)));
INSERT INTO repositories (id,provider,full_name,webhook_secret_env_ref) VALUES ('d0000000-0000-4000-8000-000000000001','github','login/acceptance','SMOKE_WEBHOOK_SECRET');
INSERT INTO issues (id,repository_id,number,title,state,status,labels) VALUES ('d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001',99001,'Login acceptance: real API board issue','open','review','["status:review"]');
INSERT INTO pull_requests (id,repository_id,number,title,state,head_sha,branch,closes) VALUES ('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001',99002,'Login acceptance linked PR','open','d000000000000000000000000000000000000000','login/acceptance','[99001]');
INSERT INTO pipeline_runs (id,repository_id,external_id,pr_number,sha,status,conclusion) VALUES ('d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','login-ci-99002',99002,'d000000000000000000000000000000000000000','completed','success');
` });
  run('pnpm', ['build']);
  preview = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(ports[1])], { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const previewLog = createWriteStream(resolve('.agent-runs/auth-preview.txt'));
  preview.stdout.pipe(previewLog); preview.stderr.pipe(previewLog);
  await waitFor(`${client}/board`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', async (response) => {
    if (!response.url().startsWith(api) || response.url().includes('/events')) return;
    const request = response.request();
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (body?.token) body.token = '<redacted>';
    network.push({ method: request.method(), url: response.url(), status: response.status(), authorization: request.headers().authorization ? 'Bearer <redacted>' : null, body });
  });
  const heading = () => page.getByRole('heading', { name: 'Sign in', exact: true });
  for (const path of ['/board?view=review#issue', '/runs', '/insights']) {
    await page.goto(`${client}${path}`);
    await heading().waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
  }
  await page.goto(`${client}/board?view=review#issue`);
  await heading().waitFor();
  await page.getByLabel('Email').fill('login@example.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('agent-ops-token')), null);
  await page.getByLabel('Password').fill('acceptance-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Issue board' }).waitFor();
  assert.equal(page.url(), `${client}/board?view=review#issue`);
  await page.getByLabel('Repository', { exact: true }).selectOption('d0000000-0000-4000-8000-000000000001');
  await page.getByText('Login acceptance: real API board issue', { exact: true }).waitFor();
  await page.getByText('CI login-ci-99002: Passed', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(artifacts, 'board.png'), fullPage: true });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await heading().waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('agent-ops-token')), null);
  await page.goto(`${client}/board`);
  await heading().waitFor();
  await page.getByLabel('Email').fill('login@example.test');
  await page.getByLabel('Password').fill('acceptance-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Issue board' }).waitFor();
  // Let the genuine API-issued JWT expire; never inject credentials or bypass guards.
  const expires = await page.evaluate(() => JSON.parse(atob(sessionStorage.getItem('agent-ops-token').split('.')[1])).exp);
  await new Promise((done) => setTimeout(done, Math.max(0, expires * 1000 - Date.now() + 1500)));
  const expiryStart = network.length;
  await page.getByRole('link', { name: 'Runs', exact: true }).click();
  await heading().waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('agent-ops-token')), null);
  assert(network.slice(expiryStart).every((entry) => entry.url.endsWith('/auth/session')),
    'Expired navigation must not mount or fetch the destination data');
  await page.screenshot({ path: resolve(artifacts, 'expired.png'), fullPage: true });
  await page.getByLabel('Email').fill('login@example.test');
  await page.getByLabel('Password').fill('acceptance-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(`${client}/runs`);
  await page.getByRole('heading', { name: 'Agent runs', exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  assert(network.some((entry) => entry.url.includes('/auth/login') && entry.status === 401));
  assert(network.some((entry) => entry.url.includes('/auth/session') && entry.status === 401 && entry.authorization));
  assert(network.some((entry) => entry.url.includes('/board?') && entry.status === 200 && entry.authorization));
  writeFileSync(resolve(artifacts, 'network.json'), JSON.stringify(network, null, 2) + '\n');
  log.push('BROWSER PASS: public denial board/runs/insights; failed login; real login/session/Bearer; full destination; seeded issue/PR/CI; logout; natural JWT expiry/session 401; redirect and re-login to /runs; zero page errors.');
} finally {
  try { await cleanup(); } finally {
    writeFileSync(resolve(artifacts, 'browser.txt'), log.join('\n').replaceAll(root, '<worktree>').replace(/[ \t]+$/gm, '').trimEnd() + '\n');
  }
}
console.log(log.at(-1));
