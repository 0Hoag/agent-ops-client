# Issue 185: repeatable real user flows

Run from this client worktree:

```sh
pnpm install --frozen-lockfile
/Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-185.mjs
```

The runner uses the read-only backend checkout at `/Users/zeross/agent-ops`,
its production Compose definition, three ephemeral localhost ports, a unique
Compose project, random synthetic secrets, and a fresh PostgreSQL volume.
It bootstraps an `.invalid` account and two organizations. Playwright signs in
through the real login form; no route interception or injected authentication
is used. HTTP session ingestion uses that validated browser's token.

## Independent observations

- Empty Overview and zero-of-three checklist, repository creation via settings,
  real session ingestion, price creation via settings, completed checklist and
  rendered recorded session result.
- Seven-day Usage ranking: MR 1 costs $17.00, MR 2 costs $1.00; model totals are
  alpha $13.40 and beta $4.60. Opening the ranked MR and verifying the selected
  repository/detail is a separate strict check.
- MR 1 has a persisted failing pipeline. Work must show the failure and link to
  `https://gitlab.example.invalid/userflows-185/project/-/merge_requests/1`.
- Sign out/in retains the repository; switching to B cannot list A's repository;
  switching back to A retains its selection (including a reload after sign-in).
  Organization-switch checks await both the organization heading and repository
  options, not merely a previously idle browser document. This interprets retention as the
  round trip to the owning organization, not permission to expose A data in B.
- Work session amounts must match persisted recorded values, not the independent
  $3-per-million estimate. Issue 10 links all three sessions. Unresolved owner
  semantics remain [backend #559](https://github.com/0Hoag/agent-ops/issues/559)
  and [backend #557](https://github.com/0Hoag/agent-ops/issues/557), respectively.

### Fixture limits

The ingest contract has no recorded-cost input. The fixture explicitly updates
the three ingested rows' recorded costs using SQL; each `UPDATE 1` is captured.
This does **not** prove that setting a price retroactively supplies recorded
cost, nor that an external telemetry producer supplies it. MRs, issue linkage
and the failed pipeline are SQL fixtures, not a live GitLab webhook. The GitLab
host is deliberately non-routable; the exact link is checked, not remote access.
The ranking check is not replaced by manually visiting Work: the latter only
continues independent evidence collection after a missing ranking action.

### Focused client fixes

Real-browser development runs found that the expensive-MR ranking was plain
text, with no way to open its details. It now links to repository-scoped Work
details; Work reads the repository/PR deep link on mount. Two focused Vitest
regressions failed before this fix (no link; empty repository selection).

The same fixture had valid GitLab repository configuration, but Work HTTP detail
returned `item.url: ""`. The captured SQL schema has no PR URL column; this is
not a missing URL in the SQL seed. Work now falls back to the selected GitLab
repository's configured base URL, full name and MR/issue number when the API URL
is absent. Explicit API URLs still take precedence, covered by the existing
Work tests. The new deep-link regression also failed before this fallback
because `Open in GitLab` was absent. No API response or backend code was changed.

## Deliberate product controls

The runner takes one in-memory clean-database snapshot after account/org setup.
It restores it before production-before, mutant, and production-restored runs.
All repeat the same browser actions, prices, session IDs, frozen ingestion time
and normalized HTTP payloads (only generated repository UUIDs differ).

Four independent product changes are compiled together in a disposable source
copy, never in the working tree:

| Intended assertion | Deliberate mutation |
| --- | --- |
| `first-run.empty-checklist` | Always report three completed steps |
| `cost.top-mr` | Sort expensive-MR ranking ascending |
| `attention.gitlab-link` | Replace Work detail URL with an incorrect GitLab URL |
| `persistence.sign-in` | Delete repository preference on logout |

Every intended check must fail on the mutant and pass after rebuilding original
production code. Other real-matrix failures remain failures. Browser assertions
are collected to avoid losing later flows; the lifecycle exits nonzero if any
restored-production check fails, if a control does not fail as intended, or if
a child browser crashes. A control is not a waiver for other assertions.

## Evidence and cleanup

Each attempt has a timestamped evidence directory. `sources.json` records client
and API revisions, API dirty status, URL, project and ingestion time. SQL seeds,
SQL results, sanitized HTTP bodies, named checks, control definitions and final
1280/390 screenshots are retained. Synthetic passwords, issued tokens and the
database snapshot are not archived. Evidence is copied before destructive
cleanup to the owning canonical client repository:

`/Users/zeross/agent-ops-client/.agent-runs/W18R10-userflows-185/<attempt>/`

The `finally` and signal handlers remove only this project's containers,
networks, volume and locally built images, then query labels to require zero
owned containers/networks/volumes. The cleanup log is archived again afterward.
No shared services or other worker resources are stopped.

## Reuse audit

At starting HEAD `35a99b45757b9068f7af572032de951f0de8d37d`,
`scripts/review-183.mjs:18–59` supplies the unique-project/ports/secrets and
cleanup pattern, `80–89` the bootstrap/real HTTP pattern, and `105–120` the
SQL fixture pattern. These exact lines were inspected before adapting them.
`scripts/review-184.mjs` and `scripts/review-186.mjs` do not exist at that HEAD;
no files or evidence were read from other workers' worktrees.

Execution results and uncovered acceptance are reported in the PR; screenshots
in the local evidence archive are not claimed as hosted attachments.

During harness development, an initial empty-spend oracle incorrectly expected
`$0.00 spent`. SQL/HTTP showed no telemetry and `spend_usd: null`; the UX standard
forbids placeholder zero for an uncomputable number. The corrected empty-state
oracle requires the exact honest `Spend unavailable` message, alongside the
independent zero-of-three checklist. This is a fixture/oracle correction, not a
product numeric fix or permission to accept an incorrect recorded amount.
