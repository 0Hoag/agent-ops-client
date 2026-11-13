// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { PricingPage } from './PricingPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const sessionData = { data: { organization_id: 'org-a', account_id: 'acct' } };
const membersData = (role = 'owner') => ({ data: { data: [{ account_id: 'acct', role }] } });
function setup(role = 'owner') {
  const session = vi.spyOn(api.api, 'v1AuthSessionList').mockResolvedValue(sessionData as never);
  const members = vi.spyOn(api.api, 'v1OrganizationsMembersList').mockResolvedValue(membersData(role) as never);
  const prices = vi.spyOn(api.api, 'v1AgentRunPricesList').mockResolvedValue({ data: { data: [] } } as never);
  return { session, members, prices };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PricingPage /></QueryClientProvider>);
}

it.each(['session', 'members', 'prices'] as const)('%s failures settle and retry only that request', async (request) => {
  for (const message of ['Request failed with status code 403', 'Network Error', 'timeout of 30000ms exceeded']) {
    const mocks = setup();
    mocks[request].mockRejectedValueOnce(new Error(message));
    mount();
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByRole('status')).toBeNull();
    if (request !== 'prices') expect(screen.queryByRole('button', { name: 'Create version' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No model prices configured.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mocks.session).toHaveBeenCalledTimes(request === 'session' ? 2 : 1);
    expect(mocks.members).toHaveBeenCalledTimes(request === 'members' ? 2 : 1);
    expect(mocks.prices).toHaveBeenCalledTimes(request === 'prices' ? 2 : 1);
    cleanup(); vi.restoreAllMocks();
  }
});

it.each(['owner', 'admin', 'member', 'viewer'])('preserves %s permissions after Retry', async (role) => {
  const { members } = setup(role);
  members.mockRejectedValueOnce(new Error('offline'));
  mount();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Create version' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No model prices configured.');
  expect(!!screen.queryByRole('button', { name: 'Create version' })).toBe(['owner', 'admin'].includes(role));
});

it.each(['session success', 'session failure', 'members success', 'members failure'])('ignores stale %s after organization switch', async (outcome) => {
  const mocks = setup();
  let resolve!: (value: never) => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((yes, no) => { resolve = yes; reject = no; });
  if (outcome.startsWith('session')) mocks.session.mockReturnValueOnce(pending);
  else mocks.members.mockReturnValueOnce(pending);
  mount();
  await waitFor(() => expect(outcome.startsWith('session') ? mocks.session : mocks.members).toHaveBeenCalledTimes(1));
  fireEvent(window, new Event('organization:will-change'));
  mocks.session.mockResolvedValue({ data: { organization_id: 'org-b', account_id: 'acct' } } as never);
  mocks.members.mockResolvedValue(membersData('viewer') as never);
  fireEvent(window, new Event('organization:changed'));
  await screen.findByText(/Read-only/);
  await act(async () => {
    if (outcome.endsWith('failure')) reject(new Error('stale failure'));
    else resolve((outcome.startsWith('session') ? sessionData : membersData()) as never);
  });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Create version' })).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mocks.members.mock.calls.filter(([org]) => org === 'org-a')).toHaveLength(outcome.startsWith('session') ? 0 : 1);
});
