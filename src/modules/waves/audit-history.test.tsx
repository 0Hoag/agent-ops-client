// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { WavesPage } from './page';
import { AuditEntry } from './AuditEntry';

const request = vi.spyOn(http, 'request');
let organization = 'org-a';
// ActionAudit is serialized directly by Go, without JSON field tags.
const record = { ID: 'audit-1', OrganizationID: 'org-a', ActorID: 'Ada', OccurredAt: '2026-04-01T12:00:00Z', CreatedAt: '2026-04-01T12:00:01Z', Action: 'start', Wave: 'Release 1', JobID: 'job-9', Outcome: 'accepted' };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><WavesPage /></QueryClientProvider>);
}
describe('agent audit history', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); organization = 'org-a'; });
  it('keeps honest fallbacks for absent evidence and uses created time when occurrence is absent', () => {
    const view = render(<AuditEntry entry={{}} />);
    for (const fallback of ['Actor not recorded — check audit source', 'Time not reported — sync session history', 'Action not recorded — check audit source', 'Batch not assigned', 'No agent task linked', 'Outcome not recorded — refresh audit history']) expect(screen.getByText(new RegExp(fallback))).toBeTruthy();
    view.rerender(<AuditEntry entry={{ createdAt: record.CreatedAt }} />);
    expect(view.container.querySelector('time')?.getAttribute('datetime')).toBe(record.CreatedAt);
  });
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
    for (const field of ['start', 'Release 1', 'job-9', 'accepted']) expect(screen.getByRole('article').textContent).toContain(field);
    expect(screen.getByText(/ago/).getAttribute('datetime')).toBe(record.OccurredAt);
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
      if (config?.url?.includes('/audit-history')) return { data: { data: [{ ...record, ID: 'b', OrganizationID: 'org-b', ActorID: 'Bob', Outcome: 'rejected' }], meta: { page: 1, per_page: 10, total: 1 } }, status: 200, statusText: 'OK', headers: {}, config } as never;
      return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config } as never;
    });
    setup();
    await waitFor(() => expect(releaseOld).toBeTruthy());
    organization = 'org-b'; fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByText('Ada')).toBeNull();
    fireEvent(window, new Event('organization:changed'));
    await waitFor(() => expect(screen.getByText('Select an organization to view batches.')).toBeTruthy());
    oldPending = false;
    expect(await screen.findByText('Bob')).toBeTruthy();
    releaseOld({ data: { data: [record], meta: { page: 1, per_page: 10, total: 1 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as never);
    await waitFor(() => expect(screen.queryByText('Ada')).toBeNull());
    expect(screen.getByText(/rejected/)).toBeTruthy();
  });
});
