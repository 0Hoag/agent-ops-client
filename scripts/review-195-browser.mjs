// Real API, supported login, no intercepted routes. Invoked by review-183 --overview-195.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
mkdirSync(`${dir}/screenshots`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const responses = [];
const matrix = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (/\/api\/v1\/(overview|insights\/analytics)(\?|$)/.test(response.url())) {
    responses.push(response.text().then((body) => ({ url: response.url(), status: response.status(), body })));
  }
});
try {
  await page.goto(`${process.env.PRODUCT_E2E_URL}/`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const text = await page.locator('main').innerText();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.screenshot({ path: `${dir}/screenshots/overview-${theme}-${width}.png`, fullPage: true });
      matrix.push({ name: 'overview', theme, width, text, documentWidth });
    }
  }
  const captured = await Promise.all(responses);
  const overview = JSON.parse(captured.find((item) => new URL(item.url).pathname.endsWith('/overview')).body).data;
  assert(overview.current.models_without_price.includes('review-unpriced'));
  assert(overview.attention.length >= 75, 'Populated attention backlog required');
  for (const row of matrix) {
    assert.match(row.text.split('Getting started')[0], /partial|incomplete|excludes|at least/i, 'Overview spend must disclose missing model prices beside its headline');
    assert(row.documentWidth <= row.width, `No horizontal overflow at ${row.width}`);
    assert(!row.text.includes('open pull request has had no activity'), 'Repeated records must be collapsed on arrival');
  }
  const headline = page.getByRole('region', { name: 'Spend summary' });
  assert.match(await headline.innerText(), /review-unpriced/);
  assert.equal(await headline.getByRole('link', { name: 'Set model prices' }).getAttribute('href'), '/settings/advanced#model-prices');
  const attention = page.getByRole('region', { name: 'Needs attention' });
  const summaries = attention.locator('summary');
  assert(await summaries.count() > 0);
  const expanded = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const summary of await summaries.all()) {
        await summary.focus();
        await page.keyboard.press('Enter');
      }
      const visibleRecords = await attention.getByRole('listitem').count();
      assert.equal(visibleRecords, overview.attention.length, 'Every attention record remains accessible');
      for (const item of overview.attention) {
        if (item.pr_number) assert(await attention.getByText(`PR #${item.pr_number}`, { exact: true }).count() > 0);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${dir}/screenshots/overview-expanded-${theme}-${width}.png`, fullPage: true });
      expanded.push({ theme, width, visibleRecords });
      for (const summary of await summaries.all()) { await summary.focus(); await page.keyboard.press('Enter'); }
    }
  }
  await headline.getByRole('link', { name: 'Set model prices' }).click();
  await page.getByRole('tabpanel', { name: 'Model prices', exact: true }).waitFor();
  writeFileSync(`${dir}/expanded.json`, JSON.stringify(expanded, null, 2));
  const before = JSON.parse(readFileSync(`${dir}/../before/api-responses.json`, 'utf8'));
  for (const path of ['/api/v1/overview', '/api/v1/insights/analytics']) {
    const extract = (items) => JSON.parse(items.find((item) => new URL(item.url).pathname === path).body);
    assert.deepEqual(extract(captured), extract(before), `Identical API inputs: ${path}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS partial spend, missing model pricing action, keyboard disclosure, all attention records, identical API inputs, desktop/mobile light/dark without overflow');
} finally {
  writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(await Promise.all(responses), null, 2));
  writeFileSync(`${dir}/page-errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
