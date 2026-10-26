// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { InsightsPage } from './InsightsPage';

const requests = vi.spyOn(http, 'request');
const repoResponse = { data: { data: [{ id: 'repo-1', provider: 'github', full_name: 'acme/widgets' }] } };
const metricsResponse = { data: { repository_id: 'repo-1', history: { complete: true }, send_back: { count: 1, rate: 0.5, numerator: 1, denominator: 2, evidence: [] }, first_ci_success: { successful: 0, eligible: 0, rate: 0, evidence: [] }, cycle_time: { completed: 0, median_seconds: 0, evidence: [] }, suggestions: [{ key: 'flaky', message: 'Retrying workflow repeatedly', occurrences: 3, evidence: [] }] } };
const incompleteResponse = { data: { ...metricsResponse.data, history: { complete: false, reason: 'webhook gap' } } };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InsightsPage /></QueryClientProvider>);
}
describe('InsightsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('renders loading, empty, error, API metrics, and explicit unknown/zero-denominator states', async () => {
    requests.mockReturnValueOnce(new Promise(() => undefined) as never);
    setup();
    expect(screen.getByRole('status').textContent).toContain('Loading repositories');
    cleanup();
    requests.mockResolvedValueOnce({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as never);
    setup();
    expect(await screen.findByText('No repositories available.')).toBeTruthy();
    cleanup();
    requests.mockRejectedValueOnce(new Error('offline'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    cleanup();
    requests.mockImplementation((config) => Promise.resolve({ data: config.url?.includes('/insights?') ? metricsResponse : repoResponse.data, status: 200, statusText: 'OK', headers: {}, config: { ...config, headers: {} } } as never));
    setup();
    await screen.findByRole('option', { name: 'acme/widgets' });
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-1' } });
    const rate = await screen.findByText('Send-back rate');
    expect(rate.parentElement?.textContent).toContain('50.0%');
    expect(screen.getByText('N/A — no eligible records')).toBeTruthy();
    expect(screen.getByText('N/A — no completed issues')).toBeTruthy();
    expect(screen.getByText('Retrying workflow repeatedly')).toBeTruthy();
    expect(requests.mock.calls.at(-1)?.[0].url).toBe('/api/v1/insights?repository_id=repo-1');
    cleanup();
    requests.mockImplementation((config) => Promise.resolve({ data: config.url?.includes('/insights?') ? incompleteResponse : repoResponse.data, status: 200, statusText: 'OK', headers: {}, config: { ...config, headers: {} } } as never));
    setup();
    await screen.findByRole('option', { name: 'acme/widgets' });
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-1' } });
    expect((await screen.findAllByText('Unknown — incomplete history')).length).toBe(3);
    expect(screen.getByText('History is incomplete: webhook gap. Metrics affected by missing history are unknown.')).toBeTruthy();
  });
});
