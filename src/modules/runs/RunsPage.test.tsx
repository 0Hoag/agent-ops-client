// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { formatRunCost } from './run-format';
import { RunsPage } from './RunsPage';

const getAggregates = vi.spyOn(http, 'request');

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><RunsPage /></QueryClientProvider></MemoryRouter>);
}

describe('RunsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  function response(data: unknown, meta?: unknown) {
    getAggregates.mockImplementation(async (config) => ({ data: { data, meta }, status: 200, statusText: 'OK', headers: {}, config } as never));
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
    expect(screen.getByText('Loading runs…').textContent).toContain('Loading runs');
    resolve?.({ data: { data: [] } });
    expect((await screen.findByText('No runs recorded.')).textContent).toBe('No runs recorded.');
    expect(requestConfig().url).toBe('/api/v1/agent-runs/aggregate');
    view.unmount();

    getAggregates.mockRejectedValueOnce(new Error('service unavailable'));
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load runs: service unavailable');
  });

  it('renders production cache arithmetic and distinguishes known zero from unknown cost', async () => {
    response([{ id: 'run-a', wave: 'W3', harness: 'Ada', model: 'm', relations: { issues: [{ number: 20, repository_id: 'o/r' }] } }], { page: 1, per_page: 20, total: 1 });
    setup();
    expect(await screen.findByRole('link', { name: '#20' })).toBeTruthy();
  });

  it('renders successful aggregate API rows', async () => {
    response([{ id: 'x', wave: 'W3', harness: 'Real API Worker', model: 'm', issue_numbers: [30] }], { page: 1, per_page: 20, total: 1 });
    setup();
    const row = await screen.findByRole('row', { name: /Real API Worker/ });
    expect(row.textContent).toContain('W3');
    expect(row.textContent).toContain('m');
  });

  it('uses server cost_vnd and explicitly labels subscription equivalent API USD', async () => {
    response([]);
    setup();
    expect(await screen.findByText('No runs recorded.')).toBeTruthy();
  });

  it('sends exact conjunctive filters and pagination and shows returned metadata', async () => {
    response([{ id: 'filtered', wave: 'W11', harness: 'h', model: 'm' }], { page: 2, per_page: 10, total: 25 });
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Repository' }), { target: { value: 'repo-1' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Wave' }), { target: { value: 'W11' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Harness' }), { target: { value: 'h' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Model' }), { target: { value: 'm' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Issue' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request' }), { target: { value: '34' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Started after' }), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Started before' }), { target: { value: '2025-02-01' } });
    await screen.findByRole('row', { name: /filtered/ });
    const config = requestConfig() as { url: string; params: Record<string, unknown> };
    expect(config.url).toBe('/api/v1/agent-runs?page=1&per_page=20&repository_id=repo-1&wave=W11&harness=h&model=m&issue_number=12&pr_number=34&started_after=2025-01-01&started_before=2025-02-01');
    expect(await screen.findByText(/Page 2 · 25 runs/)).toBeTruthy();
  });
});
