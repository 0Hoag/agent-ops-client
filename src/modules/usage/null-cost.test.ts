import { expect, it } from 'vitest';
import { sum } from './format';

it('usage totals preserve null/missing costs rather than inventing zero', () => {
  expect(sum([null])).toBeUndefined();
  expect(sum([12.4, null])).toBeUndefined();
  expect(sum([12.4, undefined])).toBeUndefined();
  expect(sum([0, 0])).toBe(0);
  expect(sum([0.0001, 12.4])).toBeCloseTo(12.4001, 8);
});
