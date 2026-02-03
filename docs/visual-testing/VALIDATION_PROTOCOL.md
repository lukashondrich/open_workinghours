# Visual Fix Validation Protocol

**Purpose:** Ensure visual fixes are properly verified, with honest uncertainty handling and human handoff when needed.

---

## Core Principle

**Never claim "verified" unless you can clearly see the difference.**

If uncertain, explicitly say so and hand off to the human for confirmation.

---

## Validation Steps

### Step 1: Establish Baseline

Before making any changes:
1. Take a BEFORE screenshot of the affected screen
2. Save it with a clear name: `{screen}-BEFORE.png`
3. Note the specific visual element you're fixing

### Step 2: Make the Fix

1. Identify the correct file and code location
2. Make the minimal change needed
3. Document what you changed and why

### Step 3: Ensure Code Loads

**Critical:** Determine if rebuild is needed (see `BUILD_AND_RELOAD.md`).

- **Release/TEST_MODE build?** → Rebuild: `cd mobile-app/e2e && npm run build:ios`
- **Development build?** → Wait for hot-reload (2-3 seconds after save)

**If you skip this step, your "after" screenshot will be identical to "before".**

### Step 4: Take After Screenshot

1. Navigate to the same screen state as baseline
2. Take AFTER screenshot: `{screen}-AFTER.png`
3. Ensure same device, orientation, and app state

### Step 5: Compare and Report

Compare the BEFORE and AFTER screenshots carefully. Then report ONE of:

#### A. Change Clearly Visible ✅
```
"Fix verified. The [specific change] is clearly visible:
- BEFORE: [description]
- AFTER: [description]
Screenshots saved to [paths]."
```

#### B. Uncertain — Request Human Verification ⚠️
```
"I made the change to [file:line], but the visual difference is too
subtle for me to confirm with confidence.

Expected change: [what should be different]
BEFORE: [path]
AFTER: [path]

Please compare these screenshots and confirm if the fix is correct."
```

#### C. No Visible Change — Suspect Issue ❌
```
"No visible change detected between BEFORE and AFTER screenshots.

Possible causes:
1. Code change didn't load (rebuild may be needed)
2. Wrong file/location edited
3. Change doesn't affect this screen

Please advise how to proceed."
```

---

## Uncertainty Is Okay

It's better to say "I'm not sure" than to falsely claim success.

**Good:**
> "The divider line change is subtle. I believe it now extends further, but I can't confirm edge-to-edge with certainty. Please verify."

**Bad:**
> "Fix verified. The divider now extends full width." *(when screenshots look identical)*

---

## What Makes Changes Hard to Verify

| Change Type | Difficulty | Recommendation |
|-------------|------------|----------------|
| Color change (obvious) | Easy | AI can verify |
| Large spacing change (>20px) | Easy | AI can verify |
| Small spacing change (<10px) | Hard | Request human verification |
| Border width (1px) | Hard | Request human verification |
| Subtle alignment | Hard | Request human verification |
| Full-width vs padded line | Medium | Compare edges carefully, admit uncertainty |

---

## Screenshot Comparison Tips

### For the AI

1. **Look at edges**: Does an element touch the screen edge or not?
2. **Look at colors**: Is the background gray vs white?
3. **Look at spacing**: Count visual "units" of space if possible
4. **Describe what you see**: Before concluding, describe both screenshots in words

### When to Request Human Help

- Change is <10 pixels
- Change is a subtle shade difference
- Screenshots appear identical at first glance
- You're comparing "it looks like" vs "I can clearly see"

---

## Example: Good Validation Flow

```
## Fixing: Month view divider not full width

### Baseline
Took BEFORE screenshot: screenshots/month-view-BEFORE.png
Observed: Divider line above summary has ~16px gap on left and right

### Fix Applied
File: MonthView.tsx:457
Change: Added marginHorizontal: -spacing.lg to summaryFooter style

### Rebuild
App is TEST_MODE build (Release). Rebuilding...
[rebuild completes]

### After Screenshot
Took AFTER screenshot: screenshots/month-view-AFTER.png

### Comparison
Looking at the divider line above "0h Erfasst":
- BEFORE: Line starts ~16px from left edge
- AFTER: [examining carefully]... Line still appears to start ~16px from edge

### Conclusion
⚠️ UNCERTAIN: I cannot clearly see a difference between BEFORE and AFTER.
The change may be too subtle, or may not have taken effect.

Requesting human verification:
- BEFORE: screenshots/month-view-BEFORE.png
- AFTER: screenshots/month-view-AFTER.png
- Expected: Divider line should touch left and right screen edges
```

---

## Human Handoff Format

When requesting human verification, provide:

1. **What was changed** (file, line, code)
2. **What should be different** (expected visual change)
3. **BEFORE screenshot path**
4. **AFTER screenshot path**
5. **Your observation** (what you see or don't see)
6. **Specific question** (what you need them to confirm)

Example:
```
Requesting human verification for Issue #1: Divider full width

Changed: MonthView.tsx:457 — added marginHorizontal: -spacing.lg
Expected: Divider line above summary should extend edge-to-edge

Screenshots:
- BEFORE: mobile-app/visual-testing/screenshots/2026-02-03/month-view-BEFORE.png
- AFTER: mobile-app/visual-testing/screenshots/2026-02-03/month-view-AFTER.png

My observation: Both screenshots appear similar. I cannot confidently
confirm the divider reaches the edges.

Please confirm: Does the divider line in AFTER touch the left and
right screen edges?
```
