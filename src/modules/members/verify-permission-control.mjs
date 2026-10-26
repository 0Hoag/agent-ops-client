import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, '../../..');
const sourcePath = path.join(root, 'src/modules/members/MembersPage.tsx');
const mutation = "const canManage = role === 'owner' || role === 'admin';";
const temp = await mkdtemp(path.join(os.tmpdir(), 'members-permission-control-'));
const copy = path.join(temp, 'client');
const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: true });
let report = '';
const record = (text) => { report += `${text}\n`; console.log(text); };
record('$ node src/modules/members/verify-permission-control.mjs (repository root)');

function command(bin, args, cwd) {
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  record(`$ ${bin} ${args.join(' ')} (cwd: isolated copy)\n${output.trimEnd()}\nexit ${result.status}`);
  if (result.status !== 0) throw new Error(`${bin} ${args.join(' ')} failed (${result.status}):\n${output}`);
  return output;
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function assertPortClosed(port) {
  const socket = net.connect(port, '127.0.0.1');
  const connected = await new Promise((resolve) => socket.once('connect', () => resolve(true)).once('error', () => resolve(false)));
  socket.destroy();
  assert.equal(connected, false, `owned listener remained on ${port}`);
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}

function descendants(pid) {
  const output = spawnSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' }).stdout;
  const parents = new Map();
  for (const line of output.trim().split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    parents.set(parent, [...(parents.get(parent) ?? []), child]);
  }
  const found = [];
  const visit = (parent) => { for (const child of parents.get(parent) ?? []) { found.push(child); visit(child); } };
  visit(pid);
  return found;
}

async function scenario(expectFailure) {
  const port = await freePort();
  const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { cwd: copy, detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverOutput = '';
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });
  let browser;
  let browserServer;
  let browserPid;
  let result;
  try {
    let ready = false;
    for (let i = 0; i < 80; i += 1) {
      try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) { ready = true; break; } } catch {}
      await delay(250);
    }
    assert(ready, `production preview did not start: ${serverOutput}`);
    browserServer = await chromium.launchServer({ headless: true });
    browserPid = browserServer.process().pid;
    browser = await chromium.connect(browserServer.wsEndpoint());
    const page = await browser.newPage();
    await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'viewer-token'));
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const auth = request.headers().authorization;
      assert.equal(auth, 'Bearer viewer-token', 'stub identity must come from actual bearer');
      const url = new URL(request.url());
      if (url.pathname.endsWith('/auth/session')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'viewer@example.test', account_id: 'viewer-1', organization_id: 'org-1' }) });
      if (url.pathname.endsWith('/organizations')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'org-1', name: 'Organization 1' }] }) });
      if (url.pathname.endsWith('/organizations/org-1/members')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'membership-viewer', organization_id: 'org-1', account_id: 'viewer-1', role: 'viewer' }, { id: 'membership-peer', organization_id: 'org-1', account_id: 'peer-1', role: 'member' }] }) });
      throw new Error(`unexpected API request ${request.method()} ${url.pathname}`);
    });
    await page.goto(`http://127.0.0.1:${port}/members`);
    await page.getByText('peer-1').waitFor();
    // This is deliberately the same user-facing assertion for baseline and mutant builds.
    const inviteVisible = await page.getByRole('button', { name: 'Create invitation link' }).count();
    const check = spawnSync(process.execPath, ['-e', "const assert=require('node:assert/strict'); assert.equal(process.argv[1], '0', 'viewer must not create invitations')", String(inviteVisible)], { encoding: 'utf8' });
    result = { status: check.status, output: `${check.stdout}${check.stderr}`, inviteVisible };
    if (!expectFailure) assert.equal(result.status, 0, result.output);
    else {
      assert.notEqual(result.status, 0, 'mutated permission unexpectedly passed');
      assert.match(result.output, /AssertionError \[ERR_ASSERTION\]: viewer must not create invitations/);
      assert.doesNotMatch(result.output, /ERR_MODULE_NOT_FOUND|Build failed|Timeout|timed out/);
    }
  } finally {
    try { await browser?.close(); } catch {}
    try { await browserServer?.close(); } catch {}
    if (server.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch {}
      await delay(300);
      try { process.kill(-server.pid, 'SIGKILL'); } catch {}
    }
    await delay(150);
    if (browserPid) {
      assert.equal(processAlive(browserPid), false, 'owned browser process survived cleanup');
      assert.deepEqual(descendants(browserPid), [], 'owned browser descendants survived cleanup');
    }
    if (server.pid) {
      try { process.kill(-server.pid, 0); assert.fail('owned preview process group survived cleanup'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      assert.deepEqual(descendants(server.pid), [], 'owned preview descendants survived cleanup');
    }
    await assertPortClosed(port);
    assert.equal(processAlive(sentinel.pid), true, 'unrelated sentinel did not survive scenario');
  }
  record(`${expectFailure ? 'MUTANT' : 'BASELINE'}: assertion exit=${result.status}, invitation buttons=${result.inviteVisible}; browser and preview process/listener absent after cleanup; sentinel pid ${sentinel.pid} survives.`);
  if (expectFailure) record(result.output.trim());
  return result;
}

try {
  const original = await readFile(sourcePath);
  const originalHash = digest(original);
  await cp(root, copy, { recursive: true, filter: (source) => !['.git', 'node_modules', 'dist', '.agent-runs'].includes(path.basename(source)) });
  record(`COPY: ${copy}; isolated files copied without repository metadata or build output.`);
  command('pnpm', ['install', '--frozen-lockfile'], copy);
  await writeFile(path.join(copy, 'src/modules/members/verify-permission-control.mjs'), await readFile(fileURLToPath(import.meta.url)));
  command('pnpm', ['build'], copy);
  await scenario(false);

  const copiedSource = path.join(copy, 'src/modules/members/MembersPage.tsx');
  const beforeMutation = await readFile(copiedSource);
  assert.equal(digest(beforeMutation), originalHash, 'production copy did not start byte-identical');
  const text = beforeMutation.toString();
  assert.equal(text.split(mutation).length - 1, 1, 'actual canManage decision not uniquely found');
  await writeFile(copiedSource, text.replace(mutation, 'const canManage = true;'));
  assert.notEqual(digest(await readFile(copiedSource)), originalHash);
  command('pnpm', ['build'], copy);
  await scenario(true);

  await writeFile(copiedSource, original);
  const restoredHash = digest(await readFile(copiedSource));
  assert.equal(restoredHash, originalHash, 'restored canManage bytes differ from source');
  command('pnpm', ['build'], copy);
  await scenario(false);
  record(`RESTORE: source SHA-256 ${originalHash}; restored production-copy SHA-256 ${restoredHash}; identical.`);
  record('STUB SCOPE: browser API stubs cover GET /auth/session, GET /organizations, and GET /organizations/org-1/members only; bearer identity is asserted. No live API/auth server is exercised. Payloads use the response structures consumed by the generated client, including the shared data envelope for members, and membership fields consumed by the module.');
  await writeFile(path.join(root, 'artifacts/members/permission-control-result.txt'), report);
} finally {
  try { process.kill(-sentinel.pid, 'SIGTERM'); } catch {}
  await delay(100);
  try { process.kill(-sentinel.pid, 'SIGKILL'); } catch {}
  await rm(temp, { recursive: true, force: true });
}
