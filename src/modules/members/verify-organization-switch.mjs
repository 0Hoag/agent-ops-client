import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.MEMBERS_SWITCH_PORT ?? 4337);
const base = `http://127.0.0.1:${port}`;
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { detached: true, stdio: ['ignore', 'ignore', 'ignore'] });
let browser;
const requests = [];
let releaseDelayedA;
const delayedA = new Promise((resolve) => { releaseDelayedA = resolve; });
const member = (org, account, role) => ({ id: `${org}-${account}`, organization_id: org, account_id: account, role });
const response = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
try {
  let ready = false;
  for (let i = 0; i < 80; i += 1) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert(ready, 'preview server did not start');
  browser = await chromium.launch({ headless: true });
  if (process.env.MEMBERS_FORCE_FAILURE === '1') throw new Error('intentional cleanup-control failure');
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'token-org-a'));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const auth = request.headers().authorization;
    const token = auth?.replace(/^Bearer /, '');
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname, authorization: auth });
    assert.ok(['token-org-a', 'token-org-b'].includes(token), `unexpected Authorization: ${auth}`);
    if (url.pathname.endsWith('/auth/session')) {
      if (token === 'token-org-b') return route.fulfill(response({ email: 'owner-b@example.test', account_id: 'owner-b', organization_id: 'org-b' }));
      return route.fulfill(response({ email: 'owner-a@example.test', account_id: 'owner-a', organization_id: 'org-a' }));
    }
    if (url.pathname.endsWith('/organizations')) return route.fulfill(response({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] }));
    if (url.pathname.endsWith('/auth/select-organization')) {
      assert.equal(token, 'token-org-a');
      const organizationId = request.postDataJSON().organization_id;
      assert.ok(['org-a', 'org-b'].includes(organizationId));
      return route.fulfill(response({ token: organizationId === 'org-a' ? 'token-org-a' : 'token-org-b' }));
    }
    if (url.pathname.endsWith('/organizations/org-a/members')) {
      assert.equal(token, 'token-org-a', 'org A members must use A bearer');
      await delayedA;
      return route.fulfill(response({ data: [member('org-a', 'owner-a', 'owner'), member('org-a', 'a-only-member', 'member')] }));
    }
    if (url.pathname.endsWith('/organizations/org-b/members')) {
      assert.equal(token, 'token-org-b', 'org B members must use newly selected B bearer');
      return route.fulfill(response({ data: [member('org-b', 'owner-b', 'owner'), member('org-b', 'b-only-member', 'member')] }));
    }
    return route.fulfill(response({ data: [] }));
  });

  await page.goto(`${base}/members`);
  await page.getByRole('heading', { name: 'Members' }).waitFor();
  await page.getByLabel('Organization').selectOption('org-a');
  await page.waitForRequest((request) => request.url().endsWith('/organizations/org-a/members'));
  await page.getByText('Loading members…').waitFor();
  await page.screenshot({ path: 'artifacts/members/members-loading.png', fullPage: true });
  await page.getByLabel('Organization').selectOption('org-b');
  await page.getByText('b-only-member').waitFor();
  assert.equal(await page.getByText('a-only-member').count(), 0, 'org A member remained visible after real organization switch');
  assert.equal(await page.getByText('owner-b').count(), 1, 'org B members not loaded');
  assert.equal(sessionStorageValue(await page.evaluate(() => sessionStorage.getItem('agent-ops-token'))), 'token-org-b');
  releaseDelayedA();
  await delay(250);
  assert.equal(await page.getByText('a-only-member').count(), 0, 'delayed org A response reintroduced stale member');
  await page.screenshot({ path: 'artifacts/members/organization-switched.png', fullPage: true });
  assert(requests.some((item) => item.path.endsWith('/auth/select-organization')));
  assert(requests.some((item) => item.path.endsWith('/organizations/org-a/members') && item.authorization === 'Bearer token-org-a'));
  assert(requests.some((item) => item.path.endsWith('/organizations/org-b/members') && item.authorization === 'Bearer token-org-b'));
  console.log('PASS: actual AppLayout selector -> select-organization API -> validated B token; A-only member absent after switch and delayed A response; loading state visible. Stubbed API, Authorization token identity asserted.');
} finally {
  releaseDelayedA?.();
  await browser?.close();
  if (server.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await delay(500);
    try { process.kill(-server.pid, 0); process.kill(-server.pid, 'SIGKILL'); } catch {}
  }
}

function sessionStorageValue(value) { return value; }
