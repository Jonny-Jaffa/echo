#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

unset ELECTRON_RUN_AS_NODE

pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

npm run dev:reception &
pids+=("$!")

sleep 1

npm run dev:client-panel &
pids+=("$!")

sleep 1

npm run dev:client-panel:room2 &
pids+=("$!")

wait
