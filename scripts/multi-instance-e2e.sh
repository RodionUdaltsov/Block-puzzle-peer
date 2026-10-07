#!/usr/bin/env bash
# Run multi-instance e2e against a local Redis (and optional Postgres).
#
# Examples:
#   ./scripts/multi-instance-e2e.sh
#   REDIS_URL=redis://127.0.0.1:6379 ./scripts/multi-instance-e2e.sh
#   DATABASE_URL=postgres://bp:bp@127.0.0.1:5432/blockpuzzle BP_STORE=postgres ./scripts/multi-instance-e2e.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export BP_STORE="${BP_STORE:-memory}"
export BP_LOG="${BP_LOG:-warn}"

echo "REDIS_URL=$REDIS_URL BP_STORE=$BP_STORE"
exec node --test --test-name-pattern=multi-instance test/multi-instance.e2e.test.js
