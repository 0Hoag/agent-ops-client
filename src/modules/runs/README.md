# Runs acceptance evidence

Run UI acceptance with `pnpm test -- src/modules/runs/RunsPage.test.tsx`. These tests render `RunsPage` and assert its displayed cache percentage, zero-denominator state, known-zero versus unknown cost, and successful aggregate response rendering. Loading, empty, and failure states are asserted separately.

Run `pnpm verify:runs-browser` for production `/runs` loading, empty, and error states with isolated network fixtures. For live data, point a client dev server at an owned API using `APP_API_URL`, then run `RUNS_BROWSER_URL=http://127.0.0.1:<client-port> RUNS_BROWSER_REAL_DATA=1 pnpm verify:runs-browser`. Real-data mode does not intercept API calls; it asserts the exact aggregate JSON response and rendered row, and saves `artifacts/browser/runs-real-data.png`.

Disposable arithmetic and cost mutation checks belong in a temporary source tree: mutate the production `cacheHitPercent` implementation, run `pnpm test -- src/modules/runs/RunsPage.test.tsx` against that tree, verify the expected assertion failure, and discard the tree. Never commit a mutation.
