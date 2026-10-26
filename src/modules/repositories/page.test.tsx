// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { RepositoriesPage } from './page';

const request = vi.spyOn(http, 'request');
let memberRole = 'owner';
function setup() {
  request.mockImplementation((config) => {
    if (config.url === '/api/v1/auth/session') return Promise.resolve({ data: { account_id: 'acct-1', organization_id: 'org-1' } } as never);
    if (config.url === '/api/v1/organizations/org-1/members') return Promise.resolve({ data: { data: [{ account_id: 'acct-1', role: memberRole }] } } as never);
    if (config.url === '/api/v1/repositories' && config.method === 'GET') return Promise.resolve({ data: { data: [{ id: 'gh', provider: 'github', full_name: 'acme/one', status_mappings: {} }, { id: 'gl', provider: 'gitlab', full_name: 'acme/two', gitlab_base_url: 'https://git.example', status_mappings: {} }] } } as never);
    return Promise.resolve({ data: { data: { id: 'new', webhook_secret: 'one-time-secret' } } } as never);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><RepositoriesPage /></QueryClientProvider>);
  return client;
}

describe('RepositoriesPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); memberRole = 'owner'; });
  it('renders both providers and hides mutation controls for read-only roles', async () => {
    memberRole = 'viewer'; setup();
    expect(await screen.findByText('acme/one')).toBeTruthy();
    expect(screen.getByText('acme/two')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create repository' })).toBeNull();
  });
  it('clears secret and form credentials when navigating away and back', async () => {
    setup();
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'acme/secret' } });
    fireEvent.change(screen.getByLabelText('Webhook credential'), { target: { value: 'request-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));
    expect(await screen.findByText('one-time-secret')).toBeTruthy();
    fireEvent(window, new Event('popstate'));
    expect(screen.queryByText('one-time-secret')).toBeNull();
    expect((screen.getByLabelText('Webhook credential') as HTMLInputElement).value).toBe('');
  });
  it('clears transient secret when the organization changes', async () => {
    setup();
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'acme/secret' } });
    fireEvent.change(screen.getByLabelText('Webhook credential'), { target: { value: 'request-secret' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Create repository' }));
    expect(await screen.findByText('one-time-secret')).toBeTruthy();
    fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByText('one-time-secret')).toBeNull();
  });
  it('sends create and PATCH payloads and reveals its returned secret once', async () => {
    const queryClient = setup();
    fireEvent.change(await screen.findByLabelText('Provider'), { target: { value: 'gitlab' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'acme/new' } });
    fireEvent.change(screen.getByLabelText('Self-hosted base URL'), { target: { value: 'https://git.internal' } });
    fireEvent.change(screen.getByLabelText('Webhook credential'), { target: { value: 'credential' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));
    expect(await screen.findByText('one-time-secret')).toBeTruthy();
    expect(request.mock.calls.some(([config]) => config.method === 'POST' && config.url === '/api/v1/repositories' && JSON.parse(config.data as string).provider === 'gitlab' && JSON.parse(config.data as string).webhook_secret === 'credential')).toBe(true);
    await waitFor(() => expect(screen.queryByText('one-time-secret')).toBeTruthy());
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables ?? null))).not.toContain('credential');
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('one-time-secret')).toBeNull();
    vi.spyOn(window, 'prompt').mockReturnValueOnce('https://git.example').mockReturnValueOnce('{"open":"todo"}');
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit settings' })[0]);
    await waitFor(() => expect(request.mock.calls.some(([config]) => config.method === 'PATCH' && config.url === '/api/v1/repositories/gh')).toBe(true));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(request.mock.calls.some(([config]) => config.method === 'DELETE' && config.url === '/api/v1/repositories/gh')).toBe(true));
  });
});
