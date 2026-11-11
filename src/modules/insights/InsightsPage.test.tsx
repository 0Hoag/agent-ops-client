// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { InsightsPage } from './InsightsPage';
import { analyticsFixture, closedIssues, deliveryFixture, excludedObservations, insightsFixture, observations, repeatedErrors } from './analytics.fixture';

const requests = vi.spyOn(http, 'request');
let organization = 'org-a';
let mode = 'data';
function respond(config: { url?: string }) {
  const url = new URL(config.url!, 'http://fixture');
  const path = url.pathname;
  if (mode === 'error' && path.includes('/insights/')) return Promise.reject(new Error('offline'));
  if (mode === 'repo-error' && path.endsWith('/repositories')) return Promise.reject(new Error('offline'));
  if (mode === 'session-error' && path.endsWith('/session')) return Promise.reject(new Error('offline'));
  if (mode === 'loading' && path.includes('/insights/')) return new Promise<never>(() => {});
  let data: unknown;
  if (path.endsWith('/session')) data = { organization_id: organization };
  else if (path.endsWith('/analytics')) data = mode === 'empty' ? { buckets: [] } : analyticsFixture(url.searchParams.get('period')!, url.searchParams.get('group_by')!);
  else if (path.endsWith('/delivery')) data = mode === 'empty' ? { history: { complete: false }, harness_comparison: [{ harness: 'unknown', changed_lines: 0, cost_per_changed_line_usd: 0 }] } : deliveryFixture();
  else if (path.endsWith('/insights')) data = mode === 'unknown' ? { data: { ...insightsFixture.data, history: { complete: false, reason: 'webhook gap' } } } : insightsFixture;
  else data = { data: mode === 'no-repos' ? [] : [{ id: 'repo-1', full_name: `${organization}/widgets` }] };
  return Promise.resolve({ data, status: 200, headers: {}, config } as never);
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><InsightsPage /></QueryClientProvider>);
  return client;
}
async function selectRepository() {
  await screen.findByRole('option', { name: `${organization}/widgets` });
  fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-1' } });
  await screen.findByText('Retrying workflow repeatedly');
}
describe('InsightsPage generated transport', () => {
  beforeEach(() => { organization = 'org-a'; mode = 'data'; requests.mockImplementation(respond); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('recomputes every cost/cache/delivery/comparison number from independent observations and preserves repository insights', async () => {
    setup();
    await selectRepository();
    const cost = observations.map((row) => row.equivalent).reduce((a, b) => a + b);
    const sum = (key: 'input' | 'cached' | 'output' | 'reasoning' | 'write' | 'billed' | 'lines') => observations.map((row) => row[key]).reduce((a, b) => a + b);
    const rows = within(screen.getByRole('region', { name: 'Cost and cache trends' })).getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Oct 1, 2026, 12:00:00 AM UTC · runner-a', `$${sum('billed').toFixed(2)}`, `$${cost.toFixed(2)}`,
      `${(sum('cached') / sum('input') * 100).toFixed(1)}% (input tokens)`,
      `${sum('input')} / ${sum('cached')} / ${sum('output')} / ${sum('reasoning')} / ${sum('write')}`, String(observations.length), String(excludedObservations.filter((row) => row.price === undefined).length),
    ]);
    expect(screen.getByText(/Missing prices:/).textContent).toContain(`Missing prices: ${excludedObservations.length}. Set missing model prices in Settings.`);
    const delivery = within(screen.getByRole('region', { name: 'Delivery quality' }));
    const cells = delivery.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
    const sent = observations.filter((row) => row.sentBack).length;
    const green = observations.filter((row) => row.green).length;
    const median = observations.map((row) => row.lead).sort((a, b) => a - b).reduce((a, b) => a + b) / observations.length;
    expect(cells).toEqual([
      ['Cost per merged PR', `$${(cost / observations.length).toFixed(2)} equivalent API cost/item`, `${observations.length} items · ${observations.length} eligible · ${excludedObservations.length} unavailable`],
      ['Cost per closed issue', `$${(cost / closedIssues.length).toFixed(2)} equivalent API cost/item`, `${closedIssues.length} items · ${closedIssues.length} eligible · 0 unavailable`],
      ['Rework rate', `${(sent / observations.length * 100).toFixed(1)}%`, `${sent} / ${observations.length}`],
      ['First-pass CI success', `${(green / observations.length * 100).toFixed(1)}%`, `${green} / ${observations.length}`],
      ['Issue-to-merge lead time', `${(median / 86400).toFixed(1)} days median`, `${observations.length} completed · ${excludedObservations.length} unavailable`],
      ['runner-a cost / observed changed line (USD/line)', `$${(cost / sum('lines')).toFixed(3)}`, `${observations.length} eligible · ${sum('lines')} observed lines · ${excludedObservations.filter((row) => row.lines === undefined).length} excluded`],
    ]);
    expect(delivery.getByText(/History unavailable:/).textContent).toContain(`${excludedObservations.filter((row) => row.history === undefined).length}.`);
    const legacyRate = screen.getByRole('heading', { name: 'Rework rate' });
    expect(legacyRate.parentElement?.textContent).toContain('50.0%');
    expect(screen.getByText('N/A — no eligible records')).toBeTruthy();
    expect(screen.getByText('N/A — no completed issues')).toBeTruthy();
    expect(screen.getByText(`${repeatedErrors.length} occurrences`)).toBeTruthy();
    expect(requests.mock.calls.some(([config]) => config.url === '/api/v1/insights?repository_id=repo-1')).toBe(true);
  });

  it('sends all supported repository/date/period/group controls through generated operations', async () => {
    setup(); await selectRepository();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-31' } });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'weekly' } });
    for (const group of ['model', 'wave', 'area', 'harness']) {
      fireEvent.change(screen.getByLabelText('Group by'), { target: { value: group } });
      await screen.findByText(`Cost and cache trends (weekly, grouped by ${group === 'harness' ? 'tool' : group === 'wave' ? 'batch' : group})`);
      expect(requests.mock.calls.some(([config]) => {
        const url = new URL(config.url!, 'http://fixture');
        return url.pathname.endsWith('/analytics') && ['repository_id=repo-1', 'from=2026-09-01', 'to=2026-10-31', 'period=weekly', `group_by=${group}`].every((part) => url.search.includes(part));
      })).toBe(true);
    }
    expect(requests.mock.calls.some(([config]) => config.url?.includes('/delivery?repository_id=repo-1&from=2026-09-01&to=2026-10-31'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: '' } });
    await waitFor(() => expect(screen.queryByText('Retrying workflow repeatedly')).toBeNull());
    expect(requests.mock.calls.some(([config]) => config.url?.includes('/analytics?from=') && !config.url.includes('repository_id='))).toBe(true);
    requests.mockClear();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2024-01-01' } });
    expect(screen.getByRole('alert').textContent).toContain('at most 366 days');
    expect(requests).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Cost and cache trends' })).toBeNull();
  });

  it('renders loading, empty, unknown, errors and successful retries without claiming zero measurements', async () => {
    mode = 'loading'; setup();
    await screen.findByText('Loading cost/cache analytics…');
    expect(screen.getByText('Loading delivery analytics…')).toBeTruthy();
    cleanup(); mode = 'empty'; setup();
    await screen.findByText('No analytics observations for this period.');
    expect(screen.getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
    expect(screen.getByText('History incomplete; sync delivery history to calculate affected metrics.')).toBeTruthy();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(4);
    expect(screen.queryByText('$0.00')).toBeNull();
    cleanup(); mode = 'no-repos'; setup();
    await screen.findByText('No repositories available.');
    cleanup(); mode = 'repo-error'; setup();
    await screen.findByText('Unable to load repositories: offline');
    cleanup(); mode = 'session-error'; setup();
    await screen.findByText('Unable to load analytics session.');
    mode = 'error'; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Unable to load cost/cache analytics: offline');
    expect(screen.getByText('Unable to load delivery analytics: offline')).toBeTruthy();
    mode = 'data';
    fireEvent.click(within(screen.getByText('Unable to load cost/cache analytics: offline')).getByRole('button'));
    fireEvent.click(within(screen.getByText('Unable to load delivery analytics: offline')).getByRole('button'));
    await screen.findByRole('region', { name: 'Delivery quality' });
    await screen.findByRole('region', { name: 'Cost and cache trends' });
    cleanup(); mode = 'unknown'; setup(); await selectRepository();
    expect(screen.getAllByText('Sync delivery history to calculate').length).toBe(3);
    expect(screen.getByText('History is incomplete: webhook gap. Sync delivery history to calculate affected metrics.')).toBeTruthy();
  });

  it('hides tenant A immediately, resets repository selection, and rejects late A responses after switching to B', async () => {
    let release: (() => void) | undefined;
    requests.mockImplementation((config) => {
      if (config.url?.includes('/analytics?') && config.url.includes('repository_id=')) return new Promise((resolve) => { release = () => resolve({ data: { ...analyticsFixture(), buckets: [{ key: 'TENANT-A-PRIVATE', equivalent_cost_usd: 999 }] }, status: 200, headers: {}, config } as never); });
      return respond(config);
    });
    const client = setup(); await selectRepository();
    expect(release).toBeTypeOf('function');
    act(() => { window.dispatchEvent(new Event('organization:will-change')); });
    expect(screen.queryByText('Retrying workflow repeatedly')).toBeNull();
    organization = 'org-b';
    act(() => { window.dispatchEvent(new Event('organization:changed')); });
    await screen.findByRole('option', { name: 'org-b/widgets' });
    expect((screen.getByLabelText('Repository') as HTMLSelectElement).value).toBe('');
    await act(async () => { release!(); });
    expect(screen.queryByText(/TENANT-A-PRIVATE/)).toBeNull();
    expect(client.getQueryCache().findAll({ queryKey: ['insights', 'org-b'] }).length).toBeGreaterThan(0);
    expect(screen.queryByText('org-a/widgets')).toBeNull();
  });
});
