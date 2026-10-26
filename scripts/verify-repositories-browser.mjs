import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const port = 18764;
const base = `http://127.0.0.1:${port}`;
const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', String(port)], { detached: true, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/repositories`)).ok) break; } catch { if (attempt === 59) throw new Error('Preview failed to start'); await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (message) => logs.push(`console ${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) logs.push(`API fixture request ${request.method()} ${request.url()}`); });
  await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture-token'));
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('/auth/session') ? { account_id: 'fixture-user', organization_id: 'fixture-org' }
      : path.endsWith('/organizations/fixture-org/members') ? { data: [{ account_id: 'fixture-user', role: 'owner' }] }
        : path.endsWith('/repositories') ? { data: [{ id: 'gh', provider: 'github', full_name: 'fixture/github', webhook_url: 'https://hooks.example/gh', status_mappings: {} }, { id: 'gl', provider: 'gitlab', full_name: 'fixture/gitlab', gitlab_base_url: 'https://git.example', webhook_url: 'https://hooks.example/gl', status_mappings: {} }] }
          : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto(`${base}/repositories`);
  await page.getByRole('heading', { name: 'Repository settings' }).waitFor();
  await page.getByText('fixture/github').waitFor();
  await page.getByText('fixture/gitlab').waitFor();
  await page.screenshot({ path: 'artifacts/repositories/settings.png', fullPage: true });
  assert.equal(await page.getByRole('article').count(), 2);
  assert.equal(logs.some((line) => line.startsWith('pageerror')), false, logs.join('\n'));
  console.log('BROWSER PASS (stubbed API fixture): GitHub and GitLab repository settings rendered; screenshot artifacts/repositories/settings.png');
  console.log(logs.join('\n'));
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
