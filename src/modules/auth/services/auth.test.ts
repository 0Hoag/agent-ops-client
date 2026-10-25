import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    sessionCall.mockRejectedValue(new Error('unauthorized'));
    expect(await validateSession()).toBe(false);
    expect(hasToken()).toBe(false);
  });
  it('logs out by removing the token', () => {
    sessionStorage.setItem('agent-ops-token', 'jwt');
    logout();
    expect(hasToken()).toBe(false);
  });
});
