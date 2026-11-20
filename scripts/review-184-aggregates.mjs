// Independent fixture oracle: no imports from production calculations.
// Rates are the explicit review-183.mjs seed contract, NOT recorded cost_usd.
const counters = ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens', 'reasoning_tokens'];
const rates = [3, 0.3, 3.75, 15, 15];
const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
const day = (value) => value?.slice(0, 10);
const within = (value, range) => value && day(value) >= range.from && day(value) <= range.to;
const priced = (row) => row.model === 'review-priced';
const estimate = (rows) => rows.filter(priced).reduce((total, row) => total + counters.reduce((cost, key, i) => cost + Number(row[key] ?? 0) * rates[i], 0) / 1e6, 0);
const savings = (rows) => sum(rows.filter(priced), 'cached_input_tokens') * (3 - 0.3) / 1e6;
const hitRate = (rows) => {
  const input = sum(rows, 'input_tokens');
  const cached = sum(rows, 'cached_input_tokens');
  return input + cached ? cached / (input + cached) : 0;
};
const groups = (rows, key) => {
  const result = new Map();
  for (const row of rows) {
    const name = key(row);
    if (!result.has(name)) result.set(name, []);
    result.get(name).push(row);
  }
  return result;
};
// A group with ANY missing recorded cost is unknown, not a priced subtotal.
const recorded = (rows) => rows.some((row) => row.cost_usd == null) ? undefined : sum(rows, 'cost_usd');

