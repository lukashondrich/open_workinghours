# User Test Feedback

**Created:** 2025-01-18
**Status:** Active - Gathering feedback for next iteration

---

## Overview

This document captures user test feedback to guide the next development iteration. Issues are prioritized based on user impact and frequency.

---

## Feedback Items

### UT-1: GPS Tracking Failed in Hospital Context

**Problem:** GPS-based geofencing did not trigger clock-out while user was in hospital.

**Context:**
- User submitted GPS telemetry data via the "Report Issue" button
- This is real-world hospital GPS data (valuable for testing/tuning)

**Investigation Finding (2025-01-18):**
The GPS telemetry data was **never stored** due to a backend bug:
1. Mobile app correctly collects and sends `gps_telemetry` in bug report payload
2. Backend `FeedbackIn` schema lacks `gps_telemetry` field - Pydantic silently discards it
3. Backend router builds `app_state` JSON without GPS data
4. **Result:** Hospital GPS data from this test was lost

**Files involved:**
- `mobile-app/src/lib/utils/reportIssue.ts` - Collects telemetry (working correctly)
- `backend/app/schemas.py` - Missing `gps_telemetry` field in `FeedbackIn`
- `backend/app/routers/feedback.py` - Doesn't include GPS in `app_state`

**Action Required:**
- [x] Investigate why GPS telemetry isn't in bug reports (DONE - backend bug found)
- [x] **FIX: Add `gps_telemetry` field to `FeedbackIn` schema**
- [x] **FIX: Include `gps_telemetry` in `app_state` JSON**
- [x] **FIX: Add GPS telemetry display to admin dashboard**
- [ ] Deploy backend fix to production
- [ ] Ask user to re-submit bug report to capture data
- [ ] Analyze signal characteristics in hospital environment
- [ ] Use this data to tune geofencing parameters

**Priority:** High
**Status:** Backend fix complete - needs deployment

---

### UT-2: Session Sync Discrepancy Between Week and Month Views

**Problem:** Active/recent GPS-tracked sessions appear in week view but not in month view.

**Example:** Session spanning yesterday to today shows in week view but is missing from month view.

**Root Cause (Investigated 2025-01-18):**
Month view had no way to load tracking data because:
1. GPS toggle (which triggers data load) was only shown in week view
2. Tracking data only loaded when `reviewMode=true`
3. If user navigated directly to month view, tracking data never loaded

**Solution Implemented (2025-01-18):**
Hybrid approach - month view always loads tracking data automatically (it's overview-only), while week view keeps the GPS toggle for detailed editing mode.

**Changes in `calendar-context.tsx`:**
1. `SET_VIEW` to month now always loads tracking (removed `reviewMode` condition)
2. `SET_MONTH` in month view now always loads tracking (removed `reviewMode` condition)
3. `tracking-changed` event refreshes month view regardless of `reviewMode`
4. New `useEffect` loads tracking on initial mount if starting in month view

**Visual Indicators (already implemented):**
- Unconfirmed days with activity show "?" icon
- Confirmed days show overtime with ✓ icon
- Multi-day sessions correctly split across days

**Priority:** High
**Status:** Fixed - needs testing

---

### UT-3: Cannot Create Tracked Sessions for Past Days

**Problem:** Users cannot retroactively add tracked time for days when:
- Their phone malfunctioned
- They forgot their phone at home
- GPS tracking failed entirely (no session created at all)

**Solution Implemented (2026-01-18):**
Manual session creation feature with two entry points:

1. **FAB Menu** - New "Log Hours" option alongside Shifts and Absences
2. **Long-press on calendar** - "Log Tracked Hours" option in template picker

**Implementation Details:**
- New `ManualSessionForm` component with location dropdown, date picker, time pickers
- `Database.createManualSession()` method with overlap validation
- Sessions created with `tracking_method: 'manual'`, `state: 'completed'`
- Calendar auto-refreshes via `tracking-changed` event
- Full i18n support (EN/DE)

**Files Changed:**
- `Database.ts` - Added `createManualSession()` and `getOverlappingSessions()`
- `ManualSessionForm.tsx` - New component
- `CalendarFAB.tsx` - Added "Log Hours" menu option
- `WeekView.tsx` - Added "Log Tracked Hours" to template picker
- `calendar-reducer.ts` / `types.ts` - State management for form
- `en.ts` / `de.ts` - Translation strings

**Validation:**
- End time must be after start time
- Cannot log future dates
- Cannot overlap with existing sessions at same location

**Priority:** High
**Status:** Implemented - needs testing

---

### UT-4: "Confirm" Action Not Sufficiently Clear

**Problem:** Users don't understand that "Confirm" means:
1. Data becomes uneditable after confirmation
2. Data gets published/submitted to the backend

**Impact:** Users may confirm without understanding the permanence, or hesitate to confirm because they don't understand what it does.

**Solution Implemented (2026-01-19):**
1. **First-time tooltip:** Modal appears on first submit tap explaining what happens
2. **Clearer labeling:** Button changed from "Confirm?" to "Submit" ("✓" when compact)
3. **Inline hint:** Header shows "Submit each day to finalize your hours" when GPS mode is active

**Files changed:**
- `src/lib/storage/OnboardingStorage.ts` (new)
- `src/lib/i18n/translations/en.ts`, `de.ts`
- `src/modules/calendar/components/WeekView.tsx`
- `src/modules/calendar/components/CalendarHeader.tsx`

**Priority:** Medium
**Status:** Implemented - needs device testing

---

### UT-5: 14-Day Widget on Status Screen Not Useful

**Problem:** One user reported they don't need/use the 14-day hours summary widget on the status screen.

**Sample Size:** 1 user (insufficient for action)

**Notes:**
- Document for pattern tracking
- If more users report this, consider:
  - Making widget collapsible
  - Moving to a dedicated "Stats" tab
  - Reducing visual prominence

**Priority:** Low (monitor)
**Status:** Documented - no action required yet

---

## Summary Table

| ID | Issue | Priority | Status |
|----|-------|----------|--------|
| UT-1 | GPS telemetry not stored | High | Backend fix done - needs deploy |
| UT-2 | Week/month view sync | High | Fixed - needs testing |
| UT-3 | Manual past sessions | High | Implemented - needs testing |
| UT-4 | Confirm clarity | Medium | Implemented - needs testing |
| UT-5 | 14-day widget unused | Low | Monitor |

---

## Next Steps

1. Retrieve and analyze hospital GPS data from UT-1
2. Device testing for UT-2, UT-3, and UT-4 implementations
3. Deploy backend fix for UT-1

---

## Related Documents

- `mobile-app/ARCHITECTURE.md` - Current calendar and geofencing implementation
- `archive/GEOFENCE_HYSTERESIS_PLAN.md` - Previous geofencing improvements
- `archive/MONTH_VIEW_UX_PLAN.md` - Month view implementation details
