// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { http } from './http';
import { api } from './api/client';

const originalAdapter = http.defaults.adapter;
const tokenKey = 'agent-ops-token';

beforeEach(() => {
  sessionStorage.clear();
  http.defaults.adapter = originalAdapter;
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
  window.removeEventListener('auth:unauthorized', onUnauthorized);
});

let unauthorizedCount = 0;
function onUnauthorized() { unauthorizedCount += 1; }

it('does not invalidate a newer session when a delayed old-session request gets 401', async () => {
  unauthorizedCount = 0;
  window.addEventListener('auth:unauthorized', onUnauthorized);
  sessionStorage.setItem(tokenKey, 'session-a');
  let rejectRequest!: (error: unknown) => void;
  let requestConfig!: InternalAxiosRequestConfig;
  http.defaults.adapter = (config: InternalAxiosRequestConfig) => new Promise((_, reject) => {
    rejectRequest = reject;
    requestConfig = config;
    expect(config.headers.Authorization).toBe('Bearer session-a');
  });

  const request = http.get('/protected');
  while (!rejectRequest) await new Promise((resolve) => setTimeout(resolve, 0));
  sessionStorage.setItem(tokenKey, 'session-b');
  rejectRequest(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', requestConfig, undefined, {
    config: requestConfig, status: 401, statusText: 'Unauthorized', headers: {}, data: {},
  }));
  await expect(request).rejects.toMatchObject({ response: { status: 401 } });

  expect(sessionStorage.getItem(tokenKey)).toBe('session-b');
  expect(unauthorizedCount).toBe(0);
});

it('still invalidates the matching session on 401', async () => {
  unauthorizedCount = 0;
  window.addEventListener('auth:unauthorized', onUnauthorized);
  sessionStorage.setItem(tokenKey, 'session-a');
  http.defaults.adapter = async (config) => {
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      config, status: 401, statusText: 'Unauthorized', headers: {}, data: {},
    });
  };

  await expect(http.get('/protected')).rejects.toMatchObject({ response: { status: 401 } });
  expect(sessionStorage.getItem(tokenKey)).toBeNull();
  expect(unauthorizedCount).toBe(1);
});

it('preserves explicit generated-client authorization and defaults to the stored bearer', async () => {
  sessionStorage.setItem(tokenKey, 'tenant-a');
  const received: string[] = [];
  http.defaults.adapter = async (config) => {
    received.push(String(config.headers.Authorization));
    return { data: { email: 'test@example.com', organization_id: 'org-b' }, status: 200, statusText: 'OK', headers: {}, config };
  };

  await api.api.v1AuthSessionList({ headers: { Authorization: 'Bearer tenant-b' } });
  await api.api.v1AuthSessionList();

  expect(received).toEqual(['Bearer tenant-b', 'Bearer tenant-a']);
  expect(sessionStorage.getItem(tokenKey)).toBe('tenant-a');
});
