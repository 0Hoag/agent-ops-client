import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';

const env = process.env;
const dir = env.PRODUCT_E2E_ARTIFACTS;
const setup = process.argv.includes('--setup');
const checks = setup ? [] : JSON.parse(readFileSync(`${dir}/checks.json`, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.setDefaultTimeout(15000);
const responses = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token$|password|secret|credential/i.test(key) ? '<redacted>' : sanitize(item)]));
  return value;
}
page.on('response', (response) => {
  if (new URL(response.url()).pathname.startsWith('/api/')) responses.push(response.json().then((body) => ({ url: response.url(), status: response.status(), body: sanitize(body) })).catch(() => ({ url: response.url(), status: response.status() })));
});
async function check(name, action) {
  try { await action(); checks.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function visit(path) { await page.goto(`${env.PRODUCT_E2E_URL}${path}`); await page.waitForLoadState('networkidle'); }
async function login() {
  await page.getByLabel('Email', { exact: true }).fill(env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('main').getByLabel('Organization', { exact: true }).selectOption(env.W185_ORG);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
}
async function screenshots(name) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true });
    await check(`${name}.viewport-${width}`, async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal document overflow'));
  }
  await page.setViewportSize({ width: 1280, height: 844 });
}
async function post(path, body) {
  const token = await page.evaluate(() => sessionStorage.getItem('agent-ops-token'));
  const response = await page.request.post(`${env.PRODUCT_E2E_URL}/api/v1/${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Agent-Run-Token': env.AGENT_RUN_TOKEN }, data: body });
  const data = await response.json();
  responses.push(Promise.resolve({ path, input: sanitize(body), status: response.status(), body: sanitize(data) }));
  assert(response.ok(), `${path}: HTTP ${response.status()} ${JSON.stringify(data)}`); return data;
}
try {
  await visit('/'); await login();
  if (setup) {
    await check('first-run.empty-checklist', async () => {
      assert.match(await page.getByRole('region', { name: 'First-run checklist' }).innerText(), /0 of 3 steps complete/);
    });
    // No telemetry means no computable spend, not a fabricated zero (UX standard).
    await check('first-run.empty-overview', async () => assert.equal(await page.getByLabel('Spend summary').innerText(), 'Spend unavailable'));
    await screenshots('empty-overview');
    await page.getByRole('link', { name: 'Connect a repository', exact: true }).click();
    await page.getByLabel('Provider').selectOption('gitlab');
    await page.getByLabel('Full name', { exact: true }).fill('userflows-185/project');
    await page.getByLabel('Self-hosted base URL').fill('https://gitlab.example.invalid');
    const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/repositories') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create repository', exact: true }).click();
    const response = await created; assert(response.ok());
    const repository = (await response.json()).data.id;
    writeFileSync(`${dir}/fixture.json`, JSON.stringify({ repository }));
    const inputs = [];
    for (const [number, model, cost] of [[1, 'userflows-alpha', 12.4], [1, 'userflows-beta', 4.6], [2, 'userflows-alpha', 1]]) {
      const body = { repository_id: repository, model, harness: 'Claude', wave: 'Userflows', worker: 'Synthetic agent', branch: `feat/userflows-${number}`, session_id: `userflows-${number}-${model}`, pr_number: number, issue_numbers: [10], started_at: env.W185_TIME, ended_at: env.W185_TIME, input_tokens: 1000000, output_tokens: 0 };
      inputs.push({ ...body, repository_id: '<created repository>' }); await post('agent-runs', body);
      // Ingest has no recorded-cost input. Seed that independent observation explicitly;
      // this is not evidence that setting a price retroactively supplies recorded cost.
      const sql = `UPDATE agent_runs SET cost_usd=${cost} WHERE repository_id='${repository}' AND session_id='userflows-${number}-${model}';`;
      const result = spawnSync('docker', ['compose', '-p', env.W185_PROJECT, '-f', `${env.W185_BACKEND}/compose.prod.yml`, 'exec', '-T', 'postgres', 'psql', '-U', 'agent_ops', '-d', 'agent_ops', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
      writeFileSync(`${dir}/recorded-${number}-${model}.sql`, sql);
      writeFileSync(`${dir}/recorded-${number}-${model}.log`, `${result.stdout}${result.stderr}`);
      assert.equal(result.status, 0); assert.match(result.stdout, /UPDATE 1/);
    }
    writeFileSync(`${dir}/inputs.json`, JSON.stringify(inputs, null, 2));
    await visit('/prices');
    for (const model of ['userflows-alpha', 'userflows-beta']) {
      await page.getByLabel('Model', { exact: true }).fill(model);
      await page.getByLabel('Effective date', { exact: true }).fill('2020-01-01');
      await page.getByLabel('input per million', { exact: true }).fill('3');
      const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/agent-run-prices') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create version', exact: true }).click(); assert((await saved).ok());
      await page.getByLabel('Model', { exact: true }).waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle');
    }
    await visit('/');
    await check('first-run.complete-checklist', async () => assert.match(await page.getByLabel('First-run checklist').innerText(), /3 of 3 steps complete/));
    await visit('/usage');
    await check('first-run.recorded-result', async () => assert.match(await page.locator('main tbody').innerText(), /userflows-alpha[\s\S]*\$12\.40/));
    await screenshots('first-result');
  } else {
    await visit('/usage');
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: '7 days' });
    await page.getByLabel('Usage repository', { exact: true }).selectOption(env.W185_REPOSITORY);
    await page.waitForLoadState('networkidle');
    const ranking = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Top five expensive merge requests', exact: true }) }).last();
    await check('cost.top-mr', async () => assert.match(await ranking.locator('li').first().innerText(), /MR #1[\s\S]*\$17\.00/));
    await page.getByLabel('Split by').selectOption('Model');
    await check('cost.per-model', async () => {
      const text = await page.locator('main').innerText();
      assert.match(text, /userflows-alpha[\s\S]*\$13\.40/); assert.match(text, /userflows-beta[\s\S]*\$4\.60/);
    });
    await screenshots('cost');
    await check('cost.open-ranked-mr', async () => {
      const link = ranking.getByRole('link', { name: /MR #1/ });
      assert.equal(await link.count(), 1, 'Most expensive MR must open its details from the ranking');
      await link.click(); await page.locator('#work-detail h2').waitFor();
      assert.equal(await page.locator('main').getByLabel('Repository', { exact: true }).inputValue(), env.W185_REPOSITORY);
      assert.equal(await page.locator('#work-detail h2').innerText(), 'Userflows MR 1');
    });
    // Continue independent observations even when the ranking cannot open a detail.
    await visit('/work');
    await page.locator('main').getByLabel('Repository', { exact: true }).selectOption(env.W185_REPOSITORY);
    await page.waitForLoadState('networkidle');
    const row = page.locator('main tr').filter({ has: page.getByRole('button', { name: 'Userflows MR 1', exact: true }) });
    await check('attention.failing-ci', async () => assert.match(await row.locator('[data-label="Status / CI"]').innerText(), /failure|failed/));
    await page.getByRole('button', { name: 'Userflows MR 1', exact: true }).click();
    await page.locator('#work-detail h2').waitFor(); await page.waitForLoadState('networkidle');
    await check('attention.gitlab-link', async () => assert.equal(await page.getByRole('link', { name: 'Open in GitLab', exact: true }).getAttribute('href'), 'https://gitlab.example.invalid/userflows-185/project/-/merge_requests/1'));
    await check('cost.recorded-runs-559', async () => {
      const text = await page.locator('#work-detail').innerText();
      assert.match(text, /userflows-alpha[\s\S]*\$12\.40 USD/); assert.match(text, /userflows-beta[\s\S]*\$4\.60 USD/);
      assert.equal(await page.locator('#work-detail li').count(), 2);
    });
    const issue = page.locator('main tr').filter({ has: page.getByRole('button', { name: 'Userflows linked issue', exact: true }) });
    await check('cost.linked-sessions-557', async () => assert.equal(await issue.locator('[data-label="Sessions"]').innerText(), '3', 'Three persisted runs link issue 10; attribution decision remains #557'));
    await screenshots('attention');
    await page.getByRole('banner').getByLabel('Repository', { exact: true }).selectOption(env.W185_REPOSITORY);
    await page.getByText('User menu', { exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await visit('/'); await login(); await page.reload(); await page.waitForLoadState('networkidle');
    await check('persistence.sign-in', async () => assert.equal(await page.getByRole('banner').getByLabel('Repository', { exact: true }).inputValue(), env.W185_REPOSITORY));
    await page.getByLabel('Organization', { exact: true }).selectOption(env.W185_OTHER); await page.waitForLoadState('networkidle');
    await check('persistence.other-org-isolation', async () => {
      await page.getByLabel('Current organization').filter({ hasText: 'Userflows 185 B' }).waitFor();
      await page.waitForFunction((id) => !document.querySelector(`header select[aria-label="Repository"] option[value="${id}"]`), env.W185_REPOSITORY);
      assert.equal(await page.getByRole('banner').locator('option').filter({ hasText: 'userflows-185/project' }).count(), 0);
    });
    await page.getByLabel('Organization', { exact: true }).selectOption(env.W185_ORG); await page.waitForLoadState('networkidle');
    await check('persistence.return-to-org', async () => {
      await page.getByLabel('Current organization').filter({ hasText: 'Userflows 185 A' }).waitFor();
      await page.getByRole('banner').getByRole('option', { name: 'userflows-185/project', exact: true }).waitFor({ state: 'attached' });
      assert.equal(await page.getByRole('banner').getByLabel('Repository', { exact: true }).inputValue(), env.W185_REPOSITORY);
    });
    await screenshots('restored-session');
  }
  await check(`${setup ? 'setup' : 'flows'}.page-errors`, async () => assert.deepEqual(errors, []));
} finally {
  writeFileSync(`${dir}/${setup ? 'setup' : 'flows'}-http.json`, JSON.stringify(await Promise.all(responses), null, 2));
  writeFileSync(`${dir}/checks.json`, JSON.stringify(checks, null, 2));
  await page.screenshot({ path: `${dir}/last-${setup ? 'setup' : 'flows'}.png`, fullPage: true }).catch(() => {});
  await browser.close();
}
