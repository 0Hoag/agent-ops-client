# #188 — production authentication and navigation

## Reproduction

```sh
scripts/verify/auth.sh
```

Run from this client checkout with pnpm dependencies, Playwright Chromium and Docker available.
The wrapper holds `/Users/zeross/agent-ops/scripts/heavy.sh` for the entire lifecycle, including
Compose, production image builds, browsers and cleanup. Do not wrap it in another heavy lock.
Backend source/Compose are read from `/Users/zeross/agent-ops`; no backend files are modified.

Each invocation allocates a unique project and three loopback ports, generates synthetic secrets,
initializes a fresh persisted PostgreSQL volume, runs the API migrations and bootstraps a synthetic
account. Real HTTP creates two organizations, distinct repositories and recorded sessions; SQL
inserts upstream-synced private issues. Wrong credentials, unscoped/scoped sessions and cross-tenant
HTTP 404s are checked before Chromium starts. No intercepted requests or injected auth tokens.

The production client is built once for the acceptance run. Only the client image is subsequently
rebuilt for the deliberate mutation and restoration; the same API, database, fixtures, credentials,
port, browser command and assertions are reused. Fresh browser contexts make each run independent.

Evidence is recorded under `.agent-runs/W19n-browser-auth-188/<timestamp>/` and copied to the same
path in `/Users/zeross/agent-ops-client` before owned resources are removed. Commands, source hashes,
HTTP status traces, acceptance/command/expected/actual JSON and screenshots are retained. Cleanup
checks project-label filters for zero surviving containers, networks and volumes, including failures.

## Registered production routes

The browser matrix follows `src/app/router.tsx`, not historical navigation assumptions:
`/`, `/work`, `/usage`, `/usage/sessions`, `/settings/advanced`, `/members`, `/repositories`,
`/prices`, `/budgets`, `/alerts`, `/waves`, `/board`, `/runs`, `/insights`, `/invite/:token`, `/login`.
`/runs` and `/insights` redirect to `/usage`. The health registration also names `/`, shadowed by
Overview; `/health` is not an independently registered route. `/ui` is development-only.
The invitation route uses a synthetic token only to exercise navigation/refresh, not acceptance.

## Defects and regressions

- [#222](https://github.com/0Hoag/agent-ops-client/issues/222): previous-tenant repository preference
  survives organization switch and signout. Original real-browser run fails at
  `AUTH_ORG_SWITCH_CLEARS_REPOSITORY_FILTER`; focused Vitest regressions fail twice with
  `expected 'repo-a' to be null`. The fix resets the preference only after successful tenant-token
  validation or signout, plus shell state. Failed selection still retains the original session.
- [#223](https://github.com/0Hoag/agent-ops-client/issues/223): mounted Work retains the previous
  tenant's task after the shell switches organization. A validated tenant change now remounts the
  route subtree as well as clearing queries, dropping module-local state and stale observer data.
  The browser checks switching back on the mounted Work page; a focused state regression fails
  before the tenant-boundary fix.

## Verification results

The complete production/restored runs each pass 24 browser checks. The command for every row is
`scripts/verify/auth.sh`; the action column identifies the exact browser/HTTP steps inside it.

| Acceptance | Action | Expected | Actual |
| --- | --- | --- | --- |
| Real HTTP auth/session | Wrong + correct POST login; GET session before/after org selection | 401 then 200; unscoped then selected org | Pass |
| Persisted tenant isolation | GET own/cross-tenant repositories | Own record only; other tenant 404 | Pass for A and B |
| Wrong password | Submit wrong password on logged-out deep link | Error; stay on login; no repository request | Pass, HTTP 401 |
| Login + org selection | Submit correct password, select A, Continue | Full `/repositories?auth188=destination#tenant-evidence` restored | Exact match |
| Org switching | Select A repository, switch B, open Work, select B; switch A on mounted Work | No previous tenant data or filter; correct private task | Pass both directions; #222/#223 fixed |
| Every actual route | Navigate and reload each route listed above | Registered screen/alias, session retained | 15 authenticated route/alias checks + login refresh pass |
| Back + signout | Work → Usage → back; signout; back; reload | Work before signout; login guard afterwards; token/filter removed | Pass |
| Responsive navigation | Screenshots at 1280/390; open mobile drawer and choose Work | No document overflow; drawer closes | Pass |
| Real session + runtime | Observe HTTP and browser errors | Session 200; only deliberate login 401; no page errors | Pass |
| Compiled mutation | Remove search/hash from preserved destination; rebuild client | `AUTH_DEEP_LINK_FULL_DESTINATION` fails | Exit 1; `/repositories` instead of full destination |
| Restoration | Restore original source; rebuild; identical browser command/fixture | All assertions pass | Exit 0, 24 checks |

Final production screenshots: [1280 px](188-auth-navigation/auth-1280.png),
[390 px](188-auth-navigation/auth-390.png). See the PR and archived `results.json` for the
per-route acceptance table, exact full gate output and source hashes.

Integration delivery evidence: canonical client `.agent-runs/W19n-browser-auth-188/1794619938796/`;
API source `ce0ad50baba397f93dbff318e92d0398e3b2b70f`, project `w19n-auth-188-37467`.
All measured source hashes match the delivered tree. Production and restored browsers each exit 0;
compiled mutation exits 1 at the named destination assertion; cleanup reports zero survivors.
The required full gate exits 0: frozen install, typecheck, lint, 69 test files / 283 tests, and
production build through `heavy.sh`. Existing Rspack bundle-size warnings remain; no checks weakened.
`bash -n scripts/verify/auth.sh`, all helper `node --check` commands and `git diff --check` exit 0.

Integration rerun (W19n-browser-auth-188-r2): merged the current development branch into
the published verification branch without rewriting history. The only conflict was the header:
retain development's named accessibility group alongside the tenant-boundary remount and
signout state reset. The router's complete pathname/query/hash preservation is unchanged.
Focused auth, repository-preference, router, layout and accessibility checks pass: 6 files,
34 tests. Current-tree production and restored browser phases each pass all 24 checks;
the identical-input compiled mutation fails at `AUTH_DEEP_LINK_FULL_DESTINATION` as required.
Final screenshots were refreshed from restored production. Exact gate and browser output is
archived and recorded in the PR;
the first integration browser attempt failed before stack creation because Docker was unavailable.
After starting Docker Desktop, the same command passed. Both project labels were checked for
zero surviving containers, networks and volumes. Historical first-run evidence is preserved.

## Limitations

- This is local Chromium production verification, not hosted deployment or cross-browser testing.
- No role matrix, invitation acceptance, password recovery, server-side token revocation or
  unrelated feature matrix is claimed. Signout is the client's existing local-token removal.
- Known backend Work numeric-choice issues #557/#559 are excluded; authentication assertions are
  not bypassed and repository IDs are taken from real persisted fixtures.
- No backend, API contract, credentials, CI or STATUS.md changes.
