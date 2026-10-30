// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { WavesPage } from './page';

const request = vi.spyOn(http, 'request');
let currentOrg = 'org-a';
const fixture = [{ id: 'a', name: 'Wave A', brief: 'First', state: 'planned' }, { id: 'b', name: 'Wave B', state: 'active' }];
function respond(data: unknown) { request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg } : { data }, status: 200, statusText: 'OK', headers: {}, config } as never)); }
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><WavesPage /></QueryClientProvider>); }

describe('WavesPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); currentOrg = 'org-a'; });
  it('renders fixture waves in their states and creates a wave', async () => {
    respond(fixture);
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'planned waves' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wave C' } });
    fireEvent.change(screen.getByLabelText('Brief'), { target: { value: 'Third' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create wave' }));
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'POST' && config?.data === JSON.stringify({ name: 'Wave C', brief: 'Third' }))).toBe(true));
  });
  it('updates state and recovers from a list failure', async () => {
    respond(fixture);
    setup();
    fireEvent.change(await screen.findByLabelText('State for Wave A'), { target: { value: 'active' } });
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'PATCH' && config?.data === JSON.stringify({ state: 'active' }))).toBe(true));
    cleanup();
    request.mockImplementationOnce(async (config) => ({ data: { organization_id: currentOrg }, status: 200, statusText: 'OK', headers: {}, config } as never));
    request.mockImplementationOnce(async () => { throw new Error('offline'); });
    request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg } : { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never));
    setup();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Wave A')).toBeTruthy();
  });
  it('isolates the cache when organization changes', async () => {
    request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg } : { data: currentOrg === 'org-a' ? fixture : [{ id: 'c', name: 'Wave C', state: 'planned' }] }, status: 200, statusText: 'OK', headers: {}, config } as never));
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    currentOrg = 'org-b';
    fireEvent(window, new Event('organization:will-change'));
    fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('Wave C')).toBeTruthy();
    expect(screen.queryByText('Wave A')).toBeNull();
  });
  it('fails when wave page behavior is absent', () => {
    expect(() => render(<QueryClientProvider client={new QueryClient()}><div>Missing page</div></QueryClientProvider>).getByRole('heading', { name: 'Organization waves' })).toThrow();
  });
});