export async function reviewAggregates({ page, db, response, figure, check, usd, compact, go }) {
  const uncovered = [
    'Rework rate and its delta: no independently established definition/evidence in the available snapshot; not asserted.',
    'CI first-pass rate and attention are outside this aggregate matrix.',
  ];
  const prices = db.prices.flat().filter((row) => row.model === 'review-priced');
  check('Persisted historical price version count', 1, prices.length);
  const price = prices[0];
  for (const [index, key] of ['input_per_million', 'cached_input_per_million', 'cache_write_per_million', 'output_per_million', 'reasoning_per_million'].entries()) check(`Persisted historical ${key}`, rates[index], Number(price?.[key]));
  check('Persisted price effective date', '2020-01-01', day(price?.effective_date));
  const safe = async (name, task) => {
    try { await task(); } catch (error) {
      check(`${name}: execution`, 'completed', String(error?.message ?? error));
      uncovered.push(`${name}: interrupted; remaining independent sections continue.`);
    }
  };
  // Normalize only floating-point arithmetic noise, never missing/nonfinite data.
  const number = (name, expected, actual) => check(name, Number.isFinite(expected) ? Number(expected.toFixed(9)) : expected, Number.isFinite(actual) ? Number(actual.toFixed(9)) : actual);
  const panel = (title) => page.getByRole('heading', { name: title, exact: true }).locator('..');
  const card = (title) => page.locator('main article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const show = async (name, sql, path, api, expected, locator) => safe(name, () => figure(name, sql, path, api, expected, locator));
  const rowsFor = (range) => db.runs.filter((row) => within(row.started_at, range));
  const summary = (range, api, prefix) => {
    const rows = rowsFor(range);
    const merged = db.prs.filter((row) => within(row.merged_at, range)).length;
    const expected = {
      runs: rows.length, merged_prs: merged, spend_usd: estimate(rows),
      input_tokens: sum(rows, 'input_tokens'), output_tokens: sum(rows, 'output_tokens'),
      cache_read_tokens: sum(rows, 'cached_input_tokens'), cache_write_tokens: sum(rows, 'cache_write_tokens'),
      cache_hit_rate: hitRate(rows), cache_savings_usd: savings(rows),
      cost_per_merged_pr: merged ? estimate(rows) / merged : undefined,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (key === 'cost_per_merged_pr' && !merged) {
        uncovered.push(`${prefix}: zero merged-PR denominator contract not asserted.`);
      } else number(`${prefix}.${key}: SQL/API`, value, api?.[key]);
    }
    expected.models_without_price = [...new Set(rows.filter((row) => !priced(row)).map((row) => row.model))].sort();
    check(`${prefix}.models_without_price: fixture/API`, expected.models_without_price, [...(api?.models_without_price ?? [])].sort());
    return expected;
  };
  const analytics = (data, prefix) => {
    const rows = rowsFor(data);
    const byBucket = groups(rows, (row) => `${day(row.started_at)}|${data.group_by === 'harness' ? row.harness : ''}`);
    check(`${prefix}: bucket identities SQL/API`, [...byBucket.keys()].sort(), (data.buckets ?? []).map((bucket) => `${day(bucket.start)}|${data.group_by === 'harness' ? bucket.key : ''}`).sort());
    number(`${prefix}.unknown_price_count`, rows.filter((row) => !priced(row)).length, data.unknown_price_count);
    for (const bucket of data.buckets ?? []) {
      const key = `${day(bucket.start)}|${data.group_by === 'harness' ? bucket.key : ''}`;
      const sql = byBucket.get(key) ?? [];
      const values = { runs: sql.length, cache_hit_rate: hitRate(sql), actual_cost_usd: sql.some(priced) ? estimate(sql) : null, unknown_price_count: sql.filter((row) => !priced(row)).length };
      for (const field of counters) values[field] = sum(sql, field);
      for (const [field, value] of Object.entries(values)) number(`${prefix}[${key}].${field}: SQL/API`, value, bucket[field]);
    }
    return groups(rows, (row) => day(row.started_at));
  };

  await safe('Usage aggregates', async () => {
    await go('/usage');
    const data = response('insights/analytics').data;
    const overview = response('overview').data;
    const rows = rowsFor(data);
    const apiRuns = response('agent-runs').data;
    check('Usage sessions: SQL/API identities', rows.map((row) => row.id).sort(), apiRuns.map((row) => row.id).sort());
    for (const row of rows) {
      const api = apiRuns.find((item) => item.id === row.id);
      for (const key of [...counters, 'cost_usd', 'model', 'harness', 'repository_id', 'pr_number']) check(`Usage ${row.id}.${key}: SQL/API`, row[key] ?? null, api?.[key] ?? null);
    }
    const daily = analytics(data, 'Usage analytics');
    const current = summary(overview.current, overview.current, 'Usage overview.current');
    const unknown = rows.some((row) => !priced(row));
    await show('Usage headline', 'Token-priced total; unavailable if any fixture model has no price', 'insights/analytics.data', data,
      `${unknown ? 'Spend unavailable — sync usage and configure model prices in Settings' : `${usd(estimate(rows))} spent`} · USD`, page.locator('main header p').first());
    await show('Usage cache savings', 'SUM(priced cached_input_tokens) * (3 - 0.3) / 1e6', 'overview.data.current.cache_savings_usd', overview.current.cache_savings_usd,
      `${usd(current.cache_savings_usd)} saved with cache`, panel('Cache savings').locator('p').first());
    check('Usage daily: UI row count', daily.size, await panel('Spend by day').locator('li').count());
    for (const [date, sql] of daily) {
      const label = new Date(`${date}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const buckets = data.buckets.filter((bucket) => day(bucket.start) === date);
      const cost = sql.some((row) => !priced(row)) ? undefined : estimate(sql);
      await show(`Usage day ${date}`, 'UTC started_at day; unknown price makes daily total unavailable', `insights/analytics.data.buckets[start=${date}]`, buckets,
        usd(cost), panel('Spend by day').locator('li').filter({ has: page.getByText(label, { exact: true }) }).locator('span').last());
    }
    // Boundary amounts remain measured even when group totals cannot be ranked.
    const boundary = [rows.find((row) => row.cost_usd == null), rows.find((row) => row.cost_usd === 0),
      rows.find((row) => row.cost_usd > 0 && row.cost_usd < 0.01), rows.find((row) => row.cost_usd > 1e6)].filter(Boolean);
    check('Usage fixture has unknown/zero/small/large recorded costs', 4, boundary.length);
    for (const sql of boundary) {
      const api = apiRuns.find((row) => row.id === sql.id);
      const session = rows.filter((row) => row.session_id === sql.session_id && row.repository_id === sql.repository_id);
      const tr = page.locator('main tr').filter({ has: page.locator(session.map((row) => `a[href*="run=${row.id}"]`).join(',')) });
      await show(`Usage boundary ${sql.session_id}`, `agent_runs[id=${sql.id}].cost_usd (recorded, not model-priced)`, `agent-runs.data[id=${sql.id}].cost_usd`, api?.cost_usd,
        usd(recorded(session)), tr.locator('td').nth(1));
      const tokens = session.reduce((sum, row) => sum + counters.slice(0, 4).reduce((total, key) => total + Number(row[key]), 0), 0);
      await show(`Usage boundary tokens ${sql.session_id}`, 'input + cached + write + output; reasoning excluded', `agent-runs.data[id=${sql.id}]`, api,
        compact(tokens), tr.locator('td').nth(2));
    }
    const repoNames = new Map();
    for (const id of new Set(rows.map((row) => row.repository_id))) repoNames.set(id, await page.getByLabel('Usage repository', { exact: true }).locator(`option[value="${id}"]`).innerText());
    uncovered.push('Repository display names come from selector labels; repository-name SQL persistence is not present in db. Monetary grouping still uses SQL repository_id.');
    for (const split of ['Model', 'Tool', 'Repository']) await safe(`Usage ${split} split`, async () => {
      await page.getByLabel('Split by', { exact: true }).selectOption(split);
      const key = (row) => split === 'Model' ? row.model || 'Model not reported' : split === 'Tool' ? row.harness || 'Tool not reported' : row.repository_id;
      const sqlGroups = groups(rows, key);
      const apiGroups = groups(apiRuns, key);
      check(`Usage ${split}: API group identities`, [...sqlGroups.keys()].sort(), [...apiGroups.keys()].sort());
      check(`Usage ${split}: UI group count`, sqlGroups.size, await panel('Spend split').locator('li').count());
      for (const [name, sql] of sqlGroups) {
        const apiCost = recorded(apiGroups.get(name) ?? []);
        number(`Usage ${split} ${name}: recorded SQL/API`, recorded(sql), apiCost);
        const label = split === 'Repository' ? repoNames.get(name) : name;
        await show(`Usage ${split} ${name}`, 'SUM(recorded cost_usd), unknown if ANY cost_usd IS NULL', `agent-runs.data grouped by ${split}`, apiCost,
          usd(recorded(sql)), panel('Spend split').locator('li').filter({ has: page.getByText(label, { exact: true }) }).locator('span').last());
      }
    });
    const mrKey = (row) => `${row.repository_id}|${row.pr_number}`;
    const mrGroups = groups(rows.filter((row) => row.pr_number), mrKey);
    const apiMRs = groups(apiRuns.filter((row) => row.pr_number), mrKey);
    const top = [...mrGroups].filter(([, sql]) => recorded(sql) !== undefined).sort((a, b) => recorded(b[1]) - recorded(a[1])).slice(0, 5);
    const apiTop = [...apiMRs].filter(([, api]) => recorded(api) !== undefined).sort((a, b) => recorded(b[1]) - recorded(a[1])).slice(0, 5);
    check('Usage MR ranking SQL/API', top.map(([key]) => key), apiTop.map(([key]) => key));
    const mrPanel = panel('Top five expensive merge requests');
    check('Usage MR ranked UI row count', top.length, await mrPanel.locator('li').count());
    for (const [index, [key, sql]] of top.entries()) {
      const apiCost = recorded(apiMRs.get(key) ?? []);
      number(`Usage MR ${key}: SQL/API recorded cost`, recorded(sql), apiCost);
      await show(`Usage MR rank ${index + 1}`, 'SUM(recorded costs) per repository_id/pr_number; exclude unknown groups; descending top 5', 'agent-runs.data MR groups', apiCost,
        usd(recorded(sql)), mrPanel.locator('li').nth(index).locator('span').last());
      await show(`Usage MR rank ${index + 1} identity`, 'Repository_id/pr_number of independently sorted recorded-cost groups', 'agent-runs.data MR groups', apiTop[index]?.[0],
        `${repoNames.get(sql[0].repository_id)} · MR #${sql[0].pr_number}`, mrPanel.locator('li').nth(index).locator('span').first());
    }
    if (!top.length) {
      uncovered.push('Fixture has no fully recorded MR groups: positive/tied top-five ordering is uncovered; unknown exclusion and empty ranking are measured.');
      await show('Usage no rankable MRs', 'Every linked MR group contains a NULL recorded cost', 'agent-runs.data MR groups', apiTop,
        'No priced merge requests. Link sessions to a merge request and sync recorded session costs.', mrPanel.getByText('No priced merge requests. Link sessions to a merge request and sync recorded session costs.', { exact: true }));
    }
    if ([...mrGroups.values()].some((sql) => recorded(sql) === undefined)) await show('Usage unknown MR warning', 'EXISTS MR group with NULL recorded cost', 'agent-runs.data MR groups', apiMRs.size,
      'Some merge requests cannot be ranked: recorded costs are unavailable. Model prices alone do not supply recorded costs.', mrPanel.getByText('Some merge requests cannot be ranked: recorded costs are unavailable. Model prices alone do not supply recorded costs.', { exact: true }));
  });

  await safe('Overview aggregates', async () => {
    await go('/');
    const data = response('overview').data;
    const dailyAPI = response('insights/analytics').data;
    const current = summary(data.current, data.current, 'Overview current');
    const previous = summary(data.previous, data.previous, 'Overview previous');
    const daily = analytics(dailyAPI, 'Overview daily');
    const partial = current.models_without_price.length > 0;
    const partialComparison = partial || previous.models_without_price.length > 0;
    await show('Overview headline', 'Fixture token-price subtotal and cache savings; excludes missing model prices', 'overview.data.current', data.current,
      `${usd(current.spend_usd)} ${partial ? 'priced subtotal · Partial spend' : 'spent'} · ${usd(current.cache_savings_usd)} saved with cache${partial ? ' (priced usage only)' : ''}`, page.getByRole('region', { name: 'Spend summary' }).locator('p').first());
    for (const [field, title] of [['spend_usd', 'Spend'], ['cost_per_merged_pr', 'Cost per merged PR'], ['cache_hit_rate', 'Cache hit rate']]) {
      const rate = field === 'cache_hit_rate';
      const article = card(`${title}${partial && !rate ? ' · Partial' : ''}`);
      await show(`Overview ${title}`, `Independent ${field}; merged denominator from persisted merged_at in UTC range`, `overview.data.current.${field}`, data.current[field],
        rate ? `${(current[field] * 100).toFixed(1)}%` : usd(current[field]), article.locator('p').first());
      const delta = current[field] - previous[field];
      const change = !rate && partialComparison ? 'Priced usage only · Set missing model prices before comparing periods' : `${delta > 0 ? '+' : ''}${rate ? `${(delta * 100).toFixed(1)} percentage points` : usd(delta)} vs previous period`;
      number(`Overview ${title}: SQL/API delta`, delta, data.current[field] - data.previous[field]);
      await show(`Overview ${title} comparison`, 'Current minus equal-length previous period; suppress monetary delta if either period is partial', `overview.data.current/previous.${field}`, [data.current[field], data.previous[field]], change, article.locator('p').last());
    }
    check('Overview daily: UI rows', daily.size, await page.getByLabel('Daily spend chart').locator('time').count());
    for (const [date, sql] of daily) {
      const buckets = dailyAPI.buckets.filter((bucket) => day(bucket.start) === date);
      await show(`Overview day ${date}`, 'UTC day token-priced subtotal; disclose unknown price count', `insights/analytics.data.buckets[start=${date}]`, buckets,
        `${usd(estimate(sql))}${sql.some((row) => !priced(row)) ? ' · Partial' : ''}`, page.getByLabel('Daily spend chart').locator('div').filter({ has: page.locator(`time[datetime^="${date}"]`) }).filter({ has: page.locator(':scope > time') }).locator(':scope > span'));
    }
  });
  return { uncovered };
}
