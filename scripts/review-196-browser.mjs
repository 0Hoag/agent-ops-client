// Real navigation and API responses only; never start workers or contact providers.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const matrix = [], responses = [], network = [], errors = [];
const actions = [];
async function mutate(name, method, endpoint, action, expected = {}) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/${endpoint}` && response.request().method() === method);
  const [response] = await Promise.all([pending, action()]);
  const body = await response.text();
  const submitted = method === 'DELETE' ? null : response.request().postDataJSON();
  actions.push({ name, method, endpoint, status: response.status(), submitted, body });
  writeFileSync(`${dir}/actions.json`, JSON.stringify(actions, null, 2));
  assert(response.ok(), `${name}: HTTP ${response.status()} ${body}`);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(submitted[key], value, `${name}: exact ${key}`);
  await page.waitForLoadState('networkidle');
  return body ? JSON.parse(body) : null;
}
async function exerciseBudgets() {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto(`${base}/budgets`);
  await page.waitForLoadState('networkidle');
  const repository = page.locator('main form').getByRole('combobox', { name: 'Repository', exact: true });
  await repository.selectOption({ label: 'review-196/disposable' });
  const repositoryId = await repository.inputValue();
  assert(repositoryId, 'Authorized repository selected');
  await page.getByLabel('Start date', { exact: true }).fill('2026-02-01');
  await page.getByLabel('End date', { exact: true }).fill('2027-02-01');
  await page.getByLabel('Batch', { exact: true }).fill('Browser CRUD batch');
  await page.getByLabel('Token limit', { exact: true }).fill('12345');
  await page.getByLabel('USD limit', { exact: true }).fill('12.5');
  const created = await mutate('budget create via authorized repository', 'POST', 'budgets', () => page.getByRole('button', { name: 'Create budget', exact: true }).click(), { repository_id: repositoryId, token_limit: 12345, usd_limit: 12.5 });
  const dates = actions.at(-1).submitted;
  assert.match(dates.starts_at, /^2026-02-01T00:00:00(?:\.000)?Z$/);
  assert.match(dates.ends_at, /^2027-02-01T00:00:00(?:\.000)?Z$/);
  const budgetId = created.data.id;
  const budget = page.locator('article').filter({ hasText: 'Browser CRUD batch' });
  await budget.getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await repository.inputValue(), repositoryId);
  await page.getByLabel('USD limit', { exact: true }).fill('19.75');
  await mutate('budget edit retains authorized repository', 'PATCH', `budgets/${budgetId}`, () => page.getByRole('button', { name: 'Update budget', exact: true }).click(), { repository_id: repositoryId, usd_limit: 19.75 });
  await budget.getByText('Token limit: 12345; USD limit: 19.75', { exact: true }).waitFor();

}
async function exerciseOptionalBudgetEnd() {
  await page.goto(`${base}/budgets`);
  await page.waitForLoadState('networkidle');
  const form = page.locator('main form');
  await form.getByRole('combobox', { name: 'Repository', exact: true }).selectOption({ label: 'review-196/disposable' });
  await form.getByLabel('Start date', { exact: true }).fill('2026-03-01');
  await form.getByLabel('End date', { exact: true }).fill('');
  await form.getByLabel('Batch', { exact: true }).fill('Browser optional end date');
  await form.getByLabel('Token limit', { exact: true }).fill('23456');
  await form.getByLabel('USD limit', { exact: true }).fill('7.5');
  const limitation = 'Open-ended budgets are unavailable: the current API requires both a start date and an end date.';
  await page.getByText(limitation, { exact: true }).waitFor();
  const end = form.getByLabel('End date', { exact: true });
  assert(await end.evaluate((input) => input.required), 'End date is natively required');
  const requests = [];
  const observe = (request) => {
    if (new URL(request.url()).pathname === '/api/v1/budgets' && request.method() === 'POST') requests.push(request.url());
  };
  page.on('request', observe);
  try {
    await form.getByRole('button', { name: 'Create budget', exact: true }).click();
    assert(await end.evaluate((input) => input.validity.valueMissing), 'Blank End date is invalid');
    assert.equal(await form.evaluate((element) => element.checkValidity()), false);
    await page.waitForLoadState('networkidle');
    // Navigation closes the observation window after the blocked submission.
    await page.goto(`${base}/settings/advanced#advanced`);
    await page.waitForLoadState('networkidle');
    assert.deepEqual(requests, [], 'Unsupported open-ended budget must not POST');
    actions.push({ name: 'unsupported open-ended budget blocked before API request', limitation, endDateRequired: true, valueMissing: true, postRequests: requests.length });
    writeFileSync(`${dir}/actions.json`, JSON.stringify(actions, null, 2));
  } finally { page.off('request', observe); }
}
async function exerciseAlerts() {
  await page.goto(`${base}/alerts`);
  await page.waitForLoadState('networkidle');
  const channels = page.getByRole('region', { name: 'Notification channels', exact: true });
  const slack = channels.locator('article').filter({ hasText: 'Slack' });
  await slack.getByRole('button', { name: 'Edit', exact: true }).click();
  await channels.getByLabel('Slack webhook URL reference', { exact: true }).fill('REVIEW_196_STILL_UNCONFIGURED');
  await mutate('channel edit reference only', 'PUT', 'alerts/channels/slack', () => channels.getByRole('button', { name: 'Save channel', exact: true }).click(), { slack_webhook_url_env_ref: 'REVIEW_196_STILL_UNCONFIGURED', enabled: false });
  await mutate('channel enable without configured provider', 'PUT', 'alerts/channels/slack', () => slack.getByRole('button', { name: 'Enable', exact: true }).click(), { enabled: true });
  await mutate('channel disable', 'PUT', 'alerts/channels/slack', () => slack.getByRole('button', { name: 'Disable', exact: true }).click(), { enabled: false });
  await mutate('channel delete', 'DELETE', 'alerts/channels/slack', () => slack.getByRole('button', { name: 'Delete', exact: true }).click());
  await channels.getByLabel('Slack webhook URL reference', { exact: true }).fill('REVIEW_196_UNCONFIGURED_SLACK');
  await channels.getByLabel('Enabled', { exact: true }).uncheck();
  await mutate('channel create disabled reference only', 'POST', 'alerts/channels', () => channels.getByRole('button', { name: 'Create channel', exact: true }).click(), { enabled: false, slack_webhook_url_env_ref: 'REVIEW_196_UNCONFIGURED_SLACK' });
  const thresholds = page.getByRole('region', { name: 'Alert threshold settings', exact: true });
  await thresholds.getByLabel('Minimum cache-hit rate (0–1)', { exact: true }).fill('0.375');
  await thresholds.getByLabel('Agent inactivity threshold (seconds)', { exact: true }).fill('123');
  await thresholds.getByLabel('Pull request inactivity threshold (seconds)', { exact: true }).fill('456');
  await mutate('threshold save exact values', 'PUT', 'alerts/thresholds', () => thresholds.getByRole('button', { name: 'Save thresholds', exact: true }).click(), { min_cache_hit: 0.375, silent_seconds: 123, pr_stale_seconds: 456 });
  assert.deepEqual(Object.keys(actions.at(-1).submitted).sort(), ['min_cache_hit', 'pr_stale_seconds', 'silent_seconds']);
  await page.reload();
  await page.waitForLoadState('networkidle');
  assert.equal(await thresholds.getByLabel('Minimum cache-hit rate (0–1)', { exact: true }).inputValue(), '0.375');
  assert.equal(await thresholds.getByLabel('Agent inactivity threshold (seconds)', { exact: true }).inputValue(), '123');
  assert.equal(await thresholds.getByLabel('Pull request inactivity threshold (seconds)', { exact: true }).inputValue(), '456');

}
async function exerciseBatches() {
  await page.goto(`${base}/waves`);
  await page.waitForLoadState('networkidle');
  await page.locator('form').getByLabel('Name', { exact: true }).fill('Browser CRUD batch');
  await page.locator('form').getByLabel('Brief', { exact: true }).fill('Disposable browser-created brief.');
  const createdBatch = await mutate('batch create', 'POST', 'waves', () => page.getByRole('button', { name: 'Create batch', exact: true }).click(), { name: 'Browser CRUD batch' });
  const batchId = createdBatch.data.id;
  await mutate('batch state to in progress', 'PATCH', `waves/${batchId}`, () => page.getByLabel('State for Browser CRUD batch', { exact: true }).selectOption('in_progress'), { state: 'in_progress' });
  await mutate('batch state to review', 'PATCH', `waves/${batchId}`, () => page.getByLabel('State for Browser CRUD batch', { exact: true }).selectOption('review'), { state: 'review' });
  await page.getByLabel('Brief for Browser CRUD batch', { exact: true }).fill('Updated browser brief.');
  const batch = page.locator('article').filter({ hasText: 'Browser CRUD batch' });
  await mutate('batch brief', 'PATCH', `waves/${batchId}`, () => batch.getByRole('button', { name: 'Save brief', exact: true }).click(), { brief: 'Updated browser brief.' });
  await page.reload();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByLabel('State for Browser CRUD batch', { exact: true }).inputValue(), 'review');
  assert.equal(await page.getByLabel('Brief for Browser CRUD batch', { exact: true }).inputValue(), 'Updated browser brief.');
}
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (!path.startsWith('/api/')) return;
  network.push({ path, status: response.status() });
  // Do not save authentication responses containing bearer credentials.
  if (!path.includes('/auth/')) responses.push(response.text().then((body) => ({ url: response.url(), status: response.status(), body })).catch((error) => ({ path, error: error.message })));
});
async function capture(name, path, link) {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto(`${base}/settings/advanced#advanced`);
  await page.waitForLoadState('networkidle');
  let href;
  if (link) {
    const anchor = page.getByRole('link', { name: link, exact: true });
    href = await anchor.getAttribute('href');
    await anchor.click();
    await page.waitForLoadState('networkidle');
    if (process.env.REVIEW_196_PHASE === 'after' && ['Agents', 'Logs'].includes(link)) {
      assert.equal(new URL(page.url()).pathname, '/waves');
      assert.equal(new URL(page.url()).hash, link === 'Agents' ? '#agents' : '#logs');
      await page.locator(link === 'Agents' ? '#agents' : '#logs').waitFor();
      if (link === 'Logs') assert.match(await page.locator('#logs').innerText(), /cannot find or reconnect to another job here/);
    }
  }
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(150);
      const value = await page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        return { text: main.innerText, width: innerWidth, documentWidth: document.documentElement.scrollWidth, headings: [...main.querySelectorAll('h1,h2,h3')].map((element) => element.textContent) };
      });
      const screenshot = `screenshots/${name}-${theme}-${width}.png`;
      await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
      matrix.push({ name, path, href, resolvedPath: new URL(page.url()).pathname, resolvedHash: new URL(page.url()).hash, theme, screenshot, ...value });
      writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
      console.log(`${name}/${theme}/${width}: ${page.url()} document=${value.documentWidth}`);
    }
  }
}
try {
  mkdirSync(`${dir}/screenshots`, { recursive: true });
  await page.goto(`${base}/settings/advanced#advanced`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: process.env.PRODUCT_E2E_ORG });
  const selection = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/auth/select-organization') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert((await selection).ok(), 'Tenant selected through real login UI');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  await capture('settings-advanced', '/settings/advanced#advanced');
  for (const [name, label] of [['advanced-batches', 'Batches'], ['advanced-agents', 'Agents'], ['advanced-logs', 'Logs'], ['advanced-budgets', 'Budgets'], ['advanced-alerts', 'Alerts']]) await capture(name, 'follow Advanced link', label);
  if (process.env.REVIEW_196_PHASE === 'after') {
    for (const exercise of [exerciseOptionalBudgetEnd, exerciseBudgets, exerciseAlerts, exerciseBatches]) {
      try {
        await exercise();
        actions.push({ name: exercise.name, completed: true });
        writeFileSync(`${dir}/actions.json`, JSON.stringify(actions, null, 2));
      }
      catch (error) {
        actions.push({ name: exercise.name, failure: error.stack || String(error) });
        writeFileSync(`${dir}/actions.json`, JSON.stringify(actions, null, 2));
        console.error(`${exercise.name}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  assert(!network.some((item) => /\/workers\/(start|restart)/.test(item.path)), 'No workers launched');
  console.log(`CAPTURED ${matrix.length} cells; no worker start/restart requests.`);
} finally {
  writeFileSync(`${dir}/network.json`, JSON.stringify(network, null, 2));
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(await Promise.all(responses), null, 2));
  writeFileSync(`${dir}/page-errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
