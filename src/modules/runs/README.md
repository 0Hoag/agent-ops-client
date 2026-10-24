# Runs acceptance evidence

Run UI acceptance with `pnpm test -- src/modules/runs/RunsPage.test.tsx`. These tests render `RunsPage` and assert its displayed cache percentage, zero-denominator state, and known-zero versus unknown cost.

Disposable arithmetic and cost mutation checks are run from the client worktree by making one production-only mutation at a time, running that same test file, and restoring the tracked source immediately. Do not commit a mutation. The real API/browser evidence uses the API repository's existing `scripts/smoke.sh` harness and `smoke.browser.spec.ts`; a compatible standalone client run must also assert `/runs` and seed aggregate rows in its isolated database.
