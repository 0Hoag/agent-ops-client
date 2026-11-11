# W18 visual, accessibility and responsive QA (#148)

## Smoke or test result

Reproduce from the client root (Docker Compose and Playwright Chromium required):

```sh
bash /Users/zeross/agent-ops/scripts/heavy.sh env \
  W18_EVIDENCE=/Users/zeross/agent-ops-client/.agent-runs/W18s-evidence \
  node scripts/qa-w18.mjs --control
```

The issue-local scripts reuse the existing `product-e2e.mjs` lifecycle: a pinned
API checkout, disposable client copy, fresh Compose project/database, ephemeral
loopback ports, generated disposable credentials, stdin account bootstrap and
actual browser login/organization selection. Neither primary checkout is updated.
The backend pin is `9b6bad46cce57cc08c3b09b7665ffe495f67455f`.

The fixture creates an organization, repository, model price and agent session
through the authenticated API. A Work issue and timeline step are SQL-seeded in
that fresh database; their browser responses come from the real API, not route
mocks. Session cost remains missing in this API version; the actionable missing
price text is preserved, not replaced with zero. No arithmetic change is included.

The matrix distinguishes real populated/dark pages from route-fixture-only
loading, empty and error states. Onboarding is the Overview first-run checklist,
not a separate route. Dark screenshots set the existing `data-theme` attribute;
they do not imply the product has a theme-switching control.

Small fixes cover dark neutral surfaces/text, visible keyboard outlines,
Settings tab semantics and arrow-key behavior, the desktop header/content
column, and mobile Work/pricing/member table reflow without dropping fields.

[76-cell screenshot matrix](matrix.md) · [axe/overflow manifest](matrix.json) ·
[keyboard results](keyboard.json) · [network summaries](network.json).
Baseline and restored each passed all 76 cells with zero serious/critical axe
violations and zero document or scroll-container overflow at 390 px. Browser
page errors were zero. Real populated acceptance is separate from route fixtures.

## Failing control

The identical browser suite runs baseline → broken → restored against the same
database, credentials, timestamps, URLs and viewport inputs. Only the disposable
client's Settings `role="tablist"` becomes `role="navigation"`. The intended
failure is axe `aria-required-parent`; the source is then restored and rebuilt.
The mutation hashes and exact outputs are archived with the run.
The broken run completed the same 76 inputs and failed with
`aria-required-parent` in 26 Settings cells (exit 1); restored passed (exit 0).
[Mutation hashes](mutation.json): original/restored
`40e738f353fc74ca6e24b07f8e2e474c110da70a529e2ab7776108b054792fa6`.

The focused Vitest suite also runs against the original five product files in
an owned disposable copy: five regression tests fail (12 pass); restoring the
changed files makes all 17 pass. The copy is removed afterward.

## Gate output

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && \
  bash /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Exit **0**: frozen install, typecheck, lint, **57 files / 181 tests passed**,
Rspack compiled with three bundle-size/performance warnings (main.js 445.274 KiB).
[Exact gate output](gate-output.txt). Targeted tests: five files / 17 tests passed.
`node --check` for both QA scripts, `jq empty` for the four evidence JSON files,
and `git diff --check` also passed.

## Not covered

- Chromium only; no screen-reader, Safari/Firefox, reduced-motion or zoom audit.
- Fixture-only transient/missing-data states are not real API acceptance.
- The actual session is populated but not priced in this pinned API response;
  arithmetic, pricing semantics and missing data are not changed.
- External provider ingestion, destructive settings mutations and advanced
  coordinator destinations are outside this visual QA run.
- Lower-impact axe findings, verbatim price timestamps and the remaining
  Members identity defect are recorded in [the matrix](matrix.md). The larger
  identity/API dependency is queued for a later implementation wave in
  [#178](https://github.com/0Hoag/agent-ops-client/issues/178).
- Loading/empty/error coverage for the extra Settings sub-tabs is not included;
  those receive real populated/dark coverage only. Mobile drawer Escape/focus
  trapping, clipboard behavior and Settings mutations were not asserted.
- Hosted CI is not awaited. Full raw commands, source hashes, screenshots,
  network summaries and cleanup inspection are archived under the owning
  checkout `.agent-runs/W18s-evidence`, outside this worktree.
