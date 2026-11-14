// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { http } from './shared/http';
import { ChannelSettings } from './modules/alerts/ChannelSettings';
import { BudgetsPage } from './modules/budgets/page';
import { WavesPage } from './modules/waves/page';

const originalAdapter = http.defaults.adapter;
afterEach(() => { cleanup(); http.defaults.adapter = originalAdapter; });
const consumers = [
  { name: 'channels', component: <ChannelSettings organizationId="org-a" />, error: /Unable to verify permissions/, write: 'Create channel' },
  { name: 'budgets', component: <BudgetsPage />, error: /Unable to load budget permissions/, write: 'Create budget' },
  { name: 'batches', component: <WavesPage />, error: /permissions could not be verified/, write: 'Create batch' },
];
function deferred() {
  let resolve!: (role: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
for (const consumer of consumers) describe(`${consumer.name} permission recovery`, () => {
  function mount(failRequest: 'members' | 'session' = 'members') {
    let org = 'org-a';
    let member = deferred();
    let session = deferred();
    let memberCalls = 0;
    let sessionCalls = 0;
    const writes: string[] = [];
    http.defaults.adapter = async (config) => {
      const url = String(config.url);
      let data: unknown = { data: [] };
      if (config.method !== 'get') writes.push(url);
      if (url.endsWith('/auth/session')) {
        sessionCalls++;
        const requestedOrg = org;
        if (failRequest === 'session') await session.promise;
        data = { organization_id: requestedOrg, account_id: 'acct' };
      }
      if (url.endsWith('/members')) {
        memberCalls++;
        const role = await member.promise;
        data = { data: [{ account_id: 'acct', role }] };
      }
      if (url.endsWith('/waves')) data = { data: [{ id: 'batch-1', name: 'Release', state: 'todo', brief: 'Ship it' }] };
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = render(<QueryClientProvider client={client}>{consumer.component}</QueryClientProvider>);
    return {
      get member() { return member; }, get session() { return session; },
      get memberCalls() { return memberCalls; }, get sessionCalls() { return sessionCalls; }, writes,
      next() { member = deferred(); session = deferred(); },
      switchOrg() {
        org = 'org-b'; fireEvent(window, new Event('organization:will-change'));
        if (consumer.name === 'channels') view.rerender(<QueryClientProvider client={client}><ChannelSettings organizationId={org} /></QueryClientProvider>);
        fireEvent(window, new Event('organization:changed'));
      },
    };
  }
  for (const request of ['members', 'session'] as const) for (const fault of ['500', '403', 'offline', 'timeout']) {
    it(`retries its own ${request} ${fault} failure and validates admin before writes`, async () => {
      const state = mount(request);
      await waitFor(() => expect(request === 'members' ? state.memberCalls : state.sessionCalls).toBe(1));
      expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
      const error = new AxiosError(fault, fault === 'timeout' ? 'ECONNABORTED' : fault === 'offline' ? 'ERR_NETWORK' : 'ERR_BAD_RESPONSE');
      if (fault === '500' || fault === '403') error.response = { status: Number(fault), data: {}, statusText: fault, headers: {}, config: { headers: {} } } as never;
      await act(async () => state[request === 'members' ? 'member' : 'session'].reject(error));
      const alert = (await screen.findByText(consumer.error)).closest('[role="alert"]')!;
      expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
      state.next();
      fireEvent.click(within(alert as HTMLElement).getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(request === 'members' ? state.memberCalls : state.sessionCalls).toBe(2));
      expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
      await act(async () => { state.session.resolve(''); state.member.resolve('admin'); });
      expect(await screen.findByRole('button', { name: consumer.write })).toBeTruthy();
      expect(screen.queryByText(consumer.error)).toBeNull();
      expect(state.writes).toEqual([]);
    });
  }
  for (const role of ['member', 'viewer']) it(`keeps ${role} read-only`, async () => {
    const state = mount();
    await act(async () => state.member.resolve(role));
    await screen.findByText(/Read-only/);
    expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
    if (consumer.name === 'batches') {
      const save = await screen.findByRole('button', { name: 'Save brief' });
      expect(save.matches(':disabled')).toBe(true);
      expect(screen.getByLabelText('State for Release').matches(':disabled')).toBe(true);
      fireEvent.click(save);
      fireEvent.change(screen.getByLabelText('State for Release'), { target: { value: 'done' } });
    }
    expect(state.writes).toEqual([]);
  });
  for (const request of ['members', 'session'] as const) for (const stale of ['success', 'failure']) it(`ignores stale ${request} ${stale} after organization switch`, async () => {
    const state = mount(request);
    await waitFor(() => expect(request === 'members' ? state.memberCalls : state.sessionCalls).toBe(1));
    const old = request === 'members' ? state.member : state.session;
    state.next(); state.switchOrg();
    await waitFor(() => expect(request === 'members' ? state.memberCalls : state.sessionCalls).toBe(2));
    await act(async () => { state.session.resolve(''); state.member.resolve('viewer'); });
    await screen.findByText(/Read-only/);
    await act(async () => { if (stale === 'success') old.resolve('owner'); else old.reject(new Error('old 500')); });
    expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
    expect(screen.queryByText(consumer.error)).toBeNull();
    expect(state.writes).toEqual([]);
  });
  it('revokes validated owner controls as soon as organization switching starts', async () => {
    const state = mount();
    await act(async () => state.member.resolve('owner'));
    await screen.findByRole('button', { name: consumer.write });
    fireEvent(window, new Event('organization:will-change'));
    expect(screen.queryByRole('button', { name: consumer.write })).toBeNull();
    expect(state.writes).toEqual([]);
  });
});
