# Visual Inspection Testing

Take screenshots and analyze UI for visual correctness.

---

## When to Use

- After styling or layout changes
- Verifying bug fixes that affect appearance
- UX review of new features
- Checking font scaling, spacing, alignment

---

## Workflow

When you need to do visual testing, lean towards spawning a general-purpose subagent. Screenshots accumulate quickly and can overflow the main conversation's context.

### Subagent Invocation

```javascript
Task({
  subagent_type: "general-purpose",
  description: "Visual inspection [description]",
  prompt: `[use template below]`
})
```

---

## Visual Inspector Agent Template

**Subagent type:** `general-purpose`

```
Visual inspection task: [DESCRIPTION]

CONTEXT:
- Platform: [ios | android]
- Device: [device ID or "auto-detect"]
- Screenshot directory: mobile-app/visual-testing/screenshots/[YYYY-MM-DD]/

CHECKS TO PERFORM:
[List specific checks]

PREREQUISITE — Build Type Check:
Before starting visual inspection of CODE CHANGES:
1. Check if Metro bundler is running: lsof -i :8081
2. If NO Metro → app is Release build → changes WON'T be visible
3. Either start Debug build (npx expo run:ios) or rebuild Release
4. If just reviewing existing UI (no code changes), Release is fine

WORKFLOW:

For each check:

1. **Try view hierarchy first** (saves context):
   - Use mobile_list_elements_on_screen
   - If check can be answered from hierarchy → answer it, move on

2. **If visual confirmation needed**, choose resolution:
   - Full resolution: pixel-level detail
   - Downsampled (50%): general layout
   - Save to file: mobile_save_screenshot(device, saveTo="path")

3. **To analyze**: Read saved file, check against criteria

4. **If uncertain**: Mark as "NEEDS HUMAN REVIEW" with file path

CONTEXT MANAGEMENT:
- View hierarchy: ~0 context cost, use freely
- Downsampled: moderate cost
- Full resolution: high cost
- For >3 checks, prefer downsampling
- Track usage in report

DO NOT:
- Accumulate more than 5-6 full-resolution images
- Guess at issues — mark uncertain instead
- Test code changes on Release build without Metro — changes won't be visible

REPORT FORMAT:

## Visual Inspection Report — [Description]

**Platform:** [iOS/Android] ([device])
**Date:** [YYYY-MM-DD]
**Checks:** [X] performed, [Y] passed, [Z] issues, [W] needs review

### TL;DR
**[PASS/FAIL/MIXED]** — [1 sentence summary]

### Context Usage
- Screenshots saved: [N]
- Screenshots analyzed (embedded): [N]
- Estimated context cost: Low (<3) / Medium (3-5) / High (6+)

### Results

| # | Check | Method | Result | Screenshot | Notes |
|---|-------|--------|--------|------------|-------|

### Issues Found (if any)

### Needs Human Review (if any)

### Screenshots Saved
[List file paths]
```

---

## Context Management

| Method | Context Cost | When to Use |
|--------|--------------|-------------|
| View hierarchy (`mobile_list_elements_on_screen`) | None | Always try first |
| Downsampled screenshot (50%) | Moderate | General layout checks |
| Full resolution screenshot | High | Pixel-level detail needed |

**Guideline:** For tasks with >3 visual checks, prefer downsampling.

---

## Downsampling Screenshots

```bash
# Save full resolution
mobile_save_screenshot(device, saveTo="path/to/full.png")

# Create 50% version (ImageMagick)
convert path/to/full.png -resize 50% path/to/downsampled.png

# Analyze downsampled, keep full for human review
```

---

## Resuming After Fixes

If a subagent finds issues that require code changes and rebuild:

```
1. Subagent reports issue → returns agentId
2. You fix the code
3. Rebuild the app (npx expo run:ios or npm run build:ios)
4. Resume the SAME subagent:

   Task({
     subagent_type: "general-purpose",
     resume: "<agentId from step 1>",
     prompt: "App has been rebuilt with fixes. Please re-verify the issues you found."
   })
```

**Why resume instead of starting fresh?**
- Preserves context — subagent remembers what it checked and what failed
- More efficient — doesn't re-do passing checks
- Better report — can show before/after comparison

**When to start fresh instead:**
- Significant time has passed (context may be stale)
- Testing completely different features
- Previous subagent hit errors or got confused

---

## Deep References

- **Design checklist:** `docs/VISUAL_TESTING.md`
- **Screen inventory:** `docs/visual-testing/SCREEN_INVENTORY.md`
- **Theme tokens:** `mobile-app/src/theme/`
