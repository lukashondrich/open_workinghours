# Calendar UX Improvements Plan

**Created:** 2026-01-15
**Status:** Complete
**Triggered by:** UX expert feedback

---

## Overview

Improve the Calendar screen UX based on feedback from UX review. Changes focus on simplifying the header, improving template selection, and adding a floating action button for better accessibility.

---

## UX Feedback Summary

| Issue | Current State | Target State |
|-------|---------------|--------------|
| GPS button looks like menu opener | Text button with red background when active | iOS-style toggle switch |
| Green bar between header and calendar | Shows "Daily Submissions" status | Remove entirely |
| Header is messy/crowded | Two rows with many elements | Simplified hierarchy |
| "Dienste" button placement | In header (primary button) | FAB with "+" in bottom-right |
| Template selection | Card-based with "Select" button | Compact radio list |
| Red shift color | Rose available in color picker | Remove rose (conflicts with tracked time) |
| Absence templates | Cannot create new ones | Add "+" button to create |
| Half-day absence defaults | May exist in some installations | Clean up via migration |

---

## Design Decisions

### 1. Header Layout (After)

```
┌─────────────────────────────────────────────────────┐
│  CALENDAR                        ┌───────────────┐  │
│  Jan 13 - Jan 19    W3          │ Week │ Month  │  │
│                                  └───────────────┘  │
├─────────────────────────────────────────────────────┤
│  [<] [>]                              GPS [●━━━]   │
└─────────────────────────────────────────────────────┘
```

- Row 1: Title + week badge + Week/Month segmented control (unchanged)
- Row 2: Nav arrows (left) + GPS label + Switch (right)
- Removed: Green bar, "Dienste" button

### 2. FAB + Popup Menu

```
                                    ┌─────────────┐
                                    │ Absences    │
                                    ├─────────────┤
                                    │ Shifts      │  ← closer to thumb
                                    └─────────────┘
                                          (+)        ← FAB (56x56)
```

- Standard Material Design FAB pattern (like Google Calendar)
- Popup appears above FAB
- "Shifts" at bottom for easier thumb reach
- Each option opens TemplatePanel on that tab

### 3. Template Selection (Compact Radio List - Draft C)

```
┌─────────────────────────────────────────────────────┐
│  ○  Morning Shift      08:00  8h   [●]         ›   │
├─────────────────────────────────────────────────────┤
│  ●  Evening Shift      14:00  8h   [●]         ›   │  ← selected
├─────────────────────────────────────────────────────┤
│  ○  Night Shift        22:00  10h  [●]         ›   │
└─────────────────────────────────────────────────────┘
```

- Radio indicator on left (single select)
- Tap row → selects/arms template
- Tap chevron (›) → opens edit view
- Color dot shows template color
- Same pattern for absences

### 4. Color Options (Shifts)

**Before:** `['teal', 'blue', 'green', 'amber', 'rose', 'purple']`
**After:** `['teal', 'blue', 'green', 'amber', 'purple']`

Rose removed because tracked time uses red/rose for display, causing visual confusion.

---

## Implementation Plan

### Phase 1: Header Simplification (Low Risk)

| Step | Task | File |
|------|------|------|
| 1.1 | Remove green bar (`submissionContainer`) | `CalendarHeader.tsx` |
| 1.2 | Remove "Dienste" button | `CalendarHeader.tsx` |
| 1.3 | Replace GPS button with Switch component | `CalendarHeader.tsx` |
| 1.4 | Update layout and styles | `CalendarHeader.tsx` |

### Phase 2: FAB Implementation (Medium Complexity)

| Step | Task | File |
|------|------|------|
| 2.1 | Create CalendarFAB component | `CalendarFAB.tsx` (new) |
| 2.2 | Implement popup menu with options | `CalendarFAB.tsx` |
| 2.3 | Wire to calendar context (tab + panel) | `CalendarFAB.tsx` |
| 2.4 | Add FAB to CalendarScreen | `CalendarScreen.tsx` |
| 2.5 | Add i18n translations | `en.ts`, `de.ts` |

