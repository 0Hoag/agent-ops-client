// Happy paths use persisted Compose data. Only explicitly named fault cells intercept GETs.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { capture, classify, emptyLists, signIn } from './review-186-helpers.mjs';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
mkdirSync(`${dir}/screenshots`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const matrix = [];
const discovery = [];
const faults = ['500', '401', '403', '404', 'timeout', 'malformed', 'empty', 'slow', 'offline'];
const pages = [
  ['overview', '/'], ['onboarding', '/#getting-started'], ['work', '/work'], ['work-detail', '/work'],
  ['usage', '/usage'], ['session', `/usage/sessions?run=${process.env.W18_RUN}&repository=${process.env.W18_REPOSITORY}`],
  ...['repositories', 'agent-setup', 'model-prices', 'members', 'advanced'].map((tab) => [`settings-${tab}`, `/settings/advanced#${tab}`]),
  ['batches', '/waves'], ['agents', '/waves#agents'], ['logs', '/waves#logs'],
  ['budgets', '/budgets'], ['alerts', '/alerts'], ['repositories', '/repositories'],
  ['prices', '/prices'], ['members', '/members'], ['health', '/health'],
  ['invitation', '/invite/invalid-review-token'], ['legacy-board', '/board'],
  ['legacy-runs', '/runs'], ['legacy-insights', '/insights'],
].filter(([name]) => !process.env.REVIEW_PAGE || process.env.REVIEW_PAGE.split(',').includes(name));
let token;
async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 844 } });
  if (token) await context.addInitScript(({ token, repository }) => {
    sessionStorage.setItem('agent-ops-token', token);
    localStorage.setItem('agent-ops-repository', repository);
  }, { token, repository: process.env.W18_REPOSITORY });
  return { context, page: await context.newPage() };
}
async function visit(page, name, path) {
  await page.goto(`${base}${path}`);
  if (name === 'legacy-board') {
    await page.getByRole('main').getByLabel('Repository', { exact: true }).selectOption(process.env.W18_REPOSITORY);
  }
  if (name === 'work-detail') {
    await page.getByRole('button', { name: /^Improve hosting deployment / }).first().click({ timeout: 12000 });
  }
}
const save = () => writeFileSync(`${dir}/fault-matrix.json`, JSON.stringify({ discovery, matrix }, null, 2));
try {
  const login = await open();
  await login.page.goto(`${base}/usage`);
  await signIn(login.page);
  token = await login.page.evaluate(() => sessionStorage.getItem('agent-ops-token'));
  assert(token, 'Real API sign-in must issue a token');
  await login.context.close();
  for (const [name, path] of pages) {
    const { context, page } = await open();
    const calls = new Map();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const pending = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (response.request().method() !== 'GET' || !/\/api\/|\/healthz/.test(url.pathname)) return;
      pending.push(response.text().then((body) => calls.set(url.pathname + url.search, { url: url.pathname + url.search, status: response.status(), body })).catch(() => {}));
    });
    try {
      await visit(page, name, path);
      await page.waitForLoadState('networkidle');
      await Promise.all(pending);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const result = await capture(page);
        await page.screenshot({ path: `${dir}/screenshots/${name}-${width}.png`, fullPage: true });
        discovery.push({ name, path, width, ...result, errors, calls: [...calls.values()] });
      }
      if (name === 'usage') {
        const good = await capture(page);
        const style = await page.addStyleTag({ content: 'main { display:none !important }' });
        const broken = await capture(page);
        assert.throws(() => assert(broken.text.trim(), 'Page must not be blank'), /Page must not be blank/);
        await style.evaluate((node) => node.remove());
        assert.equal((await capture(page)).text, good.text);
        writeFileSync(`${dir}/negative-control.json`, JSON.stringify({ input: path, mutation: 'Hide main; same API and persisted fixture', good, broken, assertion: 'Page must not be blank', failedAsIntended: true }, null, 2));
      }
    } catch (error) { discovery.push({ name, path, setupError: error.message, errors }); }
    await context.close(); save();
  }
  const jobs = discovery.filter((row) => row.width === 1280).flatMap((row) => row.calls.flatMap((call) => faults.map((fault) => ({ name: row.name, path: row.path, expectedReturn: row.url, call, fault })))).filter((row) =>
    !process.env.REVIEW_FAULT || process.env.REVIEW_FAULT.split(',').includes(row.fault)).map((row, id) => ({ ...row, id }));
  async function worker() {
    while (jobs.length) {
      const { name, path, expectedReturn, call, fault, id } = jobs.shift();
      const { context, page } = await open();
      const errors = [];
      let hits = 0;
      let early;
      let resume;
      let started;
      const intercepted = new Promise((resolve) => { started = resolve; });
      const released = new Promise((resolve) => { resume = resolve; });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== 'GET' || url.pathname + url.search !== call.url) return route.continue();
        hits++; started();
        if (fault === 'slow') { await released; return route.continue().catch(() => {}); }
        if (fault === 'offline' || fault === 'timeout') return route.abort(fault === 'timeout' ? 'timedout' : 'internetdisconnected');
        return route.fulfill({ status: /^\d/.test(fault) ? Number(fault) : 200, contentType: 'application/json', body: fault === 'malformed' ? '{invalid-json' : fault === 'empty' ? emptyLists(call.body) : JSON.stringify({ error: 'Injected review fault' }) });
      });
      const row = { id, name, path, call: call.url, fault, injection: true };
      try {
        const navigation = visit(page, name, path).catch((error) => { row.interactionError = error.message; });
        await Promise.race([intercepted, page.waitForTimeout(14000)]);
        if (fault === 'slow' && hits) {
          const since = Date.now();
          await page.waitForTimeout(300);
          early = await capture(page);
          if (process.env.REVIEW_SCREENSHOT_FAULTS === '1') await page.screenshot({ path: `${dir}/screenshots/loading-${name}-${id}-1280.png`, fullPage: true });
          await page.waitForTimeout(Math.max(0, 5000 - (Date.now() - since))); resume();
        } else resume();
        await navigation;
        if (['slow', 'empty', '401'].includes(fault)) {
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);
        } else await page.waitForTimeout(7500);
        Object.assign(row, { hits, early, result: await capture(page), errors });
        if (fault === '401' && new URL(page.url()).pathname === '/login') {
          await page.unrouteAll({ behavior: 'wait' });
          await signIn(page);
          row.returnedTo = new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash;
          row.expectedReturn = expectedReturn;
          row.sessionReturnPass = row.returnedTo === expectedReturn;
        }
        row.assessment = classify(row);
        if (process.env.REVIEW_SCREENSHOT_FAULTS === '1') {
          for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 844 });
            await page.screenshot({ path: `${dir}/screenshots/fault-${name}-${id}-${fault}-${width}.png`, fullPage: true });
          }
        }
        if (!['401', 'empty', 'slow'].includes(fault)) {
          const retry = page.getByRole('button', { name: /retry|try again/i }).first();
          if (await retry.isVisible()) {
            await page.unrouteAll({ behavior: 'wait' });
            await retry.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
            row.afterRetry = await capture(page);
            row.retryRecovered = row.afterRetry.alerts.length === 0 && row.afterRetry.shellAlerts.length === 0 && row.afterRetry.loading.length === 0 && !!row.afterRetry.text.trim();
          }
        }
      } catch (error) { row.harnessError = error.message; }
      finally { resume(); await context.close(); }
      matrix.push(row); save();
      console.log(`${name} ${call.url} ${fault}: ${row.assessment ?? 'UNVERIFIED'}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`RECORDED ${matrix.length} injected cells; ${discovery.length} happy-path viewport observations. See assessments, not a blanket pass.`);
} finally { save(); await browser.close(); }
