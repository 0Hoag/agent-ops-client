# Work, Usage and Session verification (#189)

Run from the client checkout:

```sh
scripts/verify/pages.sh
```

The entry point holds the canonical heavy-command lock for the entire lifecycle.
It extends the published `review-183.mjs` isolated-stack helper, including the
development integration, without changing its shared lifecycle. It allocates a unique Compose project and ephemeral
ports, generates synthetic account/stack secrets, bootstraps through real HTTP,
and persists fixture rows in migrated PostgreSQL. It uses no request interception,
fake browser login, backend modifications or imported production arithmetic.
The entry point archives the published API development revision into an isolated
evidence directory and adapts paths in a disposable lifecycle copy. It never
builds the shared API development checkout or includes its uncommitted files.

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
- Separate strict regression probes for closed backend #557 (linked issue
  attribution) and #559 (recorded versus estimated Work cost) now pass. Their
  historical assertion names remain; neither is a current blocker. All strict
  comparisons still block an overall pass; unrelated checks continue.

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
The timeline label assertion must pass in production before control. The mutation
must add only that named failure, and restoration must recover the identical
production failure set. Any remaining failure makes the overall command exit
nonzero. A browser crash, missing result file, or environment failure is never
a successful control or acceptance pass.

The shared lifecycle removes only its own project containers, networks and volumes,
and checks zero survivors. If Docker is unreachable before startup, no stack is
created; resource enumeration is unavailable, not a verified cleanup result.

## Owner completion, 2026-11-20

Docker preflight now succeeds. Published client development `b47f21f` was merged;
API snapshot `20fb461492e505c8b66bc588f8fbd00d4c918219` was used read-only.
The fixture supplies required batch/agent fields, probes reuse the browser's
current organization-scoped token, and locators wait for actual rendered data.
The production image is retained under an owned tag during the disposable build,
then reused without rebuilding; mutation never rebuilds the API or database.

Final project `w19o-189-c16a5c32-59442`: production/restored each have 21 passing
checks and three strict failures. Mutation adds only `PAGE_SESSION_TIMELINE`;
restoration removes that failure on unchanged persisted inputs. All 12 screenshots
per production/restored phase pass light/dark and 1280/390 overflow checks.

| Check | Expected | Actual | Tracking |
|---|---|---|---|
| Work pagination/filter/detail | HTTP-matching rows, $2.00 / 1M | Pass | #189 |
| Work GitLab href | Exact synthetic GitLab MR URL | API URL empty, link absent | #237 |
| Usage recorded total | $14.40 | Header/day $4.00; session rows/split $14.40 | #238 |
| Session step costs | Persisted cumulative $0.50/$2.00; increments $0.50/$1.50 | API cumulative $0.80/$2.00; UI increments $0.80/$1.20 | #238 |
| Session order/cache/link | Read then Test, 100%/50%, exact GitLab URL | Pass | #189 |

`scripts/verify/pages.sh` exits 1 honestly. The full client gate passes: 76 test
files / 313 tests; production build has three bundle-size/performance warnings.
Syntax checks pass. Cleanup verifies zero owned containers, networks and volumes.
Canonical evidence: `.agent-runs/W19o-pages-189/owner-completion` in the owning
client checkout. This includes SQL, HTTP, three browser phases, screenshots,
acceptance tables, gate/smoke logs and preliminary harness-failure evidence.
Screenshots are archived locally, not claimed as hosted GitHub attachments.
Product fixes belong to the user-flow/API owners; strict assertions remain intact.
