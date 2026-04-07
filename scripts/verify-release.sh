#!/usr/bin/env bash
set -euo pipefail

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
