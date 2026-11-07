// Deterministic test/browser data only; never imported by production components.
export const observations = [
  { input: 80, cached: 20, output: 6, reasoning: 3, write: 1, billed: 0, equivalent: 3, lines: 3, sentBack: true, green: true, lead: 86400, harness: 'runner-a', model: 'model-a', wave: 'W12', area: 'client' },
  { input: 120, cached: 30, output: 14, reasoning: 5, write: 3, billed: 0, equivalent: 4, lines: 5, sentBack: false, green: true, lead: 172800, harness: 'runner-a', model: 'model-a', wave: 'W12', area: 'client' },
];

export const excludedObservations = [{ price: undefined, history: undefined, lines: undefined }];
export const closedIssues = [{ id: 'issue-1' }];
export const repeatedErrors = ['workflow-retry', 'workflow-retry', 'workflow-retry'];

export function analyticsFixture(period = 'daily', group = 'harness') {
  return {
    period, group_by: group, unknown_price_count: excludedObservations.length, cache_denominator: 'input tokens', bucket_timestamp: 'start', week_starts: 'Monday',
    buckets: [{ start: '2026-10-01', key: observations[0][group as 'harness'],
      actual_cost_usd: observations.reduce((n, row) => n + row.billed, 0),
      equivalent_cost_usd: observations.reduce((n, row) => n + row.equivalent, 0),
      input_tokens: observations.reduce((n, row) => n + row.input, 0),
      cached_input_tokens: observations.reduce((n, row) => n + row.cached, 0),
      output_tokens: observations.reduce((n, row) => n + row.output, 0),
      reasoning_tokens: observations.reduce((n, row) => n + row.reasoning, 0),
      cache_write_tokens: observations.reduce((n, row) => n + row.write, 0),
      cache_hit_rate: observations.reduce((n, row) => n + row.cached, 0) / observations.reduce((n, row) => n + row.input, 0), runs: observations.length, unknown_price_count: excludedObservations.length,
    }],
  };
}

export function deliveryFixture() {
  const cost = observations.reduce((n, row) => n + row.equivalent, 0);
  return {
    history: { complete: true, unavailable: 1 },
    merged_prs: { count: 2, eligible: 2, unavailable: 1, cost_per_item_usd: cost / 2 },
    closed_issues: { count: 1, eligible: 1, unavailable: 0, cost_per_item_usd: cost },
    send_back: { rate: 0.5, numerator: 1, denominator: 2 }, first_ci_success: { rate: 1, successful: 2, eligible: 2 },
    issue_to_merge_lead_time: { median_seconds: 129600, completed: 2, unavailable: 1 },
    harness_comparison: [{ harness: 'runner-a', cost_per_changed_line_usd: cost / 8, eligible: 2, changed_lines: 8, unavailable: 1 }],
  };
}

export const insightsFixture = { data: { repository_id: 'repo-1', history: { complete: true }, send_back: { count: 1, rate: 0.5, numerator: 1, denominator: 2, evidence: [] }, first_ci_success: { successful: 0, eligible: 0, rate: 0, evidence: [] }, cycle_time: { completed: 0, median_seconds: 0, evidence: [] }, suggestions: [{ key: 'flaky', message: 'Retrying workflow repeatedly', occurrences: 3, evidence: [] }] } };
