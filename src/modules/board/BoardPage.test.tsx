// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import { BoardPage } from './BoardPage';
import type { Repository } from './services/types';

const { subscribeMock } = vi.hoisted(() => ({ subscribeMock: vi.fn() }));
vi.mock('./services/liveBoard', () => ({ subscribeToBoard: subscribeMock }));
const requests = vi.spyOn(http, 'request');

const repositories: Repository[] = [{ id: 'repo-1', provider: 'github', full_name: 'one/repo' }, { id: 'repo-2', provider: 'github', full_name: 'two/repo' }];
const emptyBoard = { data: [], meta: { page: 1, per_page: 100, total: 0 } };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  requests.mockImplementation((config) => Promise.resolve({ data: { data: config.url?.includes('/repositories?') ? repositories : emptyBoard.data, meta: emptyBoard.meta }, status: 200, statusText: 'OK', headers: {}, config: { ...config, headers: {} } } as never));
  const view = render(<QueryClientProvider client={client}><BoardPage /></QueryClientProvider>);
  return { client, ...view };
}

describe('BoardPage live lifecycle', () => {
  afterEach(() => { cleanup(); requests.mockReset(); subscribeMock.mockReset(); vi.clearAllMocks(); });

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
    await waitFor(() => expect(requests).toHaveBeenCalledTimes(3));
    expect(requests.mock.calls[0][0].url).toBe('/api/v1/repositories?page=1&per_page=100');
    expect(requests.mock.calls[1][0].url).toBe('/api/v1/board?repository_id=repo-1&page=1&per_page=100');
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
