# Settings workflow verification

## Gate commands + output

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Exit 0, run once before delivery. [Full output](gate.log): 70 test files, 286 tests
passed; Rspack compiled with three size/performance warnings. Existing test stderr
includes React Router notices, unavailable-query warnings and jsdom network errors;
these were not hidden or changed. The real browser reports zero page errors.

`bash -n scripts/verify/{settings,auth}.sh`, `node --check` for the five runner/browser
helpers, `jq empty` for generated Compose/evidence JSON, and `git diff --check` all
exit 0. The runner checks Docker first (server 29.2.0), validates the generated shell
fixture and Compose JSON, and uses the canonical heavy lock for Compose, builds and
browser work.

## Smoke/test result

`scripts/verify/settings.sh` exits 0 on fresh project `w19p-settings-190-52397`.
Production and restored production each pass 34 browser matrix rows, including 24
screenshots. [Complete acceptance/command/expected/actual table](matrix.md),
[production](production.json), [restored](restored.json), [stdout summary](smoke.log).
The final restored run observes 144 real API responses and three worker websocket
frames, with no main-page runtime errors or failed API requests. A separate real
invalid-token upgrade returns 401, as required.

| Acceptance | Command / UI action | Expected | Actual |
| --- | --- | --- | --- |
| Repository test/create/sync | Settings form, test, create, reload, sync, select repository in Work | HTTP 200/201/200, success timestamp and synced task | Passed; SQL synced task count 1 |
| Agent command | Select repository/transcript, Copy command, read clipboard | Independently constructed exact command, correct endpoint and quoting | Passed |
| Model price / cost | Create $2 input/$5 output version, reload, select dedicated repository in Overview | 1M input + 100K output = price-derived $2.50 | HTTP, rendered summary and persisted SQL agree |
| Invite member | Create viewer invitation, separate synthetic account signs in and accepts, owner reloads | HTTP 201; named viewer membership | Passed; SQL viewer count 1 |
| Budgets | Create all-repository 2M-token/$25 dated budget; reload | Same persisted limits | Passed; SQL budget count 1 |
| Alerts | Save .75/600/7200 thresholds and synthetic Slack environment reference; reload | Persisted threshold and enabled channel | Passed; no delivery claimed |
| Live logs | Registered Advanced link, start allowlisted fixture process | Two stdout lines and worker.completed via actual websocket | Three frames and rendered lines/completion; invalid token still 401 |
| Cleanup | Owned-project down, labelled resource enumeration, provider termination | Zero owned survivors | Zero containers/networks/volumes/provider processes |

[Persisted oracle output](persisted.json): price 2.5, synced issue 1, budget 1,
invited viewer 1. [Provider log](provider.log) records the real upstream HTTP calls
for all three phases. [Sources](sources.json) pins client/API revisions, tested source
hashes and isolated ports. The tested tree was the pending implementation on top of
development `de8544f31e6091983b743fdd578bbcb38eaa1d28`; evidence-only files were added
after the gate. All browser authentication goes through the registered login UI.

| Production panel | 1280 light | 1280 dark | 390 light | 390 dark |
| --- | --- | --- | --- | --- |
| Repositories | [PNG](repositories-1280-light.png) | [PNG](repositories-1280-dark.png) | [PNG](repositories-390-light.png) | [PNG](repositories-390-dark.png) |
| Model prices | [PNG](prices-1280-light.png) | [PNG](prices-1280-dark.png) | [PNG](prices-390-light.png) | [PNG](prices-390-dark.png) |
| Priced Overview | [PNG](priced-overview-1280-light.png) | [PNG](priced-overview-1280-dark.png) | [PNG](priced-overview-390-light.png) | [PNG](priced-overview-390-dark.png) |
| Budgets | [PNG](budgets-1280-light.png) | [PNG](budgets-1280-dark.png) | [PNG](budgets-390-light.png) | [PNG](budgets-390-dark.png) |
| Alerts | [PNG](alerts-1280-light.png) | [PNG](alerts-1280-dark.png) | [PNG](alerts-390-light.png) | [PNG](alerts-390-dark.png) |
| Logs | [PNG](logs-1280-light.png) | [PNG](logs-1280-dark.png) | [PNG](logs-390-light.png) | [PNG](logs-390-dark.png) |

Measured fixes: #226 missing repository controls, #227 all-repository budget scope,
#228 production websocket authentication seam. Focused regressions each failed
before and passed after their fix; before/after logs are included in this directory.

## Failing control with identical inputs

The disposable compiled client changes only `navigator.clipboard.writeText(command)`
to write `broken-command`. Same account, organization, repository IDs, transcript,
browser command, server and database snapshot. The SHA-256 in [snapshot.sha256](snapshot.sha256)
is printed identically before all three phases. The mutation browser exits 1 at
`SETTINGS_CLIPBOARD_EXACT_COMMAND`, actual `broken-command`, expected the complete
independently constructed command. [Observed failure](mutation.json).

Restoring and recompiling that disposable source passes all 34 browser rows and
the SQL oracle again. Backend and fixture images are reused. No mutation touches
the implementation checkout, and no imported production arithmetic serves as oracle.

## Not covered

- External GitHub/GitLab access, pagination/outages, external agent behavior, CLI
  ingestion execution, worktree provisioning and notification delivery are not
  claimed. The provider and process are explicit deterministic fixture boundaries.
- Price-derived Overview spend is not recorded cost. Cache/reasoning overlap,
  subscription billing, historical boundaries, Work attribution and backend
  #557/#559 remain outside this unaffected pricing case; their oracles are unchanged.
- Audit history visibly renders missing-field fallbacks after an accepted start:
  filed as #229, left for separate client/API seam triage. Audit-field semantics,
  worker stop/restart and automatic state refresh are not asserted here.
- Screenshots assert document overflow, not exhaustive nested overflow, visual
  contrast or accessibility. Production CSS theme tokens are selected directly
  for screenshots; no registered production theme switch is claimed.
- The merged auth lifecycle is reused, but its full separate auth.sh suite was not
  rerun. Settings performs real sign-in, organization selection and separate-invitee
  authentication itself. No backend, snapshots, credential values, CI, STATUS or
  unrelated branch changes were made.
- Full ignored evidence, including unsuccessful exploratory runs, is archived under
  `/Users/zeross/agent-ops-client/.agent-runs/W19p-settings-190`. Curated public files
  omit database dumps and access credentials. Build/test warnings remain visible.
