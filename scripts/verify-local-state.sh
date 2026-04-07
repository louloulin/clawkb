#!/usr/bin/env bash
set -euo pipefail

echo "==> Frontend persistence regression tests"
(
  cd src
  npm test -- src/__tests__/store-persistence.test.ts
)
