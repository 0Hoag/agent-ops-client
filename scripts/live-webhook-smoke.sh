#!/usr/bin/env bash
set -Eeuo pipefail

CLIENT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
API_ROOT=${API_REPO_DIR:-"$HOME/agent-ops-wt/w2d-browser-api"}
PROJECT="agent-ops-w2e-$(id -u)-$$"
API_PORT=${SMOKE_API_PORT:-18081}
CLIENT_PORT=${SMOKE_CLIENT_PORT:-4174}
API_URL="http://127.0.0.1:$API_PORT"
CLIENT_URL="http://127.0.0.1:$CLIENT_PORT"
ARTIFACT_DIR=${SMOKE_ARTIFACT_DIR:-"$CLIENT_ROOT/.agent-runs/live-webhook"}
PREVIEW_PID=
SECRET_A="w2e-a-$(id -u)-$$"
SECRET_B="w2e-b-$(id -u)-$$"
API_PID=
DB_PORT=
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "$PREVIEW_PID" ]]; then
    python3 - "$PREVIEW_PID" <<'PY'
import os, signal, subprocess, sys, time
root=int(sys.argv[1]); seen=set(); stack=[root]
while stack:
 p=stack.pop()
 if p in seen: continue
 seen.add(p)
 out=subprocess.run(['pgrep','-P',str(p)],capture_output=True,text=True); stack.extend(int(x) for x in out.stdout.split())
for p in seen:
 try: os.kill(p,signal.SIGTERM)
 except ProcessLookupError: pass
PY
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]]; then
    python3 - "$API_PID" <<'PY'
import os, signal, subprocess, sys
root=int(sys.argv[1]); seen=set(); stack=[root]
while stack:
 p=stack.pop()
 if p in seen: continue
 seen.add(p)
 out=subprocess.run(['pgrep','-P',str(p)],capture_output=True,text=True); stack.extend(int(x) for x in out.stdout.split())
for p in seen:
 try: os.kill(p,signal.SIGTERM)
 except ProcessLookupError: pass
PY
    wait "$API_PID" 2>/dev/null || true
  fi
  docker compose -p "$PROJECT" -f "$API_ROOT/docker-compose.yml" down --volumes --remove-orphans >/dev/null 2>&1 || true
  if [[ -n "$PREVIEW_PID" ]] && lsof -nP -iTCP:"$CLIENT_PORT" -sTCP:LISTEN 2>/dev/null | grep -q .; then printf 'cleanup failed: listener remains on %s\n' "$CLIENT_PORT" >&2; status=1; fi
  if [[ -n "$API_PID" ]] && lsof -nP -iTCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null | grep -q .; then printf 'cleanup failed: listener remains on %s\n' "$API_PORT" >&2; status=1; fi
  if docker ps -a --filter "label=com.docker.compose.project=$PROJECT" -q | grep -q .; then printf 'cleanup failed: owned containers remain\n' >&2; status=1; fi
  if docker volume ls --filter "label=com.docker.compose.project=$PROJECT" -q | grep -q .; then printf 'cleanup failed: owned volumes remain\n' >&2; status=1; fi
  if (( status == 0 )); then printf 'cleanup verified: no owned listeners, containers, or volumes (%s)\n' "$PROJECT"; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
[[ -f "$API_ROOT/docker-compose.yml" && -f "$API_ROOT/api/go.mod" ]] || { printf 'API checkout missing; set API_REPO_DIR\n' >&2; exit 1; }
mkdir -p "$ARTIFACT_DIR"
for tool in docker curl lsof pnpm go python3; do command -v "$tool" >/dev/null || { printf 'required command missing: %s\n' "$tool" >&2; exit 1; }; done
for port in "$API_PORT" "$CLIENT_PORT"; do lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q . && { printf 'port %s occupied; set SMOKE_*_PORT\n' "$port" >&2; exit 1; } || true; done
API_SHA=$(git -C "$API_ROOT" rev-parse HEAD)
CLIENT_SHA=$(git -C "$CLIENT_ROOT" rev-parse HEAD)
printf 'API_SHA=%s\nCLIENT_SHA=%s\n' "$API_SHA" "$CLIENT_SHA" | tee "$ARTIFACT_DIR/revisions.txt"
export SMOKE_API_PORT="$API_PORT" SMOKE_CLIENT_PORT="$CLIENT_PORT" SMOKE_WEBHOOK_SECRET="$SECRET_A"
export W2E_A_SECRET="$SECRET_A" W2E_B_SECRET="$SECRET_B"
export SCM_REPOSITORIES_JSON='[{"provider":"github","full_name":"w2e/a","webhook_secret_env":"W2E_A_SECRET"},{"provider":"github","full_name":"w2e/b","webhook_secret_env":"W2E_B_SECRET"}]'
DB_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
export POSTGRES_HOST_PORT="$DB_PORT" POSTGRES_PUBLISH=127.0.0.1
docker compose -p "$PROJECT" -f "$API_ROOT/docker-compose.yml" up -d postgres
DB_URL="postgres://agent_ops:agent_ops_dev@127.0.0.1:$DB_PORT/agent_ops?sslmode=disable"
for _ in {1..60}; do docker compose -p "$PROJECT" -f "$API_ROOT/docker-compose.yml" exec -T postgres pg_isready -U agent_ops -d agent_ops >/dev/null 2>&1 && break; sleep 1; done
(
  cd "$API_ROOT/api"
  HTTP_ADDR="127.0.0.1:$API_PORT" DATABASE_URL="$DB_URL" CORS_ORIGINS="http://127.0.0.1:$CLIENT_PORT" go run .
) >"$ARTIFACT_DIR/api.log" 2>&1 &
API_PID=$!
for _ in {1..90}; do curl -fsS "$API_URL/readyz" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "$API_URL/readyz" >/dev/null
pnpm --dir "$CLIENT_ROOT" install --frozen-lockfile
(cd "$CLIENT_ROOT" && APP_API_URL="$API_URL" pnpm build)
(cd "$CLIENT_ROOT" && APP_API_URL="$API_URL" pnpm preview --host 127.0.0.1 --port "$CLIENT_PORT") >"$ARTIFACT_DIR/preview.log" 2>&1 &
PREVIEW_PID=$!
for _ in {1..60}; do curl -fsS "$CLIENT_URL/board" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "$CLIENT_URL/board" >/dev/null
cd "$CLIENT_ROOT"
if ! SMOKE_ARTIFACT_DIR="$ARTIFACT_DIR" SMOKE_CLIENT_URL="$CLIENT_URL" APP_API_URL="$API_URL" SMOKE_WEBHOOK_SECRET="$SECRET_A" \
  npx playwright test --config=scripts/live-webhook.playwright.config.ts --reporter=line 2>&1 | tee "$ARTIFACT_DIR/browser.log"; then
  docker compose -p "$PROJECT" -f "$API_ROOT/docker-compose.yml" logs --no-color >"$ARTIFACT_DIR/compose.log"
  exit 1
fi
docker compose -p "$PROJECT" -f "$API_ROOT/docker-compose.yml" logs --no-color >"$ARTIFACT_DIR/compose.log"
printf 'PASS API=%s client=%s artifacts=%s\n' "$API_SHA" "$CLIENT_SHA" "$ARTIFACT_DIR"
