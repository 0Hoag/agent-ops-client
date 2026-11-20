// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { http } from '../../shared/http';
import { AppLayout } from './AppLayout';
import { useState } from 'react';

const adapter = http.defaults.adapter;
beforeEach(() => {
  sessionStorage.setItem('agent-ops-token', 'org-a');
  localStorage.clear();
  http.defaults.adapter = async (config) => {
    const org = config.headers.Authorization === 'Bearer org-b' ? 'b' : 'a';
    const path = config.url ?? '';
    const data = path.endsWith('/auth/select-organization') ? { token: 'org-b' }
      : path.endsWith('/auth/session') ? { organization_id: `org-${org}` }
      : path.endsWith('/organizations') ? { data: [{ id: 'org-a', name: 'A' }, { id: 'org-b', name: 'B' }] }
      : { data: [{ id: `repo-${org}`, full_name: `tenant/${org}` }] };
    return { config, status: 200, statusText: 'OK', headers: {}, data };
  };
});
afterEach(() => { cleanup(); http.defaults.adapter = adapter; sessionStorage.clear(); localStorage.clear(); });

function TenantState() {
  const [tenant] = useState(sessionStorage.getItem('agent-ops-token'));
  return <p>Private {tenant}</p>;
}
async function mountAndSelectRepository() {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppLayout><TenantState /></AppLayout></MemoryRouter></QueryClientProvider>);
  fireEvent(window, new CustomEvent('auth:session-restored', { detail: { organizationId: 'org-a' } }));
  await screen.findByRole('option', { name: 'tenant/a' });
  fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-a' } });
  expect(localStorage.getItem('agent-ops-repository')).toBe('repo-a');
}

it('clears the previous tenant repository filter when switching organizations', async () => {
  await mountAndSelectRepository();
  fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'org-b' } });
  await screen.findByRole('option', { name: 'tenant/b' });
  expect(localStorage.getItem('agent-ops-repository')).toBeNull();
  expect((screen.getByLabelText('Repository') as HTMLSelectElement).value).toBe('');
});

it('clears tenant repository preferences when signing out', async () => {
  await mountAndSelectRepository();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(sessionStorage.getItem('agent-ops-token')).toBeNull());
  expect(localStorage.getItem('agent-ops-repository')).toBeNull();
});

it('unmounts previous-tenant page state on a validated organization switch', async () => {
  await mountAndSelectRepository();
  expect(screen.getByText('Private org-a')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'org-b' } });
  await screen.findByRole('option', { name: 'tenant/b' });
  expect(screen.queryByText('Private org-a')).toBeNull();
  expect(screen.getByText('Private org-b')).toBeTruthy();
});
