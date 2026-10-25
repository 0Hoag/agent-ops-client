# Authentication session

The client stores the API-issued JWT in browser `sessionStorage` for the current tab and sends it as a Bearer token through the shared Axios client. Board, runs, and insights validate the token against `/api/v1/auth/session` before rendering; missing or rejected tokens redirect to login while retaining the intended pathname, query and fragment. Validation belongs to the current pathname, never the previous protected screen. Logout removes the token and clears TanStack Query data, as does protected route denial. An authenticated HTTP 401 also removes the token, clears query data and redirects the mounted protected screen. The health page remains public.

Logout is local to the tab; it does not revoke the API-issued JWT. Expiry is checked on protected navigation and authenticated HTTP responses, not by a background timer.

## Reproduce acceptance

Run from this client worktree with Docker, pnpm and Playwright Chromium installed:

```sh
git clone https://github.com/0Hoag/agent-ops.git .agent-runs/login-acceptance-api
git -C .agent-runs/login-acceptance-api checkout --detach c1231ada2102caea0144a0281167094731b78f17
node scripts/verify-auth-mutation.mjs
node scripts/verify-auth-browser.mjs
```

The clone belongs inside ignored `.agent-runs/`; do not run the API's original smoke script because it updates a canonical client checkout. The browser harness reuses only the pinned API's Compose services and schema, sets a disposable signing secret and a 30-second JWT lifetime through an ignored Compose override, and seeds an isolated Postgres database with a bcrypt account and issue/PR/CI records. It builds and serves this client on dedicated loopback ports (API 18739, client 18740, Postgres 18741), without injecting tokens, intercepting API responses or bypassing guards. It closes its browser/process group and tears down its uniquely named Compose project on success, failure and handled termination, then measures absence of owned containers, volumes and listeners. The API tracked tree must remain clean. Existing fixtures are untouched.

Evidence is in [`artifacts/auth-session/`](../artifacts/auth-session/): board and expired-login screenshots, redacted real network responses, browser/cleanup logs, and two production mutation controls with unchanged-test diagnostics and SHA-256 restore checks. The mutation harness copies production code/tests into a disposable ignored directory and links dependencies; it never edits the live production source.

## Recovery findings

- Real route/service wiring tests initially failed five assertions: cache survived missing credentials on all three protected routes, the destination lost query/fragment, and authenticated data rejection did not redirect. These paths now clear session/query state and preserve the full destination.
- The first successful browser run exposed a protected runs request before the expired session was rejected: React reused the previous route's `valid` state. Validation is now pathname-bound. An unchanged route test fails when that production guard check is removed; the final browser run asserts that only the session endpoint is requested during expired navigation.
- Provisioning attempt 1 failed with `psql` exit 3: `null value in column "id" of relation "accounts" violates not-null constraint`. Inspection of migration `005_create_accounts_table.sql` confirmed UUIDs have no default. Supplying a deterministic fixture UUID fixed setup without changing API source. The failed attempt's log includes verified cleanup.
- Attempt 2 failed build/typecheck (exit 2, TS2769): Testing Library `getByRole` does not accept Playwright's `exact` option. Removing it fixed the test; its failed-attempt log also includes verified cleanup. The final browser and final tree gate were rerun after the correction.
