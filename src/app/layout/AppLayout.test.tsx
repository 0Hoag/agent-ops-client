// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

vi.mock('../../modules/auth/services/auth', () => ({ hasToken: () => true }));
afterEach(cleanup);

it('keeps the header above the content in one flexible column beside navigation', () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppLayout><h2>Page content</h2></AppLayout></MemoryRouter></QueryClientProvider>);
  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');
  expect(header.parentElement).toBe(main.parentElement);
  expect(header.nextElementSibling).toBe(main);
  expect(header.parentElement?.classList.contains('flex-1')).toBe(true);
  expect(main.parentElement?.previousElementSibling?.tagName).toBe('ASIDE');
});
