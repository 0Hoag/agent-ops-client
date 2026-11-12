import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
const matrix = [];
const network = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.url().includes('/api/v1/')) network.push({ path: new URL(response.url()).pathname, status: response.status(), fixture: fixtureState });
});
let fixtureState = null;
const screens = [
  ['overview', '/', /Spend by day/],
  ['work', '/work', /Verify accessible product flows/],
  ['usage', '/usage', /Claude · feat\/qa/],
  ['session', `/usage/sessions?run=${process.env.W18_RUN}&repository=${process.env.W18_REPOSITORY}`, /Step 1/],
  ['settings', '/settings/advanced', /product\/e2e/],
  ['onboarding', '/#getting-started', /3 of 3 steps complete/],
];
const settingsScreens = [
  ['settings-agent', '/settings/advanced#agent-setup', /Run this command/],
  ['settings-prices', '/settings/advanced#model-prices', /qa-model/],
  ['settings-members', '/settings/advanced#members', /^owner$/],
  ['settings-advanced', '/settings/advanced#advanced', /^Alerts$/],
];
async function capture(name, state, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const axe = await page.evaluate(async () => {
    const result = await window.axe.run();
    return { violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), incomplete: result.incomplete.map(({ id }) => id) };
  });
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, scrollRegions: [...document.querySelectorAll('main *')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1).map((el) => `${el.tagName}.${el.className}`), offenders: [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map((el) => `${el.tagName}.${el.className}`) }));
  const layout = await page.evaluate(() => {
    const header = document.querySelector('header').getBoundingClientRect();
    const main = document.querySelector('main').getBoundingClientRect();
    return { headerTop: header.top, headerBottom: header.bottom, mainTop: main.top, aligned: header.x === main.x };
  });
  const screenshot = `${name}-${state}-${width}.png`;
  await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
  const serious = axe.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  matrix.push({ page: name, state, source: fixtureState ? 'route fixture' : 'real Compose API', width, screenshot, overflow, layout, ...axe });
  console.log(`${name}/${state}/${width}: overflow=${overflow.document > width}; serious=${serious.map(({ id }) => id).join(',') || 0}`);
}
async function navigate(name, path, ready) {
  await page.goto(`${base}${path}`);
  if (name === 'work') {
    await page.locator('main').getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
  }
  if (!fixtureState) await page.locator('main').getByText(ready).first().waitFor();
  else if (fixtureState === 'loading') await page.locator('main').getByRole('status').first().waitFor();
  else if (fixtureState === 'error') await page.locator('main').getByRole('alert').first().waitFor();
  else await page.waitForTimeout(700);
}
async function keyboardFlow() {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: 'Open navigation' }).waitFor();
  // Tab from the document start; do not substitute clicks for keyboard activation.
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open navigation');
  const focus = await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return { outline: style.outlineStyle, width: style.outlineWidth }; });
  assert(focus.outline !== 'none' && focus.width !== '0px', 'visible keyboard focus');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); // Close
  await page.keyboard.press('Tab'); // Overview
  await page.keyboard.press('Tab'); // Work
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Work');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Work', exact: true }).isVisible(), false);
  await page.goto(`${base}/settings/advanced#agent-setup`);
  const tab = page.getByRole('tab', { name: 'Agent setup', exact: true });
  await tab.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Model prices', selected: true }).count(), 1, 'Settings arrow-key activation');
  await page.keyboard.press('End');
  assert.equal(await page.getByRole('tab', { name: 'Advanced', selected: true }).count(), 1);
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('tab', { name: 'Repositories', selected: true }).count(), 1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/usage`);
    const session = page.getByRole('link', { name: /Claude · feat\/qa/ });
    await session.waitFor();
    await page.getByRole('combobox', { name: 'Date range', exact: true }).focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await session.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Session detail' }).waitFor();
    await page.getByRole('link', { name: 'Back to Usage' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
    await page.goto(`${base}/#getting-started`);
    await page.getByRole('link', { name: 'Send the first agent session', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('tab', { name: 'Agent setup', selected: true }).waitFor();
    await page.goto(`${base}/work`);
    await page.locator('main').getByRole('combobox', { name: 'Repository', exact: true }).selectOption(process.env.W18_REPOSITORY);
    const work = page.getByRole('button', { name: 'Verify accessible product flows', exact: true });
    await work.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Verify accessible product flows', exact: true }).waitFor();
  }
  writeFileSync(`${dir}/keyboard.json`, JSON.stringify({ mobileNavigation: 'Tab order + Enter to Work; closed after activation', focus, settingsTabs: 'ArrowRight, End, Home select and focus tabs', mainFlows: '1280/390: date preset; Usage → Session → Usage; onboarding → Agent setup; Work → detail, all keyboard activated' }, null, 2));
}
try {
  await page.goto(`${base}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Product E2E' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('main').getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  for (const [name, path, ready] of [...screens, ...settingsScreens]) {
    await navigate(name, path, ready);
    for (const state of ['populated', 'dark']) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, state === 'dark' ? 'dark' : 'light');
      for (const width of [1280, 390]) await capture(name, state, width);
    }
  }
  // Transient/missing-data states are explicitly synthetic, never real acceptance.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!fixtureState || path.includes('/auth/') || path.includes('/organizations')) return route.continue();
    if (fixtureState === 'loading') { await new Promise((done) => setTimeout(done, 20000)); return route.abort().catch(() => {}); }
    if (fixtureState === 'error') return route.fulfill({ status: 503, json: { error: 'QA fixture unavailable' } });
    return route.fulfill({ json: { data: path.endsWith('/overview') ? {} : path.endsWith('/insights/analytics') ? { buckets: [] } : [], meta: { page: 1, per_page: 100, total: 0 } } });
  });
  for (const state of ['empty', 'error', 'loading']) {
    fixtureState = state;
    for (const [name, path, ready] of screens) {
      // Work selection needs the real repository option even in fixture states.
      await page.unroute('**/api/v1/repositories');
      await page.route('**/api/v1/repositories', (route) => name === 'work' ? route.continue() : route.fallback());
      await navigate(name, path, ready);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      for (const width of [1280, 390]) await capture(name, state, width);
    }
  }
  fixtureState = null;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await keyboardFlow();
  assert.deepEqual(errors, []);
  const failures = matrix.filter((row) => row.overflow.document > row.width || (row.width === 390 && row.overflow.scrollRegions.length) || (row.width === 1280 && (!row.layout.aligned || row.layout.mainTop < row.layout.headerBottom)) || row.violations.some(({ impact }) => ['serious', 'critical'].includes(impact)));
  assert.equal(failures.length, 0, JSON.stringify(failures.map(({ page, state, width, violations, overflow }) => ({ page, state, width, violations, overflow })), null, 2));
  console.log(`PASS ${matrix.length} matrix cells; zero serious/critical axe, no viewport overflow; keyboard flows`);
} finally {
  writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
  writeFileSync(`${dir}/network.json`, JSON.stringify(network, null, 2));
  writeFileSync(`${dir}/page-errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
