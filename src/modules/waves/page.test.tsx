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
  it('edits a templated brief, saves with PATCH and reloads the persisted brief', async () => {
    let saved = 'First';
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.method === 'PATCH') { saved = JSON.parse(config.data as string).brief; return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never; }
      return { data: { data: [{ ...fixture[0], brief: saved }, fixture[1]] }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    fireEvent.change(await screen.findByLabelText('Brief template for Wave A'), { target: { value: 'Release plan' } });
    fireEvent.change(screen.getByLabelText('Brief for Wave A'), { target: { value: 'Edited release brief' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save brief' })[0]);
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'PATCH' && config?.data === JSON.stringify({ brief: 'Edited release brief' }))).toBe(true));
    await waitFor(() => expect((screen.getByLabelText('Brief for Wave A') as HTMLTextAreaElement).value).toBe('Edited release brief'));
    expect(saved).toBe('Edited release brief');
  });
  it('preserves unsaved brief text when the PATCH request fails', async () => {
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.method === 'PATCH') throw new Error('offline');
      return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    const editor = await screen.findByLabelText('Brief for Wave A') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save brief' })[0]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('Brief for Wave A') as HTMLTextAreaElement).value).toBe('Unsaved draft');
  });
});
