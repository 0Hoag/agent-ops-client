import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 18763;
const base = `http://127.0.0.1:${port}`;
mkdirSync('artifacts/organization-switch', { recursive: true });
const built = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', built.replace('<head>', '<head><base href="/">'));
const sentinel = spawn('sleep', ['60'], { detached: true, stdio: 'ignore' });
sentinel.unref();
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { detached: true, stdio: 'ignore' });
let browser;
let cleaned = false;
let scenarioError;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { await browser?.close(); }
  finally {
    if (server.exitCode === null && server.pid) {
      const exited = once(server, 'exit').catch(() => undefined);
      try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ }
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
      try { process.kill(-server.pid, 'SIGKILL'); } catch { /* process group exited */ }
      await exited;
    }
  }
  const portCheck = spawn('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: ['ignore', 'pipe', 'ignore'] });
  let listeners = '';
  for await (const chunk of portCheck.stdout) listeners += chunk;
  const [code] = await once(portCheck, 'exit');
  assert.equal(code, 1, `owned preview listener remains after ${scenarioError ? 'failure' : 'success'} cleanup: ${listeners}`);
  if (server.pid) {
    try { process.kill(-server.pid, 0); assert.fail(`owned process group ${server.pid} remains after cleanup`); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  const processTree = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set([server.pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of processTree) if (owned.has(parent) && !owned.has(pid)) { owned.add(pid); changed = true; }
  }
  assert.deepEqual([...owned].filter((pid) => pid !== server.pid), [], 'owned preview descendants remain');
  assert.doesNotThrow(() => process.kill(sentinel.pid, 0), 'unrelated sentinel was terminated');
  console.log(`CLEANUP PASS (${scenarioError ? 'forced-failure' : 'success'}): preview listener absent; owned process group and all descendants absent; unrelated sentinel preserved`);
  try { process.kill(-sentinel.pid, 'SIGTERM'); } catch { /* sentinel already exited */ }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { cleanup().finally(() => process.exit(1)); });
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/board`)).ok) break; } catch { /* preview startup */ }
    if (attempt === 59) throw new Error('Preview server did not start');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const beforeListeners = new Set(execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').slice(1));
  const page = await context.newPage();
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
        const repository = new URL(String(url)).searchParams.get('repository_id');
        if (repository === 'a-repo') window.__delayedTenantASubscription = this;
      }
    };
  });
  await context.addInitScript(() => { if (!sessionStorage.getItem('agent-ops-token')) sessionStorage.setItem('agent-ops-token', 'tenant-a'); });
  page.on('console', (message) => console.log(`BROWSER console ${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => console.error(`BROWSER pageerror: ${error.stack}`));
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) console.log(`API request ${request.method()} ${request.url()} auth=${request.headers().authorization ?? '<none>'}`); });
  page.on('response', (response) => { if (response.url().includes('/api/v1/')) console.log(`API response ${response.status()} ${response.url()}`); });
  const requests = [];
  let releaseDelayedA;
  const delayedA = new Promise((resolve) => { releaseDelayedA = resolve; });
  let delayedRequestSeen = false;
  let delayedSubscription;
  let delayTenantA = false;
  let selectionIssued = false;
  const records = { 'org-a': 'A-only', 'org-b': 'B-only' };
  const insightValues = { 'org-a': 17, 'org-b': 83 };
  const organizations = [{ id: 'org-a', name: 'Organization A' }, { id: 'org-b', name: 'Organization B' }];
  const repositories = { 'org-a': [{ id: 'a-repo', provider: 'github', full_name: 'org-a/repo-a' }], 'org-b': [{ id: 'b-repo', provider: 'github', full_name: 'org-b/repo-b' }] };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/api/v1/')) return route.continue();
    const auth = route.request().headers().authorization;
    requests.push({ url: url.href, auth });
    if (selectionIssued && url.pathname.endsWith('/auth/session') && auth !== 'Bearer tenant-b') console.error('CONTROL DIAGNOSTIC: explicit bearer preservation assertion: selected-token validation must use Bearer tenant-b');
    assert(['Bearer tenant-a', 'Bearer tenant-b'].includes(auth), `reject invalid/missing fixture auth: ${auth ?? '<missing>'}`);
    const org = auth === 'Bearer tenant-b' ? 'org-b' : 'org-a';
    if (url.pathname.endsWith('/board/ws')) return route.abort();
    if (delayTenantA && url.pathname.endsWith('/board') && org === 'org-a' && url.searchParams.get('repository_id') === 'a-repo' && !delayedRequestSeen) {
      delayedRequestSeen = true;
      await delayedA;
    }
    let body = {};
    if (url.pathname.endsWith('/auth/session')) body = { email: 'fixture@example.test', account_id: `account-${org}`, organization_id: org };
    else if (url.pathname.endsWith('/organizations')) body = { data: organizations };
    else if (url.pathname.endsWith('/repositories')) body = { data: repositories[org], meta: { page: 1, per_page: 100, total: 1 } };
    else if (url.pathname.endsWith('/board')) body = { data: [{ id: `record-${org}`, title: `${records[org]}-only board record`, number: 1, state: 'open', status: 'review', repository_id: org === 'org-a' ? 'a-repo' : 'b-repo', labels: [], assignee: '', pull_requests: [] }], meta: { page: 1, per_page: 100, total: 1 } };
    else if (url.pathname.endsWith('/agent-runs/aggregate')) body = { status: 200, data: [{ wave: records[org], worker: 'fixture', runs: 1, input_tokens: 1, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 1, reasoning_tokens: 0, cost_usd: 0 }] };
    else if (url.pathname.endsWith('/insights')) body = { data: { repository_id: url.searchParams.get('repository_id'), history: { complete: true }, send_back: { count: insightValues[org], numerator: insightValues[org], denominator: 100, rate: insightValues[org] / 100, evidence: [] }, first_ci_success: { rate: 0, eligible: 0, successful: 0, evidence: [] }, cycle_time: { completed: 0, median_seconds: 0, evidence: [] }, suggestions: [] } };
    else if (url.pathname.endsWith('/auth/select-organization')) { selectionIssued = true; body = { token: 'tenant-b' }; }
    console.log(`API stub ${url.pathname} -> ${JSON.stringify(body)}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/board`);
  await page.getByRole('heading', { name: 'Issue board' }).waitFor();
  await page.getByLabel('Repository').selectOption('a-repo');
  await page.getByText(`${records['org-a']}-only board record`).waitFor();
  await page.waitForFunction(() => window.__delayedTenantASubscription !== undefined);
  await page.evaluate(() => {
    const socket = window.__delayedTenantASubscription;
    Object.defineProperty(socket, 'readyState', { configurable: true, value: WebSocket.OPEN });
    socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'board.invalidate', repository_id: 'a-repo' }) }));
  });
  await page.screenshot({ path: 'artifacts/organization-switch/a.png', fullPage: true });
  delayTenantA = true;
  await page.getByLabel('Repository').selectOption('');
  await page.getByLabel('Repository').selectOption('a-repo');
  await page.getByLabel('Organization').selectOption('org-b');
  try { await page.waitForFunction(() => sessionStorage.getItem('agent-ops-token') === 'tenant-b', { timeout: 5000 }); }
  catch {
    if (selectionIssued && requests.some((request) => request.url.includes('/auth/session') && request.auth !== 'Bearer tenant-b')) throw new Error('CONTROL ASSERTION: explicit bearer preservation assertion: selected-token validation used the active tenant token');
    throw new Error('organization switch did not activate tenant B');
  }
  await page.evaluate(() => {
    const socket = window.__delayedTenantASubscription;
    Object.defineProperty(socket, 'readyState', { configurable: true, value: WebSocket.OPEN });
    socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'board.invalidate', repository_id: 'a-repo' }) }));
  });
  await page.waitForTimeout(150);
  assert.equal(await page.getByText(`${records['org-a']}-only board record`).count(), 0, 'delayed tenant-A subscription callback must not render A data after B activation');
  try { await page.waitForFunction(() => document.querySelector('select[aria-label="Repository"] option[value="b-repo"]') !== null, { timeout: 5000 }); }
  catch {
    if (await page.getByText(`${records['org-a']}-only board record`).count()) throw new Error('CONTROL ASSERTION: stale tenant data assertion: A-only board record rendered after B activation');
    throw new Error('CONTROL ASSERTION: stale session/cache guard removal prevented tenant-B repository state from loading');
  }
  await page.getByLabel('Repository').selectOption('b-repo');
  await page.getByText(`${records['org-b']}-only board record`).waitFor();
  assert(delayedRequestSeen, 'delayed tenant-A board response was not exercised');
  releaseDelayedA();
  await page.waitForTimeout(250);
  assert.equal(await page.getByText(`${records['org-a']}-only board record`).count(), 0);
  assert(requests.some((request) => request.url.includes('/board?repository_id=a-repo') && request.auth === 'Bearer tenant-a'));
  assert(requests.some((request) => request.url.includes('/board?repository_id=b-repo') && request.auth === 'Bearer tenant-b'));
  await page.screenshot({ path: 'artifacts/organization-switch/b.png', fullPage: true });
  for (const route of ['/runs', '/insights']) {
    await page.goto(`${base}${route}`);
    await page.getByRole('heading').first().waitFor();
    if (route === '/insights') {
      await page.getByLabel('Repository').selectOption('b-repo');
      await page.getByText('83 send-backs / 100 eligible').waitFor();
      assert.equal(await page.getByText('17 send-backs / 100 eligible').count(), 0);
      assert(requests.some((request) => request.url.includes('/insights?repository_id=b-repo') && request.auth === 'Bearer tenant-b'));
    } else {
      await page.getByText('B-only', { exact: true }).waitFor();
      assert.equal(await page.getByText('A-only', { exact: true }).count(), 0);
      assert(requests.some((request) => request.url.includes('/agent-runs/aggregate') && request.auth === 'Bearer tenant-b'));
    }
  }
  assert(requests.some((request) => request.url.includes('/agent-runs/aggregate') && request.auth === 'Bearer tenant-b'));
  assert(requests.some((request) => request.url.includes('/insights') && request.auth === 'Bearer tenant-b'));
  // Exercise the actual selection transaction in fresh contexts: a failed token
  // issuance and a token whose validation names the wrong tenant both retain A.
  for (const failure of ['selection', 'validation']) {
    const failureContext = await browser.newContext();
    const failurePage = await failureContext.newPage();
    await failurePage.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'tenant-a'));
    await failurePage.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const auth = route.request().headers().authorization;
      assert(['Bearer tenant-a', 'Bearer tenant-b'].includes(auth), `${failure} fixture received invalid auth`);
      if (url.pathname.endsWith('/auth/session')) {
        const organizationId = failure === 'validation' && auth === 'Bearer tenant-b' ? 'org-a' : 'org-a';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'fixture@example.test', account_id: 'account-org-a', organization_id: organizationId }) });
      } else if (url.pathname.endsWith('/organizations')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: organizations }) });
      } else if (url.pathname.endsWith('/auth/select-organization')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: failure === 'selection' ? '' : 'tenant-b' }) });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
    });
    await failurePage.goto(`${base}/board`);
    await failurePage.getByLabel('Repository').waitFor();
    assert.equal(await failurePage.getByLabel('Repository').inputValue(), '', 'initial repository selection must be empty');
    await failurePage.getByLabel('Organization').selectOption('org-b');
    await failurePage.getByRole('alert').waitFor();
    assert.match(await failurePage.getByRole('alert').innerText(), /session is unchanged|retained/i);
    assert.equal(await failurePage.evaluate(() => sessionStorage.getItem('agent-ops-token')), 'tenant-a', `${failure} failure must retain A`);
    await failureContext.close();
  }
  const noOrganizationContext = await browser.newContext();
  const noOrganizationPage = await noOrganizationContext.newPage();
  await noOrganizationPage.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'tenant-a'));
  await noOrganizationPage.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/session')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'fixture@example.test', account_id: 'account-org-a', organization_id: 'org-a' }) });
    else if (url.pathname.endsWith('/organizations')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    else if (url.pathname.endsWith('/repositories')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { page: 1, per_page: 100, total: 0 } }) });
    else await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await noOrganizationPage.goto(`${base}/board`);
  await noOrganizationPage.getByText('No repositories available.').waitFor();
  assert.equal(await noOrganizationPage.getByLabel('Organization').count(), 0);
  await noOrganizationContext.close();
  const transientContext = await browser.newContext();
  const transientPage = await transientContext.newPage();
  await transientPage.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'tenant-a'));
  let releaseRepositories;
  const pendingRepositories = new Promise((resolve) => { releaseRepositories = resolve; });
  await transientPage.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/session')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'fixture@example.test', account_id: 'account-org-a', organization_id: 'org-a' }) });
    else if (url.pathname.endsWith('/organizations')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: organizations }) });
    else if (url.pathname.endsWith('/repositories')) { await pendingRepositories; await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); }
    else await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await transientPage.goto(`${base}/board`);
  await transientPage.getByLabel('Loading repositories').waitFor();
  releaseRepositories();
  await transientPage.getByRole('alert').waitFor();
  await transientContext.close();
  console.log('BROWSER PASS (stub API fixture): tenant-derived repositories and distinct board/run/insight requests verified; delayed A response discarded after B activation; failure-retention flows verified.');
  const afterListeners = new Set(execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').slice(1));
  const ownedListener = (listener) => listener.includes(`:${port} `);
  assert.deepEqual([...afterListeners].filter((listener) => !beforeListeners.has(listener) && !ownedListener(listener)), [], 'fixture introduced unrelated TCP listener');
  if (process.env.ORGANIZATION_SWITCH_FORCE_FAILURE === '1') throw new Error('FORCED_SCENARIO_FAILURE: cleanup verification');
} catch (error) { scenarioError = error; throw error; }
finally { await cleanup(); }
