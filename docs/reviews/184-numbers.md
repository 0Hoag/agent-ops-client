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
`matrix.json` is the finite executed figure list, with SQL expression/source,
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

| Surface / figure family | SQL/API/UI oracle implemented | Other evidence / remaining scope |
| --- | --- | --- |
| Session headline recorded USD | Yes: persisted selected run cost | One-run session only; multi-run aggregation has focused tests |
| Session first step USD | Independent SQL pricing and literal $5.40, then first cumulative cost minus zero | One historical price/version only |
| Session run count, linked MR numbers | No | Not covered |
| Session step sequence, five token categories, trend percent/fraction, relative time | Five counters, timestamp and cache boolean checked SQL/API; five formatted counters, 100% (1/1) and 2 hours ago checked in UI | Multi-step, missing-cache and zero-denominator trends not covered |
| Usage session cost and four-category token total | Every returned fixture row | SQL/API checks include reasoning, which is excluded from UI total |
| Usage headline/day/model/tool/repository splits, MR rankings, savings | No | Not covered by independent arithmetic SQL oracle |
| Work total/range and per-row session counts | First page, direct persisted row counts | Later pages, per-row costs, header sums, detail costs/tokens and ages not covered |
| Overview headline spend/savings, metric values, deltas, daily spend | No | Null, zero and absolute-rate-delta focused tests only |
| Overview checklist, attention counts/PR numbers and date labels | No | Not covered |
| Zero/null/small/large USD and compact values | Focused literal-expectation tests plus persisted Usage fixture | Not every figure family receives every boundary |

## Regression evidence

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

## Artifact ownership and cleanup

Archive ignored evidence to
`/Users/zeross/agent-ops-client/.agent-runs/W18R9-numbers-184/` before cleanup.
Inherited tracked `.agent-runs` artifacts must stay untouched. The canonical
worktree safety script may refuse removal because those artifacts exist or the
issue branch is unmerged; do not override that refusal.
