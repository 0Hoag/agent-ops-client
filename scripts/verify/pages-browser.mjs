// Real production UI and HTTP only: no routes, fake authentication or production oracle imports.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
const fixture = JSON.parse(readFileSync(process.env.PAGES_FIXTURE, 'utf8'));
const rows = [];
const failures = [];
const network = [];
const errors = [];
let authorization;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (request.url().includes('/api/')) authorization ||= request.headers().authorization; });
page.on('response', (response) => { if (response.url().includes('/api/')) network.push({ url: response.url(), status: response.status() }); });
async function check(name, command, expected, fn, blocked) {
  try {
    const actual = await fn();
    rows.push({ name, command, expected, actual, result: 'PASS' });
    console.log(`PASS ${name}: ${JSON.stringify(actual)}`);
  } catch (error) {
    const row = { name, command, expected, actual: error.message, result: blocked ? 'BLOCKED' : 'FAIL', ...(blocked ? { blocked } : {}) };
    rows.push(row); failures.push(row);
    console.log(`${row.result} ${name}: ${error.message}`);
  }
}
async function http(path) {
  const response = await page.request.get(`${base}/api/v1/${path}`, { headers: { Authorization: authorization } });
  assert.equal(response.status(), 200, `GET ${path}: HTTP ${response.status()}`);
  const body = await response.json();
  writeFileSync(`${dir}/http-${path.replace(/[^a-z0-9]/gi, '_')}.json`, JSON.stringify(body, null, 2));
  return body;
}
async function settle() { await page.waitForLoadState('networkidle'); }
async function capture(name) {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: `${dir}/screenshots/${name}-${theme}-${width}.png`, fullPage: true });
      await check(`${name}_${theme}_${width}`, `Playwright screenshot ${name}-${theme}-${width}.png`, 'No document or nested horizontal scroll; requested theme', async () => {
        const actual = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, theme: document.documentElement.dataset.theme,
          scroll: [...document.querySelectorAll('main *')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1).length }));
        assert(actual.document <= width, JSON.stringify(actual)); assert.equal(actual.scroll, 0); assert.equal(actual.theme, theme); return actual;
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 844 });
}
try {
  mkdirSync(`${dir}/screenshots`, { recursive: true });
  await page.goto(`${base}/work`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Repository', exact: true }).selectOption(fixture.repository); await settle();
  const query = `repository_id=${fixture.repository}`;
  await check('WORK_PAGINATION', 'GET work?page=2 + click Next page / Previous page', 'API page 2 and same UI titles, then page 1', async () => {
    const second = await http(`work?${query}&page=2`);
    assert(second.data.length > 0); assert.equal(second.meta.page, 2);
    await page.getByRole('button', { name: 'Next page', exact: true }).click(); await settle();
    for (const item of second.data) assert(await page.getByRole('button', { name: item.title, exact: true }).count());
    assert.match(await page.getByRole('navigation', { name: 'Work pagination' }).innerText(), /Page 2/);
    await page.getByRole('button', { name: 'Previous page', exact: true }).click(); await settle(); return second.meta;
  });
  await check('WORK_FILTERS', 'Select Closed; search Pages merge request 2; GET work?state=closed&q=…', 'Every rendered row matches real HTTP', async () => {
    await page.getByLabel('Status', { exact: true }).selectOption('closed');
    await page.getByLabel('Search work', { exact: true }).fill('Pages merge request 2'); await settle();
    const filtered = await http(`work?${query}&state=closed&q=Pages%20merge%20request%202`);
    assert(filtered.data.length > 0);
    assert.equal(await page.locator('tr.work-row').count(), filtered.data.length);
    for (const item of filtered.data) { assert.equal(item.state, 'closed'); assert(await page.getByRole('button', { name: item.title, exact: true }).count()); }
    return filtered.data.map((item) => item.title);
  });
  await page.getByLabel('Status', { exact: true }).selectOption('');
  await page.getByLabel('Search work', { exact: true }).fill('Pages merge request 1'); await settle();
  await page.getByRole('button', { name: 'Pages merge request 1', exact: true }).click(); await settle();
  await check('WORK_DETAIL_HTTP_TOKENS', 'GET work/pr/1 and rendered selected detail', '$2.00 and 1M tokens from persisted unaffected run', async () => {
    const detail = await http(`work/pr/1?${query}`);
    const run = detail.runs.find((row) => row.id === fixture.run1);
    assert.equal(run.cost_usd, 2); assert.equal(run.tokens, 1000000);
    const text = await page.locator('#work-detail').innerText(); assert.match(text, /\$2\.00 USD · 1M tokens/); return text;
  });
  await check('WORK_GITLAB_HREF', 'Selected detail → Open in GitLab href', 'https://gitlab.example.invalid/w19/pages/-/merge_requests/1', async () => {
    const href = await page.getByRole('link', { name: 'Open in GitLab', exact: true }).getAttribute('href');
    assert.equal(href, 'https://gitlab.example.invalid/w19/pages/-/merge_requests/1'); return href;
  });
  await capture('work-detail');
  await check('KNOWN_557_SESSION_ATTRIBUTION', 'GET work/issue/1 vs persisted issue_numbers=[1]', '1 linked run', async () => {
    const detail = await http(`work/issue/1?${query}`); assert.equal(detail.item.runs_count, 1); return detail.item.runs_count;
  }, '0Hoag/agent-ops#557');
  await check('KNOWN_559_RECORDED_COST', 'GET work/pr/2 vs persisted cost_usd=12.4', '12.4 recorded USD, not estimate 2', async () => {
    const detail = await http(`work/pr/2?${query}`); const cost = detail.runs.find((row) => row.id === fixture.run2)?.cost_usd;
    assert.equal(cost, 12.4); return cost;
  }, '0Hoag/agent-ops#559');
  await page.goto(`${base}/usage`); await settle();
  await page.getByLabel('Usage repository', { exact: true }).selectOption(fixture.repository); await settle();
  await check('USAGE_RECORDED_COST_TOKENS', 'GET agent-runs and Usage sessions table', '$2.00 + $12.40, each 1M tokens; header $14.40', async () => {
    const data = await http(`agent-runs?${query}`);
    assert.equal(data.data.length, 2); assert.equal(data.data.reduce((sum, row) => sum + row.cost_usd, 0), 14.4);
    const text = await page.locator('main').innerText(); assert.match(text, /\$14\.40 spent/);
    for (const number of [1, 2]) { const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: new RegExp(`feat/pages-${number}`) }) }); assert.match(await row.innerText(), number === 1 ? /\$2\.00/ : /\$12\.40/); assert.match(await row.innerText(), /1M/); }
    return 'HTTP persisted sum=14.4; two UI rows each 1M';
  });
  await check('USAGE_FILTERS', 'Select Today; Split by Tool then Repository', 'Claude and w19/pages splits, date selection applied', async () => {
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Today' }); await settle();
    await page.getByLabel('Split by', { exact: true }).selectOption('Tool'); await settle();
    assert.match(await page.locator('main').innerText(), /Claude/);
    await page.getByLabel('Split by', { exact: true }).selectOption('Repository'); await settle();
    assert.match(await page.locator('main').innerText(), /w19\/pages/); return 'Today / Tool / Repository selected';
  });
  await capture('usage');
  await page.getByRole('link', { name: /feat\/pages-1/ }).click(); await settle();
  await check('PAGE_SESSION_TIMELINE', 'Usage session link → compiled Session Timeline component', 'Ordered Read/Test steps, $0.50/$1.50, cache trend 100%/50%, real MR href', async () => {
    await page.getByRole('heading', { name: 'Session detail', exact: true }).waitFor();
    const text = await page.locator('main').innerText(); assert.match(text, /\$2\.00 · USD/);
    assert(text.indexOf('Step 1 · Read pages') >= 0, 'PAGE_SESSION_TIMELINE: Step 1 · Read pages must render');
    assert(text.indexOf('Step 1 · Read pages') < text.indexOf('Step 2 · Test pages'));
    assert.match(text, /\$0\.50/); assert.match(text, /\$1\.50/);
    assert.deepEqual(await page.getByRole('meter').evaluateAll((els) => els.map((el) => el.getAttribute('value'))), ['100', '50']);
    assert.equal(await page.getByRole('link', { name: 'w19/pages · MR #1', exact: true }).getAttribute('href'), 'https://gitlab.example.invalid/w19/pages/-/merge_requests/1');
    const timeline = await http(`agent-runs/${fixture.run1}/timeline`); assert.equal(timeline.data.steps.length, 2); return text;
  });
  await capture('session');
  await check('BROWSER_ERRORS', 'Playwright pageerror and real HTTP status log', 'No page errors or failed API requests', () => { assert.deepEqual(errors, []); assert.deepEqual(network.filter((row) => row.status >= 400), []); return 'none'; });
} catch (error) {
  failures.push({ name: 'ENVIRONMENT_OR_NAVIGATION', actual: error.stack });
} finally {
  writeFileSync(`${dir}/result.json`, JSON.stringify({ limits: fixture.limits, rows, failures, network, errors }, null, 2));
  writeFileSync(`${dir}/acceptance.md`, '| Acceptance | Command | Expected | Actual |\n|---|---|---|---|\n' + rows.map((row) => `| ${row.name} (${row.result}) | ${row.command} | ${row.expected} | ${JSON.stringify(row.actual).replaceAll('|', '/').replaceAll('\n', ' ')} |`).join('\n'));
  await browser.close();
}
process.exitCode = failures.length ? 1 : 0;
