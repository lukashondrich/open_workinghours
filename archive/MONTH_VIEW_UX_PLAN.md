# Month View UX Improvements Plan

**Created:** 2026-01-16
**Status:** Complete
**Triggered by:** User feedback from beta testers

---

## Overview

Improve the Month View to be more useful for healthcare workers who need a quick overview of their monthly hours for HR reporting. Changes focus on expanding the grid layout, adding confirmation indicators, and providing a monthly summary footer with tracked/planned hours and overtime.

---

## User Feedback Summary

| Issue | Current State | Target State |
|-------|---------------|--------------|
| Grid only fills top ~1/3 of screen | Fixed `aspectRatio: 1` on day cells | Grid fills available space |
| Confirmed days hard to identify | Green background tint | ✓/? icons like Status page |
| No monthly statistics | None | Summary footer with hours/overtime |
| GPS toggle does nothing | Toggle visible but has no effect | Hide in month view |
| Users need HR reporting data | Must calculate manually | Show tracked, planned, overtime, absences |

---

## Design Decisions

### 1. Expanded Grid Layout

**Before:**
```
┌─────────────────────────────────────────┐
│  [Header]                               │
├─────────────────────────────────────────┤
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun      │
│ ┌───┬───┬───┬───┬───┬───┬───┐          │
│ │30 │31 │ 1 │ 2 │ 3 │ 4 │ 5 │          │
│ └───┴───┴───┴───┴───┴───┴───┘          │
│ ┌───┬───┬───┬───┬───┬───┬───┐          │
│ │ 6 │ 7 │ 8 │...│...│...│...│          │
│ └───┴───┴───┴───┴───┴───┴───┘          │
│                                         │
│  (empty space ~2/3 of screen)           │
│                                         │
└─────────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────┐
│  [Header - no GPS toggle]               │
├─────────────────────────────────────────┤
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun      │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ │ 30  │ 31  │  1  │  2  │  3  │  4  │  5  │
│ │     │     │ ●●  │ ●   │ ●   │     │     │
│ │     │     │  ✓  │  ✓  │  ?  │     │     │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ │  6  │  7  │  8  │  9  │ 10  │ 11  │ 12  │
│ │ ●●○ │ ●○  │ ●○  │ ●○  │ ●○  │     │     │
│ │  ✓  │  ✓  │  ✓  │  ✓  │  ?  │     │     │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ │ ... │ ... │ ... │ ... │ ... │ ... │ ... │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘
├─────────────────────────────────────────┤
│  142.5h     │  160.0h     │  -17.5h     │
│  Tracked    │  Planned    │  Overtime   │
│                  🌴 2    🌡️ 1            │
└─────────────────────────────────────────┘
```

### 2. Day Cell Layout

Each cell contains (top to bottom):
1. **Day number** - Same as before
2. **Indicator dots** - Shift colors (●) + tracked (○ rose)
3. **Absence icons** - 🌴 vacation, 🌡️ sick (if applicable)
4. **Confirmation icon** - ✓ confirmed, ? unconfirmed with activity

**Icon logic:**
- ✓ (Check) - Day is confirmed, color: `colors.primary[500]` (teal)
- ? (CircleHelp) - Day has activity but not confirmed, color: `colors.grey[400]`
- No icon - Day has no activity (no shifts, no tracking)

**Removed:** Green background tint for confirmed days (replaced by ✓ icon)

### 3. Summary Footer

Fixed height footer (~80px) showing:

```
┌─────────────────────────────────────────┐
│   142.5h    │   160.0h    │   -17.5h    │
│   Tracked   │   Planned   │   Overtime  │
│                                         │
│              🌴 2    🌡️ 1               │
└─────────────────────────────────────────┘
```

**Metrics:**
- **Tracked** - Sum of all tracking records in the month (minus breaks)
- **Planned** - Sum of all shift instances in the month
- **Overtime** - Tracked minus Planned (green if positive, red if negative)
- **Absence chips** - Count of vacation days (🌴) and sick days (🌡️)

### 4. GPS Toggle Hidden

The GPS toggle (`reviewMode`) controls tracked time visibility in week view. In month view:
- Tracked dots always show (no toggle needed for overview)
- Hide the toggle to reduce confusion

---

## Implementation Plan

### Phase 1: Hide GPS Toggle in Month View (Low Risk)

| Step | Task | File |
|------|------|------|
| 1.1 | Wrap GPS toggle in `state.view === 'week'` conditional | `CalendarHeader.tsx` |

### Phase 2: Expand Grid Layout (Medium Complexity)

| Step | Task | File |
|------|------|------|
| 2.1 | Remove `aspectRatio: 1` from `dayCell` style | `MonthView.tsx` |
| 2.2 | Calculate `weeksCount` from calendar days | `MonthView.tsx` |
| 2.3 | Use dynamic height: `height: 100 / weeksCount %` | `MonthView.tsx` |
| 2.4 | Add `flex: 1` to grid container | `MonthView.tsx` |

### Phase 3: Add Confirmation Icons (Medium Complexity)

| Step | Task | File |
|------|------|------|
| 3.1 | Import `Check`, `CircleHelp` from lucide-react-native | `MonthView.tsx` |
| 3.2 | Add `hasActivity` to indicators calculation | `MonthView.tsx` |
| 3.3 | Add confirmation icon row to DayCell | `MonthView.tsx` |
| 3.4 | Remove `dayCellConfirmed` and `dayLabelConfirmed` styles | `MonthView.tsx` |

### Phase 4: Add Monthly Summary Footer (Medium Complexity)

