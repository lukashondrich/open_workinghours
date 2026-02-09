# Manual Session Creation Plan

**Created:** 2026-01-18
**Status:** Complete
**Related Issue:** UT-3 (USERTEST_FEEDBACK.md)

---

## Problem Statement

When GPS tracking fails completely (phone malfunction, forgotten at home, no signal), users have no way to record their actual worked hours. They can add planned shifts and absences, but not tracked sessions.

**Current State:**
- GPS works → session created → user can edit times ✓
- GPS partially fails → session exists → user can correct times ✓
- GPS fails completely → no session → **no way to add one** ✗

---

## Solution Overview

Allow users to manually create tracked sessions identical to GPS-created ones. Two entry points for maximum discoverability and convenience:

1. **FAB menu** - Add "Log Hours" option alongside "Shifts" and "Absences"
2. **Long-press on calendar** - Add "Log Tracked Hours" option in context menu

Both entry points open the same Manual Session Form.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual differentiation | None | Same data, same purpose - no need to distinguish |
| Internal flag | Use existing `tracking_method: 'manual'` | Already in schema, good for potential auditing |
| Valid dates | Past days + present day | Users may need to log same-day hours |
| Multiple sessions per day | Allowed | Users may have split shifts or return to work |
| Overlap validation | Per-location only | Same location can't have overlapping sessions |

---

## User Flow

### Flow A: Via FAB Menu

```
1. User taps FAB (+) button
2. Menu shows: "Absences" | "Shifts" | "Log Hours"
3. User taps "Log Hours"
4. Manual Session Form opens (date defaults to selected day or today)
5. User selects: Location → Date → Start time → End time
6. User taps "Save"
7. Session created, calendar refreshes
8. Form closes, user sees new session on calendar
```

### Flow B: Via Long-Press

```
1. User long-presses on empty calendar space (past/present day)
2. Menu shows: [existing template options] + "Log Tracked Hours"
3. User taps "Log Tracked Hours"
4. Manual Session Form opens (date pre-filled from long-press location)
5. User selects: Location → Start time → End time
6. User taps "Save"
7. Session created, calendar refreshes
```

---

## UI Components

### 1. FAB Menu Update

**File:** `mobile-app/src/modules/calendar/components/CalendarFAB.tsx`

Add third option:
```
┌─────────────┐
│  Absences   │
├─────────────┤
│   Shifts    │
├─────────────┤
│  Log Hours  │  ← NEW
└─────────────┘
      [+]
```

### 2. Long-Press Menu Update

**File:** `mobile-app/src/modules/calendar/components/WeekView.tsx`

Add option to existing Alert menu when long-pressing empty space:
- Current: Shows template picker
- New: Add "Log Tracked Hours" option that opens Manual Session Form

### 3. Manual Session Form (New Component)

**File:** `mobile-app/src/modules/calendar/components/ManualSessionForm.tsx`

Modal bottom sheet or full-screen modal with:

```
┌────────────────────────────────────────┐
│  Log Tracked Hours              [X]    │
├────────────────────────────────────────┤
│                                        │
│  Location                              │
│  ┌──────────────────────────────────┐  │
│  │ [icon] Main Hospital        ▼    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Date                                  │
│  ┌──────────────────────────────────┐  │
│  │ [calendar] Fri, Jan 17, 2026     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Start Time              End Time      │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  08:00       │    │  16:30       │  │
│  └──────────────┘    └──────────────┘  │
│                                        │
│  Duration: 8h 30m                      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │           Save Session           │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

**Form Fields:**

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| Location | Dropdown | First/only location | Required, must have ≥1 location |
| Date | Date picker | Long-press date or today | Not future |
| Start Time | Time picker | 08:00 | Required |
| End Time | Time picker | 16:00 | Required, > start time |

**Computed:**
- Duration shown as helper text (end - start)

**Validation Rules:**
1. End time must be after start time
2. Date cannot be in the future
3. No overlap with existing sessions at same location on same day
4. Location must exist (edge case: user deleted all locations)

**Error States:**
- "End time must be after start time"
- "Cannot log hours for future dates"
- "Overlaps with existing session (08:00 - 12:00)"
- "Please add a location first" (if no locations configured)

---

## Data Model

### Session Creation

Use existing `TrackingSession` structure:

```typescript
{
  id: uuid(),
  location_id: selectedLocation.id,
  clock_in: startDateTime.toISOString(),    // Date + Start Time
  clock_out: endDateTime.toISOString(),     // Date + End Time
  duration_minutes: differenceInMinutes(end, start),
  tracking_method: 'manual',                 // Distinguishes from GPS
  state: 'completed',                        // Manually entered = already complete
  pending_exit_at: null,
  exit_accuracy: null,                       // No GPS data
  checkin_accuracy: null,                    // No GPS data
  created_at: now(),
  updated_at: now()
}
```

### Database Method

**File:** `mobile-app/src/modules/geofencing/services/Database.ts`

Add new method:

```typescript
async createManualSession(
  locationId: string,
  clockIn: Date,
  clockOut: Date
): Promise<TrackingSession>
```

This method:
1. Validates clockOut > clockIn
2. Checks for overlaps at same location
3. Inserts session with `tracking_method: 'manual'`
4. Returns created session

---

## State Management

### Calendar Context Updates

**File:** `mobile-app/src/lib/calendar/calendar-context.tsx`

New action:

```typescript
type CalendarAction =
  | { type: 'OPEN_MANUAL_SESSION_FORM'; payload?: { date?: string } }
  | { type: 'CLOSE_MANUAL_SESSION_FORM' }
  // ... existing actions
