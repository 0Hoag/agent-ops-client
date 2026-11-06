import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { listAlertHistory } from './client';
describe('alert history transport', () => {
  afterEach(() => vi.restoreAllMocks());
  it('sends supported pagination and returns API fields', async () => {
    const occurrence = { id: 'a1', detectedAt: '2026-01-01T00:00:00Z', rule: 'budget', message: 'Reached', repository: 'org/repo', subject: 'wave' };
    const request = vi.spyOn(api.api, 'v1AlertsHistoryList').mockResolvedValue({ data: { data: [occurrence], meta: { total: 21 } } } as never);
    expect(await listAlertHistory(2, 20)).toEqual({ data: [occurrence], total: 21 }); expect(request).toHaveBeenCalledWith({ page: 2, per_page: 20 });
  });
});
