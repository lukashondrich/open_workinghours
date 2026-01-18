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

**Root Cause:** Month view currently only displays confirmed sessions, which confuses users who expect to see their tracked time.

**Desired Behavior:**
- Show session in both views, whether active or completed
- For multi-day sessions:
  - Past days that are confirmed: show as confirmed
  - Current day (unconfirmed): show with "pending" or "?" indicator
  - Even if today's portion can't be confirmed yet, yesterday's confirmed portion should display

**Proposed Solution:**
- In month view, show unconfirmed/active days with a distinct visual indicator (e.g., "?" badge, dashed border, or faded style)
- Split multi-day sessions so each day's portion can have independent confirmation status display

**Priority:** High
**Status:** Not started

---

### UT-3: Cannot Create Tracked Sessions for Past Days

**Problem:** Users cannot retroactively add tracked time for days when:
- Their phone malfunctioned
- They forgot their phone at home
- GPS tracking failed entirely (no session created at all)

**Current State:**
- GPS works correctly → session created → user can edit start/end times ✓
- GPS partially fails → session exists → user can correct times ✓
- GPS fails completely → **no session exists → no way to add one** ✗

Users can add shifts (planned) and absences, but these are different from tracked sessions.

**Proposed Solution:**
Allow manual creation of tracked sessions (same type GPS creates):
- User selects a past day with no session
- User enters clock-in and clock-out times
- System creates a session identical to what GPS would have created
- Session appears in calendar same as GPS-tracked sessions
- Session goes through normal confirmation flow

**Design Considerations:**
- Entry point: FAB menu? Long-press on empty day? New option in template picker?
- Visual indicator: Should manually-created sessions look different from GPS-created ones? (Probably not - same data, same purpose)
- Time picker: Reuse existing session edit UI
- Validation: Prevent overlapping sessions, same rules as GPS sessions

**Priority:** High
**Status:** Not started

---

### UT-4: "Confirm" Action Not Sufficiently Clear

**Problem:** Users don't understand that "Confirm" means:
1. Data becomes uneditable after confirmation
2. Data gets published/submitted to the backend

**Impact:** Users may confirm without understanding the permanence, or hesitate to confirm because they don't understand what it does.

**Potential Solutions:**
- **Onboarding:** Add explanation during first-time use tutorial
- **Inline hint:** Add subtle explainer text near confirm button (e.g., "Submits your hours - cannot be edited after")
- **Confirmation dialog:** Brief modal explaining what happens (risk: adds friction)
- **Visual preview:** Show what will be submitted before confirming

**Priority:** Medium
**Status:** Not started - needs solution decision

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
| UT-1 | GPS failed in hospital | High | Not started |
| UT-2 | Week/month view sync | High | Not started |
| UT-3 | Manual past sessions | High | Not started |
| UT-4 | Confirm clarity | Medium | Not started |
| UT-5 | 14-day widget unused | Low | Monitor |

---

## Next Steps

1. Retrieve and analyze hospital GPS data from UT-1
2. Design solution for UT-2 (month view pending indicator)
3. Design 3rd event type for UT-3 (manual tracked session)
4. Decide on approach for UT-4 (onboarding vs inline hint)

---

## Related Documents

- `mobile-app/ARCHITECTURE.md` - Current calendar and geofencing implementation
- `archive/GEOFENCE_HYSTERESIS_PLAN.md` - Previous geofencing improvements
- `archive/MONTH_VIEW_UX_PLAN.md` - Month view implementation details
