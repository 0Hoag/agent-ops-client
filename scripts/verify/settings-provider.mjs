// Explicit upstream GitLab fixture, not an API/browser interception. Unknown calls fail closed.
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture');
  let value;
  let status = 200;
  if (req.headers['private-token'] !== 'settings-local-provider-token') status = 401;
  else if (url.pathname === '/api/v4/projects/settings-190%2Fconnected') value = { id: 190, name: 'Settings fixture project' };
  else if (url.pathname === '/api/v4/projects/settings-190%2Fconnected/issues') value = [{ iid: 190, title: 'Settings synced task', state: 'opened', labels: ['Status::Todo'], updated_at: '2026-11-01T00:00:00Z' }];
  else if (/^\/api\/v4\/projects\/settings-190%2Fconnected\/(merge_requests|pipelines)$/.test(url.pathname)) value = [];
  else status = 404;
  appendFileSync(process.argv[3], `${req.method} ${req.url}: ${status}\n`);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value ?? { error: 'fixture boundary: unsupported request or token' }));
});
server.listen(Number(process.argv[2]), '0.0.0.0', () => process.send?.('ready'));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
