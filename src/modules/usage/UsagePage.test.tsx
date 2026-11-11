// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { UsagePage } from './UsagePage';
import { registerInsights } from '../../app/register-insights';
import { registerRuns } from '../../app/register-runs';
import { MemoryRouter } from 'react-router-dom';
import { getSessions } from './services';

const requests = vi.spyOn(http, 'request');
let mode = 'data';
const run = { id: 'private-run-id', session_id: 'private-session-id', repository_id: 'repo-1', harness: 'Claude', branch: 'feat/usage', model: 'Sonnet', started_at: '2026-11-11T10:00:00Z', cost_usd: 4, input_tokens: 1000, cached_input_tokens: 200, cache_write_tokens: 100, output_tokens: 700, pr_number: 42 };
function respond(config: { url?: string }) {
  const url = new URL(config.url!, 'http://fixture');
  if (mode === 'error' && !url.pathname.endsWith('/session')) return Promise.reject(new Error('offline'));
  if (mode === 'loading' && url.pathname.endsWith('/agent-runs')) return new Promise<never>(() => {});
  let data: unknown;
  if (url.pathname.endsWith('/session')) data = { organization_id: 'org-a' };
  else if (url.pathname.endsWith('/repositories')) data = { data: [{ id: 'repo-1', full_name: 'team/widgets' }] };
  else if (url.pathname.endsWith('/agent-runs')) data = { data: mode === 'empty' ? [] : [run, { ...run, id: 'run-2', cost_usd: 2 }] };
  else if (url.pathname.endsWith('/overview')) data = { current: mode === 'missing' ? {} : { cache_savings_usd: 1.5 } };
  else data = { buckets: mode === 'empty' ? [] : [{ start: '2026-11-11', actual_cost_usd: 4 }, { start: '2026-11-11', actual_cost_usd: 2 }] };
  return Promise.resolve({ data, status: 200, headers: {}, config } as never);
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><UsagePage /></QueryClientProvider>);
}
describe('Usage', () => {
  beforeEach(() => { mode = 'data'; requests.mockImplementation(respond); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('adds real daily costs, cache savings, splits and MR costs; combines session runs without exposing IDs', async () => {
    setup();
    await screen.findByText('$6.00 spent · USD');
    expect(screen.getByText('$1.50 saved with cache')).toBeTruthy();
    expect(screen.getByText('team/widgets · MR #42')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('$6.00')).toBeTruthy();
    expect(within(table).getByText('4K')).toBeTruthy();
    expect(within(table).getByRole('link', { name: /Claude · feat\/usage ·/ }).closest('td')?.getAttribute('title')).toBe(new Date(run.started_at).toLocaleString());
    expect(table.textContent).not.toContain('private-');
    expect(screen.queryByText('Run aggregates')).toBeNull();
    fireEvent.change(screen.getByLabelText('Split by'), { target: { value: 'Tool' } });
    expect(screen.getByText('Claude')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Split by'), { target: { value: 'Repository' } });
    expect(screen.getAllByText('team/widgets').length).toBeGreaterThan(1);
  });
  it('sends repository and UTC date filters to real generated endpoints, never UUID inputs', async () => {
    setup();
    await screen.findByRole('option', { name: 'team/widgets' });
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'Today' } });
    fireEvent.change(screen.getByLabelText('Usage repository'), { target: { value: 'repo-1' } });
    await waitFor(() => expect(requests.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://fixture');
      return url.pathname.endsWith('/agent-runs') && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.get('started_after')?.endsWith('T00:00:00Z') && url.searchParams.get('started_before')?.endsWith('T23:59:59.999999999Z');
    })).toBe(true));
    expect(requests.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://fixture');
      return url.pathname.endsWith('/analytics') && url.searchParams.get('period') === 'daily' && url.searchParams.get('group_by') === 'harness' && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.get('from') === url.searchParams.get('to');
    })).toBe(true);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2099-01-01' } });
    expect(screen.getByRole('alert').textContent).toContain('ordered date range');
  });
  it('loads every API page for complete rankings and splits', async () => {
    requests.mockImplementation((config) => Promise.resolve({ data: { data: new URL(config.url!, 'http://fixture').searchParams.get('page') === '1' ? Array.from({ length: 100 }, () => run) : [run] }, status: 200 } as never));
    expect(await getSessions({ from: '2026-11-01', to: '2026-11-11' })).toHaveLength(101);
  });
  it('shows loading, actionable empty and retry states', async () => {
    mode = 'loading'; setup();
    await screen.findByText('Loading sessions…'); cleanup();
    mode = 'empty'; setup();
    await screen.findAllByText(/No usage in this period/);
    expect(screen.getAllByRole('link', { name: 'connect a repository' })[0].getAttribute('href')).toBe('/repositories'); cleanup();
    mode = 'error'; setup();
    await screen.findByText(/Unable to load sessions/);
    expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0);
  });
  it('explains missing savings rather than inventing zero', async () => {
    mode = 'missing'; setup();
    expect(await screen.findByText(/Savings unavailable. Sync token usage/)).toBeTruthy();
    expect(screen.queryByText('$0.00 saved with cache')).toBeNull();
  });
  it('registers Usage as primary analytics and redirects legacy Runs', () => {
    expect(registerInsights().path).toBe('/usage');
    render(<MemoryRouter initialEntries={['/runs']}>{registerRuns().element}</MemoryRouter>);
    expect(screen.queryByText('Run aggregates')).toBeNull();
  });
});
