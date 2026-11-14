// Real production UI + HTTP; no interception, token injection, or production arithmetic imports.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { repositorySettings, advancedSettings, screenshots } from './settings-workflows.mjs';

const base = process.env.PRODUCT_E2E_URL;
const dir = process.env.PRODUCT_E2E_ARTIFACTS;
const fixture = JSON.parse(process.env.SETTINGS_FIXTURE);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const matrix = [], network = [], errors = [], frames = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith('/api/')) network.push({ path, method: response.request().method(), status: response.status() });
});
page.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => frames.push(String(payload))));
const pass = (acceptance, command, expected, actual = expected) => {
  matrix.push({ acceptance, command, expected, actual });
  console.log(`PASS ${acceptance}: ${actual}`);
};
const goto = (path) => page.goto(base + path);
async function action(path, method, click, expected = 200) {
  const pending = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/${path}` && r.request().method() === method);
  await click();
  const response = await pending;
  assert.equal(response.status(), expected, `SETTINGS_HTTP_${method}_${path}: ${await response.text()}`);
  return response.json();
}
const helpers = { page, context, fixture, goto, pass, action, dir, frames };
try {
  await goto('/settings/advanced#repositories');
  await page.getByLabel('Email', { exact: true }).fill(process.env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await action('auth/login', 'POST', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
  await page.locator('form').getByLabel('Organization', { exact: true }).selectOption(fixture.org);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Repository settings', exact: true }).waitFor();
  pass('SETTINGS_REAL_LOGIN', 'sign in synthetic account; select persisted organization', 'registered Settings repository panel');
  await repositorySettings(helpers);
  await goto('/settings/advanced#agent-setup');
  await page.getByRole('tabpanel').getByLabel('Repository', { exact: true }).selectOption(fixture.repo);
  await page.getByLabel('Transcript file path').fill("/sessions/settings fixture.jsonl");
  await page.getByLabel('Transcript format').selectOption('codex');
  const expectedCommand = `: "\${AGENT_RUN_TOKEN:?Set AGENT_RUN_TOKEN to the configured ingestion credential}" && agentops push --harness 'codex' --endpoint '${base}/api/v1/agent-runs' --repository-id '${fixture.repo}' --wave setup --worker local-agent '/sessions/settings fixture.jsonl'`;
  await page.getByRole('button', { name: 'Copy command', exact: true }).click();
  await page.getByText('Command copied. Run it in your terminal; copying does not send a transcript.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expectedCommand, 'SETTINGS_CLIPBOARD_EXACT_COMMAND');
  pass('SETTINGS_CLIPBOARD_EXACT_COMMAND', 'select repository + transcript; Copy command; read OS clipboard', expectedCommand);
  const overview = async () => {
    await goto('/');
    await page.getByLabel('Repository', { exact: true }).last().selectOption('');
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/overview' && new URL(r.url()).searchParams.get('repository_id') === fixture.priceRepo);
    await page.getByLabel('Repository', { exact: true }).last().selectOption(fixture.priceRepo);
    return (await (await response).json()).data.current;
  };
  const unpriced = await overview();
  assert(unpriced.models_without_price.includes('settings-priced'), 'SETTINGS_PRICE_INITIALLY_MISSING');
  await page.getByRole('region', { name: 'Spend summary' }).getByText('Spend unavailable', { exact: true }).waitFor();
  await goto('/settings/advanced#model-prices');
  await page.getByLabel('Model', { exact: true }).fill('settings-priced');
  await page.getByLabel('Effective date', { exact: true }).fill('2026-01-01');
  await page.getByLabel('input per million', { exact: true }).fill('2');
  await page.getByLabel('output per million', { exact: true }).fill('5');
  await action('agent-run-prices', 'POST', () => page.getByRole('button', { name: 'Create version', exact: true }).click(), 201);
  await page.reload();
  await page.getByRole('cell', { name: 'settings-priced', exact: true }).waitFor();
  await screenshots(helpers, 'prices');
  const priced = await overview();
  assert.equal(priced.spend_usd, 2.5, 'SETTINGS_PRICE_HTTP_COST');
  assert.deepEqual(priced.models_without_price ?? [], [], 'SETTINGS_PRICE_NO_MISSING_MODELS');
  // Overview is the registered price-derived surface, not recorded agent_runs.cost_usd.
  const cost = page.getByRole('region', { name: 'Spend summary' }).getByText(/^\$2\.50 spent/);
  await cost.waitFor();
  assert.match(await cost.innerText(), /^\$2\.50 spent/, 'SETTINGS_PRICE_INDEPENDENT_COST');
  pass('SETTINGS_PRICE_INDEPENDENT_COST', 'create $2 input/$5 output version; reload; Overview → 30 days → dedicated pricing repository', 'persisted 1M input + 100K output → price-derived USD $2.50; not recorded cost');
  await screenshots(helpers, 'priced-overview');
  await goto('/settings/advanced#members');
  await page.getByLabel('Invite role').selectOption('viewer');
  const invitation = await action(`organizations/${fixture.org}/invitations`, 'POST', () => page.getByRole('button', { name: 'Create invitation link' }).click(), 201);
  const link = page.getByRole('tabpanel').getByRole('link').filter({ hasText: '/invite/' });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), new URL(invitation.data.link, base).href, 'SETTINGS_INVITATION_LINK');
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  guest.setDefaultTimeout(15000);
  await guest.goto(new URL(invitation.data.link, base).href);
  await guest.getByLabel('Email', { exact: true }).fill(process.env.SETTINGS_GUEST_EMAIL);
  await guest.getByLabel('Password', { exact: true }).fill(process.env.PRODUCT_E2E_PASSWORD);
  await guest.getByRole('button', { name: 'Sign in', exact: true }).click();
  await guest.locator('form').getByLabel('Organization', { exact: true }).selectOption(process.env.SETTINGS_GUEST_ORG);
  await guest.getByRole('button', { name: 'Continue', exact: true }).click();
  await guest.getByRole('heading', { name: 'Organization invitation', exact: true }).waitFor();
  const accepted = guest.waitForResponse((r) => r.url().endsWith('/organization-invitations/accept') && r.request().method() === 'POST');
  await guest.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  assert.equal((await accepted).status(), 201, 'SETTINGS_INVITATION_ACCEPT_HTTP');
  await guestContext.close();
  await page.reload();
  const member = page.getByRole('row').filter({ hasText: process.env.SETTINGS_GUEST_EMAIL });
  await member.getByRole('cell', { name: 'viewer', exact: true }).waitFor();
  pass('SETTINGS_INVITATION_LINK', 'Members → viewer → invitation; separate synthetic account signs in and accepts; owner reloads', 'real invitation accepted; persisted viewer identity visible');
  await advancedSettings(helpers);
  assert.deepEqual(errors, [], 'SETTINGS_NO_PAGE_ERRORS');
  assert.deepEqual(network.filter((r) => r.status >= 400), [], 'SETTINGS_NO_FAILED_HTTP');
  pass('SETTINGS_RUNTIME', 'observe browser pageerror + real HTTP responses', 'no runtime errors or failed API requests');
} catch (error) {
  matrix.push({ acceptance: 'FAIL', command: 'node scripts/verify/settings-browser.mjs', expected: 'all named assertions pass', actual: error.stack });
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(`${dir}/results.json`, JSON.stringify({ matrix, network, errors, frames }, null, 2));
  await browser.close();
}
