import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';
import type { WorkerRequest } from './generated/Api';

describe('generated worker lifecycle contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends typed lifecycle operations over shared transport', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'worker-token' });
    const request = vi.spyOn(http, 'request')
      .mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const body = {
      branch: 'feat/w14g',
      brief: 'Ship worker lifecycle',
      script: 'pnpm test',
      wave: 'W14g',
      worktree: '/tmp/worker',
    } satisfies WorkerRequest;

    await api.api.v1WorkersStartCreate(body);
    await api.api.v1WorkersRestartCreate(body);
    await api.api.v1WorkersStopCreate('worker-1');
    await api.api.v1WorkersDetail('worker-1');

    expect(request.mock.calls.map(([config]) => ({ method: config?.method, url: config?.url, data: config?.data }))).toEqual([
      { method: 'POST', url: '/api/v1/workers/start', data: JSON.stringify(body) },
      { method: 'POST', url: '/api/v1/workers/restart', data: JSON.stringify(body) },
      { method: 'POST', url: '/api/v1/workers/worker-1/stop', data: null },
      { method: 'GET', url: '/api/v1/workers/worker-1', data: null },
    ]);
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer worker-token');
  });
});
