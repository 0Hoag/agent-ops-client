import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated metrics contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests Prometheus text through the shared transport', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValue({
      data: 'agent_ops_up 1\n', status: 200, statusText: 'OK', headers: {}, config: { headers: {} },
    } as never);

    const response = await api.metrics.metricsList();

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/metrics', method: 'GET', responseType: 'text',
    }));
    expect(response.data).toBe('agent_ops_up 1\n');
  });
});
