// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { OverviewPage } from './page';

const requests = vi.spyOn(http, 'request');
let mode = 'data';
let organization = 'org-a';
function respond(config: { url?: string }) {
  const url = new URL(config.url!, 'http://fixture');
  if (mode === 'error' && url.pathname.endsWith('/overview')) return Promise.reject(new Error('offline'));
  let data: unknown;
  if (mode === 'setup-error' && url.pathname.endsWith('/agent-runs')) return Promise.reject(new Error('setup offline'));
  if (url.pathname.endsWith('/session')) data = { organization_id: organization };
  else if (url.pathname.endsWith('/repositories')) data = { data: mode === 'empty' || organization === 'org-b' ? [] : [{ id: 'repo-1', full_name: 'org-a/widgets' }] };
  else if (url.pathname.endsWith('/agent-runs')) data = { data: mode === 'empty' || organization === 'org-b' ? [] : [{ id: 'run-1', model: 'model-a' }] };
  else if (url.pathname.endsWith('/agent-run-prices/missing')) data = { data: mode === 'missing-price' ? ['model-a'] : [] };
  else if (url.pathname.endsWith('/agent-run-prices')) data = { data: mode === 'empty' || organization === 'org-b' ? [] : [{ model: 'model-a', effective_date: mode === 'future-price' ? '2099-01-01' : `${new Date().toISOString().slice(0, 10)}T00:00:00Z` }] };
  else if (url.pathname.endsWith('/overview')) data = { data: {
    current: { spend_usd: 12.5, cost_per_merged_pr: 6.25, cache_hit_rate: 0.4, rework_rate: 0.1, models_without_price: mode === 'partial' ? ['review-unpriced'] : [] },
    previous: { spend_usd: 10, cost_per_merged_pr: 5, cache_hit_rate: 0.3, rework_rate: 0.2 },
    attention: mode === 'partial' ? Array.from({ length: 75 }, (_, index) => ({ kind: 'stale_pr', repository_id: 'repo-1', pr_number: index + 1, message: 'open pull request has had no activity for at least 3 days' })) : [{ message: 'Repeated failures', run_id: 'run-1' }],
  } };
  else data = { data: { buckets: [{ start: '2026-10-01', actual_cost_usd: 12.5, unknown_price_count: mode === 'partial' ? 1 : 0 }, ...(mode === 'partial' ? [{ start: '2026-10-02' }] : [])] } };
  return Promise.resolve({ data, status: 200, headers: {}, config } as never);
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><OverviewPage /></QueryClientProvider>);
  return client;
}

