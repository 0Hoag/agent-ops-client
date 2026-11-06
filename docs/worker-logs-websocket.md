# Worker log websocket contract

The generated `GET /api/v1/workers/{worker_id}/logs` operation describes the route only. It upgrades to an authenticated WebSocket; do not use the generated REST client method to consume the live stream or parse messages as a REST response. Live socket consumption is tracked separately in #107.

The server requires authentication and authorizes an owner or admin of the job's organization. Unauthorized requests return 401, inaccessible jobs return 403, and missing jobs return 404 before upgrade. The server contract does not specify a WebSocket-specific credential transport; the consumer must use the application's supported authenticated connection mechanism.

Frames are JSON objects written by the server:

- `{"type":"worker.log","line":"..."}` for each launcher stdout/stderr line, including replayed history.
- `{"type":"worker.completed"}` when the launcher exits.

The server replays up to 256 historical lines on subscription and streams new lines in arrival order. This is the configured launcher process output, not the Codex/OpenCode harness transcript stored in `.agent-runs/<wave>.jsonl`.
