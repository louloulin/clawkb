#!/usr/bin/env bash
set -euo pipefail

VITE_LOG="${TMPDIR:-/tmp}/clawkb-local-state-vite.log"
PORT="${CLAWKB_VERIFY_PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"

echo "==> Frontend build"
(
  cd src
  npm run build
)

echo
echo "==> Start local dev server"
(
  cd src
  npm run dev -- --host 127.0.0.1 --port "$PORT" >"$VITE_LOG" 2>&1 &
  echo $! >"$VITE_LOG.pid"
)

cleanup() {
  if [ -f "$VITE_LOG.pid" ]; then
    kill "$(cat "$VITE_LOG.pid")" >/dev/null 2>&1 || true
    rm -f "$VITE_LOG.pid"
  fi
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -sf "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "$BASE_URL" >/dev/null 2>&1; then
  echo "Dev server failed to start at $BASE_URL"
  cat "$VITE_LOG"
  exit 1
fi

echo
echo "==> Local state persistence smoke check"
npx --yes -p playwright node scripts/verify-local-state-playwright.mjs "$BASE_URL"
