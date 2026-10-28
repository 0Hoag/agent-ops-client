import { describe, expect, it } from 'vitest';
import { formatRunCost, priceQueryKey, validPrice } from './pricing';

describe('price arithmetic and display', () => {
  it('does not equate subscription billed zero with missing API equivalent', () => {
    expect(formatRunCost({ billed_cost_usd: 0 }, 'USD')).toBe('$0.0000');
    expect(formatRunCost({ billed_cost_usd: 0 }, 'VND')).toBe('Unknown');
    expect(formatRunCost({ equivalent_cost_usd: 1.25 }, 'USD')).toBe('Unknown');
  });

  it('keeps server supplied currency values and leaves unknown values unknown', () => {
    expect(formatRunCost({ cost_usd: 2.5, equivalent_cost_usd: 62500 }, 'VND')).toBe('VND 62,500');
    expect(formatRunCost({}, 'USD')).toBe('Unknown');
  });

  it('validates complete non-negative dated model price versions', () => {
    const price = { model: 'model-a', effective_date: '2026-01-01', input_per_million: 1, cached_input_per_million: 0, cache_write_per_million: 2, output_per_million: 3, reasoning_per_million: 4 };
    expect(validPrice(price)).toBe(true);
    expect(validPrice({ ...price, output_per_million: -1 })).toBe(false);
    expect(validPrice({ ...price, effective_date: '' })).toBe(false);
  });

  it('isolates server data by organization', () => {
    expect(priceQueryKey('org-a')).not.toEqual(priceQueryKey('org-b'));
  });
});
