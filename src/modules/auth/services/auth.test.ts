import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

const { loginCall, sessionCall, organizationsCall, selectCall } = vi.hoisted(() => ({ loginCall: vi.fn(), sessionCall: vi.fn(), organizationsCall: vi.fn(), selectCall: vi.fn() }));
vi.mock('./client', () => ({ authClient: { api: { v1AuthLoginCreate: loginCall, v1AuthSessionList: sessionCall, v1OrganizationsList: organizationsCall, v1AuthSelectOrganizationCreate: selectCall } } }));
import { hasToken, login, logout, validateSession, listOrganizations, selectOrganization } from './auth';

describe('authentication service', () => {
  beforeEach(() => { const store = new Map<string, string>(); vi.stubGlobal('sessionStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key), clear: () => store.clear() }); vi.stubGlobal('window', { dispatchEvent: vi.fn() }); loginCall.mockReset(); sessionCall.mockReset(); organizationsCall.mockReset(); selectCall.mockReset(); });
  it('stores a successful login token and validates using Authorization-enabled shared client', async () => {
    loginCall.mockResolvedValue({ data: { token: 'jwt-test' } });
    sessionCall.mockResolvedValue({ data: { email: 'test@example.com', organization_id: 'org-a' } });
    await login('test@example.com', 'pass');
    expect(sessionStorage.getItem('agent-ops-token')).toBe('jwt-test');
    expect(await validateSession()).toBe(true);
    expect(sessionCall).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid login and clears expired sessions', async () => {
    loginCall.mockRejectedValue(new Error('invalid'));
    await expect(login('x@example.com', 'bad')).rejects.toThrow();
    sessionStorage.setItem('agent-ops-token', 'expired');
    sessionCall.mockRejectedValue(new AxiosError('unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, { status: 401, statusText: 'Unauthorized', headers: {}, config: {} as never, data: {} }));
    expect(await validateSession()).toBe(false);
    expect(hasToken()).toBe(false);
  });
  it.each([
    ['network failure', new TypeError('Network unavailable')],
    ['server failure', { response: { status: 503 } }],
  ])('retains credentials when session validation has a temporary %s', async (_label, error) => {
    sessionStorage.setItem('agent-ops-token', 'valid-token');
    sessionCall.mockRejectedValue(error);
    await expect(validateSession()).rejects.toBe(error);
    expect(hasToken()).toBe(true);
  });
  it('logs out by removing the token', () => {
    sessionStorage.setItem('agent-ops-token', 'jwt');
    logout();
    expect(hasToken()).toBe(false);
  });
  it('fails if a mutation skips session validation after login', async () => {
    loginCall.mockResolvedValue({ data: { token: 'jwt-test' } });
    sessionCall.mockRejectedValue(new Error('unauthorized'));
    await expect(login('test@example.com', 'pass')).rejects.toThrow('unauthorized');
    expect(hasToken()).toBe(false);
  });
  it('supports initial organization selection and preserves a session when selection fails', async () => {
    loginCall.mockResolvedValue({ data: { token: 'account-token' } });
    sessionCall.mockResolvedValueOnce({ data: { email: 'test@example.com' } });
    expect(await login('test@example.com', 'pass')).toEqual({ token: 'account-token', organizationId: undefined });
    organizationsCall.mockResolvedValue({ data: { data: [{ id: 'org-a', name: 'A' }] } });
    expect(await listOrganizations()).toEqual([{ id: 'org-a', name: 'A' }]);
    selectCall.mockRejectedValue(new Error('selection failed'));
    await expect(selectOrganization('org-a')).rejects.toThrow('selection failed');
    expect(sessionStorage.getItem('agent-ops-token')).toBe('account-token');
  });
  it('replaces the account token only after successful selection', async () => {
    sessionStorage.setItem('agent-ops-token', 'account-token');
    selectCall.mockResolvedValue({ data: { token: 'tenant-token' } });
    sessionCall.mockResolvedValue({ data: { email: 'test@example.com', organization_id: 'org-a' } });
    await selectOrganization('org-a');
    expect(sessionStorage.getItem('agent-ops-token')).toBe('tenant-token');
    expect(sessionCall).toHaveBeenCalledWith({ headers: { Authorization: 'Bearer tenant-token' } });
  });
  it('does not replace the active token when tenant validation fails', async () => {
    sessionStorage.setItem('agent-ops-token', 'account-token');
    selectCall.mockResolvedValue({ data: { token: 'tenant-token' } });
    sessionCall.mockResolvedValue({ data: { organization_id: 'wrong-org' } });
    await expect(selectOrganization('org-a')).rejects.toThrow('not validated');
    expect(sessionStorage.getItem('agent-ops-token')).toBe('account-token');
  });
});
