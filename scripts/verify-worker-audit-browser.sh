#!/usr/bin/env bash
set -euo pipefail
pnpm build
pnpm preview --host 127.0.0.1 --port 18764 > /tmp/w14r-preview.log 2>&1 &
preview_pid=$!
cleanup() { kill "$preview_pid" 2>/dev/null || true; wait "$preview_pid" 2>/dev/null || true; }
trap cleanup EXIT
for attempt in {1..100}; do
  if curl --silent --fail http://127.0.0.1:18764/waves >/dev/null; then break; fi
  sleep 0.25
done
node scripts/verify-worker-audit-browser.mjs
