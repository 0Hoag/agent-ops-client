#!/usr/bin/env bash
# Run an OpenCode worker in a separate worktree of the client repository.
set -euo pipefail

wave=$1 branch=$2 brief=$3
root=$(git rev-parse --show-toplevel)
wt="$HOME/agent-ops-wt/client/${branch//\//-}"
mkdir -p "$root/.agent-runs"

git -C "$root" fetch origin main
if [ ! -d "$wt" ]; then
  git -C "$root" worktree add "$wt" -b "$branch" origin/main
fi

OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1 opencode run \
  --agent worker \
  --dir "$wt" \
  --format json \
  --title "$wave" \
  "$(cat "$brief")" < /dev/null > "$root/.agent-runs/$wave.jsonl"

jq -rs '[.[] | select(.type=="text")] | last | .part.text // ""' \
  "$root/.agent-runs/$wave.jsonl" > "$root/.agent-runs/$wave.md"

jq -s '[.[] | select(.type=="step_finish") | .part.tokens] | {input: (map(.input) | add), output: (map(.output) | add)}' \
  "$root/.agent-runs/$wave.jsonl"
