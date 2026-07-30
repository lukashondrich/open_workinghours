---
name: e2e-android
description: Build the TEST_MODE APK and run the full Android E2E suite (Appium + UiAutomator2 + Jest) on the emulator, with all known pitfalls handled. Use when asked to run Android E2E tests, verify a change on Android, or before a Play Store build. Prefer delegating the run to a subagent so the long output stays out of the main conversation.
---

# Run the Android E2E suite

Primary reference: `mobile-app/e2e/README.md` (runbook, Android pitfalls 1–17,
"Infra ordering rules"). Emulator recovery: `docs/debugging.md` → Android.
This skill adds the harness-specific facts and the exact green procedure
(verified 2026-07-27, 71/71 twice in a row).

## Delegate by default

Launch a general-purpose subagent with these instructions; have it return
ONLY pass/fail counts, failed test names, verbatim errors (~40 lines each),
and the console markers ("Location setup complete", "Form testIDs", …).

## Procedure

1. **Boot the emulator FIRST** (order matters — see rule 4):
   `~/Library/Android/sdk/emulator/emulator -avd Pixel_7a -no-snapshot-load &`
   then `adb wait-for-device` and poll `adb shell getprop sys.boot_completed`
   until `1`.

2. **Build the APK — TEST_MODE must be in the env of the GRADLE call** (it is
   baked into the JS bundle at build time):
   `cd mobile-app/android && TEST_MODE=true JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleRelease -x lint`
   Verify both flags in the built APK:
   - `aapt2 dump permissions app-release.apk | grep -i calendar` → READ/WRITE_CALENDAR present
   - `unzip -p app-release.apk assets/app.config | python3 -c "import json,sys;print(json.load(sys.stdin)['extra']['TEST_MODE'])"` → True
   (`npm run build:android` = `expo run:android` also works but its install
   step can fail with a stale adb — install manually per step 3 anyway.)

3. **Clean install + prefs:**
   ```
   adb uninstall com.openworkinghours.mobileapp
   adb install mobile-app/android/app/build/outputs/apk/release/app-release.apk
   adb shell settings put secure location_mode 3
   ```
   If install fails with INSUFFICIENT_STORAGE:
   `adb shell pm clear com.google.android.gms && adb shell pm clear com.android.vending`.

4. **Start/restart Appium AFTER the emulator is booted** — Appium's cached
   device connection goes stale on any emulator restart and every new session
   then hangs. `PATH="/opt/homebrew/opt/node@22/bin:$PATH" nohup appium --allow-cors --relaxed-security &`
   If port 4723 doesn't bind within ~30 s, kill the stalled npm child of the
   driver-check: `pkill -f "npm view"` — Appium binds immediately after.
   Ready when `curl -s localhost:4723/status` contains `"ready":true`.

5. **Optional sanity before the full run** (recommended after any infra change):
   one driver session, expect the welcome screen within ~20 s (first cold
   start shows a "Loading…" spinner that long — not a failure).

6. **Run:** `cd mobile-app/e2e && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run test:android`
   (~10–12 min). Suite order is pinned by `testSequencer.js`.

7. **If ALL suites fail at `createDriver` (session POST timeout):** the
   UiAutomator2 server is wedged or Appium's device connection is stale.
   Recovery: `adb emu kill` → cold boot → uninstall
   `io.appium.uiautomator2.server(.test)` → reinstall app → **restart Appium**
   → rerun.

## Known traps (short list — details in e2e/README.md pitfalls 13–17)

- Never `driver.hideKeyboard()` on a stack screen (Back-press pops it).
- Alert buttons: `byAlertButtonText` (Button class + case-insensitive) — plain
  text matches dialog TITLES and Android renders labels ALL-CAPS.
- `waitForIdleTimeout:100` is set in driver.js — do not remove (MapView
  screens never idle; commands stall minutes and wedge the run).
- Never press Back speculatively; verify an overlay testID exists first.
- TEST_MODE login: any email + code `123456`.
