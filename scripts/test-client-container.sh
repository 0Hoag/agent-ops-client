#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="w17b-$(date +%s)-$$"
IMAGE="agent-ops-client:${RUN_ID}"
NETWORK="${RUN_ID}-net"
UPSTREAM="${RUN_ID}-upstream"
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
 def do_GET(self):
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
proxy="$(curl --silent --show-error --fail -H 'Authorization: Bearer fixture-token' "http://127.0.0.1:${PORT}/api/routing-fixture")"
[[ "${proxy}" == '/routing-fixture|Bearer fixture-token' ]] || fail "proxy response mismatch: ${proxy}"
printf 'PASS: isolated routing fixture proxy and Authorization forwarding\n'

CLIENT_URL="http://127.0.0.1:${PORT}" node -e 'const { chromium }=require("playwright"); (async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();const failed=[];p.on("requestfailed",r=>failed.push(r.url()));p.on("response",r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});await p.goto(process.env.CLIENT_URL,{waitUntil:"networkidle"});if(failed.length)throw Error("failed assets: "+failed.join(","));console.log("PASS: browser loaded production image without failed static assets")}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)})'

docker rm -f "${CLIENT}" "${UPSTREAM}" >/dev/null
docker network rm "${NETWORK}" >/dev/null
cleanup
trap - EXIT
[[ -z "$(docker ps -aq --filter "name=^${CLIENT}$")" ]] || fail 'owned container remains'
[[ -z "$(docker network ls -q --filter "name=^${NETWORK}$")" ]] || fail 'owned network remains'
[[ -z "$(docker volume ls -q --filter "name=${RUN_ID}")" ]] || fail 'owned volume remains'
printf 'PASS: no owned containers, network, or volumes remain\n'
