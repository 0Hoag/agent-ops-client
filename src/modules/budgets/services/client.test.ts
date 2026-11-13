import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { createBudget, deleteBudget, listBudgets, updateBudget } from './client';

describe('budget transport', () => {
  afterEach(() => vi.restoreAllMocks());
  it('converts date-only fields for outgoing create and update requests', async () => {
    const input = { starts_at: '2026-01-02', ends_at: '2026-02-03', token_limit: 123, usd_limit: 0.75, repository_id: 'repo', wave: 'wave-1' };
    const wire = { ...input, starts_at: '2026-01-02T00:00:00Z', ends_at: '2026-02-03T00:00:00Z' };
    const list = vi.spyOn(api.api, 'v1BudgetsList').mockResolvedValue({ data: { data: [input] } } as never);
    const create = vi.spyOn(api.api, 'v1BudgetsCreate').mockImplementation(async (body) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(body.starts_at ?? '') || /^\d{4}-\d{2}-\d{2}$/.test(body.ends_at ?? '')) throw new Error('date must be RFC3339');
      return { data: { data: body } } as never;
    });
    const update = vi.spyOn(api.api, 'v1BudgetsPartialUpdate').mockImplementation(async (_id, body) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(body.starts_at ?? '') || /^\d{4}-\d{2}-\d{2}$/.test(body.ends_at ?? '')) throw new Error('date must be RFC3339');
      return { data: { data: body } } as never;
    });
    const remove = vi.spyOn(api.api, 'v1BudgetsDelete').mockResolvedValue({ data: {} } as never);
    expect(await listBudgets()).toEqual([input]); await deleteBudget('b1');
    expect(await createBudget(input)).toEqual(wire); expect(await updateBudget('b1', input)).toEqual(wire);
    expect(list).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(wire); expect(update).toHaveBeenCalledWith('b1', wire); expect(remove).toHaveBeenCalledWith('b1');
  });

  it('preserves timestamps and omits an empty optional end date', async () => {
    const wire = { starts_at: '2026-01-02T12:30:00+02:00', token_limit: 123, usd_limit: 0.75, repository_id: 'repo', wave: 'wave-1' };
    const input = { ...wire, ends_at: '' };
    const create = vi.spyOn(api.api, 'v1BudgetsCreate').mockImplementation(async (body) => {
      if (body.ends_at === '') throw new Error('invalid budget');
      return { data: { data: body } } as never;
    });
    const update = vi.spyOn(api.api, 'v1BudgetsPartialUpdate').mockResolvedValue({ data: { data: wire } } as never);
    await createBudget(input);
    await updateBudget('b1', input);
    expect(create).toHaveBeenCalledWith(wire);
    expect(update).toHaveBeenCalledWith('b1', wire);
  });
});
