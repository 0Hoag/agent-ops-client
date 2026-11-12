import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

// Adapted from #178 verify-identities.mjs; exercises development controls, not identity acceptance.
const pin = 'bbc16354bb04ea6ad3fc5c84acc723c7eccfdab6';
const root = process.cwd();
const evidence = resolve('.agent-runs/181/browser');
mkdirSync(evidence, { recursive: true });
const fixture = mkdtempSync(join(tmpdir(), 'bodyless-181-'));
const backend = join(fixture, 'backend');
const client = join(fixture, 'client');
const project = `bodyless-181-${process.pid}`;
const password = randomBytes(24).toString('hex');
const env = { ...process.env, CLIENT_DIR: client, POSTGRES_PASSWORD: password, JWT_SECRET: randomBytes(32).toString('hex'), REPOSITORY_ENCRYPTION_KEY: randomBytes(16).toString('hex') };
const log = [];
const redact = (text) => [password, env.JWT_SECRET, env.REPOSITORY_ENCRYPTION_KEY].reduce((result, secret) => result.replaceAll(secret, '<redacted>'), text);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 900000, ...options });
  log.push(`$ ${command} ${args.join(' ')}\n${redact(`${result.stdout || ''}${result.stderr || ''}`)}\nexit=${result.status}`);
  writeFileSync(join(evidence, 'runner.txt'), log.join('\n'));
  assert.equal(result.status, 0, log.at(-1));
  return result.stdout;
}
const composeArgs = ['compose', '-p', project, '-f', join(backend, 'compose.prod.yml')];
const compose = (...args) => run('docker', [...composeArgs, ...args]);
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => server.listen(0, '127.0.0.1', done).once('error', reject));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return String(port);
}
let started = false;
let browser;
const results = { api: pin, project, viewports: [] };
try {
  run('git', ['clone', '--no-checkout', 'https://github.com/0Hoag/agent-ops.git', backend]);
  run('git', ['-C', backend, 'checkout', '--detach', pin]);
  assert.equal(run('git', ['-C', backend, 'rev-parse', 'HEAD']).trim(), pin);
  cpSync(root, client, { recursive: true, filter: (path) => !['node_modules', '.git', '.agent-runs', 'dist'].some((name) => path === join(root, name)) });
  env.PRODUCTION_API_PORT = await freePort();
  env.PRODUCTION_CLIENT_PORT = await freePort();
  env.POSTGRES_HOST_PORT = await freePort();
  started = true;
  compose('up', '-d', '--build', '--wait');
  const api = `http://127.0.0.1:${env.PRODUCTION_API_PORT}/api/v1`;
  const base = `http://127.0.0.1:${env.PRODUCTION_CLIENT_PORT}`;
  async function request(path, method, body, token) {
    const response = await fetch(`${api}/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
    return response.json();
  }
  const identities = [];
  for (const name of ['owner', 'alice', 'bob']) {
    const email = `${name}.bodyless181@example.test`;
    run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', email], { input: `${password}\n` });
    const login = await request('auth/login', 'POST', { email, password });
    const session = await request('auth/session', 'GET', undefined, login.token);
    identities.push({ token: login.token, id: session.account_id });
  }
  const [owner, alice, bob] = identities;
  const org = (await request('organizations', 'POST', { name: 'Bodyless transport acceptance' }, owner.token)).data.id;
  const token = (await request('auth/select-organization', 'POST', { organization_id: org }, owner.token)).token;
  const path = `organizations/${org}/members`;
  const invite = async (person) => {
    const invitation = await request(`organizations/${org}/invitations`, 'POST', { role: 'member' }, token);
    await request('organization-invitations/accept', 'POST', { token: invitation.data.token }, person.token);
  };
  await invite(alice);
  await invite(bob);
  browser = await chromium.launch({ headless: true });
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    const page = await context.newPage();
    await page.addInitScript((value) => sessionStorage.setItem('agent-ops-token', value), token);
    await page.goto(`${base}/members`);
    for (const person of identities) await page.getByRole('cell', { name: person.id, exact: true }).waitFor();
    const mutations = [];
    page.on('response', (response) => { if (['PATCH', 'DELETE'].includes(response.request().method())) mutations.push({ method: response.request().method(), url: response.url(), status: response.status() }); });
    for (const [person, role] of [[alice, 'viewer'], [bob, 'admin']]) {
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'GET' && response.url().endsWith(path) && response.ok()),
        page.getByRole('combobox', { name: `Role for ${person.id}`, exact: true }).selectOption(role),
      ]);
      const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: person.id, exact: true }) });
      await row.getByRole('cell', { name: role, exact: true }).waitFor();
      assert.equal(await page.getByText('Unable to update membership.', { exact: true }).count(), 0);
      const actual = await request(path, 'GET', undefined, token);
      assert.equal(actual.data.find((member) => member.account_id === person.id).role, role);
    }
    await page.screenshot({ path: join(evidence, `roles-${width}.png`), fullPage: true });
    for (const person of [alice, bob]) {
      const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: person.id, exact: true }) });
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'GET' && response.url().endsWith(path) && response.ok()),
        row.getByRole('button', { name: 'Remove', exact: true }).click(),
      ]);
      await page.getByRole('cell', { name: person.id, exact: true }).waitFor({ state: 'detached' });
      assert.equal(await page.getByText('Unable to update membership.', { exact: true }).count(), 0);
      const remaining = await request(path, 'GET', undefined, token);
      assert(!remaining.data.some((member) => member.account_id === person.id));
      assert(remaining.data.some((member) => member.account_id === owner.id));
    }
    assert.deepEqual(mutations.map(({ method, status }) => [method, status]), [['PATCH', 204], ['PATCH', 204], ['DELETE', 204], ['DELETE', 204]]);
    await page.screenshot({ path: join(evidence, `removed-${width}.png`), fullPage: true });
    results.viewports.push({ width, roleAndRemoveRefreshed: true, falseMembershipErrors: 0, mutations });
    writeFileSync(join(evidence, 'results.json'), JSON.stringify(results, null, 2));
    await context.close();
    if (width === 1280) { await invite(alice); await invite(bob); }
  }
  console.log('PASS: populated Compose/Chromium 1280/390; PATCH/DELETE 204, roles/removals refresh, no false membership errors. Identity acceptance excluded.');
} catch (error) {
  log.push(`FAIL ${redact(error.stack || String(error))}`);
  console.error(log.at(-1));
  process.exitCode = 1;
} finally {
  await browser?.close();
  try {
    if (started) {
      compose('down', '--volumes', '--remove-orphans', '--rmi', 'local');
      for (const [resource, format] of [['ps', '{{.ID}}'], ['network', '{{.ID}}'], ['volume', '{{.Name}}']]) {
        const args = resource === 'ps' ? ['ps', '-a'] : [resource, 'ls'];
        assert.equal(run('docker', [...args, '--filter', `label=com.docker.compose.project=${project}`, '--format', format]).trim(), '');
      }
      for (const port of [env.PRODUCTION_API_PORT, env.PRODUCTION_CLIENT_PORT, env.POSTGRES_HOST_PORT]) {
        const socket = connect(Number(port), '127.0.0.1');
        const listening = await new Promise((done) => socket.once('connect', () => done(true)).once('error', () => done(false)));
        socket.destroy();
        assert(!listening, `Owned listener remains: ${port}`);
      }
      log.push(`PASS cleanup ${project}: zero containers, networks, volumes, listeners`);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    writeFileSync(join(evidence, 'runner.txt'), log.join('\n'));
  }
}
