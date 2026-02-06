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

WORKFLOW:
1. Verify prerequisites
2. If Appium not running: cd mobile-app/e2e && npm run infra:[platform] &
   Wait 15 seconds
3. Run tests: cd mobile-app/e2e && npm run test:[platform]
4. Capture full output

DO NOT:
- Take screenshots
- Use mobile-mcp tools
- Attempt to fix failing tests
- Wait longer than the timeouts above — abort and report instead

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

## When Rebuild is Needed

| Scenario | Rebuild? |
|----------|----------|
| Changed JS logic only | No — Metro serves latest |
| Changed testID or accessible props | **Yes** |
| Added/removed native modules | **Yes** |
| TEST_MODE code changes | **Yes** |

```bash
# Rebuild
cd mobile-app/e2e
npm run build:ios      # or build:android
```

---

## Deep References

- **Architecture & testIDs:** `docs/E2E_TESTING_PLAN.md`
- **Quick start:** `mobile-app/e2e/README.md`
- **Test files:** `mobile-app/e2e/flows/`
