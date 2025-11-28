#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
cd "$BACKEND_DIR"
PYTHON_BIN=${PYTHON_BIN:-python3.11}
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN=${PYTHON_FALLBACK:-python3}
fi
if [ ! -d ".venv" ]; then
  echo "[start-backend] Creating virtualenv with $PYTHON_BIN"
  "$PYTHON_BIN" -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -e . >/dev/null
export DATABASE__URL=${DATABASE__URL:-sqlite:///./dev.db}
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
