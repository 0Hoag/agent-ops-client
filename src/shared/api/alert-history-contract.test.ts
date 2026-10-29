import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated alert history contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests authenticated paginated history and decodes its response', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' });
    const response = {
      data: {
        data: [{
          alertKey: 'alert-key',
          detectedAt: '2026-10-29T12:00:00Z',
          id: 'occurrence-1',
          message: 'A history alert',
          organizationID: 'org-1',
          repository: 'owner/repo',
          rule: 'budget-threshold',
          subject: 'Budget exceeded',
        }],
        meta: { page: 2, per_page: 5, total: 11 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    };
    const request = vi.spyOn(http, 'request').mockResolvedValue(response as never);

    const result = await api.api.v1AlertsHistoryList({ page: 2, per_page: 5 });

    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]?.method).toBe('GET');
    expect(request.mock.calls[0][0]?.url).toBe('/api/v1/alerts/history?page=2&per_page=5');
    expect(request.mock.calls[0][0]?.headers?.Authorization).toBeUndefined();
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer test-token');
    expect(result.data).toEqual(response.data);
    expect(result.data.data?.[0]).toMatchObject({ id: 'occurrence-1', alertKey: 'alert-key' });
    expect(result.data.meta).toEqual({ page: 2, per_page: 5, total: 11 });
  });
});
