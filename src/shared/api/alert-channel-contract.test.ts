import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../http';
import { api } from './client';

describe('generated alert channel contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses generated methods and shared transport for channel operations', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-token' });
    const channel = { kind: 'smtp', enabled: true, smtp_to_env_ref: 'ALERT_TO' };
    const listedChannel = { kind: 'smtp', enabled: true, smtp_to_env_ref: 'ALERT_TO' };
    const createdChannel = { kind: 'smtp', enabled: true, smtp_to_env_ref: 'ALERT_TO' };
    const updatedChannel = { kind: 'smtp', enabled: false, smtp_to_env_ref: 'UPDATED_TO' };
    const deleted = { message: 'deleted' };
    const responses = [
      { data: [listedChannel], status: 200, statusText: 'OK', headers: {}, config: { headers: {} } },
      { data: createdChannel, status: 201, statusText: 'Created', headers: {}, config: { headers: {} } },
      { data: updatedChannel, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } },
      { data: deleted, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } },
    ];
    const request = vi.spyOn(http, 'request');
    for (const response of responses) request.mockResolvedValueOnce(response);

    const list = await api.api.v1AlertsChannelsList();
    const created = await api.api.v1AlertsChannelsCreate(channel as never);
    const updated = await api.api.v1AlertsChannelsUpdate('smtp', channel);
    const removed = await api.api.v1AlertsChannelsDelete('smtp');

    expect(request.mock.calls.map(([config]) => ({ method: config?.method, url: config?.url, data: config?.data }))).toEqual([
      { method: 'GET', url: '/api/v1/alerts/channels', data: null },
      { method: 'POST', url: '/api/v1/alerts/channels', data: JSON.stringify(channel) },
      { method: 'PUT', url: '/api/v1/alerts/channels/smtp', data: JSON.stringify(channel) },
      { method: 'DELETE', url: '/api/v1/alerts/channels/smtp', data: null },
    ]);
    for (const [config] of request.mock.calls) expect(config?.headers?.Authorization).toBeUndefined();
    const authConfig = await http.interceptors.request.handlers?.[0]?.fulfilled?.({ headers: {} } as never);
    expect(authConfig?.headers?.Authorization).toBe('Bearer test-token');
    expect(list.data[0].kind).toBe('smtp');
    expect(created.data.enabled).toBe(true);
    expect(updated.data.smtp_to_env_ref).toBe('UPDATED_TO');
    expect(removed.data).toEqual(deleted);
  });
});
