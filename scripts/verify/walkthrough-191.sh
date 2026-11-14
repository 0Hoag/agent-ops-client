#!/usr/bin/env bash
# Browser and Docker preflight share one heavy lock; do not wrap this script again.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/verify/walkthrough-191.mjs "$@"
