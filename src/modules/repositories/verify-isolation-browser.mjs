import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const port = 18765;
const base = `http://127.0.0.1:${port}`;
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { detached: true, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/repositories`)).ok) break; } catch { if (attempt === 59) throw new Error('Preview failed to start'); await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'tenant-a'));
  const page = await context.newPage();
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const org = route.request().headers().authorization === 'Bearer tenant-b' ? 'org-b' : 'org-a';
    const data = url.pathname.endsWith('/auth/session') ? { account_id: `account-${org}`, organization_id: org }
      : url.pathname.endsWith('/organizations') ? { data: [{ id: 'org-a', name: 'Fixture A' }, { id: 'org-b', name: 'Fixture B' }] }
        : url.pathname.includes('/organizations/') && url.pathname.endsWith('/members') ? { data: [{ account_id: `account-${org}`, role: 'owner' }] }
          : url.pathname.endsWith('/auth/select-organization') ? { token: 'tenant-b' }
            : url.pathname.endsWith('/repositories') ? { data: [{ id: `repo-${org}`, provider: 'github', full_name: `${org}/fixture` }] }
              : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`${base}/repositories`);
  await page.getByText('org-a/fixture').waitFor();
  await page.getByLabel('Organization').selectOption('org-b');
  await page.getByText('org-b/fixture').waitFor();
  assert.equal(await page.getByText('org-a/fixture').count(), 0);
  await page.screenshot({ path: 'artifacts/repositories/organization-b.png', fullPage: true });
  console.log('PASS (stubbed org fixtures): switched org-a -> org-b; org-a row cleared, org-b fixture row displayed. Screenshot artifacts/repositories/organization-b.png');
} finally {
  await browser?.close();
  if (server.exitCode === null && server.pid) {
    const exited = once(server, 'exit').catch(() => undefined);
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* stopped */ }
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* stopped */ }
    await exited;
  }
}
