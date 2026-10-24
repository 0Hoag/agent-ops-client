# Real signed-webhook browser acceptance

Run from the client checkout with Docker, Go, pnpm, and Playwright's Chromium installed. The harness uses the API checkout read-only at `~/agent-ops-wt/w2d-browser-api`; override it with `API_REPO_DIR`. Example:

```sh
API_REPO_DIR="$HOME/agent-ops-wt/w2d-browser-api" \
SMOKE_API_PORT=18081 SMOKE_CLIENT_PORT=4174 \
bash scripts/live-webhook-smoke.sh
```

The ports are configurable and checked before use. Each run starts a uniquely project-scoped disposable PostgreSQL volume, runs the real API against it, seeds two webhook-configured repositories, builds/serves this client, signs an actual GitHub issues request with HMAC-SHA256, and asserts the rendered status change and websocket lifecycle. It does not mock HTTP or WebSockets. Artifacts (including the browser output and exact API/client SHAs) default to `.agent-runs/live-webhook`; set `SMOKE_ARTIFACT_DIR` to change the location. Cleanup removes the run's Compose containers/volume and owned API/client listeners, then verifies their absence.

The negative control is intended to run in an isolated disposable client worktree with the `invalidateQueries` call removed from `src/modules/board/BoardPage.tsx`, using a separate artifact directory and ports. It must fail the movement assertion (card stays in Todo) while still verifying cleanup. Do not modify the normal checkout for this control.
