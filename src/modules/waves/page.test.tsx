// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { WavesPage } from './page';

const request = vi.spyOn(http, 'request');
let currentOrg = 'org-a';
const fixture = [{ id: 'a', name: 'Wave A', brief: 'First', state: 'todo' }, { id: 'b', name: 'Wave B', state: 'in_progress' }];
function respond(data: unknown) { request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg, account_id: 'acct' } : config?.url?.includes('/members') ? { data: [{ account_id: 'acct', role: 'owner' }] } : { data }, status: 200, statusText: 'OK', headers: {}, config } as never)); }
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><WavesPage /></QueryClientProvider>); }

describe('WavesPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); currentOrg = 'org-a'; });
  it('renders fixture waves in their states and creates a wave', async () => {
    respond(fixture);
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'todo waves' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wave C' } });
    fireEvent.change(screen.getByLabelText('Brief'), { target: { value: 'Third' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create wave' }));
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'POST' && config?.data === JSON.stringify({ name: 'Wave C', brief: 'Third' }))).toBe(true));
  });
  it('updates state and recovers from a list failure', async () => {
    respond([fixture[0]]);
    setup();
    const selector = await screen.findByLabelText('State for Wave A');
    expect((selector as HTMLSelectElement).options.length).toBe(5);
    expect(screen.getByRole('region', { name: 'in_progress waves' })).toBeTruthy();
    fireEvent.change(selector, { target: { value: 'in_progress' } });
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'PATCH' && config?.data === JSON.stringify({ state: 'in_progress' }))).toBe(true));
    cleanup();
    let failed = false;
    request.mockImplementation(async (config) => { if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never; if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never; if (config?.url === '/api/v1/waves' && !failed) { failed = true; throw new Error('offline'); } return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never; });
    setup();
    expect(await screen.findByText('Unable to load waves.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Wave A')).toBeTruthy();
  });
  it('isolates the cache when organization changes', async () => {
    request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg, account_id: 'acct' } : config?.url?.includes('/members') ? { data: [{ account_id: 'acct', role: 'owner' }] } : { data: currentOrg === 'org-a' ? fixture : [{ id: 'c', name: 'Wave C', state: 'todo' }] }, status: 200, statusText: 'OK', headers: {}, config } as never));
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    currentOrg = 'org-b';
    fireEvent(window, new Event('organization:will-change'));
    fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('Wave C')).toBeTruthy();
    expect(screen.queryByText('Wave A')).toBeNull();
  });
  it('renders supported empty workflow columns for an empty list', async () => {
    respond([]);
    setup();
    expect(await screen.findByText('No waves found.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'in_progress waves' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'done waves' })).toBeTruthy();
  });
  it('edits a templated brief, saves with PATCH and reloads the persisted brief', async () => {
    let saved = 'First';
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
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
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
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
  it('starts, refreshes, stops and restarts using the exact launcher request', async () => {
    const input = { wave: 'wave-1', branch: 'feature', worktree: '/tmp/worker', script: 'pnpm test', brief: 'Do work' };
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/organizations/org-a/members') return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/workers/start' || config?.url === '/api/v1/workers/restart') return { data: { data: { ID: 'job-1', State: 'queued', Request: input } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/workers/job-1') return { data: { data: { ID: 'job-1', State: 'running', Request: input } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    for (const field of Object.keys(input)) fireEvent.change(await screen.findByLabelText(`Worker ${field}`), { target: { value: input[field as keyof typeof input] } });
    fireEvent.click(screen.getByRole('button', { name: 'Start worker' }));
    expect(await screen.findByText('Worker job-1: queued')).toBeTruthy();
    expect(JSON.parse(request.mock.calls.find(([config]) => config?.url === '/api/v1/workers/start')?.[0]?.data as string)).toEqual(input);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText('Worker job-1: running')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop worker' }));
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.url === '/api/v1/workers/job-1/stop')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Restart worker' }));
    await waitFor(() => expect(JSON.parse(request.mock.calls.find(([config]) => config?.url === '/api/v1/workers/restart')?.[0]?.data as string)).toEqual(input));
    await waitFor(() => expect(screen.getByText('Worker job-1: queued')).toBeTruthy());
  });
  it('hides worker actions from members and reports rejected worker actions', async () => {
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/organizations/org-a/members') return { data: { data: [{ account_id: 'acct', role: 'member' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Worker controls' })).toBeNull();
    expect(screen.getByText(/Read-only/)).toBeTruthy();
  });
  it('does not restore old worker details after organization change', async () => {
    respond(fixture); setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    currentOrg = 'org-b'; fireEvent(window, new Event('organization:will-change')); fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.queryByText(/Worker job-/)).toBeNull();
  });
});
