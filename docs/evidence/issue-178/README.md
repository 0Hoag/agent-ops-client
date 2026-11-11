# Member identities (#178, implementation 1/2)

Backend source: API PR #500, `bbc16354bb04ea6ad3fc5c84acc723c7eccfdab6`.
`api/docs/swagger.json` was fetched from that raw GitHub commit, copied unchanged
to `src/shared/api/swagger.json`, then generated with `pnpm generate:api`.
Swagger SHA-256: `54cbd0fef578cf76e3247a0c0d42b1daf6dfcfea3f7e6733242fe9052588accb`.
Client starting point: `00f357dfbc18d17fbcac2bd49d15e8488ba4ff1e`.

## Gate output

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && bash /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Exit 0. 57 test files, 183 tests passed. Rspack compiled with three existing
bundle-size/performance warnings. `jq empty src/shared/api/swagger.json`,
`git diff --check`, member-module ESLint and browser-script syntax checks passed.

## Smoke or test result

```sh
pnpm test src/modules/members/MembersPage.test.tsx src/modules/members/member-contract.test.ts
bash /Users/zeross/agent-ops/scripts/heavy.sh node src/modules/members/verify-identities.mjs
```

Focused suite: 5/5 passed. Browser runner: exit 0. Disposable production Compose
stack built from the pinned API and this client's source; three accounts created
with `/bootstrap-account`, real login, organization creation and invitation
acceptance. No network interception or invented member identities.

| Chromium width | Distinct actual emails | Correct PATCH/DELETE IDs and persisted state | Document overflow | Serious/critical axe |
| --- | --- | --- | --- | --- |
| 1280 | 3 | pass, both other accounts | none | 0 |
| 390 | 3 | pass, both other accounts | none | 0 |

`members.json` maps the disposable real emails to account IDs. `results.json`
records requests and per-viewport checks. Screenshots: [1280](members-1280.png),
[390](members-390.png). Axe-core 4.10.3 ran against the full page.
Cleanup verified zero project containers, networks, volumes and owned listeners.

The first browser attempt timed out waiting for a DELETE response after clicking;
the runner now registers its response listener before the action (`Promise.all`).
That failed attempt also cleaned its stack. No product behavior was changed to
make the runner pass.

## Failing control

The identical focused tests ran before the MembersPage change:

```sh
pnpm test src/modules/members/MembersPage.test.tsx
# exit 1; 1 file failed, 4 tests failed (email and fallback missing)
```

The identical contract test ran with the old HEAD Swagger temporarily restored:

```sh
pnpm test src/modules/members/member-contract.test.ts
# exit 1; 1 file failed, 1 test failed (organization.Member missing)
```

The pinned Swagger was restored immediately. The new code/contract passes all
five tests. Raw command output and full axe reports are archived under the owning
client repository's `.agent-runs/178-member-identities/`.

## Not covered

- The existing shared HTTP adapter builds a body-bearing `Response` for API
  PATCH/DELETE HTTP 204 responses. Browsers reject that response construction;
  the page reports `Unable to update membership` and does not refresh even though
  the server applies the correct change. This is visible in the screenshots.
  Acceptance verifies real requests and independent server reads, **not** a
  successful client refresh. The shared adapter is outside this unit's scope.
- Missing-email fallback is tested in jsdom (undefined, empty, whitespace);
  populated browser acceptance uses only actual API-provided emails.
- No API implementation, API client-pin update, tenant-isolation backend proof,
  QA #179 layout change, or CI result is included. Client contract must merge
  before the separate API pin handoff.
