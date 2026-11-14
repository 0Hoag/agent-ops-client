#!/usr/bin/env bash
# Real isolated production Settings verification, including compiled negative control.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/verify/auth-stack.mjs settings
