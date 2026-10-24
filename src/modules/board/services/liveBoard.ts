import { getApiBaseUrl } from '../../../shared/env';

export function boardWebSocketUrl(repositoryId: string): string {
  const base = new URL(getApiBaseUrl(), window.location.href);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/api/v1/board/ws`;
  base.search = new URLSearchParams({ repository_id: repositoryId }).toString();
  return base.toString();
}

export function subscribeToBoard(repositoryId: string, onInvalidate: () => void): () => void {
  if (!repositoryId) return () => undefined;
  const socket = new WebSocket(boardWebSocketUrl(repositoryId));
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    try {
      const message: unknown = JSON.parse(event.data);
      if (typeof message === 'object' && message !== null && 'type' in message && 'repository_id' in message && message.type === 'board.invalidate' && message.repository_id === repositoryId) onInvalidate();
    } catch {
      // Ignore malformed messages; REST remains authoritative.
    }
  });
  return () => socket.close();
}
