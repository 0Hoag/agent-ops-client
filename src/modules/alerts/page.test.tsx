// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { api } from '../../shared/api/client';
import { http } from '../../shared/http';
import { AlertsPage } from './page';

let request: MockInstance<typeof api.api.v1AlertsHistoryList>;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AlertsPage /></QueryClientProvider>);
  return client;
}

describe('AlertsPage', () => {
  beforeEach(() => {
    request = vi.spyOn(api.api, 'v1AlertsHistoryList');
    vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue({ data: { organization_id: 'org-1' } } as never);
    vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue({ data: { data: [{ account_id: 'acct', role: 'owner' }] } } as never);
    vi.spyOn(api.api, 'v1AlertsThresholdsList').mockResolvedValue({ data: { status: 200, data: { min_cache_hit: 0.8, silent_seconds: 300, pr_stale_seconds: 86400 } } } as never);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('renders empty history with the real empty channels HTTP envelope', async () => {
    request.mockRestore();
    const transport = vi.spyOn(http, 'request').mockImplementation(async (config) => {
      const url = new URL(config.url!, 'http://localhost');
      expect(config.method).toBe('GET');
      if (url.pathname === '/api/v1/alerts/channels') return { status: 200, data: { status: 200, data: [] } };
      if (url.pathname === '/api/v1/alerts/history') {
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('per_page')).toBe('20');
        return { status: 200, data: { data: null, meta: { total: 0 } } };
      }
      throw new Error(`Unexpected request: ${config.url}`);
    });
    const client = setup();
    try {
      expect(await screen.findByText('No notification channels configured.')).toBeTruthy();
      expect(await screen.findByText('No alert history found.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check setup progress' }).getAttribute('href')).toBe('/#getting-started');
      expect(screen.getByRole('heading', { name: 'Alert history' })).toBeTruthy();
      expect(screen.getByText(/Review issues that need your attention/)).toBeTruthy();
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
      expect(transport).toHaveBeenCalledTimes(2);
    } finally {
      client.clear();
    }
  });
  it('renders history and pages to the next result set', async () => {
    request.mockImplementation(async (query) => ({ data: { data: [{ id: query?.page === 2 ? 'two' : 'one', rule: query?.page === 2 ? 'Second rule' : 'First rule', message: 'Detected issue', detectedAt: '2026-01-01', repository: 'acme/repo' }], meta: { total: 21 } } } as never));
    setup();
    expect(await screen.findByText('First rule')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Second rule')).toBeTruthy();
    expect(screen.getByText('Page 2')).toBeTruthy();
    expect(request).toHaveBeenLastCalledWith({ page: 2, per_page: 20 });
    expect(screen.getByText(/Detected issue/)).toBeTruthy();
    expect(screen.getByText(/acme\/repo/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Items per page'), { target: { value: '50' } });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith({ page: 1, per_page: 50 }));
  });
  it('offers retry on failure and refetches', async () => {
    request.mockRejectedValueOnce({ message: 'offline', isAxiosError: true });
    request.mockResolvedValue({ data: { data: [], meta: { total: 0 } } } as never);
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No alert history found.')).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
  it('clears previous organization history before loading another organization', async () => {
    request.mockResolvedValueOnce({ data: { data: [{ id: 'a1', rule: 'Private org rule' }], meta: { total: 1 } } } as never);
    setup(); await screen.findByText('Private org rule');
    fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByText('Private org rule')).toBeNull();
    vi.mocked(api.api.v1AuthSessionList).mockResolvedValue({ data: { organization_id: 'org-2' } } as never);
    request.mockResolvedValue({ data: { data: [], meta: { total: 0 } } } as never);
    fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('No alert history found.')).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
