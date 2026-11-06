import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const evidence = '/Users/zeross/agent-ops/.agent-runs/W13s-channel-settings-ui-r2';
const base = 'http://127.0.0.1:24397';
await mkdir(evidence, { recursive: true });
const server = createServer(async (request, response) => {
  const file = path.extname(new URL(request.url, base).pathname) ? new URL(request.url, base).pathname.slice(1) : 'index.html';
  try { response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }); response.end(await readFile(path.join('dist', file))); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(24397, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture-token'));
  const page = await context.newPage();
  const channels = [];
  let role = 'owner'; let failWrite = false;
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url()); const method = route.request().method(); const input = route.request().postData() ? route.request().postDataJSON() : undefined;
    let body = {};
    if (pathname.endsWith('/auth/session')) body = { account_id: 'acct', organization_id: 'org-a' };
    else if (pathname.endsWith('/organizations')) body = { data: [{ id: 'org-a', name: 'Fixture' }, { id: 'org-b', name: 'Other' }] };
    else if (pathname.endsWith('/members')) body = { data: [{ account_id: 'acct', role }] };
    else if (pathname.endsWith('/alerts/channels') && method === 'GET') body = channels;
    else if (pathname.endsWith('/alerts/channels') && method === 'POST') { if (failWrite) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture denied"}' }); channels.push(input); body = input; }
    else if (pathname.includes('/alerts/channels/') && method === 'PUT') { const kind = pathname.split('/').pop(); const index = channels.findIndex((item) => item.kind === kind); channels[index] = { ...channels[index], ...input }; body = channels[index]; }
    else if (pathname.includes('/alerts/channels/') && method === 'DELETE') channels.splice(channels.findIndex((item) => item.kind === pathname.split('/').pop()), 1);
    else if (pathname.endsWith('/alerts/thresholds')) body = { min_cache_hit: 0.8, silent_seconds: 300, pr_stale_seconds: 86400 };
    else if (pathname.endsWith('/alerts/history')) body = { data: [], meta: { total: 0 } };
    else if (pathname.endsWith('/repositories')) body = { data: [] };
    else if (pathname.endsWith('/projects')) body = { data: [] };
    else return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/alerts`);
  await page.getByLabel('slack_webhook_url_env_ref').waitFor();
  await page.getByLabel('slack_webhook_url_env_ref').fill('SLACK_REF_ONLY');
  await page.getByRole('button', { name: 'Create channel' }).click();
  await page.getByText('slack', { exact: true }).waitFor();
  await page.reload(); await page.getByText('Enabled', { exact: true }).waitFor();
  assert.equal(channels[0].slack_webhook_url_env_ref, 'SLACK_REF_ONLY');
  assert.equal(await page.getByText(/fixture-secret-value/).count(), 0);
  await page.getByRole('button', { name: 'Disable' }).click(); await page.getByRole('button', { name: 'Enable' }).waitFor();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('slack_webhook_url_env_ref').fill('ROTATED_REF');
  await page.getByRole('button', { name: 'Save channel' }).click();
  await page.getByRole('button', { name: 'Delete' }).click(); await page.getByText('No notification channels configured.').waitFor();
  failWrite = true; await page.getByLabel('slack_webhook_url_env_ref').fill('BROKEN_REF'); await page.getByRole('button', { name: 'Create channel' }).click(); await page.getByRole('alert').waitFor();
  role = 'viewer'; await page.reload(); await page.getByRole('region', { name: 'Notification channels' }).getByText('Read-only: owner or admin access required.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Create channel' }).count(), 0);
  await page.screenshot({ path: `${evidence}/channels-viewer.png`, fullPage: true });
  console.log(`PASS ${base}: fixture channel CRUD, reload reference/enabled, error and viewer read-only; outbound delivery absent.`);
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
