---
name: e2e-ios
description: Build the TEST_MODE app and run the full iOS E2E suite (Appium + Jest), with all known pitfalls handled. Use when asked to run E2E tests, verify a change against the regression suite, or before a TestFlight build. Prefer delegating the run to a subagent so the long output stays out of the main conversation.
---

# Run the iOS E2E suite

Primary reference: `mobile-app/e2e/README.md` (runbook, platform notes).
This skill adds the harness-specific facts that README doesn't cover.

## Delegate by default

Launch a general-purpose subagent with these instructions and the checklist
below; have it return ONLY the pass/fail counts, failed test names, and the
last ~40 log lines for any failure. The full jest output is ~400s of noise
the main conversation doesn't need. (Per `docs/WORKFLOW_PATTERNS.md`:
testing goes to subagents; include this file's content in the prompt —
subagents don't inherit context.)

## Procedure (verified 2026-07-24)

1. **Build the app — TEST_MODE only, NO seed flag:**
   - `npm run build:ios` (in `mobile-app/e2e/`) uses `expo run:ios`, which
     FAILS on Xcode 26 ("No code signing certificates") because devicectl
     misdetects the simulator as a physical device. Use the direct
     xcodebuild fallback from `mobile-app/store-assets/README.md` → "Build
     pitfalls", but with env `TEST_MODE=true` ONLY.
   - ⚠️ Never build with `TEST_SCREENSHOT_SEED=true` for E2E — it wipes and
     seeds app state at every launch, breaking test flows that create their
     own data.
   - Verify flags in the built app:
     `python3 -c "import json;print(json.load(open('<APP>/EXConstants.bundle/app.config'))['extra'])"`
     → expect `TEST_MODE: True, TEST_SCREENSHOT_SEED: False`.

2. **Clean state:** `xcrun simctl uninstall <UDID> com.openworkinghours.mobileapp`
   then `xcrun simctl install <UDID> <path to OpenWorkingHours.app>`.
   Stale app state makes tests skip flows ("location already configured").

3. **Infra:** `cd mobile-app/e2e && ./start-infra.sh ios` (long-running;
   background it). It needs Node 22 (`/opt/homebrew/opt/node@22/bin` — the
   script sets this itself). Ready when
   `curl -s localhost:4723/status` contains `"ready":true`.

4. **Run:** `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run test:ios`
   (~380s for the full suite). Background it and read the tail.

5. **Machine load matters:** do NOT run Android Gradle builds, emulators, or
   other xcodebuilds concurrently — WebDriverAgent + the app under load
   causes timeout flakiness and ANR-style hangs (~380s quiet vs ~640s loaded,
   with extra spurious failures).

## Current baseline (2026-07-24): 56 passed / 15 failed

auth, registration, calendar, location suites are fully green. The 15 known
failures are diagnosed TEST-SCRIPT drift, not app bugs — see
`project-mgmt/ticket-e2e-suite-modernization.md` before treating them as
regressions: manual-session (suite-order/location dependency), shifts +
absences (Return-key keyboard dismissal submits the template form early),
calendar-export (fresh-sim permission flow). Compare failures against that
list; only NEW failures indicate a regression.

## Known traps

- **Auth helper vs. WelcomeScreen redesign:** `helpers/actions.js`
  `performTestLogin` bridges the post-2026-05 WelcomeScreen
  (`email-signin-button` → LoginScreen). If all tests fail with "Failed to
  authenticate", check that bridge first — the suite was silently broken
  for two months when the redesign landed without updating the helper.
  The registration fallback path is stale (register link on LoginScreen has
  no testID) but unreachable in TEST_MODE — login always succeeds.
- TEST_MODE login: any email + code `123456`.
- If a run dies mid-suite, uninstall the app before retrying (step 2).
