# E2E Regression Testing

Run the Appium test suite to verify user flows work after code changes.

---

## When to Use

- After code changes that might affect user flows
- Before committing significant changes
- As part of verification after bug fixes

---

## Workflow

When you need to run E2E tests, lean towards spawning a Bash subagent rather than running directly. This keeps test output isolated from the main conversation.

### Subagent Invocation

```javascript
Task({
  subagent_type: "Bash",
  description: "Run E2E tests [platform]",
  prompt: `[use template below]`
})
```

---

## E2E Regression Agent Template

**Subagent type:** `Bash`

```
Run E2E regression tests for [PLATFORM: ios | android].

CONTEXT:
- Working directory: /Users/user01/open_workinghours
- Test location: mobile-app/e2e/
- Expected results: iOS 48/48 (~200s), Android 45-48/48 (~160s)

TIMEOUTS (fail fast — if exceeded, abort and report):
- Build: 15 min max (usually 1-5 min)
- Tests: 10 min max (usually 3-4 min)
- Appium startup: 60 sec max

PREREQUISITES:
1. Check simulator/emulator running:
   iOS: xcrun simctl list devices | grep -i booted
   Android: adb devices
2. Check Appium running: lsof -i :4723
3. Check build type — CRITICAL:
   - Release builds do NOT hot-reload. Code changes require rebuild.
   - If testing code changes, ensure app is Debug build OR rebuild first.
   - See "Debug vs Release Builds" section below.

WORKFLOW:
1. Verify prerequisites (simulator, Appium)
2. Check build type:
   - If testing CODE CHANGES: ensure Debug build with Metro, or rebuild first
   - If Release build with no Metro: code changes WON'T be reflected — rebuild!
   - Check Metro: lsof -i :8081
3. If Appium not running: cd mobile-app/e2e && npm run infra:[platform] &
   Wait 15 seconds
4. Run tests: cd mobile-app/e2e && npm run test:[platform]
5. Capture full output

DO NOT:
- Take screenshots
- Use mobile-mcp tools
- Attempt to fix failing tests
- Wait longer than the timeouts above — abort and report instead
- Diagnose root causes — report observations only (e.g., "test X failed with error Y", not "the feature is broken because Z")

REPORT FORMAT:
## E2E Regression Results — [Platform]

**Result:** [PASS | FAIL] ([X]/48 tests)
**Duration:** [X]s

### Summary
[1-2 sentences]

### Failures (if any)
| Suite | Test | Error |
|-------|------|-------|

### Notes
[Observations]
```

---

## Expected Results

| Platform | Pass Rate | Duration | Known Flakiness |
|----------|-----------|----------|-----------------|
| iOS | 42-48/48 | ~200s | Template panel dismissal |
| Android | 43-48/48 | ~160s | Location wizard timing |

---

## Expected Durations & Timeouts

**Fail fast principle:** If any step takes significantly longer than expected, something is wrong. Abort and report rather than waiting indefinitely.

| Step | Expected Duration | Abort If Exceeds |
|------|-------------------|------------------|
| `npm run build:ios` (incremental) | ~1-4 min | 10 min |
| `npm run build:ios` (clean/first) | ~10-15 min | 20 min |
| `npm run build:android` | ~5-10 min | 15 min |
| `npm run test:ios` | ~3-4 min | 10 min |
| `npm run test:android` | ~2-3 min | 10 min |
| Appium startup | ~10-15 sec | 60 sec |

**If a timeout is hit:**
1. Kill the process
2. Report the timeout in results
3. Note what was attempted and where it stalled

---

## Debug vs Release Builds

**Critical:** Release builds are compiled native code. They do NOT hot-reload. If you're testing code changes against a Release build, your changes won't appear.

### How to Check Build Type

```bash
# iOS — check if Metro bundler is connected
# If app shows "Metro waiting on..." or responds to reload, it's Debug
# If app runs standalone without Metro, it's Release

# Look for build configuration in recent builds:
ls -la mobile-app/ios/build/Build/Products/
# Debug-iphonesimulator/ = Debug build
# Release-iphonesimulator/ = Release build
```

### Build Type Behavior

| Build Type | Hot Reload? | When to Use |
|------------|-------------|-------------|
| Debug (`npx expo run:ios`) | ✅ Yes — Metro serves JS | Development, quick iteration |
| Release (`--configuration Release`) | ❌ No — compiled | E2E tests, production testing |
| E2E build (`npm run build:ios` in e2e/) | ❌ No — Release + TEST_MODE | Automated E2E testing |

### Decision Flow

```
Testing code changes?
    │
    ├─► YES: Do you have a Debug build running with Metro?
    │       ├─► YES: Code will hot-reload, test directly
    │       └─► NO: Rebuild first, then test
    │
    └─► NO (just running existing tests): Release build is fine
```

### Commands

```bash
# Debug build (hot-reloads, for development)
cd mobile-app && npx expo run:ios

# E2E build (Release + TEST_MODE, for automated tests)
cd mobile-app/e2e && npm run build:ios

# Check if Metro is running (Debug mode indicator)
lsof -i :8081
```

---

## When Rebuild is Needed

| Scenario | Rebuild? |
|----------|----------|
| Changed JS logic only | No — Metro serves latest (Debug only!) |
| Changed testID or accessible props | **Yes** |
| Added/removed native modules | **Yes** |
| TEST_MODE code changes | **Yes** |
| Running Release build with code changes | **Yes** — Release doesn't hot-reload |

```bash
# Rebuild for E2E
cd mobile-app/e2e
npm run build:ios      # or build:android
```

---

## For the Main Agent

**Don't blindly trust subagent diagnoses.** Subagents are good at execution but can misdiagnose failures. When a subagent reports a failure:
1. Read the **observations** (what failed, what error)
2. Investigate the code yourself before concluding root cause
3. A "TEST_MODE bypass not working" might actually be a race condition

**Run both platforms in parallel.** Spawn iOS + Android E2E in a single message:
```javascript
// Single message with two Task calls = parallel execution
Task({ subagent_type: "Bash", prompt: "Run E2E for iOS..." })
Task({ subagent_type: "Bash", prompt: "Run E2E for Android..." })
```

**Some features require manual testing.** E2E can't test:
- Biometric authentication (requires enrolled Face ID / fingerprint)
- Lock screen (TEST_MODE bypasses it)
- Permission dialogs in all states
- Features requiring specific device setup

For these, document that manual testing is needed or rely on code review.

---

## Resuming After Fixes

If E2E tests fail and you fix the code:

```
1. Subagent reports failures → returns agentId
2. You fix the code
3. Rebuild if needed (see "When Rebuild is Needed")
4. Resume the SAME subagent:

   Task({
     subagent_type: "Bash",
     resume: "<agentId from step 1>",
     prompt: "Code has been fixed and rebuilt. Please re-run the failed tests."
   })
```

**Why resume instead of starting fresh?**
- Preserves context — subagent knows which tests failed
- Can focus on re-running failed tests only
- Provides before/after comparison in report

**When to start fresh instead:**
- Running full regression (not just re-testing failures)
- Previous subagent timed out or hit errors
- Significant changes since last run

---

## Deep References

- **Architecture & testIDs:** `docs/E2E_TESTING_PLAN.md`
- **Quick start:** `mobile-app/e2e/README.md`
- **Test files:** `mobile-app/e2e/flows/`
