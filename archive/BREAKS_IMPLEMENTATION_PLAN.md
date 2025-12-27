# Breaks Implementation Plan

**Created:** 2025-12-25
**Status:** Planning
**Scope:** Add break/pause functionality to tracked sessions and shift templates

---

## Overview

Users need to record break times (non-working periods) during their shifts. This affects:
1. **Tracked sessions** (review mode) - add breaks to past work sessions
2. **Shift templates** (planning mode) - define expected breaks for planned shifts
3. **Submission logic** - subtract breaks from total daily working hours

---

## Requirements

### User Stories

1. **As a user**, I want to add a break to a tracked session so that my working hours are accurately reported (net time, not gross time).
2. **As a user**, I want quick-add break buttons (5/15/30/45 min) so I can record breaks without typing.
3. **As a user**, I want to edit or remove breaks after adding them.
4. **As a user**, I want to see both gross time (clock-in to clock-out) and net time (gross minus breaks) in the UI.
5. **As a user**, I want to define expected breaks in shift templates so planning reflects realistic working hours.

### Business Rules

- **Break options**: 5, 15, 30, 45, 60 minutes (quick-add buttons)
- **Multiple breaks**: Buttons ADD to total (user can tap multiple times to sum breaks)
- **Validation**: Warn if break > duration, prevent negative net time (floor at 0)
- **Clear button**: Resets break to 0
- **Display**: Show both gross and net duration
- **Submission**: Only net time (gross - breaks) is submitted to backend
- **Overnight sessions**: Break is attributed to the session (not split across days)
  - When viewing Day 1 segment: shows full session duration with break
  - When viewing Day 2 segment: shows full session duration with break
  - Break is stored once on the session, subtracted when calculating daily totals
- **No max limit**: Trust user input (allow break > duration, just warn)

---

## Database Schema Changes

### 1. `shift_templates` Table

**Add column:**
```sql
ALTER TABLE shift_templates ADD COLUMN break_minutes INTEGER DEFAULT 0;
```

**Migration ID**: `002_add_break_minutes`

### 2. `tracking_records` Table

**Add column:**
```sql
ALTER TABLE tracking_records ADD COLUMN break_minutes INTEGER DEFAULT 0;
```

**Migration ID**: `002_add_break_minutes`

---

## Code Changes

### 1. Types (`mobile-app/src/lib/types.ts`)

**Update interfaces:**

```typescript
export interface ShiftTemplate {
  id: string;
  name: string;
  color: string;
  startTime: string; // "HH:mm"
  duration: number; // minutes
  breakMinutes?: number; // NEW - default 0
  recurrence: RecurrenceRule | null;
}

export interface TrackingRecord {
  id: string;
  sessionId?: string; // Links to geofencing session
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:mm"
  duration: number; // minutes (gross duration)
  breakMinutes?: number; // NEW - default 0
  isActive: boolean; // true if session is still ongoing
  createdAt: string;
  updatedAt: string;
}
```

---

### 2. Database Layer (`mobile-app/src/lib/Database.ts`)

**Add migration:**

```typescript
const MIGRATIONS = [
  // ... existing migrations
  {
    version: 2,
    sql: `
      ALTER TABLE shift_templates ADD COLUMN break_minutes INTEGER DEFAULT 0;
      ALTER TABLE tracking_records ADD COLUMN break_minutes INTEGER DEFAULT 0;
    `,
  },
];
```

**Update insert/update queries:**

```typescript
// Insert template
INSERT INTO shift_templates (id, name, color, start_time, duration, break_minutes, recurrence_rule)
VALUES (?, ?, ?, ?, ?, ?, ?)

// Insert tracking record
INSERT INTO tracking_records (id, session_id, date, start_time, duration, break_minutes, is_active, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

// Update tracking record
UPDATE tracking_records
SET start_time = ?, duration = ?, break_minutes = ?, updated_at = ?
WHERE id = ?
```

