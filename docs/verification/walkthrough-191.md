# Owner walkthrough #191 — first implementation run

## Execution contract

Run `bash scripts/verify/walkthrough-191.sh --preflight` from the client root.
The wrapper owns the heavy lock; do not wrap it in another `heavy.sh`.
Run without `--preflight` for the guided, headed production-browser checklist.
This is an observation tool, not a numeric oracle or a passing acceptance test.

Before a browser run, the operator must provision a fresh isolated production stack
using the committed sanctioned setup, synthetic local account and persisted fixture.
`scripts/verify/auth-stack.mjs` and `auth-fixture.mjs` were inspected read-only;
the stack helper is a standalone authentication verifier, not an exported stack API.
It cannot currently hand a running stack to this checklist. No helper was changed.
Do not run the checklist against a shared or replacement product.

Supply `PRODUCT_E2E_URL` and `WALKTHROUGH_FIXTURE` (a JSON evidence file).
Fixture evidence must identify stack project, unique ports, client/API revisions,
organization/repository scope, persisted issues/MRs/runs, SQL results and real HTTP
responses. Record costs and token-price estimates separately. Include prior/current
week runs and merged MRs, failed CI/review, sessions without MRs and missing prices.
No company GitLab reconciliation (#527) or transcript reconciliation (#528) is implied.
The stack owner must archive evidence before teardown, remove only its own resources,
and verify zero containers, networks and volumes by its unique Compose project label
on success, failure and signals. The checklist creates no Docker resources.

## Timed checklist

1. Log in through the real UI; select the fixture organization; start on Overview `/`.
   Authentication/setup is outside the timed segment; do not inject storage or tokens.
2. Answer **What did AI cost this week?** Identify the visible period and whether the
   amount is recorded or estimated. Do not silently call a rolling seven days a calendar week.
3. Answer **Is it getting more efficient?** Record visible comparative evidence, not
   an inference from a lone total. Usage resolves to `/usage`; `/runs` and `/insights`
   redirect there. Navigate with the UI, not address-bar shortcuts.
4. Answer **What needs attention?** Record actionable items visible on Overview,
   Work (`/work`) or Usage. Do not infer absent evidence from fixtures.
5. For each answer the tool counts UI click events, times until the worker submits
   the answer and captures a screenshot. Keyboard navigation must be disclosed in the
   answer; no keyboard shortcuts to bypass the three-click target. Combined time
   includes transitions and screenshot overhead, excludes the subsequent comparison.
   More than three clicks, NOT FOUND or combined time >=300 seconds is a failure.
6. Compare each visible value with archived persisted SQL and captured real HTTP.
   Record exact values and differences. Preserve root agent-ops#557 linked-session
   attribution and #559 recorded-versus-estimated discrepancies; do not redefine their
   semantics or create duplicates. An answer is not validated merely by being visible.
7. File only distinct measured defects, with command, expected/actual, screenshots,
   `found-by:agent`, `wave:W21`, `area:client`, priority/status and type labels.

## First run: blocked, not accepted

Identity: origin `git@github.com:0Hoag/agent-ops-client.git`, branch
`verify/w21c-walkthrough-191`, starting HEAD `cee0f19ee329f1c8c2450ce83d279d60738ce1f8`.
Docker preflight failed: socket `/Users/zeross/.docker/run/docker.sock` does not exist.
No credentials were edited, no stack was created, and there are no owned resources
to remove. Strict error evidence is archived under the canonical client repository
`.agent-runs/W21c-walkthrough-191/`.

No question was timed or answered, no clicks measured, no screenshots captured,
no SQL/HTTP comparison executed and no UX defect established. These are blocked
acceptance, not exemptions. The headed checklist and stack handoff remain unverified.
No product assertion was added; no identical-input mutation control was executed.
Manual timing and screenshot observations are not mutation proof.
