#!/usr/bin/env bash
# Isolated production authentication/navigation verification, including compiled mutation control.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/verify/auth-stack.mjs "$@"
