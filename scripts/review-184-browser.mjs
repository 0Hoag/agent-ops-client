import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const env = process.env;
const dir = env.PRODUCT_E2E_ARTIFACTS;
const db = JSON.parse(readFileSync(env.W18_SQL, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.clock.setFixedTime(new Date(env.W18_NOW));
const pending = [];
const responses = [];
const matrix = [];
page.on('response', (response) => {
  if (/^\/api\/v1\/(agent-runs|overview|insights\/analytics|work)(\/|$)/.test(new URL(response.url()).pathname)) pending.push(response.json().then((body) => responses.push({ url: response.url(), status: response.status(), body })).catch(() => {}));
});
const usd = (value) => value == null ? 'Cost unavailable — check model pricing in Settings' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const compact = (value) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
async function go(path) {
  await page.goto(`${env.PRODUCT_E2E_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);
}
function response(path) {
  const result = responses.findLast((row) => new URL(row.url).pathname === `/api/v1/${path}`);
  assert(result && result.status === 200, `HTTP ${path}`);
  return result.body;
}
async function figure(name, sql, apiPath, apiValue, expected, locator) {
  const actual = await locator.innerText();
  matrix.push({ name, sql, apiPath, apiValue, expected, actual, locator: locator.toString() });
  writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
  assert.equal(actual, expected, name);
}
async function screenshots(name) {
  mkdirSync(`${dir}/screenshots`, { recursive: true });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow at ${width}`);
    await page.screenshot({ path: `${dir}/screenshots/${name}-${width}.png`, fullPage: true });
  }
}
try {
  await page.goto(`${env.PRODUCT_E2E_URL}/usage`);
  await page.getByLabel('Email', { exact: true }).fill(env.PRODUCT_E2E_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(env.PRODUCT_E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Review 183' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Usage', exact: true }).waitFor();
  await go(`/usage/sessions?run=${env.W18_RUN}&repository=${env.W18_REPOSITORY}`);
  const runs = response('agent-runs').data;
  const persisted = db.runs.find((run) => run.id === env.W18_RUN);
  const api = runs.find((run) => run.id === env.W18_RUN);
  assert.equal(api.cost_usd ?? null, persisted.cost_usd, 'Persisted recorded cost = API');
  await figure('Session headline recorded cost', `agent_runs[id=${persisted.id}].cost_usd`, `agent-runs.data[id=${api.id}].cost_usd`, api.cost_usd, `${usd(persisted.cost_usd)} · USD`, page.locator('main header p').first());
  const step = db.steps[0];
  const timeline = response(`agent-runs/${env.W18_RUN}/timeline`);
  writeFileSync(`${dir}/timeline.json`, JSON.stringify(timeline, null, 2));
  const apiStep = timeline.data[0];
  // #183 seeds one 1.8M-input-only step and the historical input rate $3/M.
  // Its persisted cumulative field is not the API's historical-price estimate.
  assert.equal(db.step_priced_usd, 5.4, 'Independent fixture arithmetic: 1.8M × $3/M');
  assert.equal(apiStep.cumulative_cost_usd, db.step_priced_usd, 'SQL/API historical step cost');
  for (const key of ['sequence', 'input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens', 'cache_hit']) assert.equal(apiStep[key], step[key], `SQL/API step ${key}`);
  await figure('Session first-step cost', '(input*3 + cached*0.3 + write*3.75 + output*15 + reasoning*15)/1M; oracle.sql', 'timeline.data[0].cumulative_cost_usd', apiStep.cumulative_cost_usd, `${usd(db.step_priced_usd)} Highest cost`, page.locator('main ol li span').first());
  await figure('Session first-step token categories', 'agent_run_steps five counters', 'timeline.data[0]', apiStep, `Input ${compact(step.input_tokens)} · Cached ${compact(step.cached_input_tokens)} · Cache write ${compact(step.cache_write_tokens)} · Output ${compact(step.output_tokens)} · Reasoning ${compact(step.reasoning_tokens)}`, page.locator('main ol li p').nth(1));
  await figure('Session first-step hit rate and denominator', 'count(cache_hit=true)/count(cache_hit IS NOT NULL): 1/1', 'timeline.data[0].cache_hit', apiStep.cache_hit, 'Cache hit · Cumulative hit rate 100% (1/1 reported steps)', page.locator('main ol li p').nth(2));
  assert.equal(Date.parse(apiStep.started_at), Date.parse(step.started_at), 'SQL/API step timestamp');
  await figure('Session first-step relative time', 'agent_run_steps.started_at; fixed W18_NOW', 'timeline.data[0].started_at', apiStep.started_at, '2 hours ago', page.locator('main ol li time'));
  await screenshots('session');
  await go('/usage');
  const usageRuns = response('agent-runs').data;
  for (const run of usageRuns) {
    const sql = db.runs.find((row) => row.id === run.id);
    for (const key of ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens', 'cost_usd']) assert.equal(run[key] ?? null, sql[key], `SQL/API ${run.id}.${key}`);
    const row = page.locator('tr').filter({ has: page.locator(`a[href*="run=${run.id}"]`) });
    await figure(`Usage session ${run.session_id} cost`, `agent_runs[id=${run.id}].cost_usd`, `agent-runs.data[id=${run.id}].cost_usd`, run.cost_usd, usd(sql.cost_usd), row.locator('td').nth(1));
    const total = ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens'].reduce((sum, key) => sum + Number(sql[key]), 0);
    await figure(`Usage session ${run.session_id} tokens`, 'input + cached + cache_write + output (reasoning excluded by UI contract)', `agent-runs.data[id=${run.id}]`, run, compact(total), row.locator('td').nth(2));
  }
  await screenshots('usage');
  await go('/');
  await screenshots('overview');
  await go('/work');
  const workResponse = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/v1/work');
  await page.locator('main').getByLabel('Repository', { exact: true }).selectOption(env.W18_REPOSITORY);
  await workResponse;
  await page.locator('nav[aria-label="Work pagination"]').waitFor();
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);
  await screenshots('work');
  const work = response('work');
  assert.equal(work.meta.total, db.prs.length + db.issues.length, 'SQL/API work total');
  await figure('Work total and page range', 'count(pull_requests) + count(issues)', 'work.meta', work.meta, `1–${work.data.length} of ${db.prs.length + db.issues.length} work records`, page.locator('nav[aria-label="Work pagination"] p'));
  for (const item of work.data) {
    const row = page.locator('tr').filter({ has: page.getByRole('button', { name: item.title, exact: true }) });
    const linked = db.runs.filter((run) => item.kind === 'pr' ? run.pr_number === item.number : run.issue_numbers?.includes(item.number));
    await figure(`Work ${item.kind} #${item.number} sessions`, 'count(agent_runs linked to work)', 'work.data[].runs_count', item.runs_count, String(linked.length), row.locator('td[data-label="Sessions"]'));
    assert.equal(item.runs_count, linked.length, `SQL/API work ${item.kind} #${item.number} sessions`);
  }
  console.log(`PASS ${matrix.length} explicit SQL/API/UI figures. Partial coverage; see docs/reviews/184-numbers.md.`);
} finally {
  await page.screenshot({ path: `${dir}/last-page.png`, fullPage: true });
  writeFileSync(`${dir}/last-page.txt`, await page.locator('body').innerText());
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(responses, null, 2));
  await browser.close();
}
