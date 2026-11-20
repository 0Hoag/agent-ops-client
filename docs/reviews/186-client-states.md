# Loading, empty, error, offline and slow-network review (#186)

## Reproduction

From the client root, with Docker Desktop running:

```sh
/Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-186.mjs
node scripts/review-186-check.mjs .agent-runs/W18R11-client-states-186/fault-matrix.json
```

The first command measures; its exit status is lifecycle completion, **not** UI acceptance. The second command rejects detected defects and unverified setup. `REVIEW_PAGE` and `REVIEW_FAULT` accept comma-separated filters. The checker accepts an optional exact page name and fault after the filename. Do not interpret a filtered run as full coverage.

The runner reuses #183's real Compose fixture: an isolated organization, repository, 320 pull requests, 40 issues, 320 CI records, 20 agent runs and one timeline step. It uses the real login/organization selection operations. No happy-path API response is mocked. Seeded runs intentionally lack recorded total costs; Usage must disclose unavailable costs, not invent totals from model prices. The runner records source revisions, HTTP bootstrap statuses, seed counts, and cleanup commands. It removes its own Compose containers, networks, volumes and local images in `finally`; nothing in the backend is edited.

## Fault disclosure and oracle limits

- Discovery observes landing-page GETs and the selected Work detail. Every observed URL gets separate 500, 401, 403, 404, timeout, malformed JSON, empty-array, five-second-delay and offline cells. Response interception is deliberately injected, not a claim that the server produced these failures.
- Timeout/offline abort **the selected request**, not the whole browser or operating-system network. Delay holds that request for five seconds, captures early feedback, then allows the real response.
- Empty injection recursively replaces arrays with `[]`; scalar objects and pagination totals remain unchanged. It does not establish an empty-object contract. Empty rows are `REVIEW`, never automatic passes.
- An alert, Retry action and settled loading state are necessary but not sufficient. Retry recovery observations use the first matching button and check visible settlement, not target-request provenance. They are not proof that every individual panel recovered.
- Shared URLs are grouped, and all matching GETs are intercepted. In particular, session-guard failure can prevent a feature's own session consumer from mounting. URL coverage is not consumer-instance coverage.
- Session return compares pathname, query and hash with the resolved happy-path URL. `/runs` and `/insights` legitimately resolve to `/usage`. Selected in-memory Work detail is not represented in its URL and is not asserted to survive login.
- Main-region snapshots record header alerts separately as `shellAlerts` in the after run. Shell recovery also has a separate component regression test. Slow shell requests cannot be judged by the main-region loading oracle alone.
- A hidden-main negative control keeps the same URL, fixture and responses, fails `Page must not be blank`, restores the style and asserts the original text. This tests the blank-page oracle; it does not prove all other assertions are sensitive.

## Product regressions fixed here

All controls below ran the identical test before and after the product change. Each before run exited 1 at the intended assertion; each after run exited 0. Logs are archived with the review evidence.

| Change | Identical failing/passing command | Intended failing assertion |
| --- | --- | --- |
| Health error includes Retry calling `refetch` | `pnpm exec vitest run src/modules/health/HealthPage.test.tsx` | Accessible Retry button absent |
| Health owns `/health`, not Overview's `/` | `pnpm exec vitest run src/app/router.test.tsx -t 'opens API health'` | API health heading absent after `/health` redirected to Board |
| Reject malformed JSON with readable, body-free error | `pnpm exec vitest run src/shared/http.test.ts` | Malformed response resolved instead of rejecting |
| Retry organization/repository loading in the shell | `pnpm exec vitest run src/app/layout/AppLayout.test.tsx` | Accessible Retry button absent |

The HTTP test also preserves valid JSON and explicit plain-text responses. Existing stale-session 401 safeguards remain unchanged. Forms (#198) and identity (#193) are not reimplemented.

## Not covered

- Faults on mutations (login, organization selection, invitation acceptance, repository/price/budget/channel/batch writes), worker status after starting a job, and WebSocket live logs. Landing on the Agents/Logs hash is not execution coverage for those transports.
- Every pagination/filter permutation, repository switching during an in-flight fault, non-owner role variants, valid JSON with an invalid schema, a genuine browser-wide offline transition, and a server that never answers rather than an injected timeout.
- Pixel-by-pixel inspection of every long table row and every injected cell; screenshots and recorded text are evidence, not a blanket visual acceptance claim.
- Strict skeleton design (some current pages use accessible loading text), contextual action effectiveness for every empty state, and complete consumer-instance isolation behind shared endpoints.

The draft PR must not be treated as full issue acceptance while these exclusions or linked defects remain.
