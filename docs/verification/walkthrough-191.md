# Owner walkthrough #191

## Execution contract

Run `bash scripts/verify/walkthrough-191.sh --preflight` from the client root.
The wrapper owns the heavy lock; do not wrap it in another `heavy.sh`.
Run without `--preflight` for the guided, headed production-browser checklist.
This is an observation tool, not a numeric oracle or a passing acceptance test.

Set `WALKTHROUGH_BACKEND` to a clean detached copy of the published API
development revision, then run `bash scripts/verify/walkthrough-191.sh --isolated`.
Never point it at a concurrently edited backend checkout. For example, clone
the local API repository with `git clone --shared --no-checkout`, verify the
published SHA with `git ls-remote origin refs/heads/reviews/development`, and
check out that exact SHA detached in the copy. This excludes unpublished edits
and local environment files without changing the shared fixture helpers.
The isolated mode provides a
scripted-worker observation. This owns a fresh uniquely named Compose project,
ephemeral ports and synthetic local bootstrap account, reuses the committed
`auth-fixture.mjs` unchanged, and tears down only its own project on normal exit
or SIGINT/SIGTERM. Evidence is copied to the canonical archive before teardown;
container, network and volume label queries must return zero survivors.
No pre-existing account credentials or shared listeners are used.

The isolated mode uses real headless Chromium and the production Docker client,
not mocked HTTP, injected authentication or a replacement UI. It signs in and
selects the synthetic organization through the UI. The timed segment begins once
Overview metrics load; it clicks the 7-day preset, reads the visible metrics,
then toggles each attention category. It records actual DOM click events and
screenshots per question at 1280px, plus one 390px screenshot/overflow observation.
Timing is scripted browser execution, **not manual owner deliberation time**.
Text capture does not automatically validate an answer: the worker must interpret
it against persisted SQL and real HTTP and report unavailable answers as failures.

Isolated fixture scope: organization A has the existing synthetic unpriced session
without an MR and task #188, plus four priced sessions (1, 2, 8 and 9 days ago),
four MRs (three merged, one open) and three failed pipeline attempts for MR #2.
Organization B is the existing fixture's tenant-isolation control. All five A
runs have persisted recorded `cost_usd = NULL`, not zero. Independent estimates
using the separately reported counters are `1M * $3/M + 0.5M * $0.30/M
+ 0.1M * $15/M = $4.65` per current priced run, and `$4.53` per previous run.
The missing-price model remains missing: no price recovery or product semantics
are changed. `fixture.sql`, `persisted.txt`, `fixture.json`, `sources.json`,
`http.json`, `results.json` and screenshots preserve provenance and observations.

Before a browser run, the operator must provision a fresh isolated production stack
using the committed sanctioned setup, synthetic local account and persisted fixture.
`scripts/verify/auth-stack.mjs` and `auth-fixture.mjs` were inspected read-only;
the stack helper is a standalone authentication verifier, not an exported stack API.
It cannot hand a running stack to the headed checklist. The isolated mode owns
its lifecycle separately and imports only the committed fixture. No helper was changed.
Do not run the checklist against a shared or replacement product.

