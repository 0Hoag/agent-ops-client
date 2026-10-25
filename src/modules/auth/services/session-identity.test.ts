// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { http } from '../../../shared/http';
import { login, validateSession } from './auth';

const originalAdapter = http.defaults.adapter;
const tokenKey = 'agent-ops-token';
let unauthorized = 0;
const onUnauthorized = () => { unauthorized += 1; };
beforeEach(() => {
  sessionStorage.clear();
  unauthorized = 0;
  window.addEventListener('auth:unauthorized', onUnauthorized);
});
afterEach(() => {
  http.defaults.adapter = originalAdapter;
  window.removeEventListener('auth:unauthorized', onUnauthorized);
});

function deferSession() {
  let config: InternalAxiosRequestConfig;
  let resolve!: (response: AxiosResponse) => void;
  let reject!: (error: unknown) => void;
  let started!: () => void;
  const ready = new Promise<void>((done) => { started = done; });
  http.defaults.adapter = async (request) => {
    if (request.url?.endsWith('/auth/login')) {
      return { config: request, status: 200, statusText: 'OK', headers: {}, data: { token: 'session-a' } };
    }
    config = request;
    expect(request.url).toBe('/api/v1/auth/session');
    expect(request.headers.Authorization).toBe('Bearer session-a');
    return new Promise<AxiosResponse>((yes, no) => { resolve = yes; reject = no; started(); });
  };
  return {
    ready,
    finish(status: number) {
      const response = { config, status, statusText: String(status), headers: {}, data: {} };
      if (status === 200) resolve(response);
      else reject(new AxiosError('Validation failed', 'ERR_BAD_REQUEST', config, undefined, response));
    },
  };
}

it.each([401, 200])('does not validate or delete session B after delayed session A response %s', async (status) => {
  sessionStorage.setItem(tokenKey, 'session-a');
  const transport = deferSession();
  const result = validateSession().then((value) => value, () => 'retry');
  await transport.ready;
  sessionStorage.setItem(tokenKey, 'session-b');
  transport.finish(status);
  const outcome = await result;
  expect(sessionStorage.getItem(tokenKey)).toBe('session-b');
  expect(unauthorized).toBe(0);
  expect(outcome).toBe('retry');
});

it.each([401, 503, 200])('does not delete or authorize session B after post-login session A response %s', async (status) => {
  const transport = deferSession();
  const result = login('fixture@example.test', 'password').then(() => 'authorized', () => 'rejected');
  await transport.ready;
  sessionStorage.setItem(tokenKey, 'session-b');
  transport.finish(status);
  const outcome = await result;
  expect(sessionStorage.getItem(tokenKey)).toBe('session-b');
  expect(unauthorized).toBe(0);
  expect(outcome).toBe('rejected');
});

it('still rejects and invalidates the matching validation session on 401', async () => {
  sessionStorage.setItem(tokenKey, 'session-a');
  const transport = deferSession();
  const result = validateSession();
  await transport.ready;
  transport.finish(401);
  expect(await result).toBe(false);
  expect(sessionStorage.getItem(tokenKey)).toBeNull();
  expect(unauthorized).toBe(1);
});
