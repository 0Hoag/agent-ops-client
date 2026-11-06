// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CostCache, Delivery } from './AnalyticsTables';

afterEach(cleanup);
it('does not turn missing or zero denominators into measured zero; genuine zero costs/rates remain valid', () => {
  render(<><CostCache data={{ buckets: [{ input_tokens: 0, cache_hit_rate: 0 }, { input_tokens: 10, cache_hit_rate: 0, actual_cost_usd: 0, equivalent_cost_usd: 0 }] }} /><Delivery data={{ history: { complete: true }, merged_prs: { count: 0, cost_per_item_usd: 0 }, closed_issues: { count: 1, cost_per_item_usd: 0 }, send_back: { denominator: 0, rate: 0 }, first_ci_success: { eligible: 1, successful: 0, rate: 0 }, issue_to_merge_lead_time: { completed: 0, median_seconds: 0 }, harness_comparison: [{ harness: 'none', changed_lines: 0, cost_per_changed_line_usd: 0 }] }} /></>);
  const costs = within(screen.getByRole('region', { name: 'Cost and cache trends' })).getAllByRole('row');
  expect(within(costs[1]).getAllByRole('cell')[3].textContent).toBe('Unavailable (denominator unavailable)');
  expect(within(costs[2]).getAllByRole('cell')[3].textContent).toBe('0.0% (denominator unavailable)');
  expect(screen.getAllByText('$0.0000').length).toBe(2);
  const delivery = within(screen.getByRole('region', { name: 'Delivery quality' })).getAllByRole('row');
  expect(delivery.slice(1).map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['Unavailable', '$0.0000 equivalent API cost/item', 'Unavailable', '0.0%', 'Unavailable', 'Unavailable']);
});

it('does not publish delivery rates or lead time as measured when history is incomplete', () => {
  render(<Delivery data={{ history: { complete: false }, merged_prs: { count: 2, cost_per_item_usd: 3 }, send_back: { denominator: 2, rate: 0.5 }, first_ci_success: { eligible: 2, rate: 1 }, issue_to_merge_lead_time: { completed: 1, median_seconds: 86400 } }} />);
  expect(screen.getAllByText('Unavailable').length).toBe(5);
  expect(screen.queryByText('50.0%')).toBeNull();
});
