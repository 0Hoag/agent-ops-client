import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { analyticsFixture, deliveryFixture, insightsFixture, observations } from '../src/modules/insights/analytics.fixture.ts';

// Built bundle + deterministic network fixtures, NOT live API acceptance.
const evidence = '/Users/zeross/agent-ops/.agent-runs/W12b-rec-evidence/browser';
fs.mkdirSync(evidence, { recursive: true });
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const file = path.resolve('dist', req.url === '/' || !path.extname(req.url) ? 'index.html' : `.${req.url}`);
  if (!file.startsWith(`${path.resolve('dist')}/`) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const requests = [];
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('503')) errors.push(message.text()); });
  await page.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture-only'));
  let organization = 'org-a';
  let mode = 'data';
  let release;
  const fulfill = (route, data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${organization} ${url.pathname}${url.search}`);
    if (url.pathname.endsWith('/session')) return fulfill(route, { organization_id: organization });
    if (url.pathname.endsWith('/organizations')) return fulfill(route, { data: [{ id: 'org-a', name: 'Organization A' }, { id: 'org-b', name: 'Organization B' }] });
    if (url.pathname.endsWith('/repositories')) return fulfill(route, { data: [{ id: 'repo-1', full_name: `${organization}/widgets` }] });
    if (mode === 'error' && url.pathname.includes('/insights/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture offline"}' });
    if (url.pathname.endsWith('/analytics')) {
      if (mode === 'loading') await new Promise((resolve) => { release = resolve; });
      return fulfill(route, mode === 'empty' ? { buckets: [] } : analyticsFixture(url.searchParams.get('period'), url.searchParams.get('group_by')));
    }
    if (url.pathname.endsWith('/delivery')) return fulfill(route, mode === 'empty' ? { history: { complete: false } } : deliveryFixture());
    if (url.pathname.endsWith('/insights')) return fulfill(route, insightsFixture);
    throw new Error(`Unexpected fixture endpoint: ${url.pathname}`);
  });
  await page.goto(`${base}/insights`);
  await page.getByLabel('Repository', { exact: true }).selectOption('repo-1');
  await page.getByText('Retrying workflow repeatedly').waitFor();
  const cost = observations.reduce((n, row) => n + row.equivalent, 0);
  const lines = observations.reduce((n, row) => n + row.lines, 0);
  await page.getByRole('region', { name: 'Cost and cache trends' }).getByRole('cell', { name: `$${cost.toFixed(4)}`, exact: true }).waitFor();
  await page.getByRole('cell', { name: `$${(cost / lines).toFixed(4)}`, exact: true }).waitFor();
  assert.equal(await page.getByText('N/A — no eligible records').count(), 1);
  await page.screenshot({ path: `${evidence}/built-dashboard.png`, fullPage: true });
  await page.getByLabel('From date').fill('2026-09-01');
  await page.getByLabel('To date').fill('2026-10-31');
  await page.getByLabel('Period', { exact: true }).selectOption('weekly');
  for (const group of ['model', 'wave', 'area', 'harness']) {
    await page.getByLabel('Group by', { exact: true }).selectOption(group);
    await page.getByText(`Cost and cache trends (weekly, grouped by ${group})`).waitFor();
    assert(requests.some((url) => url.includes(`group_by=${group}`) && url.includes('to=2026-10-31') && url.includes('from=2026-09-01') && url.includes('repository_id=repo-1')));
  }
  mode = 'loading';
  // A fresh query key is required: revisiting a cached key is a background refresh,
  // not an initial loading state.
  await page.getByLabel('From date').fill('2026-09-02');
  await page.getByText('Loading cost/cache analytics…').waitFor();
  await page.screenshot({ path: `${evidence}/loading.png`, fullPage: true });
  mode = 'data'; release();
  await page.getByText('Cost and cache trends (weekly, grouped by harness)').waitFor();
  mode = 'error';
  await page.reload();
  await page.getByText(/Unable to load cost\/cache analytics:/).waitFor();
  await page.getByText(/Unable to load delivery analytics:/).waitFor();
  await page.screenshot({ path: `${evidence}/error.png`, fullPage: true });
  mode = 'data';
  for (const retry of await page.getByRole('button', { name: 'Retry', exact: true }).all()) await retry.click();
  await page.getByRole('region', { name: 'Delivery quality' }).waitFor();
  await page.getByRole('region', { name: 'Cost and cache trends' }).waitFor();
  mode = 'empty'; await page.reload();
  await page.getByText('No analytics observations for this period.').waitFor();
  await page.getByText('History incomplete; affected metrics may be unavailable.').waitFor();
  await page.screenshot({ path: `${evidence}/empty.png`, fullPage: true });
  mode = 'data'; await page.reload();
  await page.getByLabel('Repository', { exact: true }).selectOption('repo-1');
  await page.getByText('Retrying workflow repeatedly').waitFor();
  await page.evaluate(() => window.dispatchEvent(new Event('organization:will-change')));
  await page.getByText('Loading analytics session…').waitFor();
  assert.equal(await page.getByText('Retrying workflow repeatedly').count(), 0);
  organization = 'org-b';
  await page.evaluate(() => window.dispatchEvent(new Event('organization:changed')));
  await page.getByRole('option', { name: 'org-b/widgets' }).waitFor();
  assert.equal(await page.getByLabel('Repository', { exact: true }).inputValue(), '');
  assert.equal(await page.getByText('org-a/widgets').count(), 0);
  await page.screenshot({ path: `${evidence}/tenant-b.png`, fullPage: true });
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${evidence}/network.log`, requests.join('\n'));
  fs.writeFileSync(`${evidence}/console.log`, 'No unexpected console or page errors. Deliberate fixture 503s excluded.\n');
  console.log(`PASS: built ${base}/insights; deterministic fixtures only; cost/cache/delivery/harness, legacy metrics, controls, loading/error/retry/empty, tenant reset; ${evidence}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
