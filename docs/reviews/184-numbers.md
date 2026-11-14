# #184 numeric review (partial)

This is not full acceptance of “every displayed number”. No #464 oracle or
production calculation code supplies independent expectations. #464 has not
been independently validated here and is not accepted evidence for this PR.

## Contract

- USD uses en-US currency, 2–4 fractional digits: `$12.40`, `$0.0001`.
- Compact tokens use at most two fractional digits: `1.85M`; real zero is `0`.
- Missing/null cost is unavailable, never zero; one missing component makes a
  session/group total unavailable. Recorded costs are not model-price estimates.
- Overview rate values use one decimal percent; differences are **percentage
  points**, not percentage growth. Money differences are absolute USD. Neither
  divides by the previous period, including a previous zero.
- Usage token totals currently mean input + cached input + cache write + output;
  reasoning is displayed separately in Session steps, not added to that total.
  Whether upstream token categories overlap is not independently established.
- Browser Date is fixed to `W18_NOW` for both control and production. Timers are
  not paused (authentication/navigation must continue).

## Reproduction and evidence

Run from the issue worktree:

```sh
/Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-184.mjs
```

The runner delegates stack build, real account bootstrap/login, organization,
repository, initial price/run/PR/issue/step fixture and teardown to #183. #184
adds persisted recorded cost fixtures (null, zero, 0.0001, 12.4, 1234567.89) and
zero-token records with SQL. No success responses are mocked. Each invocation
owns an isolated Compose project and volume; it records commands and cleanup.

`numeric-fixture.sql`, `oracle.sql` and `sql.json` record actual persisted rows.
`matrix.json` is the finite executed UI figure list, with SQL expression/source,
HTTP path/value, expected/actual text and browser locator. `api-responses.json`
records real numeric HTTP bodies, excluding authentication tokens. The SQL
oracle reads rows directly; token addition and formatting are local test code,
never imported from application calculations. Session headline and Usage verify
recorded costs. The single timeline step independently prices its token counters
using the historical fixture rates in SQL and also asserts the literal `$5.40`
(1.8M input × $3/M). This is not a general model-billing oracle.

An intermediate run incorrectly treated the persisted timeline cumulative
column ($2.6475) as the response contract. The API instead returns a historical
price calculation ($5.40). The harness was corrected to independent SQL pricing;
the earlier failure is retained under `attempt-2`, not reported as a backend bug.
The backend implementation was inspected to identify that contract difference,
not imported or executed as the oracle.

The disposable control worktree changes only the shared USD formatter to
double non-null values. Same database, URL, account, selected session and frozen
time are used before rebuilding the production client. The runner requires a
failure naming `Session headline recorded cost`, not any nonzero exit. A timeout
or crash is a harness failure, not an accepted control. The worktree is removed
in `finally`; the production client is rebuilt against the unchanged database.

Screenshots in the ignored evidence folder are **local-only**, not attached
GitHub images. They require visual inspection; viewport assertions alone do
not prove correct layout.

## Finite coverage inventory

The following inventory describes implemented checks, not automatic acceptance.
`comparisons.json` also retains SQL/API and cardinality checks; `failures.json`
is the named aggregate. Each family catches infrastructure errors as failures,
not success. A mismatch does not prevent later independent figures from running.
`node --test scripts/review-184-results.test.mjs` specifically proves that the
known Work issue #10 expectation **2**, actual **0**, cannot return success and
that subsequent figures/families execute. No mismatch is filtered or downgraded.

