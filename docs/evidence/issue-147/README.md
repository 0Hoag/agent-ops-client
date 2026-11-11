# Issue #147 verification

## Gate output

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && bash /Users/zeross/agent-ops/scripts/heavy.sh pnpm build
```

Exit 0: frozen install, typecheck, lint, 55 test files / 178 tests passed.
Rspack compiled with 3 bundle-size/performance warnings (main.js 444.352 KiB).
An earlier gate attempt stopped at TS18048 for optional event metadata; the
fallback was corrected and the final complete gate above passed.

## Smoke or test result

Real Chromium, local production Compose, pinned API revision
`9b6bad46cce57cc08c3b09b7665ffe495f67455f`.
The issue-local runner reuses `scripts/product-e2e.mjs` fixture/bootstrap/cleanup
tooling without changing shared runner infrastructure. It creates an account,
organization, repository, model price and persisted session using supported
operations; browser login and organization selection use the actual UI.

- Session: Claude, branch `feat/copy`, 1,846,116 input tokens, zero other token categories.
- Usage displays `1.85M`, a relative start time with an exact UTC tooltip,
  and expandable definitions. The daily spend headline/chart displays `$1.8461`.
- Session costs remain absent in this pinned API response despite the configured
  price: the browser explicitly accepts the actionable missing-price state,
  not a fabricated zero. It also navigates into Session detail and checks that
  its exact timestamp preserves the persisted instant.
- Both widths assert document scroll width does not exceed viewport width.
- Browser console has no page errors. The original product suite also passed
  its real login/navigation/authentication and empty-data checks; that run is
  not used as proof of populated acceptance.

[1280 px populated Usage](usage-1280.png) · [390 px populated Usage](usage-390.png)

## Failing control

In the disposable production client copy only, replace
`notation: 'compact', maximumFractionDigits: 2` with precision `1` in
`src/shared/format.ts`. Rebuild only the client against the same database,
credentials, timestamps and browser assertions; restore and rebuild afterward.

```text
baseline: PASS real populated session copy, token/currency precision, glossary, relative/exact time, 1280/390 no overflow
mutation: AssertionError [ERR_ASSERTION]: token precision: 1.85M (exit 1)
restored: PASS real populated session copy, token/currency precision, glossary, relative/exact time, 1280/390 no overflow
cleanup: zero containers, networks, volumes (project product-e2e-97705-f4b2e7ee)
```

Formatter SHA-256: original/restored
`4b67364dd47d1db69dbf3a706ea69319a28aadb92be5f764f3ad814c2f012aee`;
broken `dcf625c8804fed15c707ae9b3d53f2c4683bceb9bf78539e4d3ceb0430b3aeb2`.
Legacy runner stage labels `broken-guard`/`restore-owned-route-guard` are inherited
names only; the recorded mutation targets the formatter, not authentication.

## Not covered

- Populated browser coverage is Usage and Session detail, not all Overview,
  Work, Settings or advanced screens; changed display paths have focused tests.
- Browser proof of priced session costs, VND, nonempty delivery history and
  external provider behavior is not claimed. No arithmetic/API correction is included.
- Raw logs, source patch and issue-local runner/browser scripts are archived in
  the owning checkout `.agent-runs/issue-147/`; successful populated/control run
  is `populated/1794403087084-97705/`. Earlier fixture attempts and cleanup
  inspections are preserved there as well. No host configuration was changed.
- Hosted CI was not awaited. Client `docs/ux-principles.md` is absent; the
  explicitly referenced API repository copy was read instead.
