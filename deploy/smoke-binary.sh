#!/usr/bin/env bash
# Smoke-tests a standalone Orbit binary in isolated temporary storage. No Docker, no dev database.
set -euo pipefail
binary=${1:-./target/release/orbit}

tmp=$(mktemp -d)
pid=""
cleanup() {
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
export ORBIT_ENV=production \
  ORBIT_BIND=127.0.0.1 \
  ORBIT_PORT="$port" \
  ORBIT_PUBLIC_ORIGIN=https://orbit.test \
  ORBIT_TRUSTED_PROXIES=127.0.0.1/32 \
  ORBIT_APP_KEY="$(openssl rand -base64 32)" \
  ORBIT_DATABASE_PATH="$tmp/orbit.sqlite" \
  ORBIT_ATTACHMENTS_PATH="$tmp/attachments" \
  ORBIT_BACKUPS_PATH="$tmp/backups"
mkdir -p "$tmp/attachments" "$tmp/backups"

"$binary" --help >/dev/null
"$binary" serve >"$tmp/server.log" 2>&1 &
pid=$!

base="http://127.0.0.1:$port"
for _ in $(seq 1 60); do
  if curl --max-time 3 -fsS -H 'X-Forwarded-Proto: https' "$base/health/ready" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS -H 'X-Forwarded-Proto: https' "$base/health/ready" >/dev/null
[[ $(curl -s -o /dev/null -w '%{http_code}' "$base/health/ready") == 400 ]]
curl -fsS -D "$tmp/headers" -H 'X-Forwarded-Proto: https' "$base/" >"$tmp/index"
grep -qi 'strict-transport-security:' "$tmp/headers"
grep -q '<div id="root">' "$tmp/index"
curl -fsS -H 'X-Forwarded-Proto: https' "$base/api/v1/setup/status" >"$tmp/setup"
python3 -c 'import json,sys; s=json.load(open(sys.argv[1])); assert not s["complete"], s' "$tmp/setup"
[[ $(curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' -H 'Origin: https://orbit.test' -H 'Content-Type: application/json' --data '{"email":"test@example.com","password":"password"}' "$base/api/v1/auth/login") == 401 ]]
for flag in --seed --reset; do
  if "$binary" migrate run "$flag" --yes >"$tmp/guard" 2>&1; then
    echo "Production binary incorrectly accepted $flag" >&2
    exit 1
  fi
  grep -q 'development mode' "$tmp/guard"
done

echo "PASS production binary: HTTPS boundary, embedded SPA, setup required, no seeded login, seed/reset blocked."
