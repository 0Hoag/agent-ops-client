# Settings production verification (#190)

Run `scripts/verify/settings.sh` from this checkout. It holds the canonical `heavy.sh`
single-machine lock for the complete Compose/browser/build lifecycle. Requirements:
Docker, pnpm dependencies, Playwright Chromium, and the read-only API checkout at
`/Users/zeross/agent-ops`. Docker availability is checked before building.

The merged #224 `auth-stack.mjs` lifecycle, `auth-fixture.mjs` HTTP fixtures and real
browser authentication pattern are reused. No token is injected into browser storage.
Each run owns a unique Compose project, ephemeral localhost ports, synthetic accounts,
random deployment secrets and a migrated persistent Postgres volume. Nothing modifies
global Docker settings or an existing deployment. API and production client images are
built once; only the client is rebuilt for the deliberately broken compiled control
and restored production. Backend code is never changed.

`settings-provider.mjs` is an explicit local upstream GitLab HTTP boundary, not an
intercepted client/API request. It accepts a synthetic token and returns one project,
one issue and empty merge-request/pipeline lists. Unknown requests fail closed. Its
request log proves the API actually reached that boundary. The real API stores the
repository and backfilled issue in Postgres. External provider auth, pagination and
outages remain unverified.

The API worker executor runs an allowlisted, mounted shell fixture which prints two
lines separated by two seconds. The browser must receive and render real websocket
`worker.log` and `worker.completed` frames. This verifies process → API → websocket →
registered UI, not an external AI agent, worktree creation or provider credentials.
The production proxy adapts a worker-log upgrade's query credential to the existing
upstream Bearer interface only when no Authorization header is present. The API
still validates signatures, membership and role; an invalid-token upgrade must return
401. No test injects a session credential. Collected access-token query logs are redacted.

The pricing oracle is independent: 1,000,000 input tokens at $2/million plus 100,000
output tokens at $5/million equals $2.50. SQL confirms persisted counters before each
phase; the real pricing form, HTTP Overview and rendered spend summary must agree. This
is a **price-derived estimate**, not recorded cost. A dedicated repository avoids mixed
priced/unpriced totals. The registered `/runs` redirects to Usage; the legacy RunsPage
is never mounted by this verifier. No cached/reasoning overlap,
Work attribution or recorded-versus-estimated substitution is asserted; backend
#557/#559 remain unresolved. No production arithmetic is imported.

Every browser phase restores the same database snapshot, IDs, dates, pre-price state
and inputs. The control changes only compiled `navigator.clipboard.writeText(command)`
to write `broken-command` in a disposable source copy. It must fail specifically at
`SETTINGS_CLIPBOARD_EXACT_COMMAND`, then restored compiled production must pass.
The clipboard oracle is independently constructed, not copied from the rendered code.

Results contain acceptance/command/expected/actual, HTTP status observations, websocket
frames, runtime errors and screenshots. Screenshots use actual production at 1280/390
and the production CSS light/dark theme tokens. Setting the CSS theme is presentation
only; production has no registered theme toggle. It does not replace runtime checks.

Ignored evidence is archived into the canonical client
`.agent-runs/W19p-settings-190/<run timestamp>` before cleanup and again afterwards.
Cleanup removes only the owned project and enumerates zero remaining containers,
networks and volumes. Interrupted runs also execute cleanup. Do not publish raw database
dumps or generated synthetic credentials. The checked-in PR evidence is a curated,
credential-free selection.
