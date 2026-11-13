// Successful responses always come from the real API. Only member GET failures are injected.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
mkdirSync(`${dir}/screenshots`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const login = await browser.newPage();
  await login.goto(`${base}/alerts`);
  await login.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await login.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await login.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await login.getByRole('button', { name: 'Continue', exact: true }).click();
  await login.waitForURL((url) => url.pathname !== '/login');
  const token = await login.evaluate(() => sessionStorage.getItem('agent-ops-token'));
  assert(token, 'Sign-in must issue a real token');
  await login.close();
  const consumers = [
    { name: 'alerts', path: '/alerts', error: /Unable to verify permissions/, write: 'Create channel' },
    { name: 'budgets', path: '/budgets', error: /Unable to load budget permissions/, write: 'Create budget' },
    { name: 'batches', path: '/waves', error: /permissions could not be verified/, write: 'Create batch' },
  ];
  for (const consumer of consumers) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 844 } });
    await context.addInitScript((value) => sessionStorage.setItem('agent-ops-token', value), token);
    const page = await context.newPage();
    const row = { consumer: consumer.name, failures: [], recovered: [] };
    const pattern = '**/api/v1/organizations/*/members';
    try {
      await page.route(pattern, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        row.failures.push({ url: route.request().url(), status: 500 });
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Permission review 500' }) });
      });
      await page.goto(`${base}${consumer.path}`);
      const alert = page.getByRole('alert').filter({ hasText: consumer.error });
      await alert.waitFor({ timeout: 20000 });
      assert(row.failures.length > 0, `${consumer.name}: exact member GET must fail`);
      assert.equal(await page.getByRole('button', { name: consumer.write, exact: true }).count(), 0, `${consumer.name}: failed permission must not grant writes`);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.screenshot({ path: `${dir}/screenshots/${consumer.name}-failed-${width}.png`, fullPage: true });
      }
      const retry = alert.getByRole('button', { name: 'Retry', exact: true });
      assert.equal(await retry.count(), 1, `${consumer.name}: permission Retry must target its own failed request`);
      await page.unroute(pattern);
      const responsePromise = page.waitForResponse((response) => row.failures.some((failure) => failure.url === response.url()) && response.request().method() === 'GET' && response.status() === 200);
      await retry.click();
      const response = await responsePromise;
      row.recovered.push({ url: response.url(), status: response.status(), body: await response.json() });
      await page.getByRole('button', { name: consumer.write, exact: true }).waitFor();
      assert.equal(await alert.count(), 0, `${consumer.name}: scoped Retry must clear permission failure`);
      if (consumer.name === 'batches') await page.getByRole('region', { name: 'Advanced agent controls', exact: true }).waitFor();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.screenshot({ path: `${dir}/screenshots/${consumer.name}-recovered-${width}.png`, fullPage: true });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${consumer.name}: no horizontal scroll at ${width}`);
      }
      row.pass = true;
    } catch (error) { row.error = error.message; row.pass = false; }
    finally { results.push(row); await context.close(); }
  }
  assert(results.every((row) => row.pass), `Permission recovery assertions failed: ${JSON.stringify(results)}`);
  console.log('PASS: independent alerts, budgets and batches member-request recovery; real 200s; 1280/390 screenshots');
} finally {
  writeFileSync(`${dir}/permission-recovery.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
