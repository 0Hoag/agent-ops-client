import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../../shared/http';
import { getHealth } from './health';

describe('getHealth', () => {
  it('returns the API health contract', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValueOnce({ data: { status: 'ok' }, status: 200, statusText: 'OK', headers: {}, config: {} });
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/healthz', responseType: 'json' }));
  });
  afterEach(() => vi.restoreAllMocks());
});
