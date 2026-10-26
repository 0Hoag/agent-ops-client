// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AppRouter } from './router';
import { AppLayout } from './layout/AppLayout';
import { http } from '../shared/http';

const originalAdapter = http.defaults.adapter;
let requests: InternalAxiosRequestConfig[];
let rejectSession = false;
let sessionFailure: 'network' | '503' | null = null;
let rejectLogin = false;
let rejectRepositories = false;
beforeEach(() => {
  sessionStorage.clear();
  requests = [];
  rejectSession = rejectLogin = rejectRepositories = false;
  sessionFailure = null;
  http.defaults.adapter = async (config) => {
    requests.push(config);
    const path = config.url?.split('?')[0];
    const response = { config, status: 200, statusText: 'OK', headers: {}, data: {} };
    if (path?.endsWith('/auth/session') && sessionFailure === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    if (path?.endsWith('/auth/session') && sessionFailure === '503') {
      throw new AxiosError('Unavailable', 'ERR_BAD_RESPONSE', config, undefined, { ...response, status: 503, statusText: 'Service Unavailable' });
    }
    if ((path?.endsWith('/auth/session') && rejectSession) ||
        (path?.endsWith('/auth/login') && rejectLogin) ||
        (path?.endsWith('/repositories') && rejectRepositories)) {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { ...response, status: 401 });
    }
    if (config.url?.endsWith('/auth/login')) response.data = { token: 'issued-token' };
    if (path?.endsWith('/repositories')) response.data = { data: [], meta: { page: 1, per_page: 100, total: 0 } };
    return response;
  };
});
afterEach(() => { cleanup(); http.defaults.adapter = originalAdapter; });

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>; }
function mount(path = '/board') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['private-data'], 'previous session');
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Location /><AppLayout><AppRouter /></AppLayout></MemoryRouter></QueryClientProvider>);
  return client;
}
async function signIn() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'fixture@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'fixture-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

it.each(['/board', '/runs', '/insights'])('denies missing sessions and clears cached data: %s', async (path) => {
  const client = mount(path);
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(requests).toHaveLength(0);
});
it('preserves the full destination through login using real generated operations and Bearer wiring', async () => {
  mount('/board?view=review#issue');
  await screen.findByRole('heading', { name: 'Sign in' });
  await signIn();
  await screen.findByText('No repositories available.');
  expect(screen.getByTestId('location').textContent).toBe('/board?view=review#issue');
  expect(requests.find((request) => request.url?.endsWith('/auth/login'))?.data).toBe(JSON.stringify({ email: 'fixture@example.test', password: 'fixture-password' }));
  const authorized = requests.filter((request) => !request.url?.endsWith('/auth/login'));
  expect(authorized.length).toBeGreaterThanOrEqual(3);
  expect(authorized.every((request) => request.headers.Authorization === 'Bearer issued-token')).toBe(true);
});
it('shows a failed login without reaching protected data', async () => {
  rejectLogin = true;
  mount();
  await screen.findByRole('heading', { name: 'Sign in' });
  await signIn();
  expect((await screen.findByRole('alert')).textContent).toContain('Unable to sign in');
  expect(sessionStorage.getItem('agent-ops-token')).toBeNull();
  expect(requests).toHaveLength(1);
});
it('logs out and removes both credentials and query data', async () => {
  sessionStorage.setItem('agent-ops-token', 'issued-token');
  const client = mount();
  await screen.findByText('No repositories available.');
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(sessionStorage.getItem('agent-ops-token')).toBeNull();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
it('rejects an expired session before requesting protected data', async () => {
  sessionStorage.setItem('agent-ops-token', 'expired');
  rejectSession = true;
  const client = mount('/runs');
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(requests.map((request) => request.url)).toEqual(['/api/v1/auth/session']);
  expect(sessionStorage.getItem('agent-ops-token')).toBeNull();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
it.each(['network', '503'] as const)('retains a valid session and retries after temporary %s validation failure', async (failure) => {
  sessionStorage.setItem('agent-ops-token', 'issued-token');
  sessionFailure = failure;
  const client = mount('/board?view=review#issue');
  await screen.findByRole('alert');
  expect(sessionStorage.getItem('agent-ops-token')).toBe('issued-token');
  expect(client.getQueryData(['private-data'])).toBe('previous session');
  expect(requests.map((request) => request.url)).toEqual(['/api/v1/auth/session']);

  sessionFailure = null;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No repositories available.');
  expect(screen.getByTestId('location').textContent).toBe('/board?view=review#issue');
  expect(requests.filter((request) => request.url?.endsWith('/auth/session'))).toHaveLength(2);
});
it('clears the session and redirects when a protected data request expires after validation', async () => {
  sessionStorage.setItem('agent-ops-token', 'issued-token');
  rejectRepositories = true;
  const client = mount();
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'));
  expect(sessionStorage.getItem('agent-ops-token')).toBeNull();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
it.each([401, 200])('keeps the newer session/cache and route gated after stale validation %s', async (status) => {
  sessionStorage.setItem('agent-ops-token', 'session-a');
  const adapter = http.defaults.adapter;
  let finish!: () => void;
  let unauthorized = 0;
  const onUnauthorized = () => { unauthorized += 1; };
  window.addEventListener('auth:unauthorized', onUnauthorized);
  http.defaults.adapter = (config) => {
    requests.push(config);
    expect(config.headers.Authorization).toBe('Bearer session-a');
    return new Promise((resolve, reject) => {
      finish = () => {
        const response = { config, status, statusText: String(status), headers: {}, data: {} };
        if (status === 200) resolve(response);
        else reject(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response));
      };
    });
  };
  try {
    const client = mount('/board?view=review#issue');
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    sessionStorage.setItem('agent-ops-token', 'session-b');
    finish();
    await screen.findByRole('alert');
    expect(sessionStorage.getItem('agent-ops-token')).toBe('session-b');
    expect(client.getQueryData(['private-data'])).toBe('previous session');
    expect(unauthorized).toBe(0);
    expect(screen.getByTestId('location').textContent).toBe('/board?view=review#issue');
    expect(requests.map((request) => request.url)).toEqual(['/api/v1/auth/session']);
    http.defaults.adapter = adapter;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No repositories available.');
    expect(requests.slice(1).every((request) => request.headers.Authorization === 'Bearer session-b')).toBe(true);
  } finally {
    window.removeEventListener('auth:unauthorized', onUnauthorized);
  }
});
it('does not render the next protected route using the previous route validation', async () => {
  sessionStorage.setItem('agent-ops-token', 'issued-token');
  mount();
  await screen.findByText('No repositories available.');
  requests.length = 0;
  rejectSession = true;
  fireEvent.click(screen.getByRole('link', { name: 'Runs' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(requests.map((request) => request.url)).toEqual(['/api/v1/auth/session']);
});
