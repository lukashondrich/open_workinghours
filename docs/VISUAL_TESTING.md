# Visual Testing

**Updated:** 2026-02-03
**Scope:** v1 — iOS Calendar screens only

---

## Overview

AI-powered visual testing for UI quality. When working on UI features, Claude Code can autonomously check for alignment issues, spacing problems, color inconsistencies, and visual regressions.

**How it works:**
1. Take screenshots of app screens on iOS simulator
2. Analyze with Claude's vision capabilities
3. Apply design checklist (based on theme tokens)
4. Generate report with findings and recommendations

---

## Quick Start

When asked to "check if the UI looks good":

1. Read this doc for workflow overview
2. Boot iOS simulator (iPhone 15 Pro recommended)
3. Ensure TEST_MODE build is installed
4. Follow capture workflow below
5. Apply design checklist
6. Generate report with screenshots

---

## Prerequisites

- iOS Simulator booted (iPhone 15 Pro or any available)
- App installed with TEST_MODE build (`com.openworkinghours.mobileapp`)
- MCP tools available: mobile-mcp

**Build the app (if needed):**
```bash
cd mobile-app/e2e
npm run build:ios
```

---

## Workflow

### Phase 1: Setup

```
# List available devices
mobile_list_available_devices → find iOS simulator ID

# Launch app
mobile_launch_app(device, "com.openworkinghours.mobileapp")
```

### Phase 2: Capture Screens

See `docs/visual-testing/SCREEN_INVENTORY.md` for complete navigation steps.

For each screen state:
1. Navigate to target state using element coordinates
2. Wait 500ms for render/animations
3. `mobile_take_screenshot` → analyze immediately with vision
4. `mobile_save_screenshot` → save to `mobile-app/visual-testing/screenshots/YYYY-MM-DD/`

### Phase 3: Analyze

**Two levels of analysis:**

1. **Design Principles** (`docs/visual-testing/DESIGN_PRINCIPLES.md`)
   - Nielsen Norman heuristics applied to this app
   - Mobile UX best practices
   - Healthcare context considerations
   - Use for higher-level "does this feel right?" questions

2. **Design Checklist** (`docs/visual-testing/DESIGN_CHECKLIST.md`)
   - Specific values from theme tokens
   - Measurable criteria (spacing, colors, sizes)
   - Use for "is this pixel-correct?" verification

Reference actual theme tokens:
- Colors: `mobile-app/src/theme/colors.ts`
- Spacing: `mobile-app/src/theme/spacing.ts`
- Typography: `mobile-app/src/theme/typography.ts`

### Phase 4: Report

Generate markdown report in `mobile-app/visual-testing/reports/YYYY-MM-DD-[feature].md`.

Include:
- Summary (PASS or ISSUES FOUND)
- Screenshot table with status per screen
- Detailed issue descriptions with recommendations
- File paths to saved screenshots

---

## File Organization

```
mobile-app/visual-testing/
├── .gitignore              # Screenshots gitignored, reports kept
├── screenshots/
│   └── YYYY-MM-DD/         # Date-organized, ephemeral
│       ├── 01-week-empty.png
│       └── ...
└── reports/
    └── YYYY-MM-DD-*.md     # Kept for reference
```

---

## MCP Tool Reference

| Tool | Purpose |
|------|---------|
| `mobile_list_available_devices` | Find booted iOS simulators |
| `mobile_launch_app` | Launch app by bundle ID |
| `mobile_list_elements_on_screen` | Get UI hierarchy with coordinates |
| `mobile_click_on_screen_at_coordinates` | Tap at x,y position |
| `mobile_swipe_on_screen` | Swipe in direction |
| `mobile_take_screenshot` | Capture screen (returns image for analysis) |
| `mobile_save_screenshot` | Save screenshot to file path |

---

## Screen Coverage (v1)

| Screen | Description |
|--------|-------------|
| Week view (empty) | Calendar tab, no shifts |
| Week view (with shifts) | If data exists |
| Month view | Toggle from week view |
| FAB menu open | Tap calendar-fab |
| TemplatePanel (shifts) | FAB → Shifts option |
| TemplatePanel (absences) | FAB → Absences option |

See `docs/visual-testing/SCREEN_INVENTORY.md` for detailed navigation.

---

## Report Format

```markdown
# Visual Testing Report: [Feature/Screen]

**Generated:** YYYY-MM-DD HH:MM
**Platform:** iOS Simulator (iPhone 15 Pro)
**App Build:** #[number]

## Summary

**Status:** PASS | ISSUES FOUND

[2-3 sentence overview]

## Screenshots

| # | Screen | File | Status | Notes |
|---|--------|------|--------|-------|
| 1 | Week view | `01-week-empty.png` | PASS | — |
| 2 | FAB menu | `04-fab-menu.png` | ISSUE | Shadow clipping |

## Issues Found

### Issue #1: [Title]
- **Location:** [Screen/Component]
- **Severity:** Low | Medium | High
- **Description:** [What's wrong]
- **Screenshot:** `screenshots/YYYY-MM-DD/XX-name.png`
- **Recommendation:** [How to fix]

## Next Steps

- [ ] [Action items for developer]
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App not launching | Check simulator booted, TEST_MODE build installed |
| FAB not visible | Switch to week view (FAB hidden in month view) |
| Panel won't open | Check for stale state, restart app |
| Screenshot blank | Ensure app is foregrounded |
| Device not found | Run `open -a Simulator` and wait for boot |

---

## Related Docs

- `docs/visual-testing/DESIGN_PRINCIPLES.md` — UX heuristics & design philosophy (NN/g-based)
- `docs/visual-testing/DESIGN_CHECKLIST.md` — What to check, theme token values
- `docs/visual-testing/SCREEN_INVENTORY.md` — What to capture, navigation steps
- `docs/visual-testing/BUILD_AND_RELOAD.md` — When rebuild is needed vs hot-reload
- `docs/visual-testing/VALIDATION_PROTOCOL.md` — How to verify fixes, human handoff
- `mobile-app/e2e/README.md` — E2E test setup (same simulator)
- `docs/E2E_TESTING_PLAN.md` — testID reference

---

## Future Expansion

- **v2:** Status dashboard, Settings screens
- **v3:** Android emulator support
- **v4:** Device matrix (iPhone SE, iPad, multiple Android)
- **v5:** CI integration
