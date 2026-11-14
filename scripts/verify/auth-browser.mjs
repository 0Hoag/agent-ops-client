// Real production UI and HTTP only. No interception, credential injection or storage writes.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const base = process.env.PRODUCT_E2E_URL;
const [a, b] = JSON.parse(process.env.AUTH_FIXTURE);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const matrix = [];
const network = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith('/api/')) network.push({ path, status: response.status() });
});
function pass(acceptance, command, expected, actual = expected) {
  matrix.push({ acceptance, command, expected, actual });
  console.log(`PASS ${acceptance}: ${actual}`);
}
const path = () => page.url().slice(base.length);
async function credentials(password = process.env.PRODUCT_E2E_PASSWORD) {
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  return response;
}
async function login() {
  assert.equal((await credentials()).status(), 200, 'AUTH_REAL_LOGIN');
  await page.getByRole('heading', { name: 'Select an organization', exact: true }).waitFor();
  await page.locator('form').getByLabel('Organization', { exact: true }).selectOption(a.org);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Current organization', { exact: true }).filter({ hasText: a.name }).waitFor();
}
async function signout() {
  await page.getByText('User menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
}
async function repository(own, other) {
  await page.getByRole('heading', { name: `${own.repository} (github)`, exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: `${other.repository} (github)`, exact: true }).count(), 0, 'AUTH_REPOSITORY_ISOLATION');
  const options = await page.locator('header').first().getByLabel('Repository', { exact: true }).locator('option').allTextContents();
  assert.deepEqual(options, ['All repositories', own.repository], 'AUTH_SHELL_REPOSITORY_ISOLATION');
}
async function screenshot(width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${base}/repositories`);
  await repository(a, b);
  await page.screenshot({ path: `${dir}/auth-${width}.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `AUTH_NO_HORIZONTAL_SCROLL_${width}`);
  if (width === 390) {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Work', exact: true }).isVisible(), false, 'AUTH_MOBILE_DRAWER_CLOSES');
  }
  pass(`production screenshot ${width}`, `viewport ${width}; /repositories; screenshot`, 'tenant A data, no document overflow; mobile navigation closes');
}
const routes = [
  ['/', 'Overview'], ['/work', 'Work'], ['/usage', 'Usage'],
  [`/usage/sessions?run=${a.run}&repository=${a.repo}`, 'Session detail'],
  ['/settings/advanced', 'Settings'], ['/members', 'Members'], ['/repositories', 'Repository settings'],
  ['/prices', 'Model prices'], ['/budgets', 'Budgets'], ['/alerts', 'Alerts'],
  ['/waves', 'Plan and track organization work'], ['/board', 'Issue board'],
  ['/runs', 'Usage', '/usage'], ['/insights', 'Usage', '/usage'],
  ['/invite/synthetic-auth-188', 'Organization invitation'],
];
try {
  const destination = '/repositories?auth188=destination#tenant-evidence';
  await page.goto(base + destination);
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(path(), '/login', 'AUTH_LOGGED_OUT_GUARD');
  assert.equal((await credentials('deliberately-wrong')).status(), 401, 'AUTH_WRONG_PASSWORD_HTTP');
  await page.getByRole('alert').filter({ hasText: 'Unable to sign in' }).waitFor();
  assert.equal(path(), '/login');
  assert.equal(network.some((r) => r.path === '/api/v1/repositories'), false, 'AUTH_NO_PROTECTED_DATA_AFTER_WRONG_PASSWORD');
  pass('wrong password', 'logged-out deep link; submit wrong password', 'HTTP 401; sign-in error; no repository request');
  await login();
  await repository(a, b);
  assert.equal(path(), destination, 'AUTH_DEEP_LINK_FULL_DESTINATION');
  pass('login + organization selection + full deep link', 'submit valid credentials; select A; Continue', destination);
  await page.locator('header').first().getByLabel('Repository', { exact: true }).selectOption(a.repo);
  await page.getByLabel('Organization', { exact: true }).selectOption(b.org);
  await page.getByLabel('Current organization', { exact: true }).filter({ hasText: b.name }).waitFor();
  await repository(b, a);
  assert.equal(await page.evaluate(() => localStorage.getItem('agent-ops-repository') ?? ''), '', 'AUTH_ORG_SWITCH_CLEARS_REPOSITORY_FILTER');
  await page.goto(`${base}/work`);
  await page.getByLabel('Repository', { exact: true }).last().selectOption(b.repo);
  await page.getByText(b.task, { exact: true }).waitFor();
  assert.equal(await page.getByText(a.task, { exact: true }).count(), 0, 'AUTH_WORK_DATA_ISOLATION');
  pass('organization switch isolation', 'select repository A; switch B; open Work', 'only B repository/task; previous repository filter cleared');
  await page.getByLabel('Organization', { exact: true }).selectOption(a.org);
  await page.getByLabel('Current organization', { exact: true }).filter({ hasText: a.name }).waitFor();
  assert.equal(await page.getByText(b.task, { exact: true }).count(), 0, 'AUTH_MOUNTED_WORK_NO_PREVIOUS_TENANT');
  await page.getByLabel('Repository', { exact: true }).last().selectOption(a.repo);
  await page.getByText(a.task, { exact: true }).waitFor();
  assert.equal(await page.getByText(b.task, { exact: true }).count(), 0, 'AUTH_MOUNTED_WORK_DATA_ISOLATION');
  await page.goto(`${base}/repositories`);
  await repository(a, b);
  pass('switch back isolation', 'switch A; open repositories', 'only A repository');
  for (const [route, heading, redirected] of routes) {
    await page.goto(base + route);
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(path(), redirected ?? route, `AUTH_ROUTE_${route}`);
    await page.reload();
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(path(), redirected ?? route, `AUTH_REFRESH_${route}`);
    assert(!path().startsWith('/login'));
    pass(`route + refresh ${route}`, `goto ${route}; reload`, `${redirected ?? route}: ${heading}; session retained`);
  }
  await page.goto(`${base}/login`);
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  pass('login route refresh', 'goto /login; reload', 'Sign in');
  await page.goto(`${base}/work`);
  await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Usage', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  assert.equal(path(), '/work', 'AUTH_BACK_NAVIGATION');
  await signout();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('agent-ops-token')), null, 'AUTH_SIGNOUT_REMOVES_TOKEN');
  assert.equal(await page.evaluate(() => localStorage.getItem('agent-ops-repository')), null, 'AUTH_SIGNOUT_REMOVES_REPOSITORY_FILTER');
  await page.goBack();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(path(), '/login', 'AUTH_BACK_AFTER_SIGNOUT_GUARDED');
  await page.reload();
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  pass('signout + back + refresh', 'Work → Usage → back; sign out; back; reload', 'Work restored before signout; login guard afterwards');
  await page.goto(base + destination);
  await login();
  await repository(a, b);
  assert.equal(path(), destination, 'AUTH_DEEP_LINK_FULL_DESTINATION');
  await screenshot(1280);
  await screenshot(390);
  assert.deepEqual(errors, [], 'AUTH_NO_BROWSER_ERRORS');
  assert(network.some((r) => r.path.endsWith('/auth/session') && r.status === 200), 'AUTH_REAL_SESSION_HTTP');
  assert.equal(network.filter((r) => r.status === 401).length, 1, 'AUTH_ONLY_INTENTIONAL_LOGIN_401');
  pass('HTTP session + runtime', 'observe real browser HTTP and pageerror', 'session HTTP 200; only deliberate login 401; no page errors');
} catch (error) {
  matrix.push({ acceptance: 'FAIL', command: 'node scripts/verify/auth-browser.mjs', expected: 'all named assertions pass', actual: error.stack });
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(`${dir}/results.json`, JSON.stringify({ matrix, network, errors }, null, 2));
  await browser.close();
}
