# Work, Usage and Session verification (#189)

Run from the client checkout:

```sh
scripts/verify/pages.sh
```

The entry point holds the canonical heavy-command lock for the entire lifecycle.
It extends the committed `review-183.mjs` isolated-stack helper, not the open
authentication review (#224). It allocates a unique Compose project and ephemeral
ports, generates synthetic account/stack secrets, bootstraps through real HTTP,
and persists fixture rows in migrated PostgreSQL. It uses no request interception,
fake browser login, backend modifications or imported production arithmetic.

Production routes resolved through `src/app/router.tsx` are `/work` → `WorkPage`,
`/usage` → `UsagePage`, and `/usage/sessions` → `SessionPage` / `Timeline`.
`/runs` redirects to Usage; `RunsPage.tsx` is not the current session route.
`src/modules/usage/page.tsx` does not exist.

## Assertions and evidence

- Work: repository, state/search filters, next/previous pagination compared with
  real HTTP; row detail; exact GitLab href; unaffected persisted $2 / 1M tokens.
- Usage: repository/date/split controls, recorded $14.40 total and session rows
  ($2 / $12.40, 1M tokens each), navigation into Session.
- Session: recorded cost, exact MR URL, sorted tool timeline, incremental
  $0.50/$1.50 step costs and 100%/50% cache trend.
- Screenshots: final production Work detail, Usage and Session, light/dark at
  1280/390 px, document and nested horizontal overflow assertions.
- Separate strict probes for existing backend #557 (linked issue attribution)
  and #559 (recorded versus estimated Work cost) remain blocking comparisons.
  They do not change attribution or pricing semantics. Unrelated checks continue.

The fixture intentionally covers only one priced model, tool and GitLab repository.
It does **not** prove complete cost acceptance, unknown-price behavior, all token
categories, multiple tenants, all date boundaries, or all pagination conditions.

Evidence under `.agent-runs/W19o-pages-189` includes source revisions, commands,
seed SQL, independent persisted snapshot, captured HTTP, per-check JSON and an
acceptance/command/expected/actual Markdown table. Each browser phase has its own
directory. `production` and `restored` contain screenshots of unmodified code.

## Compiled failing control

After the production run, the helper copies tracked source to a disposable evidence
directory and changes the production Timeline step label from `Step` to `Broken`.
Only the disposable client is rebuilt; the API/database and fixture remain unchanged.
The same browser script must fail `PAGE_SESSION_TIMELINE`. The helper then restores
the original image without rebuilding and reruns the same script and persisted data.
Unexpected failures abort; known #557/#559 failures still make the overall command
exit nonzero. A browser crash, missing result file, or environment failure is never
a successful control or acceptance pass.

The shared lifecycle removes only its own project containers, networks and volumes,
and checks zero survivors. If Docker is unreachable before startup, no stack is
created; resource enumeration is unavailable, not a verified cleanup result.

## First implementation status

`bash -n` and Node syntax checks passed. The real entry point was invoked but
stopped at `docker info`: the local Docker socket does not exist. Consequently
live assertions, compiled mutation/restoration, screenshots and zero-survivor
enumeration are **not verified**. Rerun with an available Docker daemon before
treating this issue's acceptance as complete. Do not interpret the harness or
the standalone client gate as evidence that these browser checks passed.
