import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client';
import { getAlertThresholds, listAlertHistory, updateAlertThresholds } from './client';
describe('alert history transport', () => {
  afterEach(() => vi.restoreAllMocks());
  it('sends supported pagination and returns API fields', async () => {
    const occurrence = { id: 'a1', detectedAt: '2026-01-01T00:00:00Z', rule: 'budget', message: 'Reached', repository: 'org/repo', subject: 'wave' };
    const request = vi.spyOn(api.api, 'v1AlertsHistoryList').mockResolvedValue({ data: { data: [occurrence], meta: { total: 21 } } } as never);
    expect(await listAlertHistory(2, 20)).toEqual({ data: [occurrence], total: 21 }); expect(request).toHaveBeenCalledWith({ page: 2, per_page: 20 });
  });
  it('uses generated threshold GET and PUT methods without changing wire values', async () => {
    const values = { min_cache_hit: 0.8, silent_seconds: 300, pr_stale_seconds: 86400 };
    const get = vi.spyOn(api.api, 'v1AlertsThresholdsList').mockResolvedValue({ data: { status: 200, data: values } } as never);
    const put = vi.spyOn(api.api, 'v1AlertsThresholdsUpdate').mockResolvedValue({ data: { status: 200, data: values } } as never);
    expect(await getAlertThresholds()).toEqual(values);
    expect(await updateAlertThresholds(values)).toEqual(values);
    expect(get).toHaveBeenCalledOnce(); expect(put).toHaveBeenCalledWith(values);
  });
});
