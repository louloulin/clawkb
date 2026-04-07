#!/usr/bin/env bash
set -euo pipefail

echo "==> Frontend error-classification regression tests"
(
  cd src
  npm test -- src/__tests__/app-error.test.ts
)
