#!/usr/bin/env bash
# The lock covers builds, Compose, browsers, mutation and owned-resource cleanup.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec /Users/zeross/agent-ops/scripts/heavy.sh node scripts/review-183.mjs --pages-189
