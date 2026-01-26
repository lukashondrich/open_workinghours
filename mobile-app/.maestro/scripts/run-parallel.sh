#!/usr/bin/env bash
set -euo pipefail

# Multi-device parallel Maestro execution for Open Working Hours
# Usage:
#   ./run-parallel.sh ios      # Run on all iOS simulators
#   ./run-parallel.sh android  # Run on all Android emulators
#   ./run-parallel.sh all      # Run on both platforms
#   ./run-parallel.sh single <device>  # Run on a specific device

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOWS_DIR="$SCRIPT_DIR/../flows"
RESULTS_DIR="$SCRIPT_DIR/../results"
PLATFORM="${1:-all}"
SPECIFIC_DEVICE="${2:-}"

# Ensure Java is available (required for Maestro)
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH:$HOME/.maestro/bin"

# iOS Simulators (create these in Xcode if not present)
IOS_DEVICES=(
  "iPhone SE (3rd generation)"
  "iPhone 15"
  "iPhone 15 Pro Max"
)

# Android Emulators (create these in Android Studio if not present)
ANDROID_DEVICES=(
  "Pixel_6_API_30"
  "Pixel_7a_API_34"
)

# Create results directory
mkdir -p "$RESULTS_DIR"

run_single_device() {
  local device="$1"
  local platform="$2"
  local safe_name="${device// /_}"

  echo ">>> Running tests on: $device"

  maestro test "$FLOWS_DIR" \
    --device "$device" \
    --format junit \
    --output "$RESULTS_DIR/${platform}-${safe_name}.xml" \
    2>&1 | tee "$RESULTS_DIR/${platform}-${safe_name}.log"

  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    echo ">>> PASSED: $device"
  else
    echo ">>> FAILED: $device (exit code: $exit_code)"
  fi
  return $exit_code
}

run_ios_parallel() {
  echo "=== Running Maestro on iOS Simulators ==="
  local pids=()
  local failed=0

  for device in "${IOS_DEVICES[@]}"; do
    echo "Starting tests on $device..."
    (
      # Boot simulator if not running
      xcrun simctl boot "$device" 2>/dev/null || true
      sleep 5  # Wait for boot

      run_single_device "$device" "ios"
    ) &
    pids+=($!)
  done

  # Wait for all iOS tests
  for pid in "${pids[@]}"; do
    if ! wait $pid; then
      ((failed++))
    fi
  done

  echo "=== iOS Tests Complete: $((${#IOS_DEVICES[@]} - failed))/${#IOS_DEVICES[@]} passed ==="
  return $failed
}

run_android_parallel() {
  echo "=== Running Maestro on Android Emulators ==="
  local pids=()
  local failed=0

  for device in "${ANDROID_DEVICES[@]}"; do
    echo "Starting tests on $device..."
    (
      # Check if emulator is running, start if not
      if ! adb devices | grep -q "emulator"; then
        echo "Starting emulator $device..."
        emulator -avd "$device" -no-window -no-audio &
        sleep 30  # Wait for boot
      fi

      run_single_device "$device" "android"
    ) &
    pids+=($!)
  done

  # Wait for all Android tests
  for pid in "${pids[@]}"; do
    if ! wait $pid; then
      ((failed++))
    fi
  done

  echo "=== Android Tests Complete: $((${#ANDROID_DEVICES[@]} - failed))/${#ANDROID_DEVICES[@]} passed ==="
  return $failed
}

run_single() {
  if [ -z "$SPECIFIC_DEVICE" ]; then
    echo "Error: Device name required for 'single' mode"
    echo "Usage: $0 single <device-name>"
    exit 1
  fi

  # Determine platform from device name
  local platform="unknown"
  if [[ "$SPECIFIC_DEVICE" == iPhone* ]] || [[ "$SPECIFIC_DEVICE" == iPad* ]]; then
    platform="ios"
  else
    platform="android"
  fi

  run_single_device "$SPECIFIC_DEVICE" "$platform"
}

# Main execution
echo "Maestro E2E Tests - Open Working Hours"
echo "======================================="
echo "Flows directory: $FLOWS_DIR"
echo "Results directory: $RESULTS_DIR"
echo ""

case "$PLATFORM" in
  ios)
    run_ios_parallel
    ;;
  android)
    run_android_parallel
    ;;
  all)
    run_ios_parallel
    run_android_parallel
    ;;
  single)
    run_single
    ;;
  *)
    echo "Usage: $0 {ios|android|all|single <device>}"
    echo ""
    echo "Examples:"
    echo "  $0 ios                    # Run on all iOS simulators"
    echo "  $0 android                # Run on all Android emulators"
    echo "  $0 all                    # Run on both platforms"
    echo "  $0 single 'iPhone 15'     # Run on specific device"
    echo ""
    echo "iOS Simulators:"
    for d in "${IOS_DEVICES[@]}"; do echo "  - $d"; done
    echo ""
    echo "Android Emulators:"
    for d in "${ANDROID_DEVICES[@]}"; do echo "  - $d"; done
    exit 1
    ;;
esac

echo ""
echo "=== All tests completed ==="
echo "Results saved to: $RESULTS_DIR"
ls -la "$RESULTS_DIR"
