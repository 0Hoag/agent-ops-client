# Recovery evidence for #186

The recovery preserves the four product fixes and their identical-input before/after tests described in [186-client-states.md](186-client-states.md). It does not claim complete issue acceptance.

## Provenance

- Starting client revision: `18dfe224ce14eb07790aa1f7fe038e72d409526e`.
- Existing owned lifecycle: heavy wrapper PID 9811, lifecycle PID 9814, browser PID 10150; Compose project `w18r11-186-9814`. No second browser or Compose run was started by recovery.
- `cmp .agent-runs/W18R11-client-states-186/implementation.patch .agent-runs/W18R11-client-states-186/recovery.patch` exited 0. The seven tracked product/test changes are identical to the saved implementation. The added health test predates the existing gate log.
- The existing `gate.log` records successful frozen installation, typecheck, lint and **64 files / 222 tests passed**. Recovery completes the missing build through the heavy wrapper; no earlier build success is inferred.
- `node --test scripts/review-186-helpers.test.mjs`: **4 passed**, exit 0. `git diff --check`: exit 0.

## Important evidence distinction

The already-running browser loaded its script before the worker's final harness edits. In particular, it used an exact Work-detail selector and did not capture shell alerts separately. Its fault matrix is **baseline discovery**, not after-fix verification. Unit regression controls establish the four fixes; the browser does not independently accept them.

The Work-detail discovery timeout is a harness/setup failure, not evidence of a product blank page. The corrected selector in the committed runner is not browser-verified in this recovery. Likewise, classifying the baseline matrix with the current checker cannot retroactively add absent shell observations.

All baseline failures and unverified cells are retained. A failing checker is not suppressed or converted into a passing gate. Final command results and linked remaining product defects are recorded in the PR.

Remaining Settings permission/bootstrap and price-list recovery defects are tracked in [#210](https://github.com/0Hoag/agent-ops-client/issues/210), with exact targeted reproduction and measured expected/actual states. They require coordinated role/bootstrap recovery rather than treating every baseline classifier failure as a new defect.

## Completed commands

- The missing `/Users/zeross/agent-ops/scripts/heavy.sh pnpm build` completed with `build_exit=0`; Rspack compiled with three bundle-size/performance warnings. Together with the unchanged-source `gate.log`, all required gate steps passed.
- The existing lifecycle finished recording **1026 injected cells**, **47 discovery observations** (46 viewport observations and one Work-detail setup failure). Its lifecycle exit was 0; its cleanup log confirms zero owned containers, networks and volumes.
- `node scripts/review-186-check.mjs .agent-runs/W18R11-client-states-186/fault-matrix.json` exited **1**. Baseline labels: 100 PASS, 421 OBSERVED, 150 REVIEW and 355 DEFECT; these are classifications, not independently accepted product-defect counts. Five rows report failed Retry recovery. Work-detail discovery remains unverified.
- The hidden-main control at `/usage` records `failedAsIntended: true` for `Page must not be blank`, then restores and checks the original text with identical data and responses.
- Advanced permission recovery is tracked in [#211](https://github.com/0Hoag/agent-ops-client/issues/211). Remaining baseline classifications are retained for triage, not silently marked fixed.

## Not covered

- A fresh after-fix full browser matrix, final screenshots attached to GitHub, or full issue acceptance.
- Work-detail setup, consumer-instance isolation, empty-state action effectiveness, strict skeleton design, and the exclusions in the original review document.
- Browser-wide offline, mutations, WebSockets, role permutations and all pagination/filter combinations.

Ignored logs, JSON and screenshots are archived under the owning checkout's `.agent-runs/W18R11-client-states-186/` before any worktree cleanup. They are local evidence, not public attachments.
