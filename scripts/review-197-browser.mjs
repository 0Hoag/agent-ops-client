// Real API, supported login, identical seeded database for before/after.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const responses = [];
const pending = [];
const errors = [];
const results = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (new URL(response.url()).pathname.startsWith('/api/v1/work')) {
    pending.push(response.json().then((body) => responses.push({ url: response.url(), status: response.status(), body })));
  }
});
try {
  await page.goto(`${process.env.PRODUCT_E2E_URL}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  await page.goto(`${process.env.PRODUCT_E2E_URL}/work`);
  await page.locator('main').getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${dir}/initial-desktop.png`, fullPage: true });
  assert.equal(await page.getByText('1–50 of 360 work records', { exact: true }).count(), 1, 'Work pagination regression: explicit 360-record count missing');
  const seen = new Set();
  for (let index = 1; index <= 8; index++) {
    const first = (index - 1) * 50 + 1;
    await page.getByText(`${first}–${Math.min(index * 50, 360)} of 360 work records`, { exact: true }).waitFor();
    const rows = await page.locator('tbody tr').allTextContents();
    rows.forEach((row) => seen.add(row));
    results.push({ page: index, rows: rows.length });
    if (index < 8) await page.getByRole('button', { name: 'Next page', exact: true }).click();
  }
  assert.equal(seen.size, 360, 'Every API record must be reachable without search');
  assert(await page.getByRole('button', { name: 'Next page', exact: true }).isDisabled());
  await page.getByLabel('Search work', { exact: true }).fill('Improve hosting deployment 1');
  await page.getByText('1–50 of 111 work records', { exact: true }).waitFor();
  await page.getByLabel('Status', { exact: true }).selectOption('open');
  await page.getByText('1–39 of 39 work records', { exact: true }).waitFor();
  await page.getByLabel('Search work', { exact: true }).fill('');
  await page.getByLabel('Status', { exact: true }).selectOption('');
  await page.getByText('1–50 of 360 work records', { exact: true }).waitFor();
  const selectedTitle = await page.locator('tbody tr button').first().textContent();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await page.getByRole('button', { name: selectedTitle, exact: true }).click();
      const region = page.getByRole('region', { name: 'Selected work details' });
      await region.getByRole('heading', { level: 2 }).waitFor();
      assert(await region.evaluate((el) => document.activeElement === el), 'Selected detail receives accessible focus');
      const box = await region.boundingBox();
      assert(box.y >= 0 && box.y < 844, `Selected detail immediately visible at ${width}px`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const summary = await page.locator('main header p').first().textContent();
      assert.match(summary, /On this page: \d+ work records with failing CI;/);
      assert.match(summary, /Not repository-wide totals\./);
      await Promise.all(pending);
      const list = responses.filter((entry) => new URL(entry.url).pathname === '/api/v1/work').at(-1).body;
      const cost = list.data.filter((item) => item.cost_usd != null).reduce((sum, item) => sum + item.cost_usd, 0);
      const failures = list.data.filter((item) => ['failed', 'failure'].includes(item.ci_status)).length;
      assert(summary.includes(`${failures} work records with failing CI`));
      assert(summary.includes(list.data.some((item) => item.cost_usd != null) ? `$${cost.toFixed(2)} recorded cost` : 'no recorded costs'));
      results.push({ width, theme, summary, box, detailTitle: await region.getByRole('heading', { level: 2 }).textContent() });
      await page.screenshot({ path: `${dir}/detail-${width}-${theme}.png` });
      await page.getByRole('button', { name: 'Back to selected work', exact: true }).click();
      assert.equal(await page.evaluate(() => document.activeElement.textContent), selectedTitle);
      await page.screenshot({ path: `${dir}/work-${width}-${theme}.png` });
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS all 360 records, filters/reset, page-scoped attention/cost, desktop/mobile focus and return navigation, light/dark, no overflow');
} finally {
  await Promise.all(pending);
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(responses, null, 2));
  writeFileSync(`${dir}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
