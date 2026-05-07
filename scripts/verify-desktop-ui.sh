#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname)" != "Darwin" ]; then
  echo "Desktop UI verification currently supports macOS only."
  exit 1
fi

TAURI_LOG="${TMPDIR:-/tmp}/clawkb-desktop-ui.log"
VITE_LOG="${TMPDIR:-/tmp}/clawkb-desktop-ui-vite.log"
SCREENSHOT_PATH="${TMPDIR:-/tmp}/clawkb-desktop-ui.png"
PORT="${CLAWKB_DESKTOP_VERIFY_PORT:-4274}"
BASE_URL="http://127.0.0.1:${PORT}"
WINDOW_WAIT_STEPS="${CLAWKB_DESKTOP_VERIFY_WINDOW_WAIT_STEPS:-180}"
TAURI_CONFIG_OVERRIDE=$(printf '{"build":{"beforeDevCommand":"","devUrl":"%s"}}' "$BASE_URL")
DETECTED_ORT_LIB_DIR="$(
  python -c 'import importlib.util, os
spec = importlib.util.find_spec("onnxruntime")
if spec and spec.origin:
    print(os.path.join(os.path.dirname(spec.origin), "capi"))' 2>/dev/null || true
)"
ORT_LIB_DIR="${ORT_LIB_LOCATION:-$DETECTED_ORT_LIB_DIR}"
ORT_LINK_DIR="${TMPDIR:-/tmp}/clawkb-ort-link"

(
  cd src
  npm run dev -- --host 127.0.0.1 --port "$PORT" >"$VITE_LOG" 2>&1 &
  echo $! >"$VITE_LOG.pid"
)

cleanup() {
  osascript -e 'tell application "ClawKB" to quit' >/dev/null 2>&1 || true
  if [ -f "$VITE_LOG.pid" ]; then
    kill "$(cat "$VITE_LOG.pid")" >/dev/null 2>&1 || true
    rm -f "$VITE_LOG.pid"
  fi
  if [ -f "$TAURI_LOG.pid" ]; then
    kill "$(cat "$TAURI_LOG.pid")" >/dev/null 2>&1 || true
    rm -f "$TAURI_LOG.pid"
  fi
}
trap cleanup EXIT

WINDOW_INFO=""
IMAGE_SIZE=""
IMAGE_MEAN=""
IMAGE_STDDEV=""
WINDOW_ID=""

for _ in $(seq 1 30); do
  if curl -sf "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "$BASE_URL" >/dev/null 2>&1; then
  echo "Desktop UI verification dev server failed to start at $BASE_URL"
  cat "$VITE_LOG"
  exit 1
fi

