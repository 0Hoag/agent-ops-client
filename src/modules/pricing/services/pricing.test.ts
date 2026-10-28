import { describe, expect, it } from 'vitest';
import { priceQueryKey, validPrice } from './pricing';

describe('price arithmetic and display', () => {
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