| Surface / figure family | SQL/API/UI oracle implemented | Remaining scope |
| --- | --- | --- |
| Session headline recorded USD | One run and a two-run persisted session | Unknown multi-run cost has focused tests, not its own browser session |
| Session step USD | Original literal $5.40 plus four steps, independent historical token rates and cumulative deltas | One historical price/version only; no price-revision selection coverage |
| Session run count, linked MR numbers | Two-run count and both linked MR numbers | Other relation sources not covered |
| Session sequence, five token categories, cache trend percent/fraction | Four persisted steps: miss, hit, miss, hit; 0%, 50%, 33%, 50% | All-zero token step covered; relative time checked on original step only; missing-cache/zero-denominator browser trend blocked by DB NOT NULL cache_hit |
| Usage session cost and four-category token total | Every returned session, including two-run grouping | SQL/API includes reasoning, excluded from Usage UI total by contract |
| Usage headline/day/model/tool/repository splits, MR rankings, savings | Independent persisted run arithmetic and seed-rate persistence checks; top recorded MR groups and unknown exclusion | One repository, two tools, fewer than five rankable groups; no ties or multiple prices |
| Work total/range/page count, numbers/ages and per-row sessions/costs | All 360 records over every page; strict persisted linkage, including #557 | Attribution discrepancy is not accepted |
| Work header and details | Page CI counts and priced subtotal; all linked records opened; returned detail run costs/tokens | Missing issue-linked runs remain failures; no backend attribution decision |
| Overview headline spend/savings, spend/cost-per-merged-PR/cache-rate cards, deltas, daily | Independent persisted token counters, merge dates and historical seed rates; current and previous periods | Monetary deltas are intentionally suppressed by partial pricing in this browser fixture; zero previous value remains focused-test evidence only |
| Overview rework card/delta | No independent definition established | Not covered; do not infer a zero expectation from API/production implementation |
| Overview checklist, attention counts/PR numbers and date labels | No | Not covered |
| Zero/null/small/large USD and compact values | Focused literal-expectation tests plus persisted Usage fixture | Not every figure family receives every boundary |

Second-run fixture additions preserve the #557 linked-session expectation and
its API/UI zero. Two existing priced runs with different tools share `review-multi-run`; four steps
are persisted on one of them. Three previously unpriced-model runs receive
recorded costs (0, 0.0002, 5), independently of their still-missing model prices,
so positive MR ranking and the difference between recorded and model-priced
spend can be measured. This changes the fixture from run one; only comparisons
between control and production **within run two** use identical inputs.
`numeric-inputs.json` records the shared fixed time and selected IDs. Price
tables are discovered through PostgreSQL metadata and included in `sql.json`;
the literal historical rates must match persisted values before arithmetic.
Repository monetary grouping uses SQL repository IDs; repository display names
come from the real selector and are not independently SQL-verified.

The first invocation in run two failed at fixture setup: the database enforces
unique `(repository_id, harness, session_id)`. No browser acceptance is claimed
for that attempt. The corrected fixture uses Claude and Codex for the two runs;
it does not drop or weaken the constraint. Its log is retained as
`r2/fixture-setup-failure.log`.
The next setup attempt established that `agent_run_steps.cache_hit` is NOT NULL;
its failure is retained as `r2/cache-null-setup-failure.log`. The valid persisted
fixture uses false/true/false/true. Missing-cache and zero-observation trends
cannot be exercised through this schema, so they remain uncovered in the real
browser. No constraint was weakened or mock substituted to claim that coverage.

The first extended control reached later Work navigation but was **not accepted
as a completed mutation control**: waiting only on network-idle could read stale
page data before React issued the next request, leading to locator failures and
an eventual closed browser. Its matrix is archived under
`r2/control-navigation-failure/`. The runner now waits for the actual detail/page
HTTP response and the next page's first record before comparing figures.

That attempt also exposed a small verified client defect: Overview rendered
separate tool buckets as duplicate day labels, rather than a single daily
subtotal. `DailySpend.test.tsx` independently asserts $1.25 + $2.50 = $3.75 with
one day label, and distinguishes all-unpriced from real-zero days. Both tests
failed on the original component (`r2/daily-before.log`); the component now
aggregates UTC-day buckets and retains partial-price disclosure. This is not a
backend or pricing-recovery change. The aggregate oracle also preserves a null
API bucket cost when that bucket contains **only** unpriced models; a zero
token-priced expectation would incorrectly erase missing-price semantics.

## Regression evidence

### Final second-run results

