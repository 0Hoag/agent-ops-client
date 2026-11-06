import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated alert threshold contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses GET and PUT operations with typed numeric data over shared transport', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' });
    const values = { min_cache_hit: 82.5, silent_seconds: 300, pr_stale_seconds: 7200 };
    const request = vi.spyOn(http, 'request')
      .mockResolvedValueOnce({ data: values, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never)
      .mockResolvedValueOnce({ data: values, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);

    const fetched = await api.api.v1AlertsThresholdsList();
    const updated = await api.api.v1AlertsThresholdsUpdate(values);

    expect(request.mock.calls.map(([config]) => ({ method: config?.method, url: config?.url, data: config?.data }))).toEqual([
      { method: 'GET', url: '/api/v1/alerts/thresholds', data: null },
      { method: 'PUT', url: '/api/v1/alerts/thresholds', data: JSON.stringify(values) },
    ]);
    for (const [config] of request.mock.calls) expect(config?.headers?.Authorization).toBeUndefined();
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer test-token');
    expect(fetched.data.min_cache_hit).toBe(82.5);
    expect(updated.data.silent_seconds).toBe(300);
    expect(updated.data.pr_stale_seconds).toBe(7200);
  });
});
