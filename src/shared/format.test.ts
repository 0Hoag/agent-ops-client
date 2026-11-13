import { describe, expect, it } from 'vitest';
import { compact, money, relativeTime } from './format';

describe('numeric display contract', () => {
  it.each([[0, '$0.00'], [12.4, '$12.40'], [0.0001, '$0.0001'], [1234567.89, '$1,234,567.89']])('formats USD %s without losing supported small values', (value, expected) => {
    expect(money(value)).toBe(expected);
  });
  it.each([[0, '0'], [1846116, '1.85M'], [0.01, '0.01']])('formats compact %s', (value, expected) => {
    expect(compact(value)).toBe(expected);
  });
  it('distinguishes unavailable cost from zero', () => {
    expect(money(undefined)).toBe('Cost unavailable — check model pricing in Settings');
    expect(money(null)).toBe('Cost unavailable — check model pricing in Settings');
  });
  it('uses an explicit frozen time for relative-time expectations', () => {
    const now = Date.parse('2026-11-13T12:00:00Z');
    expect(relativeTime('2026-11-13T10:00:00Z', now)).toBe('2 hours ago');
    expect(relativeTime('2026-11-13T12:00:00Z', now)).toBe('this minute');
    expect(relativeTime(undefined, now)).toBe('Time not reported — sync session history');
  });
});
