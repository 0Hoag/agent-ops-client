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

`src/shared/api/swagger.json` is the pinned Swagger 2.0 contract generated from `0Hoag/agent-ops` commit `64a74a2761d5b738aaa81c81dea41ce03be718ec` (`api/docs/swagger.json`, SHA-256 `f2f92b03322b3d1559cc4495b5a6a428250b860dbc8f041be11afd382d2679df`). Generate it with `make -C api swagger` (swag v1.16.6), then copy the output byte-for-byte, without adding a trailing newline. The snapshot byte hash is checked against this provenance by `src/shared/api/swagger-bytes-contract.test.ts`. Regenerate the checked-in TypeScript client with `pnpm generate:api`; `swagger-typescript-api` 13.1.1 and its templates are pinned in the lockfile and `scripts/api-templates/`.

## Insights API smoke

Run `scripts/verify-insights-api-smoke.sh` with `CLIENT_DIR` pointing to a clean client fixture and `API_REPO_DIR` pointing to a Git checkout of `0Hoag/agent-ops` (with its Compose file and `api/` tree). For example:

```sh
CLIENT_DIR=/path/to/client-fixture API_REPO_DIR=/path/to/agent-ops scripts/verify-insights-api-smoke.sh
```

The script starts and cleans up only its uniquely labeled Compose project and uses API/client ports 19993/19994.

## Agent workflow

See [AGENTS.md](AGENTS.md), [ROLES.md](ROLES.md), and [FIVE-MINUTES.md](FIVE-MINUTES.md). Client-specific standards are in [docs/client-standards.md](docs/client-standards.md).

The Codex worker script requires Codex CLI with a `worker` profile configured externally (`codex exec --profile worker`). The profile must be available in the invoking user's Codex configuration; this repository does not provide or configure it.
