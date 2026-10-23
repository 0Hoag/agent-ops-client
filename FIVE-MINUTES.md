# Five minutes before you start

Read this before the first action and after context compaction.

1. Confirm the current branch and working tree before changing files.
2. Read the issue and brief now; old status or a green check is not proof of acceptance.
3. Run the full client gate on the exact commit you intend to push.
4. For a negative control, verify the intended check fails with the specific injected error, then restore the tree.
5. Do not merge PRs as an implementer. Report anything not covered rather than implying success.

## Check commands

```sh
git status --short --branch
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
