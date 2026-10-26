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
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      process.kill(-server.pid, 'SIGTERM');
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
  const page = await browser.newPage();
  const activeOrg = 'org-a';
  const records = { 'org-a': 'A-only board record', 'org-b': 'B-only board record' };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const auth = route.request().headers().authorization;
    const org = auth === 'Bearer tenant-b' ? 'org-b' : 'org-a';
    let body = {};
    if (url.pathname.endsWith('/api/v1/auth/session')) body = { email: 'fixture@example.test', organization_id: org };
    if (url.pathname.endsWith('/api/v1/auth/session')) body = { email: 'fixture@example.test', organization_id: org };
    else if (url.pathname.endsWith('/api/v1/organizations')) body = { data: [{ id: 'org-a', name: 'Organization A' }, { id: 'org-b', name: 'Organization B' }] };
    else if (url.pathname.endsWith('/api/v1/repositories')) body = { data: [{ id: 'org-a', full_name: 'org-a' }, { id: 'org-b', full_name: 'org-b' }], meta: { page: 1, per_page: 100, total: 2 } };
    else if (url.pathname.endsWith('/api/v1/board')) body = { data: [{ id: `record-${org}`, title: records[org], number: 1, state: 'open', status: 'review', repository_id: org, labels: [], assignee: '', pull_requests: [] }], meta: { page: 1, per_page: 100, total: 1 } };
    else if (url.pathname.endsWith('/api/v1/auth/select-organization')) body = { token: 'tenant-b' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/`);
  await page.goto(`${base}/board`);
  await page.evaluate(() => sessionStorage.setItem('agent-ops-token', 'tenant-a'));
  await page.reload();
  await page.getByRole('heading', { name: 'Issue board' }).waitFor();
  await page.waitForTimeout(200);
  await page.waitForFunction(() => document.querySelector('select[aria-label="Repository"] option[value="org-a"]') !== null);
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
