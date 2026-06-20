#!/usr/bin/env bash
# Mirror the GitHub Actions "Install dependencies" + "Build" steps locally.
# Usage (from repo root or milionaire/):
#   ./milionaire/scripts/test-ci-build.sh
#   ./milionaire/scripts/test-ci-build.sh --dry-run-s3   # also validate aws s3 sync syntax
#
# Env: loads milionaire/.env if present (same vars as CI / .env.example).
# For a clean CI-like run without .env, unset those vars or use an empty env file.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Loaded .env"
else
  echo "No .env found — build uses only exported env vars (like CI secrets/variables)."
fi

echo "==> Node $(node -v)"
echo "==> npm ci --ignore-scripts"
npm ci --ignore-scripts

echo "==> npm run build"
npm run build

if [[ ! -f dist/index.html ]]; then
  echo "ERROR: dist/index.html missing after build" >&2
  exit 1
fi

ASSET_COUNT="$(find dist/assets -type f 2>/dev/null | wc -l | tr -d ' ')"
echo "Build OK: dist/index.html + ${ASSET_COUNT} asset file(s)"

if [[ "${1:-}" == "--dry-run-s3" ]]; then
  BUCKET="${MILLIONAIRE_S3_BUCKET:-}"
  if [[ -z "$BUCKET" ]]; then
    echo "Set MILLIONAIRE_S3_BUCKET to dry-run S3 sync (or add to .env)" >&2
    exit 1
  fi
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI not installed — skipping S3 dry-run" >&2
    exit 0
  fi
  echo "==> aws s3 sync (dry-run)"
  aws s3 sync dist/ "s3://${BUCKET}" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --dryrun
  aws s3 cp dist/index.html "s3://${BUCKET}/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --dryrun
  echo "S3 dry-run OK"
fi
