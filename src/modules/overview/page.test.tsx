// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { OverviewPage } from './page';

const requests = vi.spyOn(http, 'request');
let mode = 'data';
function respond(config: { url?: string }) {
  const url = new URL(config.url!, 'http://fixture');
  if (mode === 'error' && url.pathname.endsWith('/overview')) return Promise.reject(new Error('offline'));
  let data: unknown;
  if (url.pathname.endsWith('/session')) data = { organization_id: 'org-a' };
  else if (url.pathname.endsWith('/repositories')) data = { data: [{ id: 'repo-1', full_name: 'org-a/widgets' }] };
  else if (url.pathname.endsWith('/overview')) data = {
    current: { spend_usd: 12.5, cost_per_merged_pr: 6.25, cache_hit_rate: 0.4, rework_rate: 0.1 },
    previous: { spend_usd: 10, cost_per_merged_pr: 5, cache_hit_rate: 0.3, rework_rate: 0.2 },
    attention: [{ message: 'Repeated failures', run_id: 'run-1' }],
  };
  else data = { buckets: [{ start: '2026-10-01', actual_cost_usd: 12.5 }] };
  return Promise.resolve({ data, status: 200, headers: {}, config } as never);
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><OverviewPage /></QueryClientProvider>);
}

describe('OverviewPage', () => {
  beforeEach(() => { mode = 'data'; localStorage.clear(); requests.mockImplementation(respond); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders current and previous metrics, daily spend, and attention from API data', async () => {
    setup();
    await screen.findByText('+$2.50 vs previous period');
    expect(screen.getByText('+$2.50 vs previous period')).toBeTruthy();
    expect(screen.getByText('$6.25')).toBeTruthy();
    expect(screen.getByText('40.0%')).toBeTruthy();
    expect(screen.getByText('10.0%')).toBeTruthy();
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
});
