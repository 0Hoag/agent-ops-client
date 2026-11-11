// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../shared/api/client';
import { MembersPage } from './MembersPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps account and role labels when member rows reflow on mobile', async () => {
  vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { organization_id: 'org-a', account_id: 'acct' } } as never);
  vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role: 'owner' }] } } as never);
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><MembersPage /></MemoryRouter></QueryClientProvider>);
  expect((await screen.findByText('acct')).getAttribute('data-label')).toBe('Account');
  expect(screen.getByText('owner').getAttribute('data-label')).toBe('Role');
  expect(screen.getByRole('table').classList.contains('responsive-table')).toBe(true);
  expect(screen.getByRole('button', { name: 'Create invitation link' })).toBeTruthy();
});
