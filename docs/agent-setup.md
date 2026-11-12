# Send a first transcript

Settings > Agent setup prepares a one-time `agentops push`, not a watcher. It never
retrieves, stores, displays, or copies an ingestion credential.

1. Ask the deployment administrator whether ingestion is enabled and whether your
   repository is permitted. The current API requires the deployment's configured
   `AGENT_RUN_TOKEN` in `X-Agent-Run-Token`. A dashboard JWT does not work. There is
   no self-service token issuance endpoint. Do not create a random token and expect
   it to authenticate, or expose server configuration through the client API.
2. Install the CLI from the API checkout (`api/`):
   `go build -o "$HOME/.local/bin/agentops" ./cmd/agentops`. Ensure that directory
   exists and is on your `PATH`. See the upstream [local install guide](https://github.com/0Hoag/agent-ops/blob/main/docs/install.md).
3. Load the administrator-provided credential securely in your terminal. For Bash,
   use an interactive read rather than putting a secret in history:

   ```bash
   read -r -s -p 'Configured ingestion credential: ' AGENT_RUN_TOKEN
   printf '\n'
   export AGENT_RUN_TOKEN
   ```

4. Select a connected repository and transcript format (Codex, Claude, OpenCode).
   Enter the absolute path to a completed local transcript with model metadata.
   No file is uploaded by this page. Run the copied command from the repository's
   Git checkout so the CLI can resolve its branch. The command supplies the API
   endpoint, `--repository-id`, `--harness`, `--wave setup`, `--worker local-agent`,
   and a shell-quoted file path. Its guard fails before invoking the CLI if the
   credential is unset or empty. The CLI reads the credential from the environment,
   not a `--token` flag. Change the batch/agent labels if desired.
5. Only a successful CLI exit followed by the session appearing in Usage verifies
   ingestion. Copying a command is not a successful connection. On HTTP 401, ask the
   administrator to check the configured token and repository allowlist; do not
   substitute your dashboard login. Unset `AGENT_RUN_TOKEN` when finished.

The generated endpoint uses the same API base as the dashboard. It must be reachable
from the CLI computer; remote networking/TLS setup is deployment-specific. Sharing
the deployment-wide ingestion credential is an administrator policy decision, not
permission granted by viewing this page. Scoped self-service credentials would
require a separate backend/product design and are not implemented here.

## Disposable acceptance check

From the client checkout, run:

```sh
/Users/zeross/agent-ops/scripts/heavy.sh node scripts/agent-setup-e2e.mjs
```

This reuses the product E2E Compose/bootstrap approach with a read-only snapshot
of the local API checkout, an isolated Compose project, ephemeral loopback ports,
and disposable credentials. It runs the unchanged browser check against the old
Settings command (expected failure), then the fixed client on the same database.
It captures desktop/mobile screenshots in both themes, reads the real clipboard,
and executes the copied command with the supported CLI. A credential-free control
must fail before ingestion; an authenticated API read must find the submitted
session. It removes only its own containers, network, volume and source fixture.
Evidence is written to `.agent-runs/W18-agent-setup-194`; archive that directory
before removing the client worktree. Browser login credentials and JWTs are not
written to traces or screenshots.
