#!/usr/bin/env bash
# Spin up Redis (if free), two Node instances, run load-multi-instance.js, tear down.
#
#   ./scripts/run-multi-instance-local.sh
#   PAIRS=20 ./scripts/run-multi-instance-local.sh
#
# Optional: REDIS_URL already pointing at a live Redis (script will not start its own).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PAIRS="${PAIRS:-8}"
PORT_A="${PORT_A:-9001}"
PORT_B="${PORT_B:-9002}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export REDIS_URL

cleanup() {
  for pid in ${PID_A:-} ${PID_B:-} ${PID_REDIS:-}; do
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

# Start Redis if nothing answers PING
if ! redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
  if command -v redis-server >/dev/null 2>&1; then
    redis-server --daemonize yes --port 6379 --save "" --appendonly no
    PID_REDIS="$(redis-cli info server 2>/dev/null | true)"
    sleep 0.3
  else
    echo "Redis not reachable at $REDIS_URL and redis-server not in PATH" >&2
    exit 1
  fi
fi

BP_STORE="${BP_STORE:-memory}"
BP_LOG="${BP_LOG:-warn}"

PORT="$PORT_A" BP_INSTANCE_ID="load-a" BP_STORE="$BP_STORE" BP_LOG="$BP_LOG" \
  node server.js &
PID_A=$!
PORT="$PORT_B" BP_INSTANCE_ID="load-b" BP_STORE="$BP_STORE" BP_LOG="$BP_LOG" \
  node server.js &
PID_B=$!

# Wait for health
for port in "$PORT_A" "$PORT_B"; do
  for _ in $(seq 1 50); do
    if curl -sf "http://127.0.0.1:${port}/health" >/dev/null; then
      break
    fi
    sleep 0.15
  done
  curl -sf "http://127.0.0.1:${port}/health" >/dev/null || {
    echo "health failed on :$port" >&2
    exit 1
  }
done

node scripts/load-multi-instance.js \
  --a "ws://127.0.0.1:${PORT_A}/ws" \
  --b "ws://127.0.0.1:${PORT_B}/ws" \
  --pairs "$PAIRS"
