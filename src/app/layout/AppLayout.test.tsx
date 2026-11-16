// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const { listOrganizations } = vi.hoisted(() => ({ listOrganizations: vi.fn() }));
vi.mock('../../modules/auth/services/auth', () => ({ hasToken: () => true, listOrganizations, validateSession: async (ready: (id: string) => void) => { ready('org'); return true; } }));
vi.mock('../../shared/api/client', () => ({ api: { api: { v1RepositoriesList: async () => ({ data: { data: [] } }) } } }));
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

it('retries a failed shell organization request without requiring a page reload', async () => {
  sessionStorage.setItem('agent-ops-token', 'token');
  listOrganizations.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([{ id: 'org', name: 'Review organization' }]);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppLayout><h2>Page content</h2></AppLayout></MemoryRouter></QueryClientProvider>);
  act(() => { window.dispatchEvent(new CustomEvent('auth:session-restored', { detail: { organizationId: 'org' } })); });
  expect((await screen.findByRole('alert')).textContent).toContain('Unable to load organization');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await waitFor(() => expect(screen.getByLabelText('Current organization').textContent).toBe('Review organization'));
  expect(listOrganizations).toHaveBeenCalledTimes(2);
  sessionStorage.clear();
});
