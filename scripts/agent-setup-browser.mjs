// Real login and clipboard; no intercepted routes or injected authentication.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const network = [];
const errors = [];
const captures = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (new URL(response.url()).pathname.startsWith('/api/')) network.push({ path: new URL(response.url()).pathname, status: response.status() });
});
try {
  await page.goto(`${process.env.PRODUCT_E2E_URL}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Setup 194' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  await page.goto(`${process.env.PRODUCT_E2E_URL}/settings/advanced#agent-setup`);
  await page.getByRole('tabpanel').getByLabel('Repository', { exact: true }).selectOption(process.env.SETUP_REPOSITORY);
  await page.waitForLoadState('networkidle');
  const initialText = await page.getByRole('tabpanel').innerText();
  // The same first assertion and selected repository are used before and after.
  // Preserve screenshots even when the old masked command fails the control.
  if (!/••••|<token>|--token/.test(initialText)) {
    assert(await page.getByRole('button', { name: 'Copy command' }).isDisabled());
    await page.getByLabel('Transcript file path', { exact: true }).fill(process.env.SETUP_TRANSCRIPT);
    await page.getByRole('button', { name: 'Copy command' }).click();
    await page.getByRole('status').filter({ hasText: 'Command copied' }).waitFor();
    const command = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(command, await page.getByRole('tabpanel').locator('code').last().innerText());
    assert.match(command, /agentops push/);
    assert.match(command, /AGENT_RUN_TOKEN:\?/);
    assert.match(command, /--repository-id/);
    assert(!command.includes(process.env.AGENT_RUN_TOKEN), 'Credential must not be copied');
    writeFileSync(`${dir}/command.txt`, command);
  }
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(dimensions.document <= dimensions.viewport, `Horizontal scroll at ${width}`);
      const path = `${dir}/agent-setup-${theme}-${width}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push({ theme, ...dimensions, path, text: await page.getByRole('tabpanel').innerText() });
    }
  }
  assert.doesNotMatch(initialText, /••••|<token>|--token/, 'Setup must not offer a masked nonfunctional command');
  assert.match(initialText, /deployment administrator/);
  assert.match(initialText, /dashboard login is not an ingestion credential/);
  assert.deepEqual(errors, []);
  assert(network.some((item) => item.path.endsWith('/auth/login') && item.status === 200));
  assert(network.some((item) => item.path.endsWith('/repositories') && item.status === 200));
  console.log('PASS real login, actionable setup, clipboard, 1280/390 light/dark, no horizontal scroll');
} finally {
  writeFileSync(`${dir}/browser.json`, JSON.stringify({ network, errors, captures }, null, 2));
  await browser.close();
}
