#!/usr/bin/env bash
# The lock covers builds, Compose, browsers, mutation and owned-resource cleanup.
set -euo pipefail
cd "$(dirname "$0")/../.."
# Snapshot only published API files; never build the shared development checkout.
evidence="$PWD/.agent-runs/W19o-pages-189/owner-completion"
mkdir -p "$evidence/api-source"
revision=$(git -C /Users/zeross/agent-ops rev-parse origin/reviews/development)
git -C /Users/zeross/agent-ops archive "$revision" | tar -x -C "$evidence/api-source"
printf '%s\n' "$revision" > "$evidence/api-revision.txt"
# Adapt paths in a disposable copy, leaving the inherited lifecycle untouched.
node --input-type=module - "$evidence" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const source = readFileSync('scripts/review-183.mjs', 'utf8')
  .replace("'./verify/pages-stack.mjs'", JSON.stringify(`${process.cwd()}/scripts/verify/pages-stack.mjs`))
  .replace("const backend = '/Users/zeross/agent-ops';", `const backend = ${JSON.stringify(`${dir}/api-source`)};`)
  .replace("api: run('git', ['-C', backend, 'rev-parse', 'HEAD'])", `api: ${JSON.stringify(readFileSync(`${dir}/api-revision.txt`, 'utf8').trim())}`)
  .replace("apiStatus: run('git', ['-C', backend, 'status', '--short'])", "apiStatus: 'published archive'");
writeFileSync(`${dir}/lifecycle.mjs`, source);
NODE
exec /Users/zeross/agent-ops/scripts/heavy.sh node "$evidence/lifecycle.mjs" --pages-189
