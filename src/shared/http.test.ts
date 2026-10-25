// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { http } from './http';

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