(
  if [ -n "$ORT_LIB_DIR" ] && [ -d "$ORT_LIB_DIR" ]; then
    mkdir -p "$ORT_LINK_DIR"
    for dylib in "$ORT_LIB_DIR"/*.dylib; do
      [ -e "$dylib" ] || continue
      ln -sf "$dylib" "$ORT_LINK_DIR/$(basename "$dylib")"
    done
    if [ ! -e "$ORT_LINK_DIR/libonnxruntime.dylib" ]; then
      VERSIONED_ORT_DYLIB="$(find "$ORT_LIB_DIR" -maxdepth 1 -type f -name 'libonnxruntime*.dylib' | head -n 1)"
      if [ -n "$VERSIONED_ORT_DYLIB" ]; then
        ln -sf "$VERSIONED_ORT_DYLIB" "$ORT_LINK_DIR/libonnxruntime.dylib"
      fi
    fi
    export ORT_LIB_LOCATION="$ORT_LINK_DIR"
    export ORT_PREFER_DYNAMIC_LINK=1
    export DYLD_LIBRARY_PATH="$ORT_LINK_DIR:$ORT_LIB_DIR${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
  fi
  cargo tauri dev --no-watch --config "$TAURI_CONFIG_OVERRIDE" >"$TAURI_LOG" 2>&1 &
  echo $! >"$TAURI_LOG.pid"
)

for _ in $(seq 1 "$WINDOW_WAIT_STEPS"); do
  osascript <<'APPLESCRIPT' >/dev/null 2>&1 || true
tell application "System Events"
  set matchingProcesses to every process whose name contains "ClawKB"
  if (count of matchingProcesses) is 0 then return

  set procRef to item 1 of matchingProcesses
  if not (exists window 1 of procRef) then return

  set frontmost of procRef to true
end tell
APPLESCRIPT
  WINDOW_INFO="$(
    python -c 'import Quartz
TARGET_TITLE = "ClawKB — Personal Knowledge Base"
wins = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
matches = []
for w in wins:
    owner = (w.get("kCGWindowOwnerName") or "")
    name = (w.get("kCGWindowName") or "")
    if owner == "clawkb-app" and name == TARGET_TITLE:
        bounds = w.get("kCGWindowBounds") or {}
        matches.append((name, int(w.get("kCGWindowNumber")), int(bounds.get("X", 0)), int(bounds.get("Y", 0)), int(bounds.get("Width", 0)), int(bounds.get("Height", 0))))
if matches:
    name, number, x, y, width, height = matches[0]
    print(f"{len(matches)}|{name}|{number}|{x},{y}|{width},{height}")' 2>/dev/null || true
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

WINDOW_COUNT="${WINDOW_INFO%%|*}"
REMAINDER="${WINDOW_INFO#*|}"
WINDOW_TITLES="${REMAINDER%%|*}"
REMAINDER="${REMAINDER#*|}"
WINDOW_ID="${REMAINDER%%|*}"
REMAINDER="${REMAINDER#*|}"
WINDOW_POSITION="${REMAINDER%%|*}"
WINDOW_SIZE="${REMAINDER#*|}"

WINDOW_X="${WINDOW_POSITION%%,*}"
WINDOW_Y="${WINDOW_POSITION#*,}"
WINDOW_WIDTH="${WINDOW_SIZE%%,*}"
WINDOW_HEIGHT="${WINDOW_SIZE#*,}"

if [ -z "$WINDOW_X" ] || [ -z "$WINDOW_Y" ] || [ -z "$WINDOW_WIDTH" ] || [ -z "$WINDOW_HEIGHT" ]; then
  echo "Failed to determine ClawKB window bounds."
  echo "$WINDOW_INFO"
  exit 1
fi

for _ in $(seq 1 15); do
  python -c 'import Quartz
from AppKit import NSBitmapImageRep, NSPNGFileType
import sys
window_id = int(sys.argv[1])
output_path = sys.argv[2]
image = Quartz.CGWindowListCreateImage(
    Quartz.CGRectNull,
    Quartz.kCGWindowListOptionIncludingWindow,
    window_id,
    Quartz.kCGWindowImageBoundsIgnoreFraming,
)
if image is None:
    raise SystemExit("failed to capture target window")
bitmap = NSBitmapImageRep.alloc().initWithCGImage_(image)
data = bitmap.representationUsingType_properties_(NSPNGFileType, None)
ok = data.writeToFile_atomically_(output_path, True)
if not ok:
    raise SystemExit("failed to write screenshot")' "$WINDOW_ID" "$SCREENSHOT_PATH"

  IMAGE_WIDTH="$(sips -g pixelWidth "$SCREENSHOT_PATH" 2>/dev/null | awk '/pixelWidth/ {print $2}')"
  IMAGE_HEIGHT="$(sips -g pixelHeight "$SCREENSHOT_PATH" 2>/dev/null | awk '/pixelHeight/ {print $2}')"
  IMAGE_SIZE="${IMAGE_WIDTH}x${IMAGE_HEIGHT}"
  SCREEN_SCALE_X=$(( IMAGE_WIDTH / WINDOW_WIDTH ))
  SCREEN_SCALE_Y=$(( IMAGE_HEIGHT / WINDOW_HEIGHT ))

  if [ $(( WINDOW_WIDTH * SCREEN_SCALE_X )) -ne "$IMAGE_WIDTH" ] || \
     [ $(( WINDOW_HEIGHT * SCREEN_SCALE_Y )) -ne "$IMAGE_HEIGHT" ] || \
     [ "$SCREEN_SCALE_X" -ne "$SCREEN_SCALE_Y" ] || \
     [ "$SCREEN_SCALE_X" -lt 1 ]; then
    echo "Captured screenshot size does not match the ClawKB window bounds after accounting for display scale."
    echo "window=${WINDOW_WIDTH}x${WINDOW_HEIGHT} screenshot=${IMAGE_SIZE} scale=${SCREEN_SCALE_X}x${SCREEN_SCALE_Y}"
    exit 1
  fi

  if [ "$IMAGE_WIDTH" -lt 600 ] || [ "$IMAGE_HEIGHT" -lt 400 ]; then
    echo "Captured ClawKB window screenshot is unexpectedly small: ${IMAGE_SIZE}"
    exit 1
  fi

  IMAGE_STATS="$(
    python -c 'from PIL import Image, ImageStat
import sys
im = Image.open(sys.argv[1]).convert("L")
stat = ImageStat.Stat(im)
print(f"{stat.mean[0]:.2f}|{stat.stddev[0]:.2f}")' "$SCREENSHOT_PATH"
  )"
  IMAGE_MEAN="${IMAGE_STATS%%|*}"
  IMAGE_STDDEV="${IMAGE_STATS#*|}"

  if python -c 'import sys
mean = float(sys.argv[1])
stddev = float(sys.argv[2])
sys.exit(0 if stddev >= 12 and mean >= 20 else 1)' "$IMAGE_MEAN" "$IMAGE_STDDEV"; then
    break
  fi

  sleep 2
done

if ! python -c 'import sys
mean = float(sys.argv[1])
stddev = float(sys.argv[2])
sys.exit(0 if stddev >= 12 and mean >= 20 else 1)' "$IMAGE_MEAN" "$IMAGE_STDDEV"; then
  echo "Captured ClawKB window screenshot still looks blank."
  echo "image=${IMAGE_SIZE} mean=${IMAGE_MEAN} stddev=${IMAGE_STDDEV}"
  exit 1
fi

echo "{\"windowCount\":\"$WINDOW_COUNT\",\"windowInfo\":\"$WINDOW_TITLES\",\"bounds\":\"${WINDOW_X},${WINDOW_Y},${WINDOW_WIDTH},${WINDOW_HEIGHT}\",\"imageSize\":\"$IMAGE_SIZE\",\"scale\":\"$SCREEN_SCALE_X\",\"mean\":\"$IMAGE_MEAN\",\"stddev\":\"$IMAGE_STDDEV\",\"screenshot\":\"$SCREENSHOT_PATH\"}"
