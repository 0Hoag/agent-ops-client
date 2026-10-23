#!/usr/bin/env bash
# Run a Codex worker in a separate worktree of the client repository.
set -euo pipefail

wave=$1 branch=$2 brief=$3
root=$(git rev-parse --show-toplevel)
wt="$HOME/agent-ops-wt/client/${branch//\//-}"
mkdir -p "$root/.agent-runs"

git -C "$root" fetch origin main
if [ ! -d "$wt" ]; then
  git -C "$root" worktree add "$wt" -b "$branch" origin/main
fi

codex exec --profile worker --json -C "$wt" \
  -o "$root/.agent-runs/$wave.md" "$(cat "$brief")" < /dev/null \
  > "$root/.agent-runs/$wave.jsonl"
