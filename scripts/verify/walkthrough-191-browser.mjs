// Scripted worker observation; timing includes browser work, not human deliberation.
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const [fixture] = JSON.parse(process.env.AUTH_FIXTURE);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.setDefaultTimeout(15000);
const http = [];
const pending = [];
const result = { mode: 'scripted worker, not manual owner timing', answers: [], status: 'incomplete' };
page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('/auth/')) {
    pending.push((async () => { try { http.push({ path: url.pathname + url.search, status: response.status(), body: await response.json() }); } catch { /* Non-JSON response. */ } })());
  }
});
let clicks = 0;
await page.exposeFunction('walkthroughClick', () => { clicks++; });
await page.addInitScript(() => document.addEventListener('click', () => void window.walkthroughClick(), true));
try {
  await page.goto(process.env.PRODUCT_E2E_URL);
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('form').getByLabel('Organization', { exact: true }).selectOption(fixture.org);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Cache hit rate', exact: true }).waitFor();
  const began = performance.now();
  for (const [index, question] of ['What did AI cost this week?', 'Is it getting more efficient?', 'What needs attention?'].entries()) {
    clicks = 0;
    const start = performance.now();
    if (index === 0) await page.getByRole('button', { name: '7 days', exact: true }).click();
    if (index === 2) {
      for (const summary of await page.getByRole('region', { name: 'Needs attention', exact: true }).locator('summary').all()) await summary.click();
    }
    const visible = await page.locator('main').innerText();
    const seconds = (performance.now() - start) / 1000;
    const screenshot = `question-${index + 1}-1280.png`;
    await page.screenshot({ path: `${dir}/${screenshot}`, fullPage: true });
    result.answers.push({ question, clicks, seconds, visible, screenshot, url: page.url(), assessment: 'Requires worker interpretation and persisted/HTTP comparison; not auto-passed' });
  }
  result.combinedSeconds = (performance.now() - began) / 1000;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/overview-390.png`, fullPage: true });
  result.mobileHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  result.status = 'observed-needs-review';
} catch (error) {
  result.failure = error.stack;
  process.exitCode = 1;
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
} finally {
  await Promise.allSettled(pending);
  writeFileSync(`${dir}/http.json`, JSON.stringify(http, null, 2));
  writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
