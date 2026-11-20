// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { DailySpend } from '../../modules/overview/DailySpend';

vi.mock('../../modules/auth/services/auth', () => ({ hasToken: () => true }));
afterEach(cleanup);

it('exposes the current organization as a named accessibility group', () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppLayout>Content</AppLayout></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('group', { name: 'Current organization' })).toBeTruthy();
});

it('exposes daily spend as a named group without hiding bucket text', () => {
  render(<DailySpend buckets={[]} />);
  expect(screen.getByRole('group', { name: 'Daily spend chart' })).toBeTruthy();
});
