import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated wave contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls authenticated organization wave CRUD operations over shared transport', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' });
    const request = vi.spyOn(http, 'request')
      .mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const body = { name: 'W14', brief: 'Ship wave', state: 'active' };

    await api.api.v1WavesList();
    await api.api.v1WavesCreate(body);
    await api.api.v1WavesDetail('wave-1');
    await api.api.v1WavesPartialUpdate('wave-1', body);
    await api.api.v1WavesDelete('wave-1');

    expect(request.mock.calls.map(([config]) => ({ method: config?.method, url: config?.url, data: config?.data }))).toEqual([
      { method: 'GET', url: '/api/v1/waves', data: null },
      { method: 'POST', url: '/api/v1/waves', data: JSON.stringify(body) },
      { method: 'GET', url: '/api/v1/waves/wave-1', data: null },
      { method: 'PATCH', url: '/api/v1/waves/wave-1', data: JSON.stringify(body) },
      { method: 'DELETE', url: '/api/v1/waves/wave-1', data: null },
    ]);
    for (const [config] of request.mock.calls) {
      expect(config?.headers?.Authorization).toBeUndefined();
    }
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer test-token');
  });
});