Supply `PRODUCT_E2E_URL` and `WALKTHROUGH_FIXTURE` (a JSON evidence file).
Fixture evidence must identify stack project, unique ports, client/API revisions,
organization/repository scope, persisted issues/MRs/runs, SQL results and real HTTP
responses. Record costs and token-price estimates separately. Include prior/current
week runs and merged MRs, failed CI/review, sessions without MRs and missing prices.
No company GitLab reconciliation (#527) or transcript reconciliation (#528) is implied.
The stack owner must archive evidence before teardown, remove only its own resources,
and verify zero containers, networks and volumes by its unique Compose project label
on success, failure and signals. The checklist creates no Docker resources.

## Timed checklist

1. Log in through the real UI; select the fixture organization; start on Overview `/`.
   Authentication/setup is outside the timed segment; do not inject storage or tokens.
2. Answer **What did AI cost this week?** Identify the visible period and whether the
   amount is recorded or estimated. Do not silently call a rolling seven days a calendar week.
3. Answer **Is it getting more efficient?** Record visible comparative evidence, not
   an inference from a lone total. Usage resolves to `/usage`; `/runs` and `/insights`
   redirect there. Navigate with the UI, not address-bar shortcuts.
4. Answer **What needs attention?** Record actionable items visible on Overview,
   Work (`/work`) or Usage. Do not infer absent evidence from fixtures.
5. For each answer the tool counts UI click events, times until the worker submits
   the answer and captures a screenshot. Keyboard navigation must be disclosed in the
   answer; no keyboard shortcuts to bypass the three-click target. Combined time
   includes transitions and screenshot overhead, excludes the subsequent comparison.
   More than three clicks, NOT FOUND or combined time >=300 seconds is a failure.
6. Compare each visible value with archived persisted SQL and captured real HTTP.
   Record exact values and differences. Root agent-ops#557 and #559 are now closed;
   their historical discrepancies below are not current blockers or current proof.
   Preserve their strict semantics and reuse matching follow-ups rather than creating
   duplicates. An answer is not validated merely by being visible.
7. File only distinct measured defects, with command, expected/actual, screenshots,
   `found-by:agent`, `wave:W21`, `area:client`, priority/status and type labels.

## First run: blocked, not accepted

Identity: origin `git@github.com:0Hoag/agent-ops-client.git`, branch
`verify/w21c-walkthrough-191`, starting HEAD `cee0f19ee329f1c8c2450ce83d279d60738ce1f8`.
Docker preflight failed: socket `/Users/zeross/.docker/run/docker.sock` does not exist.
No credentials were edited, no stack was created, and there are no owned resources
to remove. Strict error evidence is archived under the canonical client repository
`.agent-runs/W21c-walkthrough-191/`.

No question was timed or answered, no clicks measured, no screenshots captured,
no SQL/HTTP comparison executed and no UX defect established. These are blocked
acceptance, not exemptions. The headed checklist and stack handoff remain unverified.
No product assertion was added; no identical-input mutation control was executed.
Manual timing and screenshot observations are not mutation proof.

## Second-run preparation and strict harness failure

Starting client HEAD `2d2c8958634175a8890cf1e8240ddcd1ea022086` was clean;
origin is `0Hoag/agent-ops-client`, branch `verify/w21c-walkthrough-191`.
`git fetch origin reviews/development` followed by `git merge
origin/reviews/development` reported already up to date (no force push).
Docker preflight now succeeds: server 29.2.0. The first isolated attempt created
project `w21c-walkthrough-191-87406`, bootstrapped the synthetic account and
persisted the fixture. It exited 1 before any browser observation because this
new harness incorrectly queried a nonexistent `agent_run_prices` table.
That is a harness defect, not a measured product or environment defect.
The bad query was removed; the existing sanctioned price endpoint response is
now saved directly as `price-http.json`, without guessing database price tables.
The failed attempt and full SQL output remain archived, not overwritten.
Cleanup removed the owned project and all three label-filtered resource queries
returned empty, exit 0. No credentials were changed to work around a refusal.

The full required client gate was executed once for this implementation run:
`pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test &&
/Users/zeross/agent-ops/scripts/heavy.sh pnpm build` exited 0: 71 test files,
290 tests passed; Rspack compiled with three existing bundle-size warnings.
React Router future warnings and jsdom AggregateError stderr were retained.
Output: canonical archive `gate-run2.log`; syntax/diff checks: `targeted-run2.log`.

## Second-run browser observations — acceptance not passed

Command: `bash scripts/verify/walkthrough-191.sh --isolated`, exit 0 means
observation completed, **not** product acceptance. Project
`w21c-walkthrough-191-88840`, unique ports 55745/55746/55747; client UI HEAD
`2d2c8958634175a8890cf1e8240ddcd1ea022086`, API
`77704cb14169a2a8da7e32c4765b27a6904a3971`.
Evidence: `/Users/zeross/agent-ops-client/.agent-runs/W21c-walkthrough-191/1794809495418-isolated/`.
The backend and production client sources were not changed.

| Question | Actual visible answer | Clicks | Scripted seconds | Assessment |
| --- | --- | ---: | ---: | --- |
| AI cost this week? | $9.30 priced subtotal, Partial spend; excludes auth-fixture; $2.70 saved with cache | 1 | 0.032507 | Full weekly answer unavailable: partial estimate over rolling Nov 10–16, not calendar week or recorded spend. Measured incomplete answer, not an exemption. |
| Getting more efficient? | Cache hit 33.3%, +24.2% vs previous period; rework 0.0%, unchanged; cost/MR $9.30 Partial with warning not to compare before setting prices | 0 | 0.001832 | Cache utilization improved by 24.2 percentage points; no complete cost-efficiency verdict. |
| Needs attention? | Nothing needs attention | 0 | 0.002371 | Failed: same page explicitly identifies an unpriced model and incomplete pricing setup. |

Combined browser segment including screenshots: **0.231715 seconds**. These are
scripted extraction times, not measured human reading/answer formulation. Each
path used at most three actual click events, no keyboard shortcuts or URL jumps.
This does not certify a manual owner walkthrough under five minutes. Screenshots
`question-{1,2,3}-1280.png` capture each answer; `overview-390.png` shows mobile,
with observed horizontal overflow false. Files are local archived evidence, not
hosted GitHub attachments. All three desktop captures were inspected by the worker.

### Independent persisted / HTTP / visible comparison

- SQL `persisted.txt`: 5 A runs, 4 MRs (1/8/9 merged, 2 open), task #188,
  3 failed pipeline attempts for PR #2. Runs 1/2 fall on Nov 15/14; runs 8/9
  Nov 8/7; unlinked `auth-A` Nov 16 has 100 input tokens and no configured price.
  All recorded costs are NULL. The executed harness initially sent a `cost_usd`
  field that the create contract does not support; persistence did not record it.
  Removed that unsupported field after observation; no recorded-cost fixture or
  recorded-versus-estimated reconciliation is claimed. This one-field harness
  cleanup is syntax-checked, not another executed browser run.
- Real GET `/agent-run-prices` returns configured rates 3 input, 0.3 cached input,
  15 output USD/million. No production arithmetic was imported. Separate persisted
  counters give $4.65 per current priced session ($9.30 subtotal), $4.53 per prior
  session ($9.06 subtotal). Recorded spend remains unavailable, not $9.30.
- GET `/overview?from=2026-11-10&to=2026-11-16`: current spend 9.3, previous
  9.059999999999999; 3/2 runs; 1/2 merged MRs; current cost/MR 9.3, previous
  4.529999999999999. UI $9.30 matches the estimated priced subtotal, not a complete
  or recorded total. Daily HTTP buckets 4.65, 4.65, null match Nov 14/15/16 labels.
- Independently `1000000 / (2000100 + 1000000) = 0.3333222226` current cache
  ratio; prior `200000 / (2000000 + 200000) = 0.0909090909`; delta 24.2413
  percentage points. HTTP agrees; UI 33.3% / +24.2% uses rounded values. Cache
  savings `1000000 * (3 - 0.3) / 1000000 = $2.70` matches HTTP and UI.
- SQL has no repeat sessions for a PR, consistent with HTTP/UI rework 0. The
  3 failed CI attempts are only 1–3 hours old; **do not** claim they meet the
  endpoint's 24-hour failing-CI attention rule. Unlinked session is also too recent
  for its 24-hour rule. Missing model price has no such age exemption.
- HTTP `models_without_price=["auth-fixture"]`, GET `/agent-run-prices/missing`
  reports that model with 1 run/100 tokens, while `/overview.attention=[]` and UI
  says “Nothing needs attention.” This is the distinct measured UX failure.
  Filed as [client #233](https://github.com/0Hoag/agent-ops-client/issues/233)
  with exact command, expected/actual, evidence and required W21 defect labels.
- Root `0Hoag/agent-ops#557` linked-session attribution and `#559` recorded versus
  estimated cost-source discrepancies remain unresolved, unchanged and not
  duplicated. Work detail was not exercised here; NULL recorded costs cannot
  prove either root issue fixed or reproduce #559's non-null recorded fixture.

Cleanup archived evidence before deleting the stack; owned containers, networks
and volumes each returned zero survivors (exit 0). No source mutation was run;
no product assertion was introduced. Manual observations are not mutation proof.

## Owner-authorized completion — 2026-11-20 (final run)

This section supersedes historical acceptance and blocker statements above.
Starting published head was `b4ac39a4f1f522483ca640e724c278ebb9a6be2f`.
Fetched and merged published client development
`b47f21f84220bf7bf605024609101902e2b21f59` without force-pushing, preserving
inherited tracked artifacts. Tested UI merge head:
`8b99695a78d3ec43cf147d27bd635e5b2c0eb9fe`; the only uncommitted executable
change at observation was the walkthrough backend-path configuration.

The API was a fresh local shared clone, detached at published development
`20fb461492e505c8b66bc588f8fbd00d4c918219`, verified with `git ls-remote`.
No dirty or concurrent backend source, local environment files or shared listeners
were consumed. No shared fixture, production UI, API, contract or CI was edited.
The required root `docs/ux-principles.md` does not exist in this client checkout;
the original brief's `/Users/zeross/agent-ops/docs/ux-principles.md` was read instead.

### Commands and current results

```sh
WALKTHROUGH_BACKEND="$PWD/.agent-runs/W21c-walkthrough-191/owner-completion/backend" \
  bash scripts/verify/walkthrough-191.sh --isolated
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && \
  /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Each command ran once and exited 0. The wrapper owns the browser/Compose heavy
lock; it was not nested. Gate: **76 test files, 313 tests passed**, Rspack compiled
with 3 bundle-size warnings in 496 ms. Existing test stderr remains in `gate.log`.

Fresh project `w21c-walkthrough-191-97212`, API/client/Postgres ports
50370/50371/50372. Real Chromium signed in and selected synthetic organization A
through the UI; the unchanged sanctioned fixture also verified B isolation.
SQL persisted five A sessions, four MRs, issue #188 and three recent failed CI
attempts. All recorded costs remain NULL. No unsupported cost field was sent.

| Question | Visible answer | Clicks | Scripted seconds | Strict assessment |
| --- | --- | ---: | ---: | --- |
| AI cost this week? | $9.30 priced subtotal, Partial spend; auth-fixture excluded; $2.70 cache savings | 1 | 0.033981458 | FAIL: complete weekly/recorded spend unavailable; rolling Nov 14–20 is not a calendar week. |
| Getting more efficient? | Cache 33.3%, +24.2 percentage points; rework 0%, unchanged; partial cost/MR $9.30 | 0 | 0.001550125 | Cache improved; FAIL for complete cost-efficiency answer, explicitly suppressed until prices are complete. |
| Needs attention? | 1 missing model price; model auth-fixture and Set model prices visible before the category toggle | 1 | 0.032082791 | Available and consistent with SQL/HTTP. #233 is closed by #234 and does not reproduce. |

Combined **0.250615083 seconds** includes screenshot overhead. All paths were
within three clicks and the automated segment below 300 seconds, but these are
**not human reading/answer-formulation measurements**. Overall acceptance remains
**measured-answer-failure**, not a passing exemption. The observer's exit 0 means
capture completed, not that unavailable answers passed.

Independent comparison uses persisted counters and configured rate HTTP, not
production arithmetic: each current priced session costs
`1M*3/M + 0.5M*0.3/M + 0.1M*15/M = $4.65`; previous sessions cost $4.53 each.
SQL dates Nov 18/19 versus Nov 11/12 yield current/previous priced subtotals
$9.30/$9.06, one/two merged MRs and $9.30/$4.53 estimated cost per merged MR.
These match real `/overview` HTTP; full monetary comparisons are not visible.
Current cache `1M/3.0001M = 33.3322%`, prior `0.2M/2.2M = 9.0909%`, delta
24.2413 percentage points and savings `1M*(3-0.3)/M = $2.70` agree with HTTP/UI.
No repeat sessions matches rework 0. No recorded-cost reconciliation is claimed.
Recent failing CI and the unlinked session are below the 24-hour attention rules.
HTTP reports `models_without_price=["auth-fixture"]`, missing-price HTTP reports
one run/100 tokens, and the UI now supplies the matching action even though API
`attention=[]`. The category starts expanded; the observer toggles it closed for
question 3. The model/action are captured in question 1/2 screenshots, not the
collapsed question 3 screenshot. No claim of following that action is made.

All four 1280/390 screenshots were inspected; mobile horizontal overflow was
false. Canonical evidence (commands, SQL, HTTP, results, screenshots, review):
`/Users/zeross/agent-ops-client/.agent-runs/W21c-walkthrough-191/owner-completion/`.
The original `1795172212143-isolated` archive and all historical archives remain.
Teardown and three label-filtered queries verified **zero owned containers,
networks and volumes**. Worktree-removal outcome is recorded in the PR.

### Remaining acceptance and controls

No product assertion was added and no disposable identical-input production
mutation was executed. Screenshots, timing and historical SQL harness failure
are not failing controls. Human timing, mobile interaction, dark theme, hosted
screenshot attachments and a named mutation/restoration pair are tracked in
[#239](https://github.com/0Hoag/agent-ops-client/issues/239). Fully priced monetary
period comparisons reuse [#235](https://github.com/0Hoag/agent-ops-client/issues/235).
Recorded-cost follow-up [#238](https://github.com/0Hoag/agent-ops-client/issues/238)
was not exercised with this NULL-cost fixture; #236/#237 do not match this path.
Root #557/#559 are closed, not current blockers; their fixes are not independently
certified here. No real company reconciliation (owner-dropped), backend/UI fixes,
extra run, merge or promotion is included. Per the final owner decision the green
gate permits readiness with these gaps tracked; exact-head CI is for the
coordinator to check, not a worker wait or a merge authorization.
