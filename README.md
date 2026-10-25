# Agent Ops Client

Standalone React client for Agent Ops, maintained in [`0Hoag/agent-ops-client`](https://github.com/0Hoag/agent-ops-client).

## Requirements

- Node.js 22
- pnpm 11.21.0

## Local development

```sh
pnpm install --frozen-lockfile
pnpm start
```

The client sends API requests to the same origin (`/`). During local development, the server proxies only `/healthz` to `http://localhost:8080`; other API paths are not proxied. Run the API separately for health checks. The client does not currently read `APP_API_URL` or another runtime API-origin setting. See [`0Hoag/agent-ops`](https://github.com/0Hoag/agent-ops) for the API and broader project. This repository does not include API code or credentials.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The same standalone checks run in GitHub Actions for pull requests and pushes to `main`.

## Generated API

`src/shared/api/swagger.json` is the pinned Swagger 2.0 contract from `0Hoag/agent-ops` commit `86a4f211a64b14cf83db6d1e2c8e00a7d5206794` (`api/docs/swagger.json`). Regenerate the checked-in TypeScript client with `pnpm generate:api`; `swagger-typescript-api` 13.1.1 and its templates are pinned in the lockfile and `scripts/api-templates/`.

## Insights API smoke

Run `scripts/verify-insights-api-smoke.sh` with `CLIENT_DIR` pointing to a clean client fixture and `API_REPO_DIR` pointing to a Git checkout of `0Hoag/agent-ops` (with its Compose file and `api/` tree). For example:

```sh
CLIENT_DIR=/path/to/client-fixture API_REPO_DIR=/path/to/agent-ops scripts/verify-insights-api-smoke.sh
```

The script starts and cleans up only its uniquely labeled Compose project and uses API/client ports 19993/19994.

## Agent workflow

See [AGENTS.md](AGENTS.md), [ROLES.md](ROLES.md), and [FIVE-MINUTES.md](FIVE-MINUTES.md). Client-specific standards are in [docs/client-standards.md](docs/client-standards.md).

The Codex worker script requires Codex CLI with a `worker` profile configured externally (`codex exec --profile worker`). The profile must be available in the invoking user's Codex configuration; this repository does not provide or configure it.
