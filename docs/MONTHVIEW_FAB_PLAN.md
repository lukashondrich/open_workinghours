# MonthView FAB & Batch Shift Placement — Implementation Plan

**Status:** Complete — tested on iOS + Android simulators
**Branch:** `worktree-monthview-fab-planning`
**Date:** 2026-04-27
**Origin:** User feedback — doctors want to place shifts directly in month view using the same "paint mode" pattern common in shift scheduling apps.

---

## Motivation

Potential users (doctors) showed their current shift-planning app and highlighted "paint mode" — select a shift type, then tap calendar days to place it — as a key workflow. Our app supported this in WeekView (FAB → arm template → double-tap to place), but the FAB was hidden in MonthView and the gesture model was inconsistent between views.

---

## Design Decisions

### Unified Gesture Model (MonthView + WeekView)

Gestures are consistent across both views. The only difference is the "not armed, single tap" action, which is view-specific.

| Gesture | Not armed | Armed |
|---------|-----------|-------|
| **Single tap** | MV: Navigate to WeekView / WV: Open InlinePicker | **Place shift (instant)** |
| **Long press** | Open InlinePicker (with targetDate) | **Remove shift of armed template from that day** |
| **FAB tap** | Opens FAB menu → InlinePicker (arming mode) | Opens FAB menu → InlinePicker (arming mode) |

**Key principles:**
- **Single-tap when armed = place** — instant, no delay
- **Long-press when armed = remove** — deliberate gesture for destructive action, stays in armed mode
- **Long-press when not armed = open InlinePicker** — for one-off placements or switching templates
- **FAB = entry point for arming** — opens InlinePicker in arming mode (no targetDate)
- **Overlap = silent skip** — light haptic instead of disruptive alert during batch placement

**Error correction flow:** User accidentally places Early Shift on Wednesday → long-press Wednesday → Early Shift removed → continues placing on other days. Never leaves armed mode.

### Layout Changes (Small Screen)

| Change | Details |
|--------|---------|
| **Compact FAB (48dp)** | Down from 56dp. MD3 minimum touch target. Icon 22px. |
| **Dynamic row count** | 5 rows when month fits, 6 only when needed. Reclaims ~50pt on most months. |
| **Collapsible summary footer** | Collapsed by default: overtime + chevron (~28pt). Expand for full details. |

### UX Polish

| Improvement | Details |
|-------------|---------|
| **Banner hint text** | "Tap to place · Hold to remove" — teaches both gestures |
| **Visual flash feedback** | Green flash on place, red flash on remove (400ms fade). Works on repeated placements. |
| **Silent overlap skip** | Light haptic instead of modal Alert when shift already exists on day |
| **Chevron direction** | Down when collapsed (expand), Up when expanded (collapse) |

---

## Files Changed

| File | Changes |
|------|---------|
| `CalendarFAB.tsx` | FAB visible in MonthView, 48dp size, icon 22px, menu repositioned |
| `MonthView.tsx` | Instant single-tap place, long-press remove, dynamic rows, collapsible footer, flash feedback, silent overlap |
| `WeekView.tsx` | Single-tap place (was double-tap), long-press remove, banner text, silent overlap |
| `calendar-reducer.ts` | `DELETE_INSTANCE` preserves armed mode (was resetting to 'viewing') |
| `en.ts` / `de.ts` | `calendar.batch.tapHint` with place + remove hint |

---

## Validation

Tested on iOS simulator (iPhone 15 Pro) and Android emulator (Pixel 7a):
- FAB visible in MonthView, menu opens correctly
- Single-tap places shift instantly with green flash + haptic
- Long-press removes shift with red flash + haptic
- Overlap silently skipped with light haptic
- Banner shows "Tap to place · Hold to remove"
- X button disarms, single-tap navigates to WeekView when not armed
- Dynamic rows: most months show 5 rows, extra space used
- Collapsible footer: chevron toggles correctly, animated expand/collapse
- WeekView gestures match MonthView (single-tap place, long-press remove)
