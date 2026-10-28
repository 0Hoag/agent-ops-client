import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const port = Number(process.env.PREVIEW_PORT ?? 24373);
const base = `http://127.0.0.1:${port}`;
const evidence = '.agent-runs/w10h-cost-protocol';
await mkdir(evidence, { recursive: true });
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, base).pathname;
  const filename = pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.replace(/^\//, '');
  try {
    const asset = await readFile(path.join('dist', filename));
    response.writeHead(200, { 'content-type': filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(asset);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
let browser;
const requests = [];
try {
  assert((await fetch(base)).ok, 'built preview did not become available');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => sessionStorage.setItem('agent-ops-token', 'fixture-token'));
  const page = await context.newPage();
  page.on('console', (message) => console.log(`console ${message.type()}: ${message.text()}`));
  page.on('requestfailed', (request) => console.log(`request failed ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => console.log(`response ${response.status()} ${response.url()}`));
  await page.addInitScript(() => { window.__fixturePageErrors = []; window.addEventListener('error', (event) => window.__fixturePageErrors.push(event.message)); });
  page.on('request', (request) => { if (request.url().includes('/api/v1/')) requests.push({ method: request.method(), url: new URL(request.url()).pathname, body: request.postData() }); });
  page.on('pageerror', (error) => console.log(`pageerror ${error.stack}`));
  let currentOrg = 'org-a';
  let role = 'owner';
  let rejectNextCreate = false;
  const pricesByOrg = { 'org-a': [{ id: 'price-1', model: 'fixture-model', effective_date: '2026-01-01', input_per_million: 1, cached_input_per_million: 0.1, cache_write_per_million: 0.2, output_per_million: 2, reasoning_per_million: 0.3 }], 'org-b': [] };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let status = 200;
    let body = {};
    if (path.endsWith('/auth/session')) body = { email: 'fixture@example.test', account_id: 'acct-a', organization_id: currentOrg };
    else if (path.endsWith('/organizations')) body = { data: [{ id: currentOrg, name: `Organization ${currentOrg}` }] };
    else if (path.endsWith('/members')) body = { data: [{ account_id: 'acct-a', role }] };
    else if (path.endsWith('/agent-run-prices') && request.method() === 'GET') body = { data: pricesByOrg[currentOrg] };
    else if (path.endsWith('/agent-run-prices') && request.method() === 'POST') { const value = request.postDataJSON(); const prices = pricesByOrg[currentOrg]; if (rejectNextCreate || prices.some((item) => item.model === value.model && item.effective_date === value.effective_date)) { rejectNextCreate = false; status = 409; body = { error: 'duplicate version' }; } else { prices.push({ ...value, id: 'price-2' }); body = { data: prices[1] }; } }
    else if (path.endsWith('/agent-run-prices/price-1') && request.method() === 'PATCH') { pricesByOrg[currentOrg][0] = { ...pricesByOrg[currentOrg][0], ...request.postDataJSON() }; body = { data: pricesByOrg[currentOrg][0] }; }
    else if (path.endsWith('/agent-runs/aggregate')) body = { data: [
      { wave: 'W10', worker: 'known-usd', runs: 1, input_tokens: 100, cached_input_tokens: 20, cache_write_tokens: 10, output_tokens: 30, reasoning_tokens: 0, cost_usd: 1.25, equivalent_cost_usd: 1.25, cost_vnd: 31250 },
      { wave: 'W10', worker: 'known-vnd', runs: 1, input_tokens: 100, cached_input_tokens: 20, cache_write_tokens: 10, output_tokens: 30, reasoning_tokens: 0, billed_cost_usd: 1.25, equivalent_cost_usd: 1.25, cost_vnd: 31250 },
      { wave: 'W10', worker: 'unknown', runs: 1, input_tokens: 100, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 30, reasoning_tokens: 0 },
      { wave: 'W10', worker: 'missing-vnd', runs: 1, input_tokens: 100, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 30, reasoning_tokens: 0, equivalent_cost_usd: 1.25 },
      { wave: 'W10', worker: 'subscription', runs: 1, input_tokens: 100, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 30, reasoning_tokens: 0, billed_cost_usd: 0, cost_usd: 0, equivalent_cost_usd: 1.25, cost_vnd: 31250 },
    ] };
    else { status = 404; body = { error: `unexpected fixture endpoint ${path}` }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${base}/pricing`);
  await page.getByRole('link', { name: 'Model prices' }).click();
  await page.getByRole('heading', { name: 'Model prices' }).waitFor();
  await page.getByText('fixture-model').waitFor();
  await page.getByRole('button', { name: 'Create version' }).waitFor();
  await page.getByLabel('Model').fill('fixture-model');
  await page.getByLabel('Effective date').fill('2026-01-01');
  await page.getByRole('button', { name: 'Create version' }).click();
  await page.getByRole('alert').filter({ hasText: 'Unable to save price version' }).waitFor();
  assert.equal(pricesByOrg['org-a'].length, 1, 'duplicate version must be rejected');
  await page.getByLabel('Model').fill('');
  await page.getByRole('button', { name: 'Create version' }).click();
  assert.equal(requests.filter((item) => item.method === 'POST').length, 1, 'required model validation must prevent request');
  await page.getByLabel('Model').fill('fixture-next');
  await page.getByLabel('Effective date').fill('2026-07-01');
  rejectNextCreate = true;
  await page.getByRole('button', { name: 'Create version' }).click();
  await page.getByRole('alert').filter({ hasText: 'Unable to save price version' }).waitFor();
  assert.equal(pricesByOrg['org-a'].length, 1, 'API rejection must not alter prices');
  const version = { model: 'fixture-next', effective_date: '2026-07-01' };
  await page.getByLabel('Model').fill(version.model);
  await page.getByLabel('Effective date').fill(version.effective_date);
  await page.getByRole('button', { name: 'Create version' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('fixture-next'));
  await page.screenshot({ path: `${evidence}/pricing-owner.png`, fullPage: true });
  const createRequest = requests.find((item) => item.method === 'POST' && JSON.parse(item.body).model === version.model);
  assert.deepEqual(JSON.parse(createRequest.body), { model: 'fixture-next', effective_date: '2026-07-01', input_per_million: 0, cached_input_per_million: 0, cache_write_per_million: 0, output_per_million: 0, reasoning_per_million: 0 });
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByLabel('Model').fill('fixture-edited');
  await page.getByRole('button', { name: 'Update version' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('fixture-edited'));
  const editRequest = requests.find((item) => item.method === 'PATCH');
  assert.equal(JSON.parse(editRequest.body).model, 'fixture-edited');
  await page.screenshot({ path: `${evidence}/pricing-edited.png`, fullPage: true });
  currentOrg = 'org-b'; role = 'member';
  await page.evaluate(() => { sessionStorage.setItem('agent-ops-token', 'fixture-token-b'); window.dispatchEvent(new Event('organization:will-change')); window.dispatchEvent(new Event('organization:changed')); });
  await page.getByText('Read-only: only organization owners and admins can edit prices.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Create version' }).count(), 0, 'member must be read-only');
  assert.equal(await page.getByText('fixture-edited').count(), 0, 'org A model must not appear in org B');
  await page.screenshot({ path: `${evidence}/pricing-member-org-b.png`, fullPage: true });
  await page.goto(`${base}/runs`);
  await page.getByRole('heading').first().waitFor();
  for (const label of ['known-usd', 'known-vnd', 'unknown', 'subscription']) await page.getByText(label, { exact: true }).waitFor();
  await page.getByLabel(/currency/i).selectOption('VND');
  await page.screenshot({ path: `${evidence}/runs-vnd.png`, fullPage: true });
  const runText = await page.locator('table').innerText();
  assert.match(runText, /known-usd\t—\t1\t15\.4%\tVND 31,250/, 'VND must use server cost_vnd, not equivalent_cost_usd');
  assert.match(runText, /known-vnd\t—\t1\t15\.4%\tVND 31,250/, 'VND must use server cost_vnd, not equivalent_cost_usd');
  assert.match(runText, /unknown\t—\t1\t0\.0%\tUnknown/);
  assert.match(runText, /missing-vnd\t—\t1\t0\.0%\tUnknown/, 'missing cost_vnd must remain Unknown');
  assert.match(runText, /subscription\t—\t1\t0\.0%\tVND 31,250/);
  await page.getByLabel(/currency/i).selectOption('USD');
  const usdText = await page.locator('table').innerText();
  assert.match(usdText, /known-usd\t—\t1\t15\.4%\t\$1\.2500/);
  assert.match(usdText, /subscription\t—\t1\t0\.0%\t\$0\.0000 \(equivalent API USD \$1\.2500\)/);
  assert.deepEqual(await page.evaluate(() => window.__fixturePageErrors), [], 'browser runtime errors');
  const observed = requests.map(({ method, url }) => `${method} ${url}`);
  const summary = `BROWSER PASS: built preview ${base}; duplicate response and one-shot API rejection show UI alert without fixture mutation; required-field native validation prevented request; successful create and PATCH state/body, owner/member UI, org switch isolation; USD billed/equivalent and VND cost_vnd/unknown fixture assertions. Requests ${JSON.stringify(observed)}`;
  console.log(summary);
  await writeFile(`${evidence}/requests.json`, JSON.stringify(requests, null, 2));
  await writeFile(`${evidence}/manifest.json`, JSON.stringify({ issues: [71, 72], sourceHead: process.env.GIT_HEAD ?? 'unrecorded', browserCommand: `PREVIEW_PORT=${port} node scripts/verify-pricing-browser.mjs`, browserResult: summary, screenshots: ['pricing-owner.png', 'pricing-edited.png', 'pricing-member-org-b.png', 'runs-vnd.png'], requestLog: 'requests.json', runFixture: { billed_cost_usd: 0, equivalent_cost_usd: 1.25, cost_vnd: 31250, missingCostVnd: 'Unknown', unknown: 'Unknown' }, apiSchemaSha256: {}, hostedCi: process.env.HOSTED_CI ?? 'not recorded', realApiSmoke: 'pending root #340 acceptance' }, null, 2));
  const hashes = {};
  for (const file of ['src/shared/api/swagger.json', 'src/shared/api/generated/Api.ts']) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  const manifest = JSON.parse(await readFile(`${evidence}/manifest.json`, 'utf8'));
  manifest.apiSchemaSha256 = { swagger: hashes['src/shared/api/swagger.json'], generated: hashes['src/shared/api/generated/Api.ts'] };
  await writeFile(`${evidence}/manifest.json`, JSON.stringify(manifest, null, 2));
  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
