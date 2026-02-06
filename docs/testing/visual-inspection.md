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

## Deep References

- **Design checklist:** `docs/VISUAL_TESTING.md`
- **Screen inventory:** `docs/visual-testing/SCREEN_INVENTORY.md`
- **Theme tokens:** `mobile-app/src/theme/`
