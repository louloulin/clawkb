#!/usr/bin/env bash
set -euo pipefail

VITE_LOG="${TMPDIR:-/tmp}/clawkb-runtime-modes-vite.log"
DOM_SNAPSHOT="${TMPDIR:-/tmp}/clawkb-runtime-modes-dom.html"
PORT="${CLAWKB_RUNTIME_VERIFY_PORT:-4273}"
BASE_URL="http://127.0.0.1:${PORT}"
CHROME_BIN="${CLAWKB_RUNTIME_VERIFY_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

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
echo "==> Runtime mode verification"
if [ ! -x "$CHROME_BIN" ]; then
  echo "Chrome binary not found for runtime verification: $CHROME_BIN"
  exit 1
fi

"$CHROME_BIN" \
  --headless=new \
  --disable-gpu \
  --virtual-time-budget=4000 \
  --dump-dom \
  "$BASE_URL" >"$DOM_SNAPSHOT"

if ! rg -q 'data-runtime-mode="browser-unsupported"' "$DOM_SNAPSHOT"; then
  echo "Runtime mode marker missing from rendered preview DOM."
  sed -n '1,120p' "$DOM_SNAPSHOT"
  exit 1
fi

if ! rg -qi 'Desktop runtime required' "$DOM_SNAPSHOT"; then
  echo "Desktop runtime guard text missing from rendered preview DOM."
  sed -n '1,160p' "$DOM_SNAPSHOT"
  exit 1
fi

if ! rg -qi 'Preview Only' "$DOM_SNAPSHOT"; then
  echo "Preview-only badge text missing from rendered preview DOM."
  sed -n '1,160p' "$DOM_SNAPSHOT"
  exit 1
fi

if ! rg -qi 'Open the Tauri desktop app' "$DOM_SNAPSHOT"; then
  echo "Desktop-only guidance missing from rendered preview DOM."
  sed -n '1,160p' "$DOM_SNAPSHOT"
  exit 1
fi

echo "{\"runtimeMode\":\"browser-unsupported\",\"verification\":\"preview-guard-rendered\",\"snapshot\":\"$DOM_SNAPSHOT\"}"
