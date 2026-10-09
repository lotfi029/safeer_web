#!/usr/bin/env bash
# .github/scripts/check-image.sh — proves a built safeer-web image serves the site the way the VPS
# runs it (safeer_api docs/backend/DEPLOYMENT-VPS.md): PUBLIC_SITE_URL is a real-looking https domain
# with no DNS, and every SSR call must go to API_INTERNAL_URL (B2). Uses the mock API on the host.
#
#   1. the container starts, reports healthy, runs as `node`, carries no node_modules
#   2. /ar and /en with Host: safeer.test (and www.) render 200 with the transfer state
#   3. a foreign Host is refused (400); /api/v1/site is proxied to the API
#
# Usage: .github/scripts/check-image.sh <image>   (ci.yml's `image` job)
set -euo pipefail

IMAGE="${1:?usage: check-image.sh <image>}"
NAME="safeer-web-imgcheck-$$"
API_PORT=3150
WEB_PORT=4150
mock_pid=""

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "--- web logs ---"; docker logs "$NAME" 2>&1 | tail -50 || true
  fi
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  [ -n "$mock_pid" ] && kill "$mock_pid" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT

step() { echo; echo "==> $*"; }

step "mock API on 127.0.0.1:$API_PORT"
MOCK_API_PORT=$API_PORT node e2e/mock-api/server.mjs > /dev/null 2>&1 &
mock_pid=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$API_PORT/api/v1/health" > /dev/null && break
  [ "$i" = 50 ] && { echo "mock API did not start"; exit 1; }
  sleep 0.2
done

step "1. container up (host network, as API_INTERNAL_URL is on the host here)"
docker run -d --name "$NAME" --network host \
  -e HOST=127.0.0.1 -e PORT=$WEB_PORT \
  -e PUBLIC_SITE_URL=https://safeer.test \
  -e API_INTERNAL_URL=http://127.0.0.1:$API_PORT \
  -e TRUST_PROXY=1 \
  "$IMAGE" > /dev/null
for i in $(seq 1 40); do
  health="$(docker inspect -f '{{.State.Health.Status}}' "$NAME")"
  [ "$health" = healthy ] && break
  [ "$i" = 40 ] && { echo "container health: $health"; exit 1; }
  sleep 2
done
echo "container health: $health"
docker exec "$NAME" sh -c 'test "$(whoami)" = node && test ! -e node_modules && test ! -e dist/safeer_web/node_modules && echo "user=$(whoami), no node_modules"'

step "2. pages render for the public host (B2: SSR never fetches https://safeer.test)"
for host in safeer.test www.safeer.test; do
  for path in /ar /en; do
    out="$(mktemp)"
    code="$(curl -s -o "$out" -w '%{http_code}' -H "Host: $host" -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$WEB_PORT$path")"
    grep -q 'ng-state' "$out" || { echo "$host$path: no transfer state"; code="fail"; }
    echo "$host$path → $code"
    rm -f "$out"
    [ "$code" = 200 ] || exit 1
  done
done

step "3. host check and proxy"
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' "http://127.0.0.1:$WEB_PORT/ar")"
echo "Host: evil.example → $code"; [ "$code" = 400 ]
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: safeer.test' "http://127.0.0.1:$WEB_PORT/api/v1/site")"
echo "/api/v1/site → $code"; [ "$code" = 200 ]

echo; echo "Image check passed: $IMAGE"
