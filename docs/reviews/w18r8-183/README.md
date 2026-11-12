# W18R8: real-browser UX review (#183)

**Result: review completed, product not all-pass.** Two small defects fixed; seven larger findings filed (#193–#199). This is not a fixture-only green report.

## Method and provenance

- Verified before edits: remote `0Hoag/agent-ops-client`, branch `review/w18r8-browser`, clean HEAD `6bf1525350b9976432d04ed259a4b0b2c791ac14`.
- Standards: API checkout `docs/ux-principles.md` and `docs/client-standards.md`.
- API checkout read-only, revision `c8c16767b08d4cec843bb0dd91ccbc09a1330219`; pre-existing status is recorded in [sources.json](sources.json). No backend, launcher or shared-script changes.
- Existing `package.json`, `scripts/product-e2e.*`, `scripts/qa-w18*`, and documented `compose.prod.yml` informed the lifecycle. Root `playwright.config.ts` does not exist; no replacement credential scheme was invented.
- Unique Compose project `w18r8-183-53809`, ephemeral loopback ports, fresh owned database. Account/organization/repository bootstrapped through supported commands/APIs with generated disposable secrets.
- Persisted seed: **320 MRs, 40 issues, 320 CI results, 20 sessions over ten days**, paired priced/unpriced models. Prices and sessions use the real API; MR/issue/CI records use SQL only in this owned database. No owner records or external-provider credentials.
- Actual Chromium login/organization selection; no intercepted routes, mocked responses, or injected browser authentication. Themes use the application's `data-theme` mechanism.
- **20 page/destination entries × two widths × two themes = 80 screenshots per phase.** Full-page PNGs have viewport widths 1280/390 and initial viewport height 844. All 80 original captures were visually inspected, with matrix text supplementing downscaled tall images.
- [matrix.json](matrix.json) contains the final DOM text, controls, page headings, resolved paths and overflow measurements. [api-responses.json](api-responses.json) contains actual synthetic-data API responses. [source-hashes.json](source-hashes.json) identifies reviewed files.

## Per-page / per-rule checklist

`P` = pass in the observed state; `F` = measured/visible failure, linked below; `—` = not applicable to that captured state, **not** an untested-state pass. UUID/ISO/Unknown checks concern visible main content; command UUIDs are included. Theme/layout judgments include both themes. Filters apply only where the page exposes filtering/configuration choices.

Columns: **Nav** four-item/Advanced placement; **Answer** useful opening sentence/number; **IDs** no raw UUID; **Time** no raw ISO; **Words** plain language; **Filter** appropriate selects/presets/no ID input; **Known** no “Unknown”; **Empty** observed empty state has next action; **Action** clear primary action; **Calm** useful layout/themes; **Width** no horizontal scroll; **Numbers** observed arithmetic/identity (not a full #184 audit).

| Page | Nav | Answer | IDs | Time | Words | Filter | Known | Empty | Action | Calm | Width | Numbers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Overview | P | F | P | P | P | F | P | — | P | F | P | F |
| Getting started anchor | P | F | P | P | P | F | P | — | P | F | P | F |
| Work | P | F | P | P | F | P | P | — | P | F | P | P |
| Work detail | P | F | P | P | F | P | P | — | P | F | P | F |
| Usage | P | P | P | P | P | P | P | F | F | F | P | P |
| Session detail | P | P | P | P | F | — | P | — | P | P | P | P |
| Settings / Repositories | P | P | P | P | F | P | P | — | F | F | P | — |
| Settings / Agent setup | P | F | F | P | P | P | P | — | F | P | P | — |
| Settings / Model prices | P | P | P | P | P | P | P | — | P | P | P | P |
| Settings / Members | P | P | P | P | P | P | P | — | P | P | P | — |
| Settings / Advanced | F | P | P | P | P | — | P | — | P | P | P | — |
| Advanced / Batches | P | F | P | P | F | F | P | P | F | F | P | — |
| Advanced / Agents destination | F | F | P | P | F | P | P | — | P | F | P | P |
| Advanced / Logs destination | F | P | P | P | P | P | P | F | F | F | P | P |
| Advanced / Budgets | P | F | P | P | F | F | P | P | F | F | P | — |
| Advanced / Alerts | P | F | P | P | F | P | P | P | F | F | P | — |
| Direct Repositories | P | F | P | P | F | P | P | — | F | F | P | — |
| Direct Model prices | P | P | P | P | P | P | P | — | P | P | P | P |
| Direct Members | P | F | P | P | P | P | P | — | P | P | P | — |
| Legacy Issue board | F | F | P | P | P | P | P | — | — | P | P | — |

All 80 final cells: document width equals viewport width, no measured horizontal-scroll regions, no visible ISO timestamps or “Unknown”, no unhandled page errors. Agent setup exposes one UUID per cell. **Retry/error behavior was not exercised in this populated capture; it is not certified by these passes.** Loading skeletons, offline states and every possible empty configuration remain separate acceptance work (#186).

## Fixed defects and unchanged-input regressions

1. **Budgets blank page:** the API returns a shared `{data: ...}` envelope; the service previously treated it as an array, producing `l.map is not a function`. Unwrap list/create/update at the typed service seam, including a null empty list. Existing page/transport test fixtures now match the actual envelope. Assertions were retained, not relaxed.
2. **Raw pricing timestamp / blank edit date:** render `Jan 1, 2020` with exact-time tooltip and machine `dateTime`; normalize the editor's date input to `YYYY-MM-DD`. Unit input includes the real server's ISO shape. [Before](before/settings-prices-light-390.png) → [after](screenshots/settings-prices-light-390.png). [Budget before](before/advanced-budgets-light-390.png) → [after](screenshots/advanced-budgets-light-390.png).

Targeted command:

```sh
pnpm exec vitest run src/modules/budgets/page.test.tsx src/modules/pricing/PricingPage.test.tsx
```

Before product fix: exit 1, **2 files failed; 5 failed / 1 passed** (budget array crash and missing readable date). After fix: exit 0, **2 files / 6 tests passed**. Full logs are archived as `regression-before.log` / `regression-after.log`.

Real-browser unchanged assertions:

```sh
/Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-183.mjs --compare
```

The runner first builds the two original product files from the pinned baseline, then rebuilds only the owned client with the fixes. **The same API, database, seeded IDs, credentials, URLs and filters remain in place.** Before: browser process exit 1, `Budgets regression: expected empty state, not a blank page`; pricing captures contain eight ISO-bearing cells. After: process exit 0, `PASS budget envelope and readable pricing date regressions`; zero ISO-bearing cells, zero page errors. Overall lifecycle exit 0 because the before failure is required. Requested API URL sets are identical; budget, session-list and selected-work response bodies are identical. Overview current/previous metrics are identical; tied attention entries change order, not contents.

Viewport measurement control uses identical live API data: 390 px baseline → injected `html{min-width:2000px}` → 390 px restored; the unchanged overflow assertion rejects 2000 px. [Control evidence](viewport-control.json). This is an instrument control, not a product mutation or a UX-all-pass assertion.

## Larger defects filed

| Issue | Concrete failure / evidence |
|---|---|
| [#193](https://github.com/0Hoag/agent-ops-client/issues/193) | `/work/pr/1` returns MR #320 identity with MR #1 runs; API response + Work-detail screenshot. Backend coordination required; no backend fix attempted. |
| [#194](https://github.com/0Hoag/agent-ops-client/issues/194) | Setup command displays/copies a masked nonfunctional token and raw repository UUID. |
| [#195](https://github.com/0Hoag/agent-ops-client/issues/195) | Overview calls the priced subtotal total spend, lacks Custom preset, shows four-place currency, and renders 75 repetitive attention cards. |
| [#196](https://github.com/0Hoag/agent-ops-client/issues/196) | Advanced Agents → Work, Logs → Usage; batch/notification jargon and free-text budget Repository ID. |
| [#197](https://github.com/0Hoag/agent-ops-client/issues/197) | Work shows 50 / 360 records with no paging/count, content-only opening, Runs terminology and buried mobile detail; duplicate legacy board. |
| [#198](https://github.com/0Hoag/agent-ops-client/issues/198) | Dark hovered Work row becomes unreadable; weak form boundaries/action hierarchy and mobile evidence density. Visual finding, not an invented contrast ratio. |
| [#199](https://github.com/0Hoag/agent-ops-client/issues/199) | Usage's actually observed unranked/missing-cost sections have no contextual next-step button/link. |

All carry `found-by:agent`, `wave:W18`, `area:client`, priority and `status:todo` labels. Issues contain exact reproduction/capture commands, archived paths and acceptance. `scripts/review-183-check.mjs <evidence-directory> <rule>` exits 1 for `work-detail`, `advanced-links`, `budget-id-filter`, `setup-command`, `partial-spend`, and `usage-next-step`. The visual finding uses screenshots, not a fabricated machine assertion. The same checks can run against this committed evidence directory.

## Numerical spot checks

Actual API responses: one priced session costs `1.8×3 + 1.2×0.3 + 0.01×3.75 + 0.02×15 + 0.001×15 = $6.1125`. Seven-day priced subtotal `7×6.1125 = $42.7875`; cache savings `7×1.2×(3−0.3) = $22.68`; cache hit `1.2/(1.8+1.2) = 40%`. MR count is 74; `42.7875/74 = 0.578209459…` matches the displayed four-place value, whose formatting/partial-total semantics fail #195. Session tokens `1,800,000+1,200,000+10,000+20,000+1,000 = 3,031,000` render `3.03M`. Recorded `cost_usd` is absent from session-list payloads, so unavailable session cost was not called an arithmetic defect or converted to zero. Complete API/database metric reconciliation belongs to #184.

## Gate commands + output

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && \
  /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Final exit **0**: install lockfile up to date; `tsc --noEmit` and ESLint passed; **59 test files / 192 tests passed**; **Rspack compiled with 3 warnings** (bundle/entry size and code-splitting advice). Existing tests also log React Router future warnings, jsdom network errors and undefined mocked query warnings; they were not hidden or fixed outside scope. Full `gate.log` is preserved.

First gate attempt stopped at one budget transport test using the old bare-body fixture; build did not run. Corrected that fixture to the observed envelope without changing its expected values/method calls. `gate-attempt-1.log` is preserved. No full gates were run after each edit; the failed final-gate attempt was corrected and rerun.

## Screenshot index (actual API-backed stack)

| Page | Light desktop | Light mobile | Dark desktop | Dark mobile |
|---|---|---|---|---|
| overview | [1280](screenshots/overview-light-1280.png) | [390](screenshots/overview-light-390.png) | [1280](screenshots/overview-dark-1280.png) | [390](screenshots/overview-dark-390.png) |
| onboarding | [1280](screenshots/onboarding-light-1280.png) | [390](screenshots/onboarding-light-390.png) | [1280](screenshots/onboarding-dark-1280.png) | [390](screenshots/onboarding-dark-390.png) |
| work | [1280](screenshots/work-light-1280.png) | [390](screenshots/work-light-390.png) | [1280](screenshots/work-dark-1280.png) | [390](screenshots/work-dark-390.png) |
| work-detail | [1280](screenshots/work-detail-light-1280.png) | [390](screenshots/work-detail-light-390.png) | [1280](screenshots/work-detail-dark-1280.png) | [390](screenshots/work-detail-dark-390.png) |
| usage | [1280](screenshots/usage-light-1280.png) | [390](screenshots/usage-light-390.png) | [1280](screenshots/usage-dark-1280.png) | [390](screenshots/usage-dark-390.png) |
| session | [1280](screenshots/session-light-1280.png) | [390](screenshots/session-light-390.png) | [1280](screenshots/session-dark-1280.png) | [390](screenshots/session-dark-390.png) |
| settings-repositories | [1280](screenshots/settings-repositories-light-1280.png) | [390](screenshots/settings-repositories-light-390.png) | [1280](screenshots/settings-repositories-dark-1280.png) | [390](screenshots/settings-repositories-dark-390.png) |
| settings-agent | [1280](screenshots/settings-agent-light-1280.png) | [390](screenshots/settings-agent-light-390.png) | [1280](screenshots/settings-agent-dark-1280.png) | [390](screenshots/settings-agent-dark-390.png) |
| settings-prices | [1280](screenshots/settings-prices-light-1280.png) | [390](screenshots/settings-prices-light-390.png) | [1280](screenshots/settings-prices-dark-1280.png) | [390](screenshots/settings-prices-dark-390.png) |
| settings-members | [1280](screenshots/settings-members-light-1280.png) | [390](screenshots/settings-members-light-390.png) | [1280](screenshots/settings-members-dark-1280.png) | [390](screenshots/settings-members-dark-390.png) |
| settings-advanced | [1280](screenshots/settings-advanced-light-1280.png) | [390](screenshots/settings-advanced-light-390.png) | [1280](screenshots/settings-advanced-dark-1280.png) | [390](screenshots/settings-advanced-dark-390.png) |
| advanced-batches | [1280](screenshots/advanced-batches-light-1280.png) | [390](screenshots/advanced-batches-light-390.png) | [1280](screenshots/advanced-batches-dark-1280.png) | [390](screenshots/advanced-batches-dark-390.png) |
| advanced-agents | [1280](screenshots/advanced-agents-light-1280.png) | [390](screenshots/advanced-agents-light-390.png) | [1280](screenshots/advanced-agents-dark-1280.png) | [390](screenshots/advanced-agents-dark-390.png) |
| advanced-logs | [1280](screenshots/advanced-logs-light-1280.png) | [390](screenshots/advanced-logs-light-390.png) | [1280](screenshots/advanced-logs-dark-1280.png) | [390](screenshots/advanced-logs-dark-390.png) |
| advanced-budgets | [1280](screenshots/advanced-budgets-light-1280.png) | [390](screenshots/advanced-budgets-light-390.png) | [1280](screenshots/advanced-budgets-dark-1280.png) | [390](screenshots/advanced-budgets-dark-390.png) |
| advanced-alerts | [1280](screenshots/advanced-alerts-light-1280.png) | [390](screenshots/advanced-alerts-light-390.png) | [1280](screenshots/advanced-alerts-dark-1280.png) | [390](screenshots/advanced-alerts-dark-390.png) |
| repositories-direct | [1280](screenshots/repositories-direct-light-1280.png) | [390](screenshots/repositories-direct-light-390.png) | [1280](screenshots/repositories-direct-dark-1280.png) | [390](screenshots/repositories-direct-dark-390.png) |
| prices-direct | [1280](screenshots/prices-direct-light-1280.png) | [390](screenshots/prices-direct-light-390.png) | [1280](screenshots/prices-direct-dark-1280.png) | [390](screenshots/prices-direct-dark-390.png) |
| members-direct | [1280](screenshots/members-direct-light-1280.png) | [390](screenshots/members-direct-light-390.png) | [1280](screenshots/members-direct-dark-1280.png) | [390](screenshots/members-direct-dark-390.png) |
| board-legacy | [1280](screenshots/board-legacy-light-1280.png) | [390](screenshots/board-legacy-light-390.png) | [1280](screenshots/board-legacy-dark-1280.png) | [390](screenshots/board-legacy-dark-390.png) |

## Cleanup and evidence archive

Every attempt ran `docker compose -p <owned-project> ... down --volumes --remove-orphans --rmi local` and inspected Docker containers, networks and volumes filtered by that exact project label. All three lists were empty. Final log: `PASS cleanup w18r8-183-53809: zero owned containers, networks and volumes`. Existing owner stacks were not stopped or changed.

Ignored evidence must remain in `/Users/zeross/agent-ops-client/.agent-runs/W18R8-browser-183/` before worktree removal: full gate/lifecycle logs, first failed attempts, before/after matrices/API responses, seed SQL, screenshots, source provenance and issue bodies. Attempt 1 was a harness-only missing ingestion-token header (401); attempt 2 was a strict locator collision in Agent setup. Both were corrected transparently, not filed as product defects.

## Not covered

- No external GitLab/GitHub synchronization, real provider delivery, worker launches, live log stream, notification delivery, budget CRUD in the real browser, invitation acceptance, fresh-user journey, every possible state, or complete accessibility/contrast certification. Owned records were seeded; no owner/provider acceptance is implied.
- Legacy board was captured at its repository-selection state, not as a second populated board. Advanced Agents/Logs destinations are captured truthfully as Work/Usage, not mislabeled as working control/log pages.
- Exact-time tooltips, every filter interaction, error/retry/offline/slow states and full numerical/database audit remain separate work (#184, #186, #187). Missing evidence alone was not filed as a defect.
- Numeric spot checks use the actual API plus documented seed inputs, not a claim that every backend metric definition is correct. Session recorded-vs-equivalent cost remains a product/API follow-up, not an invented screenshot arithmetic finding.
- The local worktree-removal script only accepts a merged/base-reachable head, not merely a pushed open PR. If it refuses removal, preserve the clean pushed worktree rather than bypassing its safety checks.
