#!/usr/bin/env bash
set -Eeuo pipefail

CLIENT_DIR=${CLIENT_DIR:?CLIENT_DIR must point to a clean client fixture}
API_REPO_DIR=${API_REPO_DIR:?API_REPO_DIR must point to an API checkout}
if [[ ! -d "$API_REPO_DIR" ]] || ! git -C "$API_REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'invalid API_REPO_DIR: not a Git checkout: %s\n' "$API_REPO_DIR" >&2
  exit 1
fi
if [[ ! -f "$API_REPO_DIR/docker-compose.yml" || ! -f "$API_REPO_DIR/api/go.mod" ]]; then
  printf 'invalid API_REPO_DIR: expected docker-compose.yml and api/go.mod: %s\n' "$API_REPO_DIR" >&2
  exit 1
fi
ARTIFACT_DIR="$CLIENT_DIR/artifacts/insights-api-smoke"
PROJECT="insights-api-$(id -u)-$$"
API_PORT=19993
CLIENT_PORT=19994
DB_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
API_PID=
PREVIEW_PID=
SECRET="insights-$(id -u)-$$"
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  for pid in "$PREVIEW_PID" "$API_PID"; do
    if [[ -n "$pid" ]]; then
      python3 - "$pid" <<'PY'
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
      wait "$pid" 2>/dev/null || true
    fi
  done
  docker compose -p "$PROJECT" -f "$API_REPO_DIR/docker-compose.yml" down --volumes --remove-orphans >/dev/null 2>&1 || true
  for port in "$API_PORT" "$CLIENT_PORT"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q .; then printf 'cleanup failed: listener remains on %s\n' "$port" >&2; status=1; fi
  done
  if docker ps -a --filter "label=com.docker.compose.project=$PROJECT" -q | grep -q .; then printf 'cleanup failed: owned containers remain (%s)\n' "$PROJECT" >&2; status=1; fi
  if docker volume ls --filter "label=com.docker.compose.project=$PROJECT" -q | grep -q .; then printf 'cleanup failed: owned volumes remain (%s)\n' "$PROJECT" >&2; status=1; fi
  if (( status == 0 )); then printf 'cleanup verified: owned listeners, containers, and volumes absent (%s)\n' "$PROJECT"; fi
  exit "$status"
}
trap cleanup EXIT
for command in docker curl lsof pnpm go python3; do command -v "$command" >/dev/null || { printf 'required command missing: %s\n' "$command" >&2; exit 1; }; done
for port in "$API_PORT" "$CLIENT_PORT"; do lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q . && { printf 'port %s already occupied\n' "$port" >&2; exit 1; } || true; done
mkdir -p "$ARTIFACT_DIR"
API_SHA=$(git -C "$API_REPO_DIR" rev-parse HEAD)
CLIENT_SHA=$(git -C "$CLIENT_DIR" rev-parse HEAD)
printf 'API_SHA=%s\nCLIENT_SHA=%s\n' "$API_SHA" "$CLIENT_SHA" | tee "$ARTIFACT_DIR/revisions.txt"
export POSTGRES_HOST_PORT="$DB_PORT" POSTGRES_PUBLISH=127.0.0.1
docker compose -p "$PROJECT" -f "$API_REPO_DIR/docker-compose.yml" up -d postgres
DB_URL="postgres://agent_ops:agent_ops_dev@127.0.0.1:$DB_PORT/agent_ops?sslmode=disable"
for _ in {1..60}; do docker compose -p "$PROJECT" -f "$API_REPO_DIR/docker-compose.yml" exec -T postgres pg_isready -U agent_ops -d agent_ops >/dev/null 2>&1 && break; sleep 1; done
export SCM_REPOSITORIES_JSON='[{"provider":"github","full_name":"fixture/insights","webhook_secret_env":"INSIGHTS_SECRET"}]' INSIGHTS_SECRET="$SECRET"
(
  cd "$API_REPO_DIR/api"
  HTTP_ADDR="127.0.0.1:$API_PORT" DATABASE_URL="$DB_URL" CORS_ORIGINS="http://127.0.0.1:$CLIENT_PORT" go run .
) >"$ARTIFACT_DIR/api.log" 2>&1 & API_PID=$!
API_URL="http://127.0.0.1:$API_PORT"; CLIENT_URL="http://127.0.0.1:$CLIENT_PORT"
for _ in {1..90}; do curl -fsS "$API_URL/readyz" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "$API_URL/readyz" >/dev/null
REPOSITORY_ID=$(curl -fsS "$API_URL/api/v1/repositories?page=1&per_page=100" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
export DB_PORT API_URL REPOSITORY_ID CLIENT_DIR CLIENT_URL ARTIFACT_DIR
docker compose -p "$PROJECT" -f "$API_REPO_DIR/docker-compose.yml" exec -T postgres psql -U agent_ops -d agent_ops -v ON_ERROR_STOP=1 -c "INSERT INTO webhook_events (id,repository_id,provider,event_type,delivery_id,payload,received_at,created_at,updated_at) VALUES ('a0000000-0000-4000-8000-000000000001','$REPOSITORY_ID','github','issues','fixture-issue','{\"issue\":{\"number\":17,\"state\":\"closed\",\"labels\":[]}}'::jsonb,NOW(),NOW(),NOW())"
curl -fsS "$API_URL/api/v1/insights?repository_id=$REPOSITORY_ID" >"$ARTIFACT_DIR/seeded-api-response.json"
python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); assert p["data"]["history"]["complete"] is False; print("Seeded API response PASS:",p["data"]["history"],p["data"]["cycle_time"])' "$ARTIFACT_DIR/seeded-api-response.json"
(cd "$CLIENT_DIR" && APP_API_URL="$API_URL" pnpm build) >"$ARTIFACT_DIR/client-build.log" 2>&1
(cd "$CLIENT_DIR" && APP_API_URL="$API_URL" pnpm preview --host 127.0.0.1 --port "$CLIENT_PORT") >"$ARTIFACT_DIR/preview.log" 2>&1 & PREVIEW_PID=$!
for _ in {1..60}; do curl -fsS "$CLIENT_URL/insights" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "$CLIENT_URL/insights" >/dev/null
INSIGHTS_BROWSER_URL="$CLIENT_URL" pnpm --dir "$CLIENT_DIR" verify:insights-browser >"$ARTIFACT_DIR/browser.log" 2>&1
printf 'API=%s client=%s repo=%s artifacts=%s\n' "$API_SHA" "$CLIENT_SHA" "$REPOSITORY_ID" "$ARTIFACT_DIR"
