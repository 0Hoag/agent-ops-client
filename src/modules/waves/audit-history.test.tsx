// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { WavesPage } from './page';

const request = vi.spyOn(http, 'request');
let organization = 'org-a';
const record = { id: 'audit-1', actorID: 'Ada', occurredAt: '2026-04-01T12:00:00Z', action: 'worker.start', wave: 'Release 1', jobID: 'job-9', outcome: 'accepted' };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><WavesPage /></QueryClientProvider>);
}
describe('worker audit history', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); organization = 'org-a'; });
  it('renders persisted-shaped audit rows and requests paginated pages', async () => {
    let pageTwo: unknown;
    let pageOne: unknown;
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: organization, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/audit-history')) { const query = new URLSearchParams(config.url.split('?')[1]); if (query.get('page') === '2') pageTwo = { page: Number(query.get('page')), per_page: Number(query.get('per_page')) }; else pageOne = { page: Number(query.get('page')), per_page: Number(query.get('per_page')) }; return { data: { data: [record], meta: { page: Number(query.get('page')), per_page: 10, total: 11 } }, status: 200, statusText: 'OK', headers: {}, config } as never; }
      return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    expect(await screen.findByText('Ada')).toBeTruthy();
    expect(pageOne).toEqual({ page: 1, per_page: 10 });
    for (const field of ['worker.start', 'Release 1', 'job-9', 'accepted']) expect(screen.getByText(new RegExp(field))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(pageTwo).toBeTruthy());
    expect(pageTwo).toEqual({ page: 2, per_page: 10 });
  });
  it('reports audit history errors, retries, and renders empty state', async () => {
    let failedOnce = false;
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: organization, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'owner' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/audit-history')) { if (!failedOnce) { failedOnce = true; throw new Error('offline'); } return { data: { data: [], meta: { page: 1, per_page: 10, total: 0 } }, status: 200, statusText: 'OK', headers: {}, config } as never; }
      return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    expect(await screen.findByText('Unable to load agent audit history.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No agent actions found.')).toBeTruthy();
  });
  it('clears rows during organization switch and rejects a late old-organization response', async () => {
    let releaseOld!: (value: never) => void;
    let oldPending = true;
    request.mockImplementation(async (config) => {
      if (config?.url === '/api/v1/auth/session') return { data: { organization_id: organization, account_id: 'acct' }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/members')) return { data: { data: [{ account_id: 'acct', role: 'admin' }] }, status: 200, statusText: 'OK', headers: {}, config } as never;
      if (config?.url?.includes('/audit-history') && organization === 'org-a' && oldPending) return new Promise((resolve) => { releaseOld = resolve as (value: never) => void; });
      if (config?.url?.includes('/audit-history')) return { data: { data: [{ ...record, id: 'b', actorID: 'Bob', outcome: 'rejected' }], meta: { page: 1, per_page: 10, total: 1 } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    await waitFor(() => expect(releaseOld).toBeTruthy());
    organization = 'org-b'; fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByText('Ada')).toBeNull();
    fireEvent(window, new Event('organization:changed'));
    await waitFor(() => expect(screen.getByText('Select an organization to view waves.')).toBeTruthy());
    oldPending = false;
    expect(await screen.findByText('Bob')).toBeTruthy();
    releaseOld({ data: { data: [record], meta: { page: 1, per_page: 10, total: 1 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as never);
    await waitFor(() => expect(screen.queryByText('Ada')).toBeNull());
    expect(screen.getByText(/rejected/)).toBeTruthy();
  });
});
