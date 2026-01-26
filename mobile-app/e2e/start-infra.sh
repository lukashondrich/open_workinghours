#!/bin/bash
#
# E2E Test Infrastructure Startup Script
#
# Usage:
#   ./start-infra.sh          # Start Appium only
#   ./start-infra.sh ios      # Start Appium + boot iOS simulator
#   ./start-infra.sh android  # Start Appium + start Android emulator
#   ./start-infra.sh both     # Start everything
#
# Requirements:
#   - Node 22 installed at /opt/homebrew/opt/node@22
#   - Appium installed globally
#   - iOS: Xcode + Simulator
#   - Android: Android Studio + emulator configured
#

set -e

# Use Node 22 (required for Appium 3.x)
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

echo "Using Node: $(node -v)"

# Kill any existing Appium
echo "Stopping existing Appium..."
pkill -f "appium" 2>/dev/null || true
sleep 1

# Start Appium
echo "Starting Appium..."
appium --allow-cors --relaxed-security &
APPIUM_PID=$!

# Wait for Appium to be ready
echo "Waiting for Appium to start..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:4723/status > /dev/null 2>&1; then
    echo "✓ Appium ready (PID: $APPIUM_PID)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ Appium failed to start"
    exit 1
  fi
  sleep 1
done

# Handle platform argument
PLATFORM="${1:-none}"

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  echo ""
  echo "Checking iOS simulator..."

  # Check if any simulator is booted
  BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)

  if [ "$BOOTED" -eq 0 ]; then
    echo "Booting iOS simulator..."
    open -a Simulator
    sleep 5

    # Wait for simulator to boot
    for i in {1..60}; do
      BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)
      if [ "$BOOTED" -gt 0 ]; then
        echo "✓ iOS simulator booted"
        break
      fi
      if [ $i -eq 60 ]; then
        echo "✗ Simulator failed to boot"
      fi
      sleep 1
    done
  else
    echo "✓ iOS simulator already running"
  fi
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  echo ""
  echo "Checking Android emulator..."

  # Check if emulator is running
  RUNNING=$(adb devices 2>/dev/null | grep -c "emulator" || true)

  if [ "$RUNNING" -eq 0 ]; then
    echo "Starting Android emulator..."

    # Get first available AVD
    AVD=$(emulator -list-avds 2>/dev/null | head -1)

    if [ -z "$AVD" ]; then
      echo "✗ No Android AVDs found. Create one in Android Studio."
    else
      echo "Starting AVD: $AVD"
      emulator -avd "$AVD" -no-snapshot-load &

      # Wait for emulator to boot
      echo "Waiting for emulator to boot (this may take a minute)..."
      adb wait-for-device

      # Wait for boot to complete
      for i in {1..120}; do
        BOOT=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
        if [ "$BOOT" = "1" ]; then
          echo "✓ Android emulator ready"
          break
        fi
        if [ $i -eq 120 ]; then
          echo "✗ Emulator boot timeout"
        fi
        sleep 1
      done
    fi
  else
    echo "✓ Android emulator already running"
  fi
fi

echo ""
echo "========================================="
echo "Infrastructure ready!"
echo ""
echo "Run tests with:"
echo "  npm run test:ios      # iOS tests"
echo "  npm run test:android  # Android tests"
echo "  npm test              # All tests"
echo ""
echo "Appium running at: http://127.0.0.1:4723"
echo "To stop: pkill -f appium"
echo "========================================="

# Keep script running to show Appium logs
wait $APPIUM_PID
