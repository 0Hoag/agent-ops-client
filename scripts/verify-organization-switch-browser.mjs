import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 18763;
const base = `http://127.0.0.1:${port}`;
mkdirSync('artifacts/organization-switch', { recursive: true });
const built = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', built.replace('<head>', '<head><base href="/">'));
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { detached: true, stdio: 'ignore' });
let browser;
let cleaned = false;
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
  await context.addInitScript(() => { sessionStorage.setItem('agent-ops-token', 'tenant-a'); });
  const page = await context.newPage();
  page.on('console', (message) => console.log(`BROWSER console ${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => console.error(`BROWSER pageerror: ${error.stack}`));
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) console.log(`API request ${request.method()} ${request.url()} auth=${request.headers().authorization ?? '<none>'}`); });
  page.on('response', (response) => { if (response.url().includes('/api/v1/')) console.log(`API response ${response.status()} ${response.url()}`); });
  const requests = [];
  const records = { 'org-a': 'A-only board record', 'org-b': 'B-only board record' };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/api/v1/')) return route.continue();
    const auth = route.request().headers().authorization;
    requests.push({ url: url.href, auth });
    const org = auth === 'Bearer tenant-b' ? 'org-b' : 'org-a';
    let body = {};
    if (url.pathname.endsWith('/auth/session')) body = { email: 'fixture@example.test', organization_id: org };
    else if (url.pathname.endsWith('/organizations')) body = { data: [{ id: 'org-a', name: 'Organization A' }, { id: 'org-b', name: 'Organization B' }] };
    else if (url.pathname.endsWith('/repositories')) body = { data: [{ id: 'org-a', provider: 'github', full_name: 'org-a' }, { id: 'org-b', provider: 'github', full_name: 'org-b' }], meta: { page: 1, per_page: 100, total: 2 } };
    else if (url.pathname.endsWith('/board')) body = { data: [{ id: `record-${org}`, title: records[org], number: 1, state: 'open', status: 'review', repository_id: org, labels: [], assignee: '', pull_requests: [] }], meta: { page: 1, per_page: 100, total: 1 } };
    else if (url.pathname.endsWith('/auth/select-organization')) body = { token: 'tenant-b' };
    console.log(`API stub ${url.pathname} -> ${JSON.stringify(body)}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/board`);
  await page.getByRole('heading', { name: 'Issue board' }).waitFor();
  await page.waitForTimeout(200);
  await page.waitForFunction(() => document.querySelector('select[aria-label="Repository"] option[value="org-a"]') !== null, { timeout: 5000 }).catch(async (error) => {
    console.error(`DOM: ${await page.locator('body').innerText()}`);
    console.error(`Requests observed: ${JSON.stringify(requests, null, 2)}`);
    throw error;
  });
  await page.getByLabel('Repository').selectOption('org-a');
  await page.getByText(records['org-a']).waitFor();
  await page.screenshot({ path: 'artifacts/organization-switch/a.png', fullPage: true });
  await page.getByLabel('Organization').selectOption('org-b');
  await page.waitForFunction(() => sessionStorage.getItem('agent-ops-token') === 'tenant-b');
  await page.getByText(records['org-b']).waitFor();
  assert.equal(await page.getByText(records['org-a']).count(), 0);
  await page.screenshot({ path: 'artifacts/organization-switch/b.png', fullPage: true });
  console.log('BROWSER PASS (stub API fixture): two organizations, distinct tenant board records; old record gone after switch.');
} finally { await cleanup(); }
