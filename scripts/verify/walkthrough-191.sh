#!/usr/bin/env bash
# Browser and Docker preflight share one heavy lock; do not wrap this script again.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "${1:-}" == "--isolated" ]]; then
  exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/verify/walkthrough-191-stack.mjs
fi
exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/verify/walkthrough-191.mjs "$@"
