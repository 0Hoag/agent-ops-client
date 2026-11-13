// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { BudgetsPage } from './page';
import type { BudgetBudget, BudgetRequest } from '../../shared/api/generated/Api';
import type { InternalAxiosRequestConfig } from 'axios';

const calls: string[] = [];
const writes: BudgetRequest[] = [];
const originalAdapter = http.defaults.adapter;
let role = 'owner';
let budgets: BudgetBudget[];
function response(config: InternalAxiosRequestConfig, data: unknown) { return { data, status: 200, statusText: 'OK', headers: {}, config }; }
function setup() {
  budgets = [{ id: 'budget-1', starts_at: '2026-01-01', ends_at: '', token_limit: 100, usd_limit: 5 }];
  http.defaults.adapter = async (config) => {
    const url = String(config.url);
    if (url.endsWith('/api/v1/auth/session')) return response(config, { account_id: 'acct-1', organization_id: 'org-1' });
    if (url.endsWith('/api/v1/organizations/org-1/members')) return response(config, { data: [{ account_id: 'acct-1', role }] });
    if (url.endsWith('/api/v1/repositories')) return response(config, { data: [{ id: 'repo-1', full_name: 'team/widgets' }] });
    if (url.endsWith('/api/v1/budgets') && config.method === 'get') { calls.push('list'); return response(config, { data: [...budgets] }); }
    if (url.endsWith('/api/v1/budgets') && config.method === 'post') {
      calls.push('create'); const input = JSON.parse(config.data as string) as BudgetRequest; writes.push(input);
      const created = { id: 'budget-2', ...input }; budgets.push(created); return response(config, { data: created });
    }
    if (url.endsWith('/api/v1/budgets/budget-2') && config.method === 'patch') {
      calls.push('update'); const input = JSON.parse(config.data as string) as BudgetRequest; writes.push(input);
      budgets = budgets.map((budget) => budget.id === 'budget-2' ? { ...budget, ...input } : budget); return response(config, { data: budgets[1] });
    }
    if (url.endsWith('/api/v1/budgets/budget-2') && config.method === 'delete') { calls.push('delete'); budgets = budgets.filter((budget) => budget.id !== 'budget-2'); return response(config, {}); }
    return response(config, {});
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><BudgetsPage /></QueryClientProvider>);
  return client;
}

describe('BudgetsPage', () => {
  it('explains that open-ended budgets are unavailable and prevents unsupported requests', async () => {
    setup();
    const end = await screen.findByLabelText('End date') as HTMLInputElement;
    expect(end.required).toBe(true);
    expect(screen.getByText(/Open-ended budgets are unavailable/)).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: 'Create budget' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('valid date range');
    expect(writes).toEqual([]);
  });
  it('names repository scopes and does not silently broaden an unavailable scope', async () => {
    setup(); budgets = [{ id: 'budget-1', starts_at: '2026-01-01', ends_at: '2026-12-31', repository_id: 'repo-1', wave: 'Release' }];
    expect(await screen.findByText('Repository: team/widgets; Batch: Release')).toBeTruthy();
    budgets = [{ ...budgets[0], repository_id: 'removed-repo' }];
    fireEvent(window, new Event('organization:changed'));
    expect(await screen.findByText('Repository: Repository unavailable; Batch: Release')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByRole('combobox', { name: 'Repository' }) as HTMLSelectElement).value).toBe('removed-repo');
    fireEvent.click(screen.getByRole('button', { name: 'Update budget' }));
    expect(screen.getByRole('alert').textContent).toContain('Choose an available repository');
    expect(writes).toEqual([]);
  });
  it('links an empty budget list to live setup progress', async () => {
    setup(); budgets = [];
    await screen.findByText('No budgets configured.');
    expect(screen.getByRole('link', { name: 'Check setup progress' }).getAttribute('href')).toBe('/#getting-started');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); http.defaults.adapter = originalAdapter; calls.length = 0; writes.length = 0; role = 'owner'; });
  it('renders budgets and hides editing controls for read-only members', async () => {
    role = 'viewer'; setup();
    expect(await screen.findByText(/2026-01-01/)).toBeTruthy();
    expect(screen.getByText(/Token limit: 100/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create budget' })).toBeNull();
  });
  it('persists created budgets through the API and refetches the list', async () => {
    const client = setup();
    expect(await screen.findByText(/2026-01-01/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-01' } });
    await screen.findByRole('option', { name: 'team/widgets' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Repository' }), { target: { value: 'repo-1' } });
    fireEvent.change(screen.getByLabelText('Batch'), { target: { value: 'W13' } });
    fireEvent.change(screen.getByLabelText('USD limit'), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText('Token limit'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    await waitFor(() => expect(calls).toContain('create'));
    await waitFor(() => expect(calls.filter((call) => call === 'list').length).toBeGreaterThanOrEqual(2));
    expect(client.getQueryData(['budgets', 'org-1'])).toBeTruthy();
    expect(writes[0]).toEqual({ starts_at: '2026-02-01T00:00:00Z', ends_at: '2026-03-01T00:00:00Z', repository_id: 'repo-1', wave: 'W13', token_limit: 250, usd_limit: 0.75 });
    expect(await screen.findByText(/Token limit: 250; USD limit: 0.75/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
    expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-03-01');
    expect((screen.getByRole('combobox', { name: 'Repository' }) as HTMLSelectElement).value).toBe('repo-1');
    fireEvent.change(screen.getByLabelText('Token limit'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Batch'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update budget' }));
    expect(await screen.findByText(/Token limit: 0; USD limit: 0.75/)).toBeTruthy();
    expect(writes[1]).toEqual({ ...writes[0], token_limit: 0, wave: '' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    await waitFor(() => expect(screen.queryByText(/Token limit: 0; USD limit: 0.75/)).toBeNull());
    expect(calls).toContain('delete');
  });
  it('rejects reversed dates, fractional tokens and negative amounts without a request', async () => {
    setup(); await screen.findByText(/2026-01-01/);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-01' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create budget' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('valid date range');
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-05-01' } });
    for (const [label, value] of [['Token limit', '1.5'], ['USD limit', '-1']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.submit(screen.getByRole('button', { name: 'Create budget' }).closest('form')!);
      expect(screen.getByRole('alert')).toBeTruthy();
      fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
    }
    expect(writes).toEqual([]);
  });
});
