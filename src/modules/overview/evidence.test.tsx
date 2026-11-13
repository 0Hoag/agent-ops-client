// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Attention } from './Attention';
import { DailySpend } from './DailySpend';

afterEach(cleanup);

describe('Overview evidence', () => {
  it('prioritizes actionable records before inactive merge requests and retains unfamiliar kinds', () => {
    render(<Attention items={[
      { kind: 'stale_pr', pr_number: 7, message: 'Inactive merge request' },
      { kind: 'missing_price', model: 'unpriced-model', message: 'Price required' },
      { kind: 'new-server-kind', message: 'New attention reason', run_id: 'session/1' },
    ]} />);
    const summaries = [...document.querySelectorAll('summary')];
    expect(summaries.map((item) => item.textContent)).toEqual([
      '1 missing model price', '1 other attention item', '1 merge request inactive for 3+ days',
    ]);
    document.querySelectorAll('details').forEach((item) => { item.open = true; });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('New attention reason')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View run' }).getAttribute('href')).toBe('/runs/session%2F1');
    expect(screen.getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
  });

  it('distinguishes a reported zero from an absent cost and labels partial daily subtotals', () => {
    render(<DailySpend buckets={[
      { start: '2026-11-01', actual_cost_usd: 0 },
      { start: '2026-11-02', unknown_price_count: 1 },
      { start: '2026-11-03', actual_cost_usd: 2.6475, unknown_price_count: 1 },
    ]} />);
    const chart = within(screen.getByLabelText('Daily spend chart'));
    expect(chart.getAllByText('$0.00')).toHaveLength(1);
    expect(chart.getByText('Not priced')).toBeTruthy();
    expect(chart.getByText('$2.6475 · Partial')).toBeTruthy();
    expect(chart.getByText('Nov 3').getAttribute('dateTime')).toBe('2026-11-03');
  });

  it('provides a calm empty attention state', () => {
    render(<Attention />);
    expect(screen.getByText('Nothing needs attention.')).toBeTruthy();
    expect(document.querySelector('details')).toBeNull();
  });
});