describe('OverviewPage', () => {
  beforeEach(() => { mode = 'data'; organization = 'org-a'; localStorage.clear(); requests.mockImplementation(respond); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('qualifies the unchanged priced subtotal beside the headline with missing models and pricing action', async () => {
    mode = 'partial'; setup();
    await screen.findByText(/priced subtotal · Partial spend/);
    const headline = await screen.findByRole('region', { name: 'Spend summary' });
    expect(headline.textContent).toContain('$12.50 priced subtotal · Partial spend');
    expect(headline.textContent).toContain('Excludes unpriced usage: review-unpriced');
    expect(within(headline).getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
    expect(screen.getByLabelText('Daily spend chart').textContent).toContain('Oct 1');
    expect(screen.getByLabelText('Daily spend chart').textContent).toContain('Not priced');
    expect(screen.getByLabelText('Daily spend chart').textContent).not.toContain('$0.00');
    expect(screen.queryByText('+$2.50 vs previous period')).toBeNull();
  });

  it('summarizes 75 attention records in a keyboard-native disclosure without losing any record', async () => {
    mode = 'partial'; setup();
    const attention = await screen.findByRole('region', { name: 'Needs attention' });
    const disclosure = attention.querySelector('details')!;
    expect(disclosure).toBeTruthy();
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector('summary')?.textContent).toBe('75 merge requests inactive for 3+ days');
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(within(attention).getAllByRole('listitem')).toHaveLength(75);
    expect(within(attention).getByText('PR #75')).toBeTruthy();
  });

  it('renders current and previous metrics, daily spend, and attention from API data', async () => {
    setup();
    await screen.findByText('+$2.50 vs previous period');
    expect(screen.getByText('+$2.50 vs previous period')).toBeTruthy();
    expect(screen.getByText('$6.25')).toBeTruthy();
    expect(screen.getByText('40.0%')).toBeTruthy();
    expect(screen.getByText('10.0%')).toBeTruthy();
    fireEvent.click(screen.getByText('1 other attention item'));
    expect(screen.getByText('Repeated failures')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View run' }).getAttribute('href')).toBe('/runs/run-1');
    expect(screen.getByLabelText('Daily spend chart').textContent).toContain('$12.50');
  });

  it('passes selected date presets and repository filter to both data services', async () => {
    setup();
    await screen.findByRole('option', { name: 'org-a/widgets' });
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-1' } });
    await waitFor(() => expect(requests.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://fixture');
      return url.pathname.endsWith('/overview') && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.has('from') && url.searchParams.has('to');
    })).toBe(true));
    expect(requests.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://fixture');
      return url.pathname.endsWith('/analytics') && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.get('period') === 'daily';
    })).toBe(true);
    expect(localStorage.getItem('agent-ops-repository')).toBe('repo-1');
  });

  it('shows overview request errors', async () => {
    mode = 'error'; setup();
    expect(await screen.findByText('Unable to load overview: offline')).toBeTruthy();
  });

  it('derives empty and completed steps from unfiltered APIs, not local storage or date/repository filters', async () => {
    mode = 'empty'; localStorage.setItem('onboarding-complete', 'true');
    localStorage.setItem('agent-ops-repository', 'stale-repository');
    const client = setup();
    await screen.findByText('0 of 3 steps complete');
    const checklist = within(screen.getByRole('region', { name: 'First-run checklist' }));
    expect(checklist.getAllByText('Not complete')).toHaveLength(3);
    expect(checklist.getByRole('link', { name: 'Connect a repository' }).getAttribute('href')).toBe('/settings/advanced#repositories');
    expect(checklist.getByRole('link', { name: 'Send the first agent session' }).getAttribute('href')).toBe('/settings/advanced#agent-setup');
    expect(checklist.getByRole('link', { name: 'Set model prices' }).getAttribute('href')).toBe('/settings/advanced#model-prices');
    mode = 'data';
    await act(() => client.invalidateQueries({ queryKey: ['onboarding'] }));
    await screen.findByText('3 of 3 steps complete');
    expect(checklist.getAllByText('Complete')).toHaveLength(3);
    const call = requests.mock.calls.find(([config]) => new URL(config.url!, 'http://fixture').pathname.endsWith('/agent-runs'))!;
    const url = new URL(call[0].url!, 'http://fixture');
    expect(url.searchParams.get('per_page')).toBe('1');
    expect(url.searchParams.has('repository_id')).toBe(false);
    expect(url.searchParams.has('started_after')).toBe(false);
  });

  it.each(['missing-price', 'future-price'])('keeps pricing incomplete for %s', async (value) => {
    mode = value; setup();
    await screen.findByText('2 of 3 steps complete');
    expect(screen.getByRole('link', { name: 'Set model prices' }).parentElement?.textContent).toContain('Not complete');
  });

  it('reports verification failures with retry instead of claiming completion', async () => {
    mode = 'setup-error'; setup();
    await screen.findByText('Unable to check setup progress: setup offline');
    expect(screen.queryByText('3 of 3 steps complete')).toBeNull();
    mode = 'data'; fireEvent.click(screen.getByRole('button', { name: 'Retry setup check' }));
    await screen.findByText('3 of 3 steps complete');
  });

  it('hides old organization progress immediately and checks the selected organization', async () => {
    setup(); await screen.findByText('3 of 3 steps complete');
    act(() => window.dispatchEvent(new Event('organization:will-change')));
    expect(screen.queryByRole('region', { name: 'First-run checklist' })).toBeNull();
    organization = 'org-b';
    act(() => window.dispatchEvent(new Event('organization:changed')));
    await screen.findByText('0 of 3 steps complete');
  });
});
