import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

// Run from the client root through the shared heavy wrapper, like product-e2e.mjs.
const pin = 'bbc16354bb04ea6ad3fc5c84acc723c7eccfdab6';
const root = process.cwd();
const evidence = resolve('.agent-runs/178/browser');
mkdirSync(evidence, { recursive: true });
const fixture = mkdtempSync(join(tmpdir(), 'member-identities-'));
const backend = join(fixture, 'backend');
const client = join(fixture, 'client');
const project = `members-178-${process.pid}`;
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
const results = { api: pin, viewports: [] };
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
    const email = `${name}.members178@example.test`;
    run('docker', [...composeArgs, 'exec', '-T', 'api', '/bootstrap-account', '--email', email], { input: `${password}\n` });
    const login = await request('auth/login', 'POST', { email, password });
    const session = await request('auth/session', 'GET', undefined, login.token);
    identities.push({ email, token: login.token, id: session.account_id });
  }
  const [owner, alice, bob] = identities;
  const org = (await request('organizations', 'POST', { name: 'Members identity acceptance' }, owner.token)).data.id;
  const token = (await request('auth/select-organization', 'POST', { organization_id: org }, owner.token)).token;
  const path = `organizations/${org}/members`;
  const invite = async (person) => {
    const invitation = await request(`organizations/${org}/invitations`, 'POST', { role: 'member' }, token);
    await request('organization-invitations/accept', 'POST', { token: invitation.data.token }, person.token);
  };
  await invite(alice);
  await invite(bob);
  const populated = await request(path, 'GET', undefined, token);
  assert.deepEqual(populated.data.map((member) => member.email).sort(), identities.map((person) => person.email).sort());
  writeFileSync(join(evidence, 'members.json'), JSON.stringify(populated, null, 2));
  const axeResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js');
  assert(axeResponse.ok, 'axe-core download failed');
  const axe = await axeResponse.text();
  browser = await chromium.launch({ headless: true });
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    const page = await context.newPage();
    await page.addInitScript((value) => sessionStorage.setItem('agent-ops-token', value), token);
    await page.goto(`${base}/members`);
    for (const person of identities) await page.getByText(person.email, { exact: true }).waitFor();
    const mutations = [];
    page.on('request', (req) => { if (['PATCH', 'DELETE'].includes(req.method())) mutations.push({ method: req.method(), url: req.url(), body: req.postData() }); });
    for (const [person, role] of [[alice, 'viewer'], [bob, 'admin']]) {
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith(`${path}/${person.id}`) && response.ok()),
        page.getByRole('combobox', { name: `Role for ${person.email}`, exact: true }).selectOption(role),
      ]);
      assert(mutations.some((req) => req.method === 'PATCH' && req.url.endsWith(`${path}/${person.id}`) && JSON.parse(req.body).role === role));
    }
    const actual = await request(path, 'GET', undefined, token);
    assert.equal(actual.data.find((member) => member.account_id === alice.id).role, 'viewer');
    assert.equal(actual.data.find((member) => member.account_id === bob.id).role, 'admin');
    await page.addScriptTag({ content: axe });
    const accessibility = await page.evaluate(() => window.axe.run(document));
    const serious = accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const text = await page.locator('body').innerText();
    for (const person of identities) assert(!text.includes(person.id), 'Displayed UUID');
    await page.screenshot({ path: join(evidence, `members-${width}.png`), fullPage: true });
    writeFileSync(join(evidence, `axe-${width}.json`), JSON.stringify(accessibility, null, 2));
    // Remove each person separately and verify the remaining real membership.
    for (const person of [alice, bob]) {
      await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().endsWith(`${path}/${person.id}`) && response.ok()),
        page.getByRole('button', { name: `Remove ${person.email}`, exact: true }).click(),
      ]);
      assert(mutations.some((req) => req.method === 'DELETE' && req.url.endsWith(`${path}/${person.id}`)));
      const remaining = await request(path, 'GET', undefined, token);
      assert(!remaining.data.some((member) => member.account_id === person.id));
      assert(remaining.data.some((member) => member.account_id === owner.id));
    }
    results.viewports.push({ width, seriousCritical: serious.map(({ id }) => id), overflow, correctRoleAndRemoveTargets: true, mutations });
    writeFileSync(join(evidence, 'results.json'), JSON.stringify(results, null, 2));
    await context.close();
    // Restore the populated state for the second independent viewport.
    await invite(alice);
    await invite(bob);
  }
  assert(results.viewports.every((result) => !result.overflow && result.seriousCritical.length === 0), 'Viewport overflow or serious/critical axe violations; see results.json');
  console.log('PASS: real populated API #500 Compose/Chromium at 1280/390; distinct emails, correct role/remove IDs, no UUIDs, no overflow, zero serious/critical axe');
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
