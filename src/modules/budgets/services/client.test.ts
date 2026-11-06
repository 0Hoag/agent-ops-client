import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { createBudget, deleteBudget, listBudgets, updateBudget } from './client';

describe('budget transport', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses generated methods for list, create, update and delete with values intact', async () => {
    const input = { starts_at: '2026-01-02', ends_at: '2026-02-03', token_limit: 123, usd_limit: 0.75, repository_id: 'repo', wave: 'wave-1' };
    const list = vi.spyOn(api.api, 'v1BudgetsList').mockResolvedValue({ data: [input] } as never);
    const create = vi.spyOn(api.api, 'v1BudgetsCreate').mockResolvedValue({ data: input } as never);
    const update = vi.spyOn(api.api, 'v1BudgetsPartialUpdate').mockResolvedValue({ data: input } as never);
    const remove = vi.spyOn(api.api, 'v1BudgetsDelete').mockResolvedValue({ data: {} } as never);
    expect(await listBudgets()).toEqual([input]); expect(await createBudget(input)).toEqual(input); expect(await updateBudget('b1', input)).toEqual(input); await deleteBudget('b1');
    expect(list).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(input); expect(update).toHaveBeenCalledWith('b1', input); expect(remove).toHaveBeenCalledWith('b1');
  });
});
