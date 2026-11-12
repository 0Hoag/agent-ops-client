// No intercepted routes or injected authentication: every page uses the Compose API.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const network = [];
const errors = [];
const matrix = [];
const responses = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith('/api/')) network.push({ path, status: response.status() });
  if (/\/api\/v1\/(overview|work|budgets|insights\/analytics|agent-runs)(\/|$)/.test(path)) {
    responses.push(response.text().then((body) => ({ url: response.url(), status: response.status(), body })).catch((error) => ({ path, error: error.message })));
  }
});
const screens = [
  ['overview', '/'],
  ['onboarding', '/#getting-started'],
  ['work', '/work'],
  ['work-detail', '/work'],
  ['usage', '/usage'],
  ['session', `/usage/sessions?run=${process.env.W18_RUN}&repository=${process.env.W18_REPOSITORY}`],
  ['settings-repositories', '/settings/advanced#repositories'],
  ['settings-agent', '/settings/advanced#agent-setup'],
  ['settings-prices', '/settings/advanced#model-prices'],
  ['settings-members', '/settings/advanced#members'],
  ['settings-advanced', '/settings/advanced#advanced'],
  ['advanced-batches', '/waves'],
  ['advanced-agents', '/work'],
  ['advanced-logs', '/runs'],
  ['advanced-budgets', '/budgets'],
  ['advanced-alerts', '/alerts'],
  ['repositories-direct', '/repositories'],
  ['prices-direct', '/prices'],
  ['members-direct', '/members'],
  ['board-legacy', '/board'],
];
async function measure() {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const text = main.innerText;
    const uuid = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) ?? [];
    const iso = text.match(/\b\d{4}-\d\d-\d\dT\d\d:\d\d[^\s]*/g) ?? [];
    const unknown = text.match(/\bunknown\b/gi) ?? [];
    const jargon = text.match(/\b(harness|wave|worker|run|runs)\b/gi) ?? [];
    const scrollRegions = [...main.querySelectorAll('*')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1).map((el) => `${el.tagName}.${el.className}`);
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, scrollRegions, uuid, iso, unknown, jargon, text, headings: [...main.querySelectorAll('h1,h2')].map((el) => el.textContent), controls: [...main.querySelectorAll('button,input,select')].map((el) => ({ tag: el.tagName, name: el.getAttribute('aria-label') ?? el.textContent, type: el.getAttribute('type') })), theme: document.documentElement.dataset.theme };
  });
}
function assertNoOverflow(value) {
  assert(value.documentWidth <= value.width, `horizontal overflow: ${value.documentWidth} > ${value.width}`);
}
try {
  await page.goto(`${base}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  // Negative control for the new viewport measurement, using identical API data.
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await measure();
  const style = await page.addStyleTag({ content: 'html { min-width: 2000px !important; }' });
  const broken = await measure();
  assert.throws(() => assertNoOverflow(broken), /horizontal overflow/);
  await style.evaluate((el) => el.remove());
  const restored = await measure();
  assert.equal(restored.documentWidth, before.documentWidth);
  writeFileSync(`${dir}/viewport-control.json`, JSON.stringify({ mutation: 'html min-width:2000px; removed after measurement', before, broken, restored }, null, 2));
  for (const [name, path] of screens) {
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle');
    if (['work', 'work-detail', 'advanced-agents'].includes(name)) {
      await page.locator('main').getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
      await page.waitForLoadState('networkidle');
      if (name === 'work-detail') {
        await page.getByRole('textbox', { name: 'Search work', exact: true }).fill('Improve hosting deployment 1');
        await page.getByRole('button', { name: 'Improve hosting deployment 1', exact: true }).click();
        await page.locator('aside h2').waitFor();
      }
    }
    if (name === 'settings-agent') {
      await page.getByRole('tabpanel', { name: 'Agent setup', exact: true }).getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
    }
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(150);
        const result = await measure();
        const screenshot = `screenshots/${name}-${theme}-${width}.png`;
        mkdirSync(`${dir}/screenshots`, { recursive: true });
        await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
        const row = { name, path, resolvedPath: new URL(page.url()).pathname, theme, width, screenshot, ...result };
        matrix.push(row);
        console.log(`${name}/${theme}/${width}: document=${result.documentWidth}; UUID=${result.uuid.length}; ISO=${result.iso.length}; Unknown=${result.unknown.length}; jargon=${result.jargon.length}`);
        writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
      }
    }
  }
  console.log(`CAPTURED ${matrix.length} real API-backed cells. Visual and numeric judgment required; this is not an automatic UX pass.`);
  if (process.env.W18_ASSERT_FIXES) {
    for (const row of matrix.filter((row) => row.name === 'advanced-budgets')) {
      assert.match(row.text, /No budgets configured\./, 'Budgets regression: expected empty state, not a blank page');
    }
    for (const row of matrix.filter((row) => ['settings-prices', 'prices-direct'].includes(row.name))) {
      assert.equal(row.iso.length, 0, 'Pricing regression: no raw ISO timestamps');
      assert.match(row.text, /Jan 1, 2020/);
    }
    assert.deepEqual(errors, [], 'No unhandled page errors');
    console.log('PASS budget envelope and readable pricing date regressions');
  }
} finally {
  writeFileSync(`${dir}/network.json`, JSON.stringify(network, null, 2));
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(await Promise.all(responses), null, 2));
  writeFileSync(`${dir}/page-errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
