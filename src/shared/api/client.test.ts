import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated API transport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the configured Axios seam and returns generated run envelopes', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValueOnce({ data: { data: [{ id: 'r1' }] }, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const response = await api.api.v1AgentRunsList({ repository_id: 'repo-1', wave: 'W6', issue_number: 18 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/agent-runs?repository_id=repo-1&wave=W6&issue_number=18' }));
    expect(response.data.data?.[0].id).toBe('r1');
  });

  it('requests paginated board data with the generated operation', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValueOnce({ data: { data: [], meta: { page: 2, per_page: 100, total: 201 } }, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const response = await api.api.v1BoardList({ repository_id: 'repo-1', page: 2, per_page: 100 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/board?repository_id=repo-1&page=2&per_page=100' }));
    expect(response.data.meta?.page).toBe(2);
  });

  it('requests analytics through the generated operation with its filters', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValueOnce({ data: {}, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const filters = { repository_id: 'repo-1', group_by: 'model', period: 'weekly', from: '2026-01-01', to: '2026-01-31' } satisfies Parameters<typeof api.api.v1InsightsAnalyticsList>[0];
    await api.api.v1InsightsAnalyticsList(filters);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/v1/insights/analytics?repository_id=repo-1&group_by=model&period=weekly&from=2026-01-01&to=2026-01-31',
      method: 'GET',
    }));
  });

  it('uses the generated JWT login operation and response type', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValueOnce({ data: { token: 'jwt-token' }, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } } as never);
    const credentials = { email: 'user@example.com', password: 'secret' } satisfies Parameters<typeof api.api.v1AuthLoginCreate>[0];
    const response = await api.api.v1AuthLoginCreate(credentials);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/auth/login', method: 'POST', data: JSON.stringify(credentials) }));
    const token: string | undefined = response.data.token;
    expect(token).toBe('jwt-token');
  });
});
