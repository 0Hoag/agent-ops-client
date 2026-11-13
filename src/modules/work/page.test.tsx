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
      const page = Number(url.searchParams.get('page') ?? 1);
      const per_page = Number(url.searchParams.get('per_page') ?? 50);
      const body: WorkListResponse = { data: data.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: data.length } };
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
  it('reaches all 360 records and resets pagination and detail on filters', async () => {
    setup({ items: Array.from({ length: 360 }, (_, index) => ({ ...item, number: index + 1, title: `Task ${index + 1}` })) });
    await selectRepository();
    expect(await screen.findByText('1–50 of 360 work records')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true);
    for (let page = 2; page <= 8; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByText(`${(page - 1) * 50 + 1}–${Math.min(page * 50, 360)} of 360 work records`);
    }
    expect(screen.getByRole('button', { name: 'Task 360' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Search work'), { target: { value: 'Task 1' } });
    expect(await screen.findByText('1–50 of 111 work records')).toBeTruthy();
  });

  it('focuses selected session details and returns to the selected work', async () => {
    setup();
    await selectRepository();
    const trigger = await screen.findByRole('button', { name: 'Fix login' });
    fireEvent.click(trigger);
    const region = await screen.findByRole('region', { name: 'Selected work details' });
    expect(document.activeElement).toBe(region);
    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to selected work' }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'open' } });
    expect(screen.queryByRole('button', { name: 'Back to selected work' })).toBeNull();
  });

  it('does not turn missing cost or CI into a repository total', async () => {
    setup({ items: [{ ...item, ci_status: 'failure', cost_usd: undefined }] });
    await selectRepository();
    expect(await screen.findByText('On this page: 1 work records with failing CI; no recorded costs. Other costs are unavailable; sync priced sessions. Not repository-wide totals.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: '' } });
    expect(screen.queryByText(/On this page:/)).toBeNull();
  });
  it('links missing setup steps without changing work selection', async () => {
    setup({ items: [] });
    await selectRepository();
    await screen.findByText('No work found.');
    expect(screen.getByRole('link', { name: 'Send the first agent session' }).getAttribute('href')).toBe('/settings/advanced#agent-setup');
    expect(screen.getByRole('link', { name: 'Connect a repository' }).getAttribute('href')).toBe('/settings/advanced#repositories');
    expect(screen.getByRole('link', { name: 'Check setup progress' }).getAttribute('href')).toBe('/#getting-started');
  });
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
    expect(within(row).getByText(/\d+ days ago/)).toBeTruthy();
    expect(within(row).getByTitle('Jan 1, 2025, 12:00:00 AM UTC')).toBeTruthy();
    expect(within(row).getByText('2')).toBeTruthy();
    expect(within(row).getByText('$1.25')).toBeTruthy();
    expect(screen.getByText('On this page: 0 work records with failing CI; $2.50 recorded cost across 2 priced work records. Not repository-wide totals.')).toBeTruthy();
    expect(screen.getByRole('table').classList.contains('responsive-table')).toBe(true);
    expect(within(row).getAllByRole('cell').map((cell) => cell.getAttribute('data-label'))).toEqual(['Work', 'Status / CI', 'Author', 'Age', 'Sessions', 'Cost']);
    expect(screen.getByRole('button', { name: 'Update docs' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search work'), { target: { value: 'login' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Update docs' })).toBeNull());
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'closed' } });
    expect(await screen.findByText('No work found.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'open' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Fix login' }));
    expect(await screen.findByText('model-x')).toBeTruthy();
    expect(screen.getByText('$0.50 USD · 120 tokens')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open in GitLab' }).getAttribute('href')).toBe(item.url);
    expect(request.mock.calls.some(([config]) => {
      const url = new URL(config.url!, 'http://localhost');
      return url.pathname === '/api/v1/work' && url.searchParams.get('repository_id') === 'repo-1' && url.searchParams.get('q') === 'login' && url.searchParams.get('state') === 'open';
    })).toBe(true);
  });

  it('requests no work before repository selection, including filter changes', async () => {
    setup();
    await screen.findByRole('option', { name: 'acme/app' });
    const workRequests = () => request.mock.calls.filter(([config]) => new URL(config.url!, 'http://localhost').pathname.startsWith('/api/v1/work'));
    expect(workRequests()).toHaveLength(0);
    expect(screen.queryByText('Loading work…')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search work'), { target: { value: 'login' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'open' } });
    expect(screen.getByText('Select a repository to view its work.')).toBeTruthy();
    expect(screen.queryByText('Loading work…')).toBeNull();
    expect(workRequests()).toHaveLength(0);
    await selectRepository();
    fireEvent.click(await screen.findByRole('button', { name: 'Fix login' }));
    expect(await screen.findByText('model-x')).toBeTruthy();
    expect(workRequests().map(([config]) => config.url)).toEqual([
      '/api/v1/work?repository_id=repo-1&state=open&q=login&page=1',
      '/api/v1/work/issue/7?repository_id=repo-1',
    ]);
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search work'), { target: { value: 'docs' } });
    expect(screen.getByText('Select a repository to view its work.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(workRequests()).toHaveLength(2);
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
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to load details: detail offline Retry');
    expect(screen.getByRole('button', { name: 'Fix login' })).toBeTruthy();
  });
});
