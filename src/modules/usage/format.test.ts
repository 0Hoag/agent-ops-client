import { describe, expect, it } from 'vitest';
import { dailyCosts, groupCosts, money, relativeTime, sessionRows, tokens } from './format';
import { dateRange } from './services';

describe('Usage calculations', () => {
  it('preserves unpriced values in daily and split sums', () => {
    expect(dailyCosts([{ start: '2026-11-11', actual_cost_usd: 2 }, { start: '2026-11-11', actual_cost_usd: 3, unknown_price_count: 1 }])).toEqual([{ name: '2026-11-11', cost: undefined }]);
    expect(groupCosts([{ cost: 2 }, {}], () => 'Model', (row) => row.cost)).toEqual([{ name: 'Model', cost: undefined }]);
    expect(money(undefined)).toContain('check model pricing');
    expect(tokens({ input_tokens: 100 })).toContain('sync token usage');
    expect(sessionRows([{ session_id: 'a', cost_usd: 2 }, { session_id: 'a' }])[0].cost_usd).toBeUndefined();
  });
  it('uses human relative time and inclusive UTC presets', () => {
    expect(relativeTime('2026-11-11T10:00:00Z', Date.parse('2026-11-11T12:00:00Z'))).toBe('2 hours ago');
    expect(dateRange('7 days', new Date('2026-11-11T12:00:00Z'))).toEqual({ from: '2026-11-05', to: '2026-11-11' });
    expect(dateRange('30 days', new Date('2026-11-11T12:00:00Z')).from).toBe('2026-10-13');
  });
});
