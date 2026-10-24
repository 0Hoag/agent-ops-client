# Runs acceptance evidence

Run UI acceptance with `pnpm test -- src/modules/runs/RunsPage.test.tsx`. These tests render `RunsPage` and assert its displayed cache percentage, zero-denominator state, known-zero versus unknown cost, and successful aggregate response rendering. Loading, empty, and failure states are asserted separately.

Disposable arithmetic and cost mutation checks are run from the client worktree by making one production-only mutation at a time, running that same test file, and restoring the tracked source immediately. Do not commit a mutation. Real API/browser evidence is exercised with the API fixture's `scripts/runs-smoke.sh`, which seeds aggregate data in its own Compose database and uses a disposable client clone; do not run the broader shared `scripts/smoke.sh` fixture for this module.
