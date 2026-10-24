import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardWebSocketUrl, subscribeToBoard } from './liveBoard';
import { getApiBaseUrl } from '../../../shared/env';
import { http } from '../../../shared/http';

const sockets: Array<{ url: string; close: ReturnType<typeof vi.fn>; listener?: (event: MessageEvent<string>) => void }> = [];
class FakeWebSocket {
  url: string;
  close = vi.fn();
  listener?: (event: MessageEvent<string>) => void;
  constructor(url: string) { this.url = url; sockets.push(this); }
  addEventListener(_type: string, listener: (event: MessageEvent<string>) => void) { this.listener = listener; }
}

describe('board live updates', () => {
  afterEach(() => { sockets.length = 0; vi.unstubAllGlobals(); });

  it('uses same-origin ws or configured secure API origin', () => {
    vi.stubGlobal('window', { location: { href: 'https://client.example/board' } });
    expect(boardWebSocketUrl('repo id')).toBe('wss://client.example/api/v1/board/ws?repository_id=repo+id');
    vi.spyOn(http, 'get').mockResolvedValue({ data: {} });
    expect(new URL('/api/v1/board', new URL(getApiBaseUrl(), window.location.href)).origin).toBe('https://client.example');
  });

  it('invalidates only matching repository event and closes on cleanup', () => {
    vi.stubGlobal('window', { location: { href: 'https://client.example/' } });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const invalidate = vi.fn();
    const unsubscribe = subscribeToBoard('repo-1', invalidate);
    expect(sockets[0].url).toContain('repository_id=repo-1');
    sockets[0].listener?.({ data: JSON.stringify({ type: 'board.invalidate', repository_id: 'repo-2' }) } as MessageEvent<string>);
    expect(invalidate).not.toHaveBeenCalled();
    sockets[0].listener?.({ data: JSON.stringify({ type: 'board.invalidate', repository_id: 'repo-1' }) } as MessageEvent<string>);
    expect(invalidate).toHaveBeenCalledOnce();
    unsubscribe();
    expect(sockets[0].close).toHaveBeenCalledOnce();
  });

  it('does not open a socket for an empty selection', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    subscribeToBoard('', vi.fn());
    expect(sockets).toHaveLength(0);
  });
});
