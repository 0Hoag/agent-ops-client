import axios, { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { Api, HttpClient } from './generated/Api';

function setup(status: number, data: unknown = '') {
  const request = vi.fn().mockResolvedValue({ status, data });
  const instance = Object.assign(axios.create(), { request });
  const client = new HttpClient({ instance });
  return { request, client, api: new Api(client) };
}

describe('native Response through the production Axios adapter', () => {
  it.each([
    [204, 'PATCH'], [204, 'DELETE'], [205, 'PATCH'], [205, 'DELETE'],
  ] as const)('resolves HTTP %i %s with no body', async (status, method) => {
    const { api, request } = setup(status);
    const accountId = 'account-181';
    const response = method === 'PATCH'
      ? await api.api.v1OrganizationsMembersPartialUpdate('org-181', accountId, { role: 'viewer' })
      : await api.api.v1OrganizationsMembersDelete('org-181', accountId);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(status);
    expect(response.ok).toBe(true);
    expect(response.body).toBeNull();
    expect(await response.text()).toBe('');
    expect(response.error).toBeNull();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: `/api/v1/organizations/org-181/members/${accountId}`, method,
      ...(method === 'PATCH' ? { data: JSON.stringify({ role: 'viewer' }) } : {}),
    }));
  });

  it('preserves ordinary JSON and text decoding', async () => {
    const json = setup(200, { data: [{ account_id: 'account-181', role: 'viewer' }] });
    const response = await json.api.api.v1OrganizationsMembersList('org-181');
    expect(response.data.data?.[0].account_id).toBe('account-181');
    expect(response.headers.get('x-request-url')).toBe('/api/v1/organizations/org-181/members');

    const text = setup(200, 'agent_ops_up 1\n');
    const metrics = await text.client.request<string>({ path: '/metrics', method: 'GET', format: 'text', headers: { Accept: 'text/plain' } });
    expect(metrics.data).toBe('agent_ops_up 1\n');
    expect(text.request).toHaveBeenCalledWith(expect.objectContaining({ responseType: 'text' }));
  });

  it('preserves Axios failures without converting them to successful responses', async () => {
    const { api, request } = setup(204);
    const failure = new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 403, statusText: 'Forbidden', data: { error: 'forbidden' }, headers: {}, config: { headers: new axios.AxiosHeaders() },
    });
    request.mockRejectedValue(failure);
    await expect(api.api.v1OrganizationsMembersPartialUpdate('org-181', 'account-181', { role: 'admin' })).rejects.toBe(failure);
    await expect(api.api.v1OrganizationsMembersDelete('org-181', 'account-181')).rejects.toBe(failure);
  });
});
