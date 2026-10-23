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

The development server runs the client. Health requests are proxied to the API at `http://localhost:8080`; configure or run the API separately. See [`0Hoag/agent-ops`](https://github.com/0Hoag/agent-ops) for the API and broader project. This repository does not include API code or credentials.

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
