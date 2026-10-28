// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { formatRunCost, RunsPage } from './RunsPage';

const getAggregates = vi.spyOn(http, 'request');

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><RunsPage /></QueryClientProvider>);
}

describe('RunsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  function aggregateResponse(data: unknown[]) {
    getAggregates.mockResolvedValueOnce({ data: { data }, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
  }
  function requestConfig() {
    return getAggregates.mock.calls.at(-1)?.[0] as { url?: string };
  }

  it('formats server VND and subscription billed/equivalent USD independently', () => {
    const row = { billed_cost_usd: 0, equivalent_cost_usd: 1.25, cost_vnd: 31250, cost_usd: 0 };
    expect(formatRunCost(row, 'USD')).toBe('$0.0000 (equivalent API USD $1.2500)');
    expect(formatRunCost(row, 'VND')).toBe('VND 31,250');
    expect(formatRunCost({ equivalent_cost_usd: 1.25 }, 'VND')).toBe('Unknown');
    expect(formatRunCost({}, 'USD')).toBe('Unknown');
    expect(formatRunCost({ cost_usd: 2.5 }, 'USD')).toBe('$2.5000');
  });

  it('renders loading, empty, and error states', async () => {
    let resolve: ((value: { data: { data: [] } }) => void) | undefined;
    getAggregates.mockReturnValueOnce(new Promise((done) => { resolve = (value) => done({ data: { data: value.data.data }, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never); }));
    const view = setup();
    expect(screen.getByRole('status').textContent).toContain('Loading runs');
    resolve?.({ data: { data: [] } });
    expect((await screen.findByText('No runs recorded.')).textContent).toBe('No runs recorded.');
    expect(requestConfig().url).toBe('/api/v1/agent-runs/aggregate');
    view.unmount();

    getAggregates.mockRejectedValueOnce(new Error('service unavailable'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load runs: service unavailable');
  });

  it('renders production cache arithmetic and distinguishes known zero from unknown cost', async () => {
    aggregateResponse([
      { wave: 'W3', worker: 'Ada', issue_number: 20, runs: 1, input_tokens: 30, cached_input_tokens: 50, cache_write_tokens: 20, output_tokens: 0, reasoning_tokens: 0, cost_usd: 0 },
      { wave: 'W3', worker: 'Lin', issue_number: 29, runs: 1, input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, reasoning_tokens: 0 },
    ]);
    setup();
    const row = await screen.findByRole('row', { name: /Ada/ });
    expect(row.textContent).toContain('50.0%');
    expect(row.textContent).toContain('$0.0000');
    const unknown = screen.getByRole('row', { name: /Lin/ });
    expect(unknown.textContent).toContain('N/A');
    expect(unknown.textContent).toContain('Unknown');
  });

  it('renders successful aggregate API rows', async () => {
    aggregateResponse([
      { wave: 'W3', worker: 'Real API Worker', issue_number: 30, runs: 2, input_tokens: 75, cached_input_tokens: 25, cache_write_tokens: 0, output_tokens: 5, reasoning_tokens: 0, cost_usd: 1.25 },
    ]);
    setup();
    const row = await screen.findByRole('row', { name: /Real API Worker/ });
    expect(row.textContent).toContain('W3');
    expect(row.textContent).toContain('#30');
    expect(row.textContent).toContain('25.0%');
    expect(row.textContent).toContain('$1.2500');
  });

  it('uses server cost_vnd and explicitly labels subscription equivalent API USD', async () => {
    aggregateResponse([{ wave: 'W3', worker: 'Subscription', runs: 1, cost_usd: 0, billed_cost_usd: 0, equivalent_cost_usd: 1.25, cost_vnd: 31250 }]);
    setup();
    await screen.findByRole('row', { name: /Subscription/ });
    expect(screen.getByRole('row', { name: /Subscription/ }).textContent).toContain('equivalent API USD $1.2500');
    fireEvent.change(screen.getByRole('combobox', { name: 'Currency' }), { target: { value: 'VND' } });
    expect(await screen.findByRole('cell', { name: 'VND 31,250' })).toBeTruthy();
  });
});
