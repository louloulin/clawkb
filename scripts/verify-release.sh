#!/usr/bin/env bash
set -euo pipefail

DETECTED_ORT_LIB_DIR="$(
  python -c 'import importlib.util, os
spec = importlib.util.find_spec("onnxruntime")
if spec and spec.origin:
    print(os.path.join(os.path.dirname(spec.origin), "capi"))' 2>/dev/null || true
)"

if [ -n "${ORT_LIB_LOCATION:-$DETECTED_ORT_LIB_DIR}" ] && [ -d "${ORT_LIB_LOCATION:-$DETECTED_ORT_LIB_DIR}" ]; then
  ORT_SOURCE_DIR="${ORT_LIB_LOCATION:-$DETECTED_ORT_LIB_DIR}"
  ORT_LINK_DIR="${TMPDIR:-/tmp}/clawkb-ort-link-release"
  mkdir -p "$ORT_LINK_DIR"
  for dylib in "$ORT_SOURCE_DIR"/*.dylib; do
    [ -e "$dylib" ] || continue
    ln -sf "$dylib" "$ORT_LINK_DIR/$(basename "$dylib")"
  done
  if [ ! -e "$ORT_LINK_DIR/libonnxruntime.dylib" ]; then
    VERSIONED_ORT_DYLIB="$(find "$ORT_SOURCE_DIR" -maxdepth 1 -type f -name 'libonnxruntime*.dylib' | head -n 1)"
    if [ -n "$VERSIONED_ORT_DYLIB" ]; then
      ln -sf "$VERSIONED_ORT_DYLIB" "$ORT_LINK_DIR/libonnxruntime.dylib"
    fi
  fi
  export ORT_LIB_LOCATION="$ORT_LINK_DIR"
  export ORT_PREFER_DYNAMIC_LINK=1
  export DYLD_LIBRARY_PATH="$ORT_LINK_DIR:$ORT_SOURCE_DIR${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
fi

echo "==> Rust test suite"
cargo test

echo
echo "==> Frontend smoke suite"
(
  cd src
  npm test
)

echo
echo "==> Frontend production build"
(
  cd src
  npm run build
)

echo
echo "==> Browser preview runtime verification"
bash scripts/verify-runtime-modes.sh

echo
echo "==> Local-state persistence verification"
bash scripts/verify-local-state.sh

echo
echo "==> Error-handling verification"
bash scripts/verify-error-handling.sh

echo
echo "==> Desktop UI verification"
bash scripts/verify-desktop-ui.sh
