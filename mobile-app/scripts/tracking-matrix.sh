#!/usr/bin/env bash
# Runs every tracking scenario timeline against BOTH cores and writes a
# scenario × core matrix to project-mgmt/tracking-scenario-matrix.md.
# Usage: cd mobile-app && scripts/tracking-matrix.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=/tmp/tracking-matrix
mkdir -p "$OUT"
FILES="src/modules/geofencing/__tests__/scenarios.android.test.ts src/modules/geofencing/__tests__/scenarios.tester-evening.test.ts src/modules/geofencing/__tests__/scenarios.ios.test.ts"
TRACKING_CORE=android npx jest $FILES --silent --forceExit --json --outputFile="$OUT/android.json" >/dev/null 2>&1 || true
TRACKING_CORE=ios     npx jest $FILES --silent --forceExit --json --outputFile="$OUT/ios.json" >/dev/null 2>&1 || true
node scripts/tracking-matrix.js "$OUT/android.json" "$OUT/ios.json" > ../project-mgmt/tracking-scenario-matrix.md
echo "wrote project-mgmt/tracking-scenario-matrix.md"
