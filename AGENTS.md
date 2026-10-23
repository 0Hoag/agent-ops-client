# Agent workflow

## Scope

This repository contains the Agent Ops client only. The API is maintained in [`0Hoag/agent-ops`](https://github.com/0Hoag/agent-ops); do not add API gates or assume an `api/` directory exists here. Follow [docs/client-standards.md](docs/client-standards.md) for client changes.

## Git and delivery

- Use GitHub CLI (`gh`); target `main` and open a pull request for each deliverable.
- Use Conventional Commits, for example `feat(client): add ...` or `chore(ci): ...`.
- Include `Closes #n` for each issue the PR resolves.
- Do not merge your own PR.

## Required gate

Run from the repository root before committing and report command output in the PR:

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

For shell scripts, also run `bash -n <script>`. Validate JSON configuration with `jq empty <file>` and OpenCode configuration with `opencode models` (or `opencode run` in a configured environment).

## Harness

OpenCode worker configuration is in `.opencode/agents/worker.md`; project configuration is in `opencode.json`. Worker scripts live under `scripts/` and operate against this repository's root `package.json` and `src/` tree. The canonical client checkout is `~/agent-ops-client`; worker worktrees are under `~/agent-ops-wt`.