**New method:**

```typescript
async updateTrackingBreak(id: string, breakMinutes: number): Promise<void> {
  await this.db.runAsync(
    'UPDATE tracking_records SET break_minutes = ?, updated_at = ? WHERE id = ?',
    [breakMinutes, new Date().toISOString(), id]
  );
}
```

---

### 3. UI Components

#### 3.1 TrackingBadge (`WeekView.tsx`)

**Add break UI when session is selected:**

```tsx
{active && (
  <View style={styles.breakControls}>
    <Text style={styles.breakLabel}>Add Break:</Text>
    <View style={styles.breakButtons}>
      <TouchableOpacity onPress={() => onAddBreak(record.id, 5)}>
        <Text>5m</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onAddBreak(record.id, 15)}>
        <Text>15m</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onAddBreak(record.id, 30)}>
        <Text>30m</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onAddBreak(record.id, 45)}>
        <Text>45m</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onAddBreak(record.id, 60)}>
        <Text>60m</Text>
      </TouchableOpacity>
    </View>
    {record.breakMinutes > 0 && (
      <>
        <View style={styles.breakSummaryRow}>
          <Text style={styles.breakCurrent}>
            Current break: {formatDuration(record.breakMinutes)}
          </Text>
          <TouchableOpacity onPress={() => onClearBreak(record.id)}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.breakSummary}>
          Gross: {formatDuration(displayDuration)} | Break: {formatDuration(record.breakMinutes)} | Net: {formatDuration(Math.max(0, displayDuration - record.breakMinutes))}
        </Text>
      </>
    )}
  </View>
)}
```

**Update duration display:**

```typescript
// Show net duration (gross - break) in the badge
const breakMinutes = record.breakMinutes || 0;
const netDuration = Math.max(0, displayDuration - breakMinutes);

<Text style={styles.trackingDurationText}>
  {formatDuration(netDuration)}
</Text>
```

#### 3.2 ShiftEditModal

**Add break input:**

```tsx
<View style={styles.formGroup}>
  <Text style={styles.label}>Break Duration</Text>
  <View style={styles.breakButtons}>
    {[0, 5, 15, 30, 45, 60].map((minutes) => (
      <TouchableOpacity
        key={minutes}
        style={[
          styles.breakButton,
          breakMinutes === minutes && styles.breakButtonSelected,
        ]}
        onPress={() => setBreakMinutes(minutes)}
      >
        <Text>{minutes}m</Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
```

---

### 4. State Management

**Calendar reducer (`calendar-reducer.ts`):**

```typescript
case 'UPDATE_TRACKING_BREAK': {
  return {
    ...state,
    trackingRecords: state.trackingRecords.map((record) =>
      record.id === action.id
        ? { ...record, breakMinutes: action.breakMinutes }
        : record
    ),
  };
}
```

**WeekView handlers:**

```typescript
const handleAddBreak = async (id: string, additionalMinutes: number) => {
  try {
    const record = state.trackingRecords.find((r) => r.id === id);
    if (!record) return;

    const currentBreak = record.breakMinutes || 0;
    const newBreak = currentBreak + additionalMinutes;

    // Warn if break exceeds session duration
    if (newBreak > record.duration) {
      Alert.alert(
        'Break exceeds session duration',
        `Total break (${formatDuration(newBreak)}) is longer than session duration (${formatDuration(record.duration)}). Net time will be 0.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: async () => {
              const db = await Database.getInstance();
              await db.updateTrackingBreak(id, newBreak);
              dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: newBreak });
            },
          },
        ]
      );
      return;
    }

    const db = await Database.getInstance();
    await db.updateTrackingBreak(id, newBreak);
    dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: newBreak });
  } catch (error) {
    console.error('Failed to add break:', error);
  }
};

