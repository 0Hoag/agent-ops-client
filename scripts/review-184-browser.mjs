import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { results } from './review-184-results.mjs';
import { reviewAggregates } from './review-184-aggregates.mjs';

const { check, family, finish, failures, comparisons } = results();

const env = process.env;
const dir = env.PRODUCT_E2E_ARTIFACTS;
const db = JSON.parse(readFileSync(env.W18_SQL, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.clock.setFixedTime(new Date(env.W18_NOW));
const pending = [];
const responses = [];
const matrix = [];
const uncovered = [];
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
  let actual;
  expected = expected.trim();
  try { actual = (await locator.innerText({ timeout: 3000 })).trim(); }
  catch (error) { actual = `LOCATOR ERROR: ${error.message}`; }
  matrix.push({ name, sql, apiPath, apiValue, expected, actual, locator: locator.toString(), pass: actual === expected });
  writeFileSync(`${dir}/matrix.json`, JSON.stringify(matrix, null, 2));
  check(name, expected, actual);
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
  await family('Session original single-run figures', async () => {
  await go(`/usage/sessions?run=${env.W18_RUN}&repository=${env.W18_REPOSITORY}`);
  const runs = response('agent-runs').data;
  const persisted = db.runs.find((run) => run.id === env.W18_RUN);
  const api = runs.find((run) => run.id === env.W18_RUN);
  check('Persisted recorded cost = API', persisted.cost_usd, api.cost_usd ?? null);
  await figure('Session headline recorded cost', `agent_runs[id=${persisted.id}].cost_usd`, `agent-runs.data[id=${api.id}].cost_usd`, api.cost_usd, `${usd(persisted.cost_usd)} · USD`, page.locator('main header p').first());
  const step = db.steps.find((step) => step.run_id === env.W18_RUN);
  const timeline = response(`agent-runs/${env.W18_RUN}/timeline`);
  writeFileSync(`${dir}/timeline.json`, JSON.stringify(timeline, null, 2));
  const apiStep = timeline.data[0];
  // #183 seeds one 1.8M-input-only step and the historical input rate $3/M.
  // Its persisted cumulative field is not the API's historical-price estimate.
  check('Independent fixture arithmetic: 1.8M × $3/M', 5.4, db.step_priced_usd);
  check('SQL/API historical step cost', db.step_priced_usd, apiStep.cumulative_cost_usd);
  for (const key of ['sequence', 'input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens', 'cache_hit']) check(`SQL/API step ${key}`, step[key], apiStep[key]);
  await figure('Session first-step cost', '(input*3 + cached*0.3 + write*3.75 + output*15 + reasoning*15)/1M; oracle.sql', 'timeline.data[0].cumulative_cost_usd', apiStep.cumulative_cost_usd, `${usd(db.step_priced_usd)} Highest cost`, page.locator('main ol li span').first());
  await figure('Session first-step token categories', 'agent_run_steps five counters', 'timeline.data[0]', apiStep, `Input ${compact(step.input_tokens)} · Cached ${compact(step.cached_input_tokens)} · Cache write ${compact(step.cache_write_tokens)} · Output ${compact(step.output_tokens)} · Reasoning ${compact(step.reasoning_tokens)}`, page.locator('main ol li p').nth(1));
  await figure('Session first-step hit rate and denominator', 'count(cache_hit=true)/count(cache_hit IS NOT NULL): 1/1', 'timeline.data[0].cache_hit', apiStep.cache_hit, 'Cache hit · Cumulative hit rate 100% (1/1 reported steps)', page.locator('main ol li p').nth(2));
  check('SQL/API step timestamp', Date.parse(step.started_at), Date.parse(apiStep.started_at));
  await figure('Session first-step relative time', 'agent_run_steps.started_at; fixed W18_NOW', 'timeline.data[0].started_at', apiStep.started_at, '2 hours ago', page.locator('main ol li time'));
  await screenshots('session');
  });
  await family('Session multi-run and multi-step figures', async () => {
    const sqlRuns = db.runs.filter((run) => run.session_id === 'review-multi-run');
    const selected = sqlRuns.find((run) => run.branch === 'feat/hosting-2');
    await go(`/usage/sessions?run=${selected.id}&repository=${env.W18_REPOSITORY}`);
    const apiRuns = response('agent-runs').data.filter((run) => run.session_id === selected.session_id);
    for (const sql of sqlRuns) check(`Multi-run ${sql.id} recorded cost SQL/API`, sql.cost_usd, apiRuns.find((run) => run.id === sql.id)?.cost_usd);
    await figure('Session multi-run headline', 'SUM(agent_runs.cost_usd) for review-multi-run', 'agent-runs.data[session_id=review-multi-run]', apiRuns, `${usd(sqlRuns.reduce((sum, run) => sum + Number(run.cost_usd), 0))} · USD`, page.locator('main header p').first());
    await figure('Session multi-run count', 'COUNT(*) for review-multi-run', 'agent-runs.data[session_id=review-multi-run]', apiRuns.length, 'Actual recorded cost across 2 runs in this session; not an estimate.', page.locator('main header p').nth(1));
    for (const sql of sqlRuns) await figure(`Session linked MR #${sql.pr_number}`, 'agent_runs.pr_number', 'agent-runs.data[].pr_number', apiRuns.find((run) => run.id === sql.id)?.pr_number, `review-183/hosting · MR #${sql.pr_number}`, page.locator(`main a[href$="/pull/${sql.pr_number}"]`));
    const timeline = response(`agent-runs/${selected.id}/timeline`).data;
    const steps = db.steps.filter((step) => step.run_id === selected.id).sort((a, b) => a.sequence - b.sequence);
    let hits = 0; let reported = 0; let cumulative = 0;
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index]; const api = timeline[index];
      const cost = (Number(step.input_tokens) * 3 + Number(step.cached_input_tokens) * 0.3 + Number(step.cache_write_tokens) * 3.75 + Number(step.output_tokens) * 15 + Number(step.reasoning_tokens) * 15) / 1000000;
      cumulative += cost;
      for (const key of ['sequence', 'input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens']) check(`Session multi-step ${index + 1} ${key} SQL/API`, step[key], api[key]);
      check(`Session multi-step ${index + 1} cache SQL/API`, step.cache_hit, api.cache_hit ?? null);
      check(`Session multi-step ${index + 1} cumulative historical USD SQL/API`, Number(cumulative.toFixed(9)), Number(api.cumulative_cost_usd.toFixed(9)));
      const row = page.locator('main ol li').nth(index);
      await figure(`Session multi-step ${index + 1} sequence`, 'agent_run_steps.sequence', `timeline.data[${index}].sequence`, api.sequence, `Step ${step.sequence} · Read`, row.locator('strong'));
      await figure(`Session multi-step ${index + 1} cost`, 'independent historical token rates; cumulative delta', `timeline.data[${index}].cumulative_cost_usd`, api.cumulative_cost_usd, `${usd(cost)} ${index === 2 ? 'Highest cost' : ''}`, row.locator('span').first());
      await figure(`Session multi-step ${index + 1} tokens`, 'agent_run_steps five persisted counters', `timeline.data[${index}]`, api, `Input ${compact(step.input_tokens)} · Cached ${compact(step.cached_input_tokens)} · Cache write ${compact(step.cache_write_tokens)} · Output ${compact(step.output_tokens)} · Reasoning ${compact(step.reasoning_tokens)}`, row.locator('p').nth(1));
      if (step.cache_hit !== null) { reported++; if (step.cache_hit) hits++; }
      const trend = reported ? `${Math.round(hits / reported * 100)}% (${hits}/${reported} reported steps)` : 'unavailable — sync cache telemetry';
      await figure(`Session multi-step ${index + 1} trend including zero denominator`, 'count hits / count non-null cache_hit within run prefix', `timeline.data[0:${index + 1}].cache_hit`, timeline.slice(0, index + 1).map((row) => row.cache_hit), `Cache ${step.cache_hit === null ? 'not reported — sync cache telemetry' : step.cache_hit ? 'hit' : 'miss'} · Cumulative hit rate ${trend}`, row.locator('p').nth(2));
    }
    await screenshots('session-multi');
  });
  await family('Usage session rows', async () => {
  await go('/usage');
  const usageRuns = response('agent-runs').data;
  for (const run of usageRuns) {
    const sql = db.runs.find((row) => row.id === run.id);
    for (const key of ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens', 'cost_usd']) check(`SQL/API ${run.id}.${key}`, sql[key], run[key] ?? null);
  }
  for (const sessionId of new Set(usageRuns.map((run) => run.session_id))) {
    const api = usageRuns.filter((run) => run.session_id === sessionId);
    const sql = db.runs.filter((run) => api.some((row) => row.id === run.id));
    const row = page.locator('tr').filter({ has: page.locator(api.map((run) => `a[href*="run=${run.id}"]`).join(',')) });
    const cost = sql.some((run) => run.cost_usd == null) ? null : sql.reduce((sum, run) => sum + Number(run.cost_usd), 0);
    await figure(`Usage session ${sessionId} cost`, 'SUM(cost_usd) grouped by session_id; null propagates', 'agent-runs.data[session_id]', api, usd(cost), row.locator('td').nth(1));
    const total = sql.reduce((sum, run) => sum + ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens'].reduce((sum, key) => sum + Number(run[key]), 0), 0);
    await figure(`Usage session ${sessionId} tokens`, 'input + cached + cache_write + output (reasoning excluded by UI contract)', 'agent-runs.data[session_id]', api, compact(total), row.locator('td').nth(2));
  }
  await screenshots('usage');
  });
  await family('Overview and Usage aggregates', async () => {
    const result = await reviewAggregates({ page, db, response, figure, check, usd, compact, go });
    uncovered.push(...result.uncovered);
  });
  await family('Overview screenshots', async () => { await go('/'); await screenshots('overview'); });
  await family('Work pages and details', async () => {
  await go('/work');
  const workResponse = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/v1/work');
  await page.locator('main').getByLabel('Repository', { exact: true }).selectOption(env.W18_REPOSITORY);
  await workResponse;
  await page.locator('nav[aria-label="Work pagination"]').waitFor();
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);
  await screenshots('work');
  for (let current = 1; ; current++) {
  const work = response('work');
  check('SQL/API work total', db.prs.length + db.issues.length, work.meta.total);
  await figure(`Work page ${current} total and range`, 'count(pull_requests) + count(issues)', 'work.meta', work.meta, `${(current - 1) * work.meta.per_page + 1}–${Math.min(current * work.meta.per_page, work.meta.total)} of ${db.prs.length + db.issues.length} work records`, page.locator('nav[aria-label="Work pagination"] p'));
  await figure(`Work page ${current} page count`, 'ceil((count(pull_requests)+count(issues))/per_page)', 'work.meta', work.meta, `Page ${current} of ${Math.ceil((db.prs.length + db.issues.length) / work.meta.per_page)}`, page.locator('nav[aria-label="Work pagination"] span'));
  let expectedPriced = 0; let expectedCost = 0;
  const failuresCI = work.data.filter((item) => item.kind === 'pr' && db.pipelines.some((pipeline) => pipeline.pr_number === item.number && pipeline.conclusion === 'failure')).length;
  for (const item of work.data) {
    const row = page.locator('tr').filter({ has: page.getByRole('button', { name: item.title, exact: true }) });
    const persisted = (item.kind === 'pr' ? db.prs : db.issues).find((record) => record.number === item.number);
    check(`Work ${item.kind} #${item.number} number SQL/API`, persisted.number, item.number);
    check(`Work ${item.kind} #${item.number} timestamp SQL/API`, Date.parse(persisted.updated_at), Date.parse(item.updated_at));
    const days = Math.round((Date.parse(persisted.updated_at) - Date.parse(env.W18_NOW)) / 86400000);
    const age = days === 0 ? 'this minute' : days === -1 ? 'yesterday' : `${-days} days ago`;
    await figure(`Work ${item.kind} #${item.number} relative age`, 'persisted updated_at; frozen W18_NOW; fixture whole days', 'work.data[].updated_at', item.updated_at, age, row.locator('td[data-label="Age"]'));
    await figure(`Work ${item.kind} #${item.number} number`, 'persisted work.number', 'work.data[].number', item.number, `${item.kind === 'pr' ? 'Merge request' : 'Issue'} #${persisted.number}`, row.locator('td[data-label="Work"] p'));
    const linked = db.runs.filter((run) => item.kind === 'pr' ? run.pr_number === item.number : run.issue_numbers?.includes(item.number));
    await figure(`Work ${item.kind} #${item.number} sessions`, 'count(agent_runs linked to work)', 'work.data[].runs_count', item.runs_count, String(linked.length), row.locator('td[data-label="Sessions"]'));
    check(`SQL/API work ${item.kind} #${item.number} sessions`, linked.length, item.runs_count);
    // Empty work has unavailable recorded cost; any missing linked run also
    // makes its recorded subtotal unavailable. Do not narrow issue linkage.
    const cost = !linked.length || linked.some((run) => run.cost_usd == null) ? null : linked.reduce((sum, run) => sum + Number(run.cost_usd), 0);
    if (cost != null) { expectedPriced++; expectedCost += cost; }
    check(`SQL/API work ${item.kind} #${item.number} cost`, cost, item.cost_usd ?? null);
    await figure(`Work ${item.kind} #${item.number} cost`, 'SUM(linked agent_runs.cost_usd), unavailable for missing components', 'work.data[].cost_usd', item.cost_usd, usd(cost), row.locator('td[data-label="Cost"]'));
    if (linked.length) await family(`Work ${item.kind} #${item.number} detail`, async () => {
      const loaded = page.waitForResponse((result) => new URL(result.url()).pathname === `/api/v1/work/${item.kind}/${item.number}`);
      await row.getByRole('button', { name: item.title, exact: true }).click();
      await loaded;
      await page.waitForLoadState('networkidle'); await Promise.all(pending);
      const detail = response(`work/${item.kind}/${item.number}`);
      check(`Work ${item.kind} #${item.number} detail linked count SQL/API`, linked.length, detail.runs?.length ?? 0);
      for (let index = 0; index < (detail.runs?.length ?? 0); index++) {
        const run = detail.runs[index]; const sql = linked.find((row) => row.id === run.id);
        assert(sql, 'Work detail run must exist in persisted linked runs');
        check(`Work detail ${run.id} cost SQL/API`, sql.cost_usd, run.cost_usd ?? null);
        const tokens = ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens'].reduce((sum, key) => sum + Number(sql[key]), 0);
        check(`Work detail ${run.id} tokens SQL/API`, tokens, run.tokens);
        await figure(`Work detail ${run.id} cost/tokens`, 'persisted recorded USD; sum five token categories', 'work.detail.data.runs[]', run, `${usd(sql.cost_usd)} USD · ${compact(tokens)} tokens`, page.locator('#work-detail li').nth(index).locator('p').nth(1));
      }
    });
  }
  await figure(`Work page ${current} header CI count and priced subtotal`, 'pipeline_runs.conclusion; persisted linked recorded costs for page', 'work.data[].ci_status,cost_usd', work.data, `On this page: ${failuresCI} work records with failing CI; ${expectedPriced ? `${usd(expectedCost)} recorded cost across ${expectedPriced} priced work records` : 'no recorded costs'}.${expectedPriced < work.data.length ? ' Other costs are unavailable; sync priced sessions.' : ''} Not repository-wide totals.`, page.locator('main header p'));
  if (current * work.meta.per_page >= work.meta.total) break;
  const loaded = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/v1/work' && new URL(result.url()).searchParams.get('page') === String(current + 1));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await loaded;
  await page.waitForLoadState('networkidle'); await Promise.all(pending);
  await page.getByRole('button', { name: response('work').data[0].title, exact: true }).waitFor();
  }
  });
  writeFileSync(`${dir}/failures.json`, JSON.stringify(failures, null, 2));
  writeFileSync(`${dir}/comparisons.json`, JSON.stringify(comparisons, null, 2));
  writeFileSync(`${dir}/uncovered.json`, JSON.stringify(uncovered, null, 2));
  console.log(`RESULT ${matrix.length} explicit UI figures; ${failures.length} failures. Partial coverage; see docs/reviews/184-numbers.md.`);
  try { finish(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
} finally {
  writeFileSync(`${dir}/api-responses.json`, JSON.stringify(responses, null, 2));
  try {
    await page.screenshot({ path: `${dir}/last-page.png`, fullPage: true, timeout: 10000 });
    writeFileSync(`${dir}/last-page.txt`, await page.locator('body').innerText());
  } finally { await browser.close(); }
}