| Step | Task | File |
|------|------|------|
| 4.1 | Create `getMonthSummary()` helper function | `calendar-utils.ts` |
| 4.2 | Create `MonthlySummaryFooter` component | `MonthView.tsx` |
| 4.3 | Calculate and pass summary data to footer | `MonthView.tsx` |
| 4.4 | Style footer with dividers and absence chips | `MonthView.tsx` |

### Phase 5: Translations (Low Risk)

| Step | Task | File |
|------|------|------|
| 5.1 | Add English translations | `en.ts` |
| 5.2 | Add German translations | `de.ts` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `mobile-app/src/modules/calendar/components/CalendarHeader.tsx` | Hide GPS toggle when `view === 'month'` |
| `mobile-app/src/modules/calendar/components/MonthView.tsx` | Expand grid, add icons, add summary footer |
| `mobile-app/src/lib/calendar/calendar-utils.ts` | Add `getMonthSummary()` function |
| `mobile-app/src/lib/i18n/translations/en.ts` | Add "Tracked", "Planned", "Overtime" |
| `mobile-app/src/lib/i18n/translations/de.ts` | Add "Erfasst", "Geplant", "Überstunden" |

---

## New Types

```typescript
// In calendar-utils.ts
export interface MonthSummary {
  trackedMinutes: number;
  plannedMinutes: number;
  vacationDays: number;
  sickDays: number;
}
```

---

## Translations

```typescript
// en.ts
calendar: {
  month: {
    tracked: 'Tracked',
    planned: 'Planned',
    overtime: 'Overtime',
  },
}

// de.ts
calendar: {
  month: {
    tracked: 'Erfasst',
    planned: 'Geplant',
    overtime: 'Überstunden',
  },
}
```

---

## Verification Checklist

- [ ] GPS toggle hidden in month view
- [ ] GPS toggle still visible in week view
- [ ] Month grid fills available screen space
- [ ] Day cells are taller (not square)
- [ ] ✓ icon appears on confirmed days with activity
- [ ] ? icon appears on unconfirmed days with activity
- [ ] No icon on days without activity
- [ ] Green background removed from confirmed days
- [ ] Summary footer shows at bottom of screen
- [ ] Tracked hours sum correctly for the month
- [ ] Planned hours sum correctly for the month
- [ ] Overtime shows correct difference with +/- sign
- [ ] Overtime text is green when positive, red when negative
- [ ] Vacation count shows with 🌴 icon
- [ ] Sick day count shows with 🌡️ icon
- [ ] Absence chips hidden when counts are 0
- [ ] German translations work correctly
- [ ] Tapping a day still navigates to week view

---

## Out of Scope (Deferred)

- **Swipe navigation** - Save for later (arrows work fine)
- **Export to HR systems** - Defer until format requirements known
- **Legend for dots** - No user feedback requesting this yet
- **Additional graphs** - Avoid cluttering the view

---

## Progress Log

### 2026-01-16
- Created this planning document
- Explored codebase patterns (MonthView, CalendarHeader, DashboardDataService)
- Designed implementation approach based on user feedback
- Identified existing patterns for summary calculations
- **Implementation complete:**
  - Phase 1: GPS toggle hidden in month view (CalendarHeader.tsx)
  - Phase 2: Grid layout expanded to fill screen with dynamic cell heights
  - Phase 3: Added ✓/? confirmation icons, removed green confirmed background
  - Phase 4: Added `getMonthSummary()` helper and `MonthlySummaryFooter` component
  - Phase 5: Added translations (EN: Tracked/Planned/Overtime, DE: Erfasst/Geplant/Überstunden)
- **Enhancement: Per-day overtime display (nudge to confirm)**
  - Confirmed days show overtime + ✓ (e.g., "+1h 30m ✓")
  - Color-coded: green (positive), red (negative), grey (zero)
  - Format: hours+minutes to avoid decimal confusion ("+1h 30m" not "+1.5h")
  - Unconfirmed days with activity show ? icon
  - Footer shows "(+Xh Ym confirmed)" hint when some overtime is unconfirmed
  - Added `formatOvertimeDisplay()` helper and `confirmedOvertimeMinutes` to summary
- **Bug fix: Month view tracking records**
  - Issue: Only the last-viewed week's tracking data was shown in month view
  - Cause: `loadRealTrackingRecords()` only loaded current week range
  - Fix: CalendarProvider now loads full month data when:
    - Switching to month view while in review mode
    - Navigating months while in month view + review mode
    - Tracking events (clock-in/out) while in month view
- **Hide FAB in month view**
  - Month view is for overview, week view is for editing
  - Added `state.view === 'month'` check to CalendarFAB
- **Multi-day session overlap fix**
  - Issue: Sessions >24h only showed on start day, middle days showed 0h
  - Solution: Added `getTrackedMinutesForDate()` with proper overlap calculation
  - Breaks proportionally allocated based on overlap ratio
- **Code cleanup: Deduplicated time helpers**
  - Moved `getDayBounds()` and `computeOverlapMinutes()` to calendar-utils.ts
  - DashboardDataService now imports from calendar-utils (single source of truth)
- **Swipe navigation with animation**
  - PanResponder detects horizontal swipes (>50px threshold)
  - 200ms slide animation before month change
  - Refs used to avoid stale closure issues
- **Header title click**
  - Clicking "Planning Calendar [Month]" navigates to current month
  - Matches week view behavior (click title → go to today)
- **Consistent footer layout**
  - Grid always renders 42 cells (6 weeks) regardless of month
  - Absence row always rendered with minHeight: 32
  - Confirmed hint always reserves space (opacity: 0 when hidden)

---

## Notes

- Summary calculation follows same pattern as `DashboardDataService.loadDashboardData()`
- Overtime = Tracked - Planned (simple subtraction, not contract-based)
- Day cells use dynamic height based on weeks in month (4-6 weeks)
- Confirmation icons use same lucide-react-native library as rest of app
