import { expect, it } from 'vitest';
import { total } from './format';

it('session totals preserve null/missing recorded costs rather than inventing zero', () => {
  const calculate = total;
  expect(calculate([null])).toBeUndefined();
  expect(calculate([12.4, null])).toBeUndefined();
  expect(calculate([12.4, undefined])).toBeUndefined();
  expect(calculate([0, 0])).toBe(0);
  expect(calculate([0.0001, 12.4])).toBeCloseTo(12.4001, 8);
});
