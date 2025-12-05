#!/usr/bin/env bash
set -euo pipefail

# Run Detox on iOS simulator with Expo dev client.
# Usage:
#   ./scripts/run-detox-ios.sh seeded       # uses TEST_DB_SEED=true
#   ./scripts/run-detox-ios.sh shift        # UI-driven flow (no seed)
#
# Optional env:
#   TEST_PRIVACY_NOISE_SEED (default 12345)
#   DETOX_CONFIG (default ios.sim.debug)
#   SIMULATOR_NAME (default "iPhone 15")

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-seeded}"
DETOX_CONFIG="${DETOX_CONFIG:-ios.sim.debug}"
SIMULATOR_NAME="${SIMULATOR_NAME:-iPhone 15}"
NOISE_SEED="${TEST_PRIVACY_NOISE_SEED:-12345}"

if [[ "$MODE" == "seeded" ]]; then
  export TEST_DB_SEED=true
else
  export TEST_DB_SEED=false
fi
export TEST_PRIVACY_NOISE_SEED="$NOISE_SEED"

echo "[detox-run] Building Expo dev client for simulator ($SIMULATOR_NAME)..."
EXPO_NO_START=1 npx expo run:ios --configuration Debug --device "$SIMULATOR_NAME"

echo "[detox-run] Running Detox ($MODE) with config $DETOX_CONFIG ..."
npx detox test --configuration "$DETOX_CONFIG" --reuse --headless
