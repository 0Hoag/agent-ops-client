import { describe, expect, it } from 'vitest';
import { cacheHitPercent } from './runs';

describe('cacheHitPercent', () => {
  it('uses normalized cached, input, and cache-write tokens', () => {
    expect(cacheHitPercent({ input_tokens: 30, cached_input_tokens: 50, cache_write_tokens: 20 })).toBe(50);
  });

  it('returns null when the token denominator is zero', () => {
    expect(cacheHitPercent({ input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0 })).toBeNull();
  });

  it('keeps a known zero cost distinct from an unknown cost', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(undefined)).toBe('Unknown');
  });
});

function formatCost(cost: number | undefined): string {
  return cost === undefined ? 'Unknown' : `$${cost.toFixed(2)}`;
}
