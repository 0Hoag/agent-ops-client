import { getApiBaseUrl } from '../../shared/env';

export function workerLogsUrl(workerId: string, token: string): string {
  const base = new URL(getApiBaseUrl(), window.location.href);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/api/v1/workers/${encodeURIComponent(workerId)}/logs`;
  base.search = new URLSearchParams({ access_token: token }).toString();
  return base.toString();
}

export function subscribeToWorkerLogs(workerId: string, onLine: (line: string) => void, onComplete: () => void, onError: () => void): () => void {
  const token = sessionStorage.getItem('agent-ops-token');
  if (!workerId || !token) { onError(); return () => undefined; }
  const socket = new WebSocket(workerLogsUrl(workerId, token));
  let active = true;
  const messageListener = (event: MessageEvent<string>) => {
    if (!active) return;
    try {
      const message: unknown = JSON.parse(event.data);
      if (typeof message !== 'object' || message === null || !('type' in message)) return;
      if (message.type === 'worker.log' && 'line' in message && typeof message.line === 'string') onLine(message.line);
      if (message.type === 'worker.completed') onComplete();
    } catch { onError(); }
  };
  const errorListener = () => { if (active) onError(); };
  socket.addEventListener('message', messageListener);
  socket.addEventListener('error', errorListener);
  return () => { active = false; socket.removeEventListener('message', messageListener); socket.removeEventListener('error', errorListener); socket.close(); };
}
