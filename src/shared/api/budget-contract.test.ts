import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated budget contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls authenticated organization budget CRUD operations over the shared transport', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' });
    const request = vi.spyOn(http, 'request')
      .mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const body = { repository_id: 'repo-1', wave: 'W13', usd_limit: 500 };

    await api.api.v1BudgetsList();
    await api.api.v1BudgetsCreate(body);
    await api.api.v1BudgetsDetail('budget-1');
    await api.api.v1BudgetsPartialUpdate('budget-1', body);
    await api.api.v1BudgetsDelete('budget-1');

    expect(request.mock.calls.map(([config]) => ({ method: config?.method, url: config?.url, data: config?.data }))).toEqual([
      { method: 'GET', url: '/api/v1/budgets', data: null },
      { method: 'POST', url: '/api/v1/budgets', data: JSON.stringify(body) },
      { method: 'GET', url: '/api/v1/budgets/budget-1', data: null },
      { method: 'PATCH', url: '/api/v1/budgets/budget-1', data: JSON.stringify(body) },
      { method: 'DELETE', url: '/api/v1/budgets/budget-1', data: null },
    ]);
    for (const [config] of request.mock.calls) {
      expect(config?.headers?.Authorization).toBeUndefined();
    }
  });
});
