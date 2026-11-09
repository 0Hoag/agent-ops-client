import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated overview contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests the overview with date filters and returns summary fields', async () => {
    const data = { current: { runs: 12, spend_usd: 4.5 }, previous: { runs: 9 } };
    const request = vi.spyOn(http, 'request').mockResolvedValue({
      data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} },
    } as never);

    const response = await api.api.v1OverviewList({ from: '2026-11-01', to: '2026-11-09' });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/v1/overview?from=2026-11-01&to=2026-11-09', method: 'GET',
    }));
    expect(response.data.current?.runs).toBe(12);
    expect(response.data.current?.spend_usd).toBe(4.5);
  });
});
