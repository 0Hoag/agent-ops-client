import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const evidence = '/Users/zeross/agent-ops/.agent-runs/W13k-rec-evidence';
const base = 'http://127.0.0.1:24396';
await mkdir(evidence, { recursive: true });
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, base).pathname;
  const file = path.extname(pathname) ? pathname.slice(1) : 'index.html';
  try {
    const body = await readFile(path.join('dist', file));
    response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(24396, '127.0.0.1', resolve));
let browser;
const requests = [];
const errors = [];
let budgets = [];
let emptyHistory = false;
let rejectHistory = false;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'budget-history-fixture'));
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method();
    const pathname = url.pathname;
    const input = request.postData() ? request.postDataJSON() : undefined;
    requests.push({ pathname, method, query: url.search, input });
    let body = {}; let status = 200;
    if (pathname.endsWith('/auth/session')) body = { account_id: 'acct', organization_id: 'org' };
    else if (pathname.endsWith('/organizations')) body = { data: [{ id: 'org', name: 'Fixture organization' }] };
    else if (pathname.endsWith('/members')) body = { data: [{ account_id: 'acct', role: 'owner' }] };
    else if (pathname.endsWith('/budgets') && method === 'GET') body = budgets;
    else if (pathname.endsWith('/budgets') && method === 'POST') { body = { ...input, id: 'b1' }; budgets.push(body); }
    else if (pathname.endsWith('/budgets/b1') && method === 'PATCH') { budgets[0] = { ...budgets[0], ...input }; body = budgets[0]; }
    else if (pathname.endsWith('/budgets/b1') && method === 'DELETE') budgets = [];
    else if (pathname.endsWith('/alerts/history')) {
      if (rejectHistory) { status = 503; body = { error: 'fixture unavailable' }; }
      else body = { data: emptyHistory ? [] : [{ id: 'a1', rule: 'Budget exceeded', message: 'Token limit reached', repository: 'fixture/repo', subject: 'W13', detectedAt: '2026-11-01T10:30:00Z' }], meta: { total: emptyHistory ? 0 : 21 } };
    } else { status = 404; body = { error: `Unexpected endpoint ${pathname}` }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/budgets`);
  await page.getByText('No budgets configured.').waitFor();
  const input = { starts_at: '2026-11-01', ends_at: '2026-12-01', repository_id: 'repo-1', wave: 'W13', token_limit: 12500, usd_limit: 0.75 };
  for (const [label, field] of [['Start date', 'starts_at'], ['End date', 'ends_at'], ['Repository ID', 'repository_id'], ['Wave', 'wave'], ['Token limit', 'token_limit'], ['USD limit', 'usd_limit']]) await page.getByLabel(label, { exact: true }).fill(String(input[field]));
  await page.getByRole('button', { name: 'Create budget', exact: true }).click();
  await page.getByText('Token limit: 12500; USD limit: 0.75', { exact: true }).waitFor();
  assert.deepEqual(requests.find((request) => request.method === 'POST').input, input);
  await page.reload();
  await page.getByText('Token limit: 12500; USD limit: 0.75', { exact: true }).waitFor();
  await page.getByText('Repository: repo-1; Wave: W13', { exact: true }).waitFor();
  await page.getByText('2026-11-01 – 2026-12-01', { exact: true }).waitFor();
  await page.screenshot({ path: `${evidence}/budget-reloaded.png`, fullPage: true });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  for (const [label, value] of [['Start date', input.starts_at], ['End date', input.ends_at], ['Repository ID', input.repository_id], ['Wave', input.wave], ['Token limit', String(input.token_limit)], ['USD limit', String(input.usd_limit)]]) assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), value);
  await page.getByLabel('Token limit', { exact: true }).fill('0');
  await page.getByLabel('Wave', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Update budget', exact: true }).click();
  await page.getByText('Token limit: 0; USD limit: 0.75', { exact: true }).waitFor();
  assert.deepEqual(requests.find((request) => request.method === 'PATCH').input, { ...input, token_limit: 0, wave: '' });
  await page.screenshot({ path: `${evidence}/budget-edited.png`, fullPage: true });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('No budgets configured.').waitFor();
  assert.equal(budgets.length, 0);
  await page.screenshot({ path: `${evidence}/budget-deleted.png`, fullPage: true });
  await page.getByRole('link', { name: 'Alert history', exact: true }).click();
  await page.getByText('Budget exceeded', { exact: true }).waitFor();
  await page.getByText('Token limit reached', { exact: true }).waitFor();
  await page.getByText('2026-11-01T10:30:00Z · fixture/repo · W13', { exact: true }).waitFor();
  await page.screenshot({ path: `${evidence}/history-populated.png`, fullPage: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2', { exact: true }).waitFor();
  await page.getByLabel('Items per page').selectOption('50');
  await page.getByText('Page 1', { exact: true }).waitFor();
  assert(requests.some((request) => request.query === '?page=2&per_page=20'));
  emptyHistory = true; rejectHistory = true;
  await page.reload();
  await page.getByRole('alert').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${evidence}/history-error.png`, fullPage: true });
  rejectHistory = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByText('No alert history found.', { exact: true }).waitFor();
  await page.screenshot({ path: `${evidence}/history-empty.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  for (const pathname of ['/budgets', '/alerts']) {
    await anonymousPage.goto(`${base}${pathname}`);
    await anonymousPage.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(new URL(anonymousPage.url()).pathname, '/login');
  }
  await anonymous.close();
  await writeFile(`${evidence}/browser-requests.json`, JSON.stringify(requests, null, 2));
  console.log(`PASS ${base}: create, reload exact dates/scope/numeric values, edit/clear scope/zero tokens, delete; populated history, pagination/page size, error/retry to empty; both routes protected; no runtime errors.`);
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
