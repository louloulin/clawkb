#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname)" != "Darwin" ]; then
  echo "Desktop UI verification currently supports macOS only."
  exit 1
fi

TAURI_LOG="${TMPDIR:-/tmp}/clawkb-desktop-ui.log"
SCREENSHOT_PATH="${TMPDIR:-/tmp}/clawkb-desktop-ui.png"

(
  cargo tauri dev --no-watch >"$TAURI_LOG" 2>&1 &
  echo $! >"$TAURI_LOG.pid"
)

cleanup() {
  osascript -e 'tell application "ClawKB" to quit' >/dev/null 2>&1 || true
  if [ -f "$TAURI_LOG.pid" ]; then
    kill "$(cat "$TAURI_LOG.pid")" >/dev/null 2>&1 || true
    rm -f "$TAURI_LOG.pid"
  fi
}
trap cleanup EXIT

WINDOW_INFO=""
for _ in $(seq 1 90); do
  WINDOW_INFO="$(
    osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "System Events"
  set matchingProcesses to every process whose name contains "ClawKB"
  if (count of matchingProcesses) is 0 then
    return ""
  end if

  set procRef to item 1 of matchingProcesses
  if not (exists window 1 of procRef) then
    return ""
  end if

  set windowNames to name of every window of procRef
  return (count of windowNames as string) & "|" & (windowNames as text)
end tell
APPLESCRIPT
  )"

  if [ -n "$WINDOW_INFO" ]; then
    break
  fi
  sleep 2
done

if [ -z "$WINDOW_INFO" ]; then
  echo "Failed to observe a ClawKB desktop window."
  cat "$TAURI_LOG"
  exit 1
fi

screencapture -x "$SCREENSHOT_PATH" || true
echo "{\"windowInfo\":\"$WINDOW_INFO\",\"screenshot\":\"$SCREENSHOT_PATH\"}"