```

New state:

```typescript
interface CalendarState {
  // ... existing
  manualSessionFormOpen: boolean;
  manualSessionFormDate: string | null;  // Pre-filled date if from long-press
}
```

### After Session Created

1. Emit `tracking-changed` event (existing pattern)
2. Calendar provider catches event, refreshes tracking data
3. New session appears on calendar immediately

---

## Implementation Steps

### Phase 1: Database Layer
- [ ] Add `Database.createManualSession()` method
- [ ] Add overlap detection helper
- [ ] Add unit tests for session creation

### Phase 2: Manual Session Form Component
- [ ] Create `ManualSessionForm.tsx` component
- [ ] Location dropdown (fetch from Database)
- [ ] Date picker integration
- [ ] Time pickers for start/end
- [ ] Duration calculation display
- [ ] Validation logic and error display
- [ ] Save handler (calls Database method)

### Phase 3: FAB Menu Integration
- [ ] Add "Log Hours" option to CalendarFAB
- [ ] Wire up to open ManualSessionForm
- [ ] Add i18n strings (EN/DE)

### Phase 4: Long-Press Integration
- [ ] Modify long-press handler in WeekView
- [ ] Add "Log Tracked Hours" option to Alert menu
- [ ] Pass pre-selected date to form

### Phase 5: State & Refresh
- [ ] Add calendar state for form open/close
- [ ] Emit tracking-changed event on save
- [ ] Verify calendar refresh works

### Phase 6: Polish & Edge Cases
- [ ] Handle "no locations" state gracefully
- [ ] Test overlap validation thoroughly
- [ ] Verify month view also shows new sessions
- [ ] Test confirmation flow for manually-created sessions

---

## i18n Strings

**English:**
```
manual_session_title: "Log Tracked Hours"
manual_session_location: "Location"
manual_session_date: "Date"
manual_session_start: "Start Time"
manual_session_end: "End Time"
manual_session_duration: "Duration"
manual_session_save: "Save Session"
manual_session_error_future: "Cannot log hours for future dates"
manual_session_error_overlap: "Overlaps with existing session"
manual_session_error_times: "End time must be after start time"
manual_session_error_no_location: "Please add a location first"
fab_log_hours: "Log Hours"
longpress_log_hours: "Log Tracked Hours"
```

**German:**
```
manual_session_title: "Arbeitszeit erfassen"
manual_session_location: "Standort"
manual_session_date: "Datum"
manual_session_start: "Startzeit"
manual_session_end: "Endzeit"
manual_session_duration: "Dauer"
manual_session_save: "Speichern"
manual_session_error_future: "Keine zukünftigen Zeiten möglich"
manual_session_error_overlap: "Überschneidung mit bestehender Sitzung"
manual_session_error_times: "Endzeit muss nach Startzeit liegen"
manual_session_error_no_location: "Bitte zuerst einen Standort hinzufügen"
fab_log_hours: "Zeit erfassen"
longpress_log_hours: "Arbeitszeit erfassen"
```

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `Database.ts` | Modify | Add `createManualSession()` method |
| `ManualSessionForm.tsx` | Create | New form component |
| `CalendarFAB.tsx` | Modify | Add "Log Hours" option |
| `WeekView.tsx` | Modify | Add long-press menu option |
| `calendar-context.tsx` | Modify | Add form state management |
| `calendar-reducer.ts` | Modify | Add actions for form |
| `en.ts` | Modify | Add English strings |
| `de.ts` | Modify | Add German strings |

---

## Testing Checklist

- [ ] Create session via FAB → appears on calendar
- [ ] Create session via long-press → date pre-filled correctly
- [ ] Overlap validation prevents duplicate sessions
- [ ] Cannot select future dates
- [ ] End time must be after start time
- [ ] Session appears in both week and month views
- [ ] Session can be edited after creation (drag handles)
- [ ] Session can be confirmed and submitted to backend
- [ ] Works with multiple locations
- [ ] Works when only one location exists
- [ ] Error state when no locations configured
- [ ] German translations display correctly

---

## Decided Questions

1. **Break time for manual sessions?** - No. Keep it simple. Users can add breaks after creation via the existing "Adjust Breaks" flow.

2. **Quick presets?** - No. YAGNI. Users can enter times directly.

---

## Success Criteria

1. Users can create tracked sessions for any past day or today
2. Sessions are indistinguishable from GPS-created ones in calendar view
3. Sessions go through normal confirmation and submission flow
4. Feature is discoverable via FAB menu
5. Feature is convenient via long-press shortcut
