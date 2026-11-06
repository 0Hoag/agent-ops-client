# Product browser suite

Requires Docker Compose v2, Git, Node 22, pnpm, and Playwright Chromium.
Install locked dependencies and run `pnpm exec playwright install chromium` on
developer machines (CI installs browser system dependencies too).

```sh
pnpm test:e2e
pnpm test:e2e --control
```

On the shared macOS worker, wrap either command with
`/Users/zeross/agent-ops/scripts/heavy.sh`. The suite includes browser execution,
Compose and full Docker client builds; do not nest the heavy wrapper.

The runner clones API revision `4b554f6cb0a05c6bee65f790ebbad9255096294d`
into a disposable directory, copies this client, and uses the documented
`compose.prod.yml` and stdin-only `/bootstrap-account` command. Ports are
ephemeral loopback ports, with a unique Compose project and fresh database.
It creates an organization and repository through supported authenticated API
operations, then logs in and selects the organization in the actual browser.
Board, runs and alert history must render their explicit empty states and return
successful empty API pages. No mocks, SQL inserts, developer credentials or
injected browser sessions are used.

`--control` runs the same spec with identical credentials, data and URLs three
times: baseline, a bypassed route render guard in the disposable client copy,
and restored guard. The middle run must fail the named anonymous-board assertion.
This does not edit production sources or the primary API checkout.

Evidence defaults to `.agent-runs/product-e2e/<run>/`; set
`PRODUCT_E2E_EVIDENCE` to an external archive directory on workers. It includes
source hashes, API/client revisions, command output, screenshots, safe request
summaries and cleanup inspection. Traces are disabled to avoid saving secrets.
Cleanup runs on success, failure and handled signals and checks that no project
containers, networks or volumes remain. SIGKILL/host failure cannot run cleanup.
CI runs the identical command with the control and uploads evidence even on failure.

Not covered: populated boards/runs/alerts, editors, live logs, clean-machine
installation, external providers or hosted CI negative-control success until
that job has actually executed.

## Current verification blocker

The first local real-stack run at the pinned API revision stopped during fixture
setup: `POST /api/v1/repositories` returned HTTP 404 after successful account
bootstrap, login, organization creation and selection. No browser page assertion
or broken-guard/restored pass was reached. The suite deliberately fails rather
than falling back to mocks or SQL. The CI job is wired but its success is not yet
verified; this is not completion evidence for issue #7.