const handleClearBreak = async (id: string) => {
  try {
    const db = await Database.getInstance();
    await db.updateTrackingBreak(id, 0);
    dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: 0 });
  } catch (error) {
    console.error('Failed to clear break:', error);
  }
};
```

---

### 5. Submission Logic (`DailySubmissionService.ts`)

**Update daily totals calculation:**

```typescript
// Calculate total net working hours for the day
const calculateDailyTotal = (records: TrackingRecord[], date: string): number => {
  return records
    .filter((r) => r.date === date)
    .reduce((total, record) => {
      const grossMinutes = record.duration;
      const breakMinutes = record.breakMinutes || 0;
      const netMinutes = Math.max(0, grossMinutes - breakMinutes);

      // For overnight sessions, attribute break to the day it's stored on
      // (The record.date already determines which day owns the session)

      return total + netMinutes;
    }, 0);
};
```

**Submission payload:**

```typescript
// Submit net working hours (gross - breaks)
{
  date: "2025-12-24",
  total_minutes: 480 // Already net time (breaks subtracted)
}
```

---

## Overnight Session Handling

**Example:** User works 22:00 (Day 1) to 07:00 (Day 2) = 9 hours gross, with 45min break

**Storage:**
- `tracking_records` row:
  - `date`: "2025-12-24" (Day 1)
  - `start_time`: "22:00"
  - `duration`: 540 (9 hours)
  - `break_minutes`: 45

**Display:**
- Day 1 column (22:00-24:00 segment):
  - Shows "9h" (full session duration)
  - Break UI shows "Break: 45m"
  - Start grabber only
- Day 2 column (00:00-07:00 segment):
  - Shows "9h" (full session duration)
  - Break UI shows "Break: 45m"
  - End grabber only

**Submission:**
- Day 1 total: Includes this session's net time (540 - 45 = 495 minutes)
- Day 2 total: Does NOT include this session (it's attributed to Day 1 via `date` field)

**Implementation:**
- Break is stored once on the session
- Both day segments show the same break value
- Break is subtracted when calculating the daily total for `record.date`

---

## UI/UX Design

### Visual Mockup (TrackingBadge - Active State)

```
┌─────────────────────────────┐
│      ╳╳╳ 7h 45m ╳╳╳         │ ← Duration (net time)
│                              │
│  Add Break: [5m] [15m] [30m] [45m] [60m]  │ ← Quick-add buttons (cumulative)
│  Current break: 30m  [Clear]  │ ← Total + clear button (only if break > 0)
│  Gross: 8h 15m | Break: 30m | Net: 7h 45m  │ ← Summary (only if break > 0)
└─────────────────────────────┘
```

### ShiftEditModal (Template)

```
┌─────────────────────────────┐
│  Name: [Morning Shift     ] │
│  Start: [08:00]             │
│  Duration: [8h 30m]         │
│  Break: [0m] [5m] [15m] [30m] [45m] [60m]  │ ← New field (single select)
│  Color: [●] [●] [●] [●]     │
│                              │
│      [Cancel]    [Save]      │
└─────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

1. **Database tests** (`Database.test.ts`)
   - Test break_minutes field in insert/update
   - Test migration adds columns correctly
   - Test updateTrackingBreak() method

2. **Reducer tests** (`calendar-reducer.test.ts`)
   - Test UPDATE_TRACKING_BREAK action

3. **Submission logic tests** (`DailySubmissionService.test.ts`)
   - Test daily total calculation with breaks
   - Test overnight session break attribution

### Integration Tests

1. **Add single break to tracking session**
   - Tap session → Tap "Adjust"
   - Tap "30m" → Verify UI shows "Current break: 30m"
   - Verify database updated
   - Verify duration shows net time (gross - 30m)

2. **Add multiple breaks (cumulative)**
   - Tap session → Tap "Adjust"
   - Tap "15m" → Verify shows "Current break: 15m"
   - Tap "30m" → Verify shows "Current break: 45m"
   - Tap "15m" → Verify shows "Current break: 60m"
   - Verify duration shows net time (gross - 60m)

