// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import type { WorkDetail, WorkItem, WorkListResponse } from '../../shared/api/generated/Api';
import { WorkPage } from './page';

const request = vi.spyOn(http, 'request');
const item: WorkItem = { kind: 'issue', number: 7, title: 'Fix login', state: 'open', ci_status: 'passed', author: 'Sam', created_at: '2025-01-01T00:00:00Z', runs_count: 2, cost_usd: 1.25, url: 'https://gitlab.example/issue/7' };
const closed: WorkItem = { ...item, number: 8, title: 'Update docs', state: 'closed' };
const detail: WorkDetail = { item, runs: [{ id: 'run-1', model: 'model-x', cost_usd: 0.5, tokens: 120 }] };
const response = (data: unknown) => ({ data, status: 200 });
const clients: QueryClient[] = [];

function setup(options: { items?: WorkItem[]; fail?: boolean; pending?: boolean; detailFail?: boolean } = {}) {
  request.mockImplementation(async (config) => {
    const url = new URL(config.url!, 'http://localhost');
    expect(config.method).toBe('GET');
    expect(config.params).toBeUndefined();
    if (url.pathname === '/api/v1/repositories') return response({ data: [{ id: 'repo-1', full_name: 'acme/app' }] });
    if (url.pathname === '/api/v1/work') {
      if (options.fail) throw new Error('offline');
      if (options.pending) return new Promise(() => {});
      const items = url.searchParams.get('repository_id') === 'repo-1' ? options.items ?? [item, closed] : [];
      const data = items.filter((entry) => (!url.searchParams.get('q') || entry.title?.includes(url.searchParams.get('q')!)) && (!url.searchParams.get('state') || entry.state === url.searchParams.get('state')));
      const body: WorkListResponse = { data, meta: { total: data.length } };
      return response(body);
    }
    if (url.pathname === '/api/v1/work/issue/7') {
      expect(url.searchParams.get('repository_id')).toBe('repo-1');
      if (options.detailFail) throw new Error('detail offline');
      return response(detail);
    }
    throw new Error(`Unexpected request: ${config.url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><WorkPage /></QueryClientProvider>);
  return options;
}

async function selectRepository() {
  await screen.findByRole('option', { name: 'acme/app' });
  fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'repo-1' } });
}

describe('WorkPage', () => {
  afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
    request.mockReset();
    localStorage.clear();
  });

  it('renders work values, filters visible rows, and opens real-shaped details', async () => {
    setup();
    await selectRepository();
    const row = (await screen.findByRole('button', { name: 'Fix login' })).closest('tr')!;
    expect(within(row).getByText('open / passed')).toBeTruthy();
    expect(within(row).getByText('Sam')).toBeTruthy();
    expect(within(row).getByText(/\d+d ago/)).toBeTruthy();
    expect(within(row).getByText('2')).toBeTruthy();
    expect(within(row).getByText('$1.25')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update docs' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search work'), { target: { value: 'login' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Update docs' })).toBeNull());
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'closed' } });
    expect(await screen.findByText('No work found.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'open' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Fix login' }));
    expect(await screen.findByText('model-x')).toBeTruthy();
    expect(screen.getByText('$0.50 · 120 tokens')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open in GitLab' }).getAttribute('href')).toBe(item.url);
    expect(request.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://localhost');
      return url.pathname === '/api/v1/work' && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.get('q') === 'login' && url.searchParams.get('state') === 'open';
    })).toBe(true);
  });

  it('shows repository guidance and explicit empty work', async () => {
    setup({ items: [] });
    expect(screen.getByText('Select a repository to view its work.')).toBeTruthy();
    await selectRepository();
    expect(await screen.findByText('No work found.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fix login' })).toBeNull();
  });

  it('shows loading while the work request is unresolved', async () => {
    localStorage.setItem('agent-ops-repository', 'repo-1');
    setup({ pending: true });
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Loading work…');
    expect(screen.queryByText('No work found.')).toBeNull();
  });

  it('retries a failed request and renders recovered work', async () => {
    localStorage.setItem('agent-ops-repository', 'repo-1');
    const scenario = setup({ fail: true });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to load work: offline Retry');
    scenario.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Fix login' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows detail loading and failure without losing the work list', async () => {
    setup({ detailFail: true });
    await selectRepository();
    fireEvent.click(await screen.findByRole('button', { name: 'Fix login' }));
    expect(screen.getByRole('status').textContent).toBe('Loading details…');
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to load details: detail offline');
    expect(screen.getByRole('button', { name: 'Fix login' })).toBeTruthy();
  });
});
