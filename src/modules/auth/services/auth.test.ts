import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

const { loginCall, sessionCall } = vi.hoisted(() => ({ loginCall: vi.fn(), sessionCall: vi.fn() }));
vi.mock('./client', () => ({ authClient: { api: { v1AuthLoginCreate: loginCall, v1AuthSessionList: sessionCall } } }));
import { hasToken, login, logout, validateSession } from './auth';

describe('authentication service', () => {
  beforeEach(() => { const store = new Map<string, string>(); vi.stubGlobal('sessionStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key), clear: () => store.clear() }); loginCall.mockReset(); sessionCall.mockReset(); });
  it('stores a successful login token and validates using Authorization-enabled shared client', async () => {
    loginCall.mockResolvedValue({ data: { token: 'jwt-test' } });
    sessionCall.mockResolvedValue({ data: { email: 'test@example.com' } });
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
});
