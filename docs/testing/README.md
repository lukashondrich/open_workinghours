# Testing

Entry point for all testing workflows.

---

## Overview

| Type | Purpose | When to Use |
|------|---------|-------------|
| **E2E Regression** | Verify user flows work | After code changes, before commits |
| **Visual Inspection** | Verify UI looks correct | After styling/layout changes |

---

## Approach: Lean Towards Subagents

When performing testing tasks, lean towards spawning specialized subagents rather than doing the work directly in the main conversation.

**Why this matters:**
- Screenshots accumulate quickly and can overflow context
- If a testing subagent crashes, main conversation is preserved
- Subagents return focused text reports

**When to use subagents:**
- Visual testing (any amount of screenshots)
- E2E test runs (long output)
- Any testing task that might need retries

**When direct execution is acceptable:**
- Quick single check (e.g., "is the app running?")
- Reading test results from a file

---

## Testing Workflows

### E2E Regression Testing

Run the Appium test suite to verify user flows work.

**→ See [e2e-regression.md](./e2e-regression.md)** for the subagent template and workflow.

**Deep reference:** `docs/E2E_TESTING_PLAN.md` (architecture, testIDs, session history)

**Quick start:** `mobile-app/e2e/README.md`

---

### Visual Inspection Testing

Take screenshots and analyze UI for correctness.

**→ See [visual-inspection.md](./visual-inspection.md)** for the subagent template and workflow.

**Deep reference:** `docs/VISUAL_TESTING.md` (design checklist, screen inventory)

---

## Quick Reference

```bash
# E2E tests
cd mobile-app/e2e
npm run test:ios      # expect 42-48/48
npm run test:android  # expect 43-48/48

# Prerequisites
xcrun simctl list devices | grep -i booted  # iOS simulator
adb devices                                  # Android emulator
```

---

## Known Flakiness

| Issue | Platform | Frequency |
|-------|----------|-----------|
| Template panel doesn't dismiss after double-tap | Both | ~15-25% |
| Location wizard timing | Android | ~10% |

These are test infrastructure issues, not app bugs. Re-running usually passes.
