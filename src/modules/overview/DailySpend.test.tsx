// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DailySpend } from './DailySpend';

afterEach(cleanup);

it('shows one UTC-day subtotal across tools, retaining missing-price disclosure', () => {
  render(<DailySpend buckets={[
    { start: '2026-11-10T00:00:00Z', key: 'Claude', actual_cost_usd: 1.25 },
    { start: '2026-11-10T00:00:00Z', key: 'Codex', actual_cost_usd: 2.5 },
    { start: '2026-11-10T00:00:00Z', key: 'Other', unknown_price_count: 1 },
  ]} />);
  expect(screen.getAllByText('Nov 10')).toHaveLength(1);
  expect(screen.getByText('$3.75 · Partial')).toBeTruthy();
});

it('distinguishes an all-unpriced day from a real zero subtotal', () => {
  render(<DailySpend buckets={[
    { start: '2026-11-10T00:00:00Z', unknown_price_count: 1 },
    { start: '2026-11-10T00:00:00Z', unknown_price_count: 1 },
    { start: '2026-11-11T00:00:00Z', actual_cost_usd: 0 },
  ]} />);
  expect(screen.getAllByText('Not priced')).toHaveLength(1);
  expect(screen.getByText('$0.00')).toBeTruthy();
});
