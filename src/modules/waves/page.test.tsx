// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { WavesPage } from './page';

const request = vi.spyOn(http, 'request');
class FakeSocket {
  static sockets: FakeSocket[] = [];
  listeners: Record<string, ((event: MessageEvent<string>) => void)[]> = {};
  closed = false;
  constructor(public url: string) { FakeSocket.sockets.push(this); }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) { this.listeners[type] = [...(this.listeners[type] ?? []), listener]; }
  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void) { this.listeners[type] = (this.listeners[type] ?? []).filter((item) => item !== listener); }
  close() { this.closed = true; }
  emit(data: string) { for (const listener of this.listeners.message ?? []) listener({ data } as MessageEvent<string>); }
}
let currentOrg = 'org-a';
const fixture = [{ id: 'a', name: 'Wave A', brief: 'First', state: 'todo' }, { id: 'b', name: 'Wave B', state: 'in_progress' }];
function respond(data: unknown) { request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg, account_id: 'acct' } : config?.url?.includes('/members') ? { data: [{ account_id: 'acct', role: 'owner' }] } : { data }, status: 200, statusText: 'OK', headers: {}, config } as never)); }
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><WavesPage /></QueryClientProvider>); }

describe('WavesPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); FakeSocket.sockets = []; currentOrg = 'org-a'; });
  beforeEach(() => { sessionStorage.setItem('agent-ops-token', 'test-token'); });
  it('presents the purpose and truthful scope of advanced agent controls and logs', async () => {
    respond(fixture);
    setup();
    expect(await screen.findByRole('heading', { name: /plan and track organization work/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /advanced agent controls/i }).getAttribute('href')).toBe('/waves#agents');
    expect(screen.getByRole('link', { name: /live logs/i }).getAttribute('href')).toBe('/waves#logs');
    expect(screen.getByText(/only logs the selected job started here/i)).toBeTruthy();
    expect(screen.getByText(/start an agent here to view its live logs/i)).toBeTruthy();
    expect(screen.getByText(/cannot find or reconnect to another job here/i)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Advanced agent controls' }).id).toBe('agents');
    expect(screen.getByRole('region', { name: 'Live logs' }).id).toBe('logs');
    expect(screen.queryByRole('textbox', { name: /worker|worktree|script/i })).toBeNull();
    expect(screen.queryByText(/product terms/i)).toBeNull();
  });
  afterEach(() => { sessionStorage.clear(); });
  it('renders fixture waves in their states and creates a wave', async () => {
    respond(fixture);
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Ready batches' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wave C' } });
    fireEvent.change(within(screen.getByRole('button', { name: 'Create batch' }).closest('form')!).getByLabelText('Brief'), { target: { value: 'Third' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }));
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'POST' && config?.data === JSON.stringify({ name: 'Wave C', brief: 'Third' }))).toBe(true));
  });
  it('updates state and recovers from a list failure', async () => {
    respond([fixture[0]]);
    setup();
    const selector = await screen.findByLabelText('State for Wave A');
    expect((selector as HTMLSelectElement).options.length).toBe(5);
    expect(screen.getByRole('region', { name: 'In progress batches' })).toBeTruthy();
    fireEvent.change(selector, { target: { value: 'in_progress' } });
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.method === 'PATCH' && config?.data === JSON.stringify({ state: 'in_progress' }))).toBe(true));
    cleanup();
    let failed = false;
    request.mockImplementation(async (config) => { if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never; if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never; if (config?.url === '/api/v1/waves' && !failed) { failed = true; throw new Error('offline'); } return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never; });
    setup();
    expect(await screen.findByText('Unable to load batches.')).toBeTruthy();
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
    expect(await screen.findByText('No batches found.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Check setup progress' }).getAttribute('href')).toBe('/#getting-started');
    expect(screen.getByRole('region', { name: 'In progress batches' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Done batches' })).toBeTruthy();
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
    vi.stubGlobal('WebSocket', FakeSocket);
    const input = { wave: 'wave-1', branch: 'feature', worktree: '/tmp/worker', script: 'pnpm test', brief: 'Do work' };
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/workers/start') return { data: { data: { ID: 'job-1', State: 'queued', Request: input } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/workers/restart') return { data: { data: { ID: 'job-2', State: 'queued', Request: input } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/workers/job-1') return { data: { data: { ID: 'job-1', State: 'running', Request: input } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    const controls = within(await screen.findByRole('region', { name: 'Advanced agent controls' }));
    for (const [key, label] of [['wave', 'Batch'], ['branch', 'Branch'], ['worktree', 'Working folder'], ['script', 'Tool'], ['brief', 'Brief']] as const) fireEvent.change(controls.getByLabelText(label), { target: { value: input[key] } });
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));
    expect(await screen.findByText('Agent job-1: queued')).toBeTruthy();
    await waitFor(() => expect(FakeSocket.sockets.length).toBe(1));
    expect(new URL(FakeSocket.sockets[0].url).pathname).toBe('/api/v1/workers/job-1/logs');
    FakeSocket.sockets[0].emit(JSON.stringify({ type: 'worker.log', line: 'first emitted' }));
    FakeSocket.sockets[0].emit(JSON.stringify({ type: 'worker.log', line: 'second emitted' }));
    FakeSocket.sockets[0].emit(JSON.stringify({ type: 'worker.completed' }));
    expect(await screen.findByText('second emitted')).toBeTruthy();
    expect(screen.getByText('Agent completed.')).toBeTruthy();
    expect(screen.getByLabelText('Live logs').textContent?.indexOf('first emitted')).toBeLessThan(screen.getByLabelText('Live logs').textContent?.indexOf('second emitted') ?? 0);
    expect(JSON.parse(request.mock.calls.find(([config]) => config?.url === '/api/v1/workers/start')?.[0]?.data as string)).toEqual(input);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText('Agent job-1: running')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop agent' }));
    await waitFor(() => expect(request.mock.calls.some(([config]) => config?.url === '/api/v1/workers/job-1/stop')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Restart agent' }));
    await waitFor(() => expect(JSON.parse(request.mock.calls.find(([config]) => config?.url === '/api/v1/workers/restart')?.[0]?.data as string)).toEqual(input));
    await waitFor(() => expect(screen.getByText('Agent job-2: queued')).toBeTruthy());
     await waitFor(() => expect(FakeSocket.sockets.length).toBe(2));
     expect(FakeSocket.sockets[1].url).toContain('/job-2/logs');
  });
  it('closes the log socket on organization change and unmount', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
     request.mockImplementation(async (config) => ({ data: config?.url === '/api/v1/auth/session' ? { organization_id: currentOrg, account_id: 'acct' } : config?.url?.includes('/members') ? { data: [{ account_id: 'acct', role: 'owner' }] } : config?.url === '/api/v1/workers/start' ? { data: { ID: 'job-1', State: 'running' } } : config?.url === '/api/v1/workers/job-1' ? { data: { ID: 'job-1', State: 'running' } } : { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never));
    const view = setup();
    const controls = within(await screen.findByRole('region', { name: 'Advanced agent controls' }));
    for (const [label, value] of [['Batch', 'wave-1'], ['Branch', 'feature'], ['Working folder', '/tmp/worker'], ['Tool', 'pnpm test']] as const) fireEvent.change(controls.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));
    await waitFor(() => expect(FakeSocket.sockets.length).toBe(1));
    currentOrg = 'org-b'; fireEvent(window, new Event('organization:will-change'));
    await waitFor(() => expect(FakeSocket.sockets[0].closed).toBe(true));
     fireEvent(window, new Event('organization:changed'));
     await waitFor(() => expect(FakeSocket.sockets.length).toBe(1));
    view.unmount();
  });
  it('hides worker actions from members and reports rejected worker actions', async () => {
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: currentOrg, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url === '/api/v1/organizations/org-a/members') return { data: { data: [{ account_id: 'acct', role: 'member' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: fixture }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Advanced agent controls' })).toBeNull();
    expect(screen.getByText(/Read-only/)).toBeTruthy();
  });
  it('does not restore old worker details after organization change', async () => {
    respond(fixture); setup();
    expect(await screen.findByText('Wave A')).toBeTruthy();
    currentOrg = 'org-b'; fireEvent(window, new Event('organization:will-change')); fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('Wave A')).toBeTruthy();
    expect(screen.queryByText(/Agent job-/)).toBeNull();
  });
});