3. **Warning when break > duration**
   - Tap 2h session → Tap "Adjust"
   - Tap "60m" 3 times (total 180m > 120m)
   - Verify alert shows "Break exceeds session duration"
   - Tap "Add Anyway" → Verify break = 180m, net time = 0

4. **Clear break**
   - Tap session with break → Tap "Adjust"
   - Tap "Clear" → Verify break removed
   - Verify duration shows gross time

5. **Overnight session break**
   - Clock in at 22:00 Day 1
   - Clock out at 07:00 Day 2
   - Add 45m break
   - Verify both day segments show "Break: 45m"
   - Confirm Day 1 → Verify submitted time = (9h - 45m)

6. **Shift template break**
   - Edit template → Set break to 30m → Save
   - Create instance → Verify break is included
   - Check planning view shows net time

---

## Implementation Phases

### Phase 1: Database & Types (30 min)
- ✅ Add break_minutes columns to both tables
- ✅ Update TypeScript interfaces
- ✅ Add migration
- ✅ Update Database class methods

### Phase 2: TrackingBadge Break UI (1-2 hours)
- ✅ Add break controls to active session UI
- ✅ Implement quick-add buttons (5/15/30/45)
- ✅ Add break summary display (gross/net)
- ✅ Update duration display to show net time
- ✅ Wire up handlers

### Phase 3: ShiftEditModal Break Field (30 min)
- ✅ Add break duration selector
- ✅ Update save handler
- ✅ Test template with break

### Phase 4: Submission Logic (30 min)
- ✅ Update daily total calculation
- ✅ Test overnight session break attribution
- ✅ Verify backend receives net time

### Phase 5: Testing & Refinement (1 hour)
- ✅ Write unit tests
- ✅ Manual testing on device
- ✅ Edge cases (active session with break, overnight session)

---

## Decisions Made

1. **Multiple breaks:** ✅ Buttons ADD to total (user can tap 15m + 15m + 30m = 60m)
2. **Backend submission:** ✅ Net time only (gross - break)
3. **Overnight attribution:** ✅ Break belongs to session start day (simple)
4. **Break options:** ✅ 5/15/30/45/60 minutes
5. **Validation:** ✅ Warn if break > duration, floor net time at 0
6. **Editing after confirmation:** ✅ No editing (locked)
7. **Template breaks:** ✅ Required (not optional)
8. **Break during active sessions:** ✅ Allowed
9. **Auto-populate from template:** ✅ No (manual only)
10. **Max break limit:** ✅ None (trust user input)

---

## Migration Strategy

1. **Database migration**: Automatic via version bump (v1 → v2)
2. **Existing data**: All existing records get `break_minutes = 0` (default)
3. **No data loss**: Additive change, fully backward compatible
4. **Rollback**: Drop columns if needed (migration v2 → v1)

---

## Dependencies

- **Expo**: No new dependencies
- **date-fns**: Already used for time calculations
- **Database**: SQLite schema change (migration)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration fails | High | Test migration thoroughly, add error handling |
| Break UI clutters screen | Medium | Show break controls only when session is active/selected |
| Overnight session confusion | Medium | Clear documentation, visual indicators for which day owns the break |
| User forgets to add break | Low | Consider future feature: auto-suggest break for long sessions |

---

## Success Criteria

✅ Users can add breaks to tracked sessions via quick-add buttons (5/15/30/45)
✅ Users can edit or remove breaks
✅ UI displays both gross and net duration
✅ Shift templates support break field
✅ Submission logic correctly subtracts breaks from daily totals
✅ Overnight session breaks are attributed correctly
✅ All tests pass
✅ No regressions in existing functionality

---

**Next Steps:**

1. Review this plan with user
2. Clarify open questions
3. Implement Phase 1 (Database & Types)
4. Incremental implementation and testing