### Phase 3: TemplatePanel Refactor (High Complexity)

| Step | Task | File |
|------|------|------|
| 3.1 | Remove 'rose' from COLORS array | `TemplatePanel.tsx` |
| 3.2 | Create compact radio row component | `TemplatePanel.tsx` |
| 3.3 | Refactor shifts tab to use compact rows | `TemplatePanel.tsx` |
| 3.4 | Add absence template creation (+ button) | `TemplatePanel.tsx` |
| 3.5 | Refactor absences tab to use compact rows | `TemplatePanel.tsx` |

### Phase 4: Database Migration (Low Risk)

| Step | Task | File |
|------|------|------|
| 4.1 | Add migration 3: delete half-day templates | `CalendarStorage.ts` |

---

## Files to Create

| File | Purpose |
|------|---------|
| `mobile-app/src/modules/calendar/components/CalendarFAB.tsx` | Floating action button with popup menu |

## Files to Modify

| File | Changes |
|------|---------|
| `mobile-app/src/modules/calendar/components/CalendarHeader.tsx` | Remove green bar, remove Dienste button, add Switch |
| `mobile-app/src/modules/calendar/components/TemplatePanel.tsx` | Compact radio list, remove rose, add absence creation |
| `mobile-app/src/modules/calendar/screens/CalendarScreen.tsx` | Add CalendarFAB |
| `mobile-app/src/modules/calendar/services/CalendarStorage.ts` | Migration 3 |
| `mobile-app/src/lib/i18n/translations/en.ts` | FAB menu labels, GPS label |
| `mobile-app/src/lib/i18n/translations/de.ts` | German translations |

---

## Verification Checklist

- [ ] Header shows Switch for GPS toggle (not button)
- [ ] Green bar removed from week view
- [ ] "Dienste" button removed from header
- [ ] FAB visible in bottom-right corner
- [ ] FAB popup shows "Shifts" and "Absences" options
- [ ] Tapping FAB option opens correct tab in TemplatePanel
- [ ] Template list shows radio buttons (single select)
- [ ] Tapping row selects template
- [ ] Tapping chevron opens edit view
- [ ] Rose color not available in shift color picker
- [ ] Can create new absence template via "+" button
- [ ] Half-day absence templates removed after migration
- [ ] Works on both iOS and Android

---

## Progress Log

### 2026-01-15
- Created this planning document
- Explored codebase patterns (toggle, FAB, theme)
- Designed implementation approach
- **Implementation complete:**
  - Phase 1: Header simplified (green bar removed, GPS switch added)
  - Phase 2: FAB created with popup menu
  - Phase 3: TemplatePanel refactored to compact radio list, rose color removed, absence creation added
  - Phase 4: Migration added to clean up half-day templates
- **Additional refinements based on testing:**
  - FAB icon: Plus/X swap instead of rotation (alignment fix)
  - GPS toggle: Eye icon with red theme (clearer affordance for "visibility")
  - Template rows: Edit pencil moved to left, radio selector to right (thumb reach)
  - Absence edit form: Added name, type selector, full-day toggle, start/end times
  - Absence persistence: Added `replaceAbsenceTemplates()` to fix FK constraint errors
  - Combined persistence useEffect for templates + instances (order guarantee)
  - FAB hiding: Added `hideFAB` state, syncs with time picker and template picker
  - Mutually exclusive selection: Selecting shift disarms absence and vice versa
  - Double-tap on empty space: Opens template picker (same as long-press)
  - Progressive disclosure: Raised thresholds to 32px/56px for better text fitting

---

## Notes

- State management extended with `hideFAB: boolean` and `SET_HIDE_FAB` action
- Migration only removes seeded half-day templates (IDs containing 'half')
- User-created templates preserved
- Key insight: Absence templates weren't being persisted, causing FK errors when placing instances