The final real-stack invocation completed both the formatter control and the
restored production browser matrix against the **same** persisted database and
fixed time. Each executed **1,578 UI figures** and **3,566 total comparisons**
(UI figures are included in that total, not additional). Production recorded
**1,547 matching UI figures**, **3,497 matching total comparisons** and **69
named failures**, all in Work linkage/cost families. There were no final family
execution/locator failures. All 360 Work records across eight pages were
visited; linked Work details were opened even after issue #10 failed.

The strict #557 expectation remains 2 persisted issue-linked runs versus API/UI
0. The expanded matrix additionally measured Work's substitution of calculated
costs for recorded telemetry, filed as
[agent-ops#559](https://github.com/0Hoag/agent-ops/issues/559): persisted and
`/agent-runs` recorded cost 12.4 versus Work detail HTTP cost 6.1125 and UI
`$6.1125 USD · 3.03M tokens` (expected `$12.40 USD · 3.03M tokens`). Missing
price also replaces valid zero/small recorded Work costs with null. Neither
backend behavior was changed or copied into the independent expectations.
These are comparison counts, **not** a claim of 69 distinct defects.

The formatter control retained 98 failures and explicitly named
`Session headline recorded cost`: expected `$12.40 · USD`, actual
`$24.80 · USD`; the restored client's identical figure passes. Both matrices
reach all eight Work pages. `control-result.txt` and the control/production
matrices record the full result, not merely an arbitrary nonzero exit.

Final gate: 70 test files / 291 tests passed; typecheck, lint and heavy-wrapped
build passed (three bundle-size warnings). The earlier second-run gate preceded
the verified daily subtotal fix and is **not** final-tree evidence. The final
gate is `r2/final-gate.log`; focused daily tests show 2 failures before and
2 passes after. Aggregator tests: 2 passed. `r2/run.log` exits 1 honestly;
Compose cleanup reports zero owned containers, networks and volumes.

Final screenshots for Overview, Usage, Work, one-run Session and multi-run
Session were captured at 1280/390 and inspected locally. No document horizontal
overflow was observed by the viewport assertions. Overview now shows one Nov 10
subtotal; large Usage money wraps inside its mobile cell; Work remains a very
long mobile card list. Visual inspection does not cover every row of that long
image. All images are **local-only**, not GitHub attachments. API revision:
`4be317a604bea6549ca160ae14aa580eeee6a0d5`; external backend modifications already
present in its status were left untouched.

Acceptance remains incomplete: #557, #559, the explicitly uncovered inventory
above, and `uncovered.json` prevent an exhaustive “every number” claim. No third
implementation run or promotion is requested by this delivery.

Focused tests were run before the fixes, then after:

- Overview null/current/previous handling and percentage-point labeling:
  `unit-before.log` (2 failures), `unit-after.log` (12 passes).
- Session and Usage null totals: `null-before.log` (2 failures), followed by
  the separated module-local tests in `focused-after.log`.
- Usage cache savings: correcting the test fixture to the real overview
  envelope failed the existing numeric assertion in `usage-envelope-before.log`.
  The service now unwraps the envelope without changing generated API code.

Final command outcomes, smoke, mutation result and uncovered acceptance belong
in the PR evidence. Intermediate failed runs are not acceptance evidence.

The real Work run exposed an unresolved attribution discrepancy:
[agent-ops#557](https://github.com/0Hoag/agent-ops/issues/557). Two persisted runs
link to issue #10 and PR #10; Work's `Sessions` cell for the issue displays `0`.
The independent linked-session expectation is `2`. Backend code intentionally
excludes PR-linked runs from issue attribution, but that narrower meaning is
not conveyed by the UI. This requires a contract decision, not copying the
backend rule into the oracle. The strict failing check stays in the harness;
the real-stack command is **not passing** and #184 is not fully accepted.

## Artifact ownership and cleanup

Archive ignored evidence to
`/Users/zeross/agent-ops-client/.agent-runs/W18R9-numbers-184/` before cleanup.
Inherited tracked `.agent-runs` artifacts must stay untouched. The canonical
worktree safety script may refuse removal because those artifacts exist or the
issue branch is unmerged; do not override that refusal.
