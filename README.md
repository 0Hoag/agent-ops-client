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

## Agent workflow

See [AGENTS.md](AGENTS.md), [ROLES.md](ROLES.md), and [FIVE-MINUTES.md](FIVE-MINUTES.md). Client-specific standards are in [docs/client-standards.md](docs/client-standards.md).

The Codex worker script requires Codex CLI with a `worker` profile configured externally (`codex exec --profile worker`). The profile must be available in the invoking user's Codex configuration; this repository does not provide or configure it.
