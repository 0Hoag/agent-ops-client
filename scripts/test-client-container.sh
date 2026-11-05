#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="w17e-$(date +%s)-$$"
IMAGE="agent-ops-client:${RUN_ID}"
NETWORK="${RUN_ID}-net"
UPSTREAM="${RUN_ID}-http-upstream"
CLIENT="${RUN_ID}-client"
PORT="${CLIENT_PORT:-18087}"
DOCKER_CONFIG="${DOCKER_CONFIG:-${ROOT}/.agent-runs/docker-config}"
mkdir -p "${ROOT}/.agent-runs" "${DOCKER_CONFIG}"
export DOCKER_CONFIG

cleanup() {
  docker rm -f "${CLIENT}" "${UPSTREAM}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK}" >/dev/null 2>&1 || true
  docker image rm "${IMAGE}" >/dev/null 2>&1 || true
}

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
wait_http() {
  local url="$1" i
  for i in $(seq 1 60); do
    if curl --silent --show-error --fail "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  fail "readiness timeout: ${url}"
}

cd "${ROOT}"
trap cleanup EXIT
docker build -t "${IMAGE}" .
docker network create "${NETWORK}" >/dev/null
docker run -d --name "${UPSTREAM}" --network "${NETWORK}" --network-alias upstream \
  python:3.12-alpine python -u -c 'from http.server import BaseHTTPRequestHandler,HTTPServer
class H(BaseHTTPRequestHandler):
 protocol_version="HTTP/1.1"
 def do_GET(self):
  if self.path=="/api/v1/board/ws?probe=one" and self.headers.get("Upgrade","").lower()=="websocket" and self.headers.get("Connection","").lower()=="upgrade" and self.headers.get("Authorization")=="Bearer fixture-token":
   self.send_response(101,"Switching Protocols"); self.send_header("Upgrade","websocket"); self.send_header("Connection","Upgrade"); self.send_header("X-Fixture","PASS"); self.end_headers(); return
  if self.headers.get("Upgrade","").lower()=="websocket":
   self.send_response(200); self.send_header("Content-Length","0"); self.end_headers(); return
  self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write((self.path+"|"+self.headers.get("Authorization","")).encode())
 def log_message(self,*a): pass
HTTPServer(("0.0.0.0",8080),H).serve_forever()' >/dev/null
for i in $(seq 1 60); do
  if docker exec "${UPSTREAM}" python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8080/routing-fixture")' >/dev/null 2>&1; then break; fi
  [[ "$i" -lt 60 ]] || fail 'upstream readiness timeout'
  sleep 1
done
printf 'PASS: isolated upstream ready\n'
docker run -d --name "${CLIENT}" --network "${NETWORK}" -p "127.0.0.1:${PORT}:8080" \
  -e API_UPSTREAM=http://upstream:8080 "${IMAGE}" >/dev/null

uid="$(docker exec "${CLIENT}" id -u)"
[[ "${uid}" != 0 ]] || fail "container runs as UID 0"
printf 'PASS: runtime UID=%s\n' "${uid}"
wait_http "http://127.0.0.1:${PORT}/"
js_path="$(curl --silent --fail "http://127.0.0.1:${PORT}/" | python3 -c 'import re,sys; print(re.search(r"<script[^>]+src=\"([^\"]+\.js)\"",sys.stdin.read()).group(1))')"
curl --silent --show-error --fail "http://127.0.0.1:${PORT}${js_path}" >/dev/null || fail 'built JavaScript not served'
printf 'PASS: production JavaScript served (%s)\n' "${js_path}"
deep="$(curl --silent --show-error --fail "http://127.0.0.1:${PORT}/runs/deep/route")"
[[ "${deep}" == *'<div id="root"'* ]] || fail 'deep route did not return SPA document'
printf 'PASS: deep SPA route fallback\n'
proxy="$(curl --silent --show-error --fail -H 'Authorization: Bearer fixture-token' "http://127.0.0.1:${PORT}/api/v1/routing-fixture?probe=one")"
[[ "${proxy}" == '/api/v1/routing-fixture?probe=one|Bearer fixture-token' ]] || fail "proxy response mismatch: ${proxy}"
printf 'PASS: HTTP path/query and Authorization preserved\n'
ws="$(curl --silent --show-error --include --http1.1 -H 'Authorization: Bearer fixture-token' -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "http://127.0.0.1:${PORT}/api/v1/board/ws?probe=one" || true)"
[[ "${ws}" == *'101 Switching Protocols'* && "${ws}" == *'X-Fixture: PASS'* ]] || fail "websocket proxy mismatch: ${ws}"
printf 'PASS: websocket path/query and upgrade headers preserved\n'

NODE_PATH="${ROOT}/node_modules${NODE_PATH:+:${NODE_PATH}}" CLIENT_URL="http://127.0.0.1:${PORT}" node -e 'const { chromium }=require("playwright"); (async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();const failed=[];p.on("requestfailed",r=>failed.push(r.url()));p.on("response",r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});await p.goto(process.env.CLIENT_URL,{waitUntil:"networkidle"});if(failed.length)throw Error("failed assets: "+failed.join(","));console.log("PASS: browser loaded production image without failed static assets")}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)})'

docker rm -f "${CLIENT}" "${UPSTREAM}" >/dev/null
docker network rm "${NETWORK}" >/dev/null
cleanup
trap - EXIT
[[ -z "$(docker ps -aq --filter "name=^${CLIENT}$")" && -z "$(docker ps -aq --filter "name=^${UPSTREAM}$")" ]] || fail 'owned container remains'
[[ -z "$(docker network ls -q --filter "name=^${NETWORK}$")" ]] || fail 'owned network remains'
[[ -z "$(docker volume ls -q --filter "name=${RUN_ID}")" ]] || fail 'owned volume remains'
printf 'PASS: no owned containers, network, or volumes remain\n'
