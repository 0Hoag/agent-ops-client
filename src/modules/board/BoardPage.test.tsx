// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardPage } from './BoardPage';
import type { Page, Repository } from './services/types';

const { getMock, subscribeMock } = vi.hoisted(() => ({ getMock: vi.fn(), subscribeMock: vi.fn() }));
vi.mock('./services/liveBoard', () => ({ subscribeToBoard: subscribeMock }));
vi.mock('./services/client', () => ({ boardApi: { get: getMock } }));

const repositories: Page<Repository> = { data: [{ id: 'repo-1', provider: 'github', full_name: 'one/repo' }, { id: 'repo-2', provider: 'github', full_name: 'two/repo' }], meta: { page: 1, per_page: 100, total: 2 } };
const emptyBoard = { data: [], meta: { page: 1, per_page: 100, total: 0 } };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  getMock.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/repositories') ? repositories : emptyBoard }));
  const view = render(<QueryClientProvider client={client}><BoardPage /></QueryClientProvider>);
  return { client, ...view };
}

describe('BoardPage live lifecycle', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('invalidates only the selected repository board query on a live event', async () => {
    let notify: (() => void) | undefined;
    subscribeMock.mockImplementation((_id: string, callback: () => void) => { notify = callback; return vi.fn(); });
    const { client } = setup();
    const select = await screen.findByRole('combobox', { name: 'Repository' });
    await screen.findByRole('option', { name: 'one/repo' });
    fireEvent.change(select, { target: { value: 'repo-1' } });
    await screen.findByText('No issues on this board.');
    expect(subscribeMock).toHaveBeenLastCalledWith('repo-1', expect.any(Function));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    notify?.();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['board', 'repo-1'] }));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(3));
    expect(client.getQueryCache().find({ queryKey: ['board', 'repo-1', 1] })?.state.data).toEqual(emptyBoard);
    expect(client.getQueryCache().find({ queryKey: ['board', 'repo-2', 1] })).toBeUndefined();
  });

  it('closes the old socket on repository change and the selected socket on unmount', async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    const { unmount } = setup();
    const select = await screen.findByRole('combobox', { name: 'Repository' });
    await screen.findByRole('option', { name: 'one/repo' });
    fireEvent.change(select, { target: { value: 'repo-1' } });
    await waitFor(() => expect(subscribeMock).toHaveBeenLastCalledWith('repo-1', expect.any(Function)));
    fireEvent.change(select, { target: { value: 'repo-2' } });
    await waitFor(() => expect(subscribeMock).toHaveBeenLastCalledWith('repo-2', expect.any(Function)));
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(2));
    const previousCalls = subscribeMock.mock.calls.length;
    const oldCallback = subscribeMock.mock.calls[0][1] as () => void;
    oldCallback();
    expect(subscribeMock).toHaveBeenCalledTimes(previousCalls);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(3);
  });
});
