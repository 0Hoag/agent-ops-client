// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunsPage } from './RunsPage';

const { getAggregates } = vi.hoisted(() => ({ getAggregates: vi.fn() }));
vi.mock('./services/client', () => ({ runsApi: { get: getAggregates } }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><RunsPage /></QueryClientProvider>);
}

describe('RunsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders loading, empty, and error states', async () => {
    let resolve: ((value: { data: { data: [] } }) => void) | undefined;
    getAggregates.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = setup();
    expect(screen.getByRole('status').textContent).toContain('Loading runs');
    resolve?.({ data: { data: [] } });
    expect((await screen.findByText('No runs recorded.')).textContent).toBe('No runs recorded.');
    view.unmount();

    getAggregates.mockRejectedValueOnce(new Error('service unavailable'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load runs: service unavailable');
  });

  it('renders production cache arithmetic and distinguishes known zero from unknown cost', async () => {
    getAggregates.mockResolvedValueOnce({ data: { data: [
      { wave: 'W3', worker: 'Ada', issue_number: 20, runs: 1, input_tokens: 30, cached_input_tokens: 50, cache_write_tokens: 20, output_tokens: 0, reasoning_tokens: 0, cost_usd: 0 },
      { wave: 'W3', worker: 'Lin', issue_number: 29, runs: 1, input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, reasoning_tokens: 0 },
    ] } });
    setup();
    const row = await screen.findByRole('row', { name: /Ada/ });
    expect(row.textContent).toContain('50.0%');
    expect(row.textContent).toContain('$0.0000');
    const unknown = screen.getByRole('row', { name: /Lin/ });
    expect(unknown.textContent).toContain('N/A');
    expect(unknown.textContent).toContain('Unknown');
  });

  it('shows aggregate data returned by the API', async () => {
    getAggregates.mockResolvedValueOnce({ data: { data: [
      { wave: 'W3', worker: 'Real API Worker', issue_number: 30, runs: 2, input_tokens: 75, cached_input_tokens: 25, cache_write_tokens: 0, output_tokens: 5, reasoning_tokens: 0, cost_usd: 1.25 },
    ] } });
    setup();
    const row = await screen.findByRole('row', { name: /Real API Worker/ });
    expect(row.textContent).toContain('W3');
    expect(row.textContent).toContain('#30');
    expect(row.textContent).toContain('25.0%');
    expect(row.textContent).toContain('$1.2500');
  });
});
