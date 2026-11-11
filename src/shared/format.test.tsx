// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { compact, count, exactTime, money, relativeTime } from './format';
import { ProductTerms, RelativeTime } from './ui/ProductTerms';
import { AuditEntry } from '../modules/waves/AuditEntry';

afterEach(cleanup);
it('formats counts, token units and USD without inventing missing prices', () => {
  expect(compact(1846116)).toBe('1.85M');
  expect(count(1846116)).toBe('1,846,116');
  expect(compact(0)).toBe('0');
  expect(compact(undefined)).toContain('sync usage');
  expect(money(12.4)).toBe('$12.40');
  expect(money(0.0001)).toBe('$0.0001');
  expect(money(0)).toBe('$0.00');
  expect(money(undefined)).toContain('check model pricing in Settings');
});
it('pairs relative time with a stable exact UTC tooltip and handles missing/invalid time', () => {
  const value = '2026-11-11T10:00:00Z';
  expect(relativeTime(value, Date.parse('2026-11-11T12:00:00Z'))).toBe('2 hours ago');
  expect(relativeTime(value, Date.parse('2026-11-11T09:00:00Z'))).toBe('in 1 hour');
  expect(relativeTime('invalid')).toContain('sync session history');
  expect(exactTime('invalid')).toBeUndefined();
  expect(exactTime(value)).toBe('Nov 11, 2026, 10:00:00 AM UTC');
  render(<RelativeTime value={value} />);
  expect(screen.getByTitle('Nov 11, 2026, 10:00:00 AM UTC').getAttribute('datetime')).toBe(value);
});
it('explains remaining terms and provides actionable missing audit metadata', () => {
  const view = render(<><ProductTerms /><AuditEntry entry={{}} /></>);
  expect(screen.getByText('Terms explained')).toBeTruthy();
  expect(screen.getByTitle(/agent application/).textContent).toBe('Tool');
  expect(view.container.textContent).not.toMatch(/Unknown/);
  expect(view.container.textContent).toContain('check audit source');
  expect(view.container.textContent).toContain('refresh audit history');
  expect(view.container.textContent).toContain('sync session history');
});
