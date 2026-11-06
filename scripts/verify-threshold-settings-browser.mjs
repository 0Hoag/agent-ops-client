import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:24397';
const evidence = '/Users/zeross/agent-ops/.agent-runs/W13r-threshold-settings-ui';
await (await import('node:fs/promises')).mkdir(evidence, { recursive: true });
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, base).pathname;
  const file = path.extname(pathname) ? pathname.slice(1) : 'index.html';
  try {
    response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(await readFile(path.join('dist', file)));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(24397, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'threshold-fixture'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let thresholds = { min_cache_hit: 0.8, silent_seconds: 300, pr_stale_seconds: 86400 };
  const requests = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    requests.push({ path: url.pathname, method: req.method(), body: req.postDataJSON() });
    let body;
    if (url.pathname.endsWith('/auth/session')) body = { account_id: 'acct', organization_id: 'org' };
    else if (url.pathname.endsWith('/organizations')) body = { data: [{ id: 'org', name: 'Fixture org' }] };
    else if (url.pathname.endsWith('/members')) body = { data: [{ account_id: 'acct', role: 'owner' }] };
    else if (url.pathname.endsWith('/alerts/thresholds') && req.method() === 'GET') body = thresholds;
    else if (url.pathname.endsWith('/alerts/thresholds') && req.method() === 'PUT') { thresholds = req.postDataJSON(); body = thresholds; }
    else if (url.pathname.endsWith('/alerts/history')) body = { data: [], meta: { total: 0 } };
    else { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/alerts`);
  const cache = page.getByLabel('Minimum cache-hit rate (%)');
  await cache.waitFor();
  assert.equal(await cache.inputValue(), '0.8');
  await cache.fill('0.83');
  await page.getByRole('button', { name: 'Save thresholds' }).click();
  await page.getByText('Thresholds saved.').waitFor();
  assert.deepEqual(thresholds, { min_cache_hit: 0.83, silent_seconds: 300, pr_stale_seconds: 86400 });
  await page.reload();
  await page.getByLabel('Minimum cache-hit rate (%)').waitFor();
  assert.equal(await page.getByLabel('Minimum cache-hit rate (%)').inputValue(), '0.83');
  assert.deepEqual(errors, []);
  await (await import('node:fs/promises')).writeFile(`${evidence}/browser-requests.json`, JSON.stringify(requests, null, 2));
  await page.screenshot({ path: `${evidence}/threshold-settings.png`, fullPage: true });
  console.log(`PASS ${base}: owner edits and reloads exact values; ${requests.length} API requests; no runtime errors.`);
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
