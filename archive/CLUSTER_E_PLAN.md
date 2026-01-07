# Cluster E: Vacation & Sick Days Implementation Plan

**Created:** 2026-01-06
**Status:** ✅ IMPLEMENTED - Ready for Testing
**Completed:** 2026-01-06
**Effort Estimate:** Medium-High (3-4 sessions)

---

## Overview

Add the ability for users to mark days (or portions of days) as vacation or sick leave. This is for personal tracking only - not submitted to backend. Absences reduce planned hours and provide a complete picture of the user's work calendar.

### Goals

1. Users can plan vacation days ahead of time
2. Users can mark sick days (usually same-day or retrospective)
3. Calendar shows absences distinctively from shifts
4. 14-day overview reflects absences in planned hours calculation
5. Consistent visual language (icons) across all views

### Non-Goals

- Backend submission of absence data
- Approval workflows
- PTO balance tracking
- Integration with HR systems

---

## Design Decisions

### Data Model

| Decision | Choice |
|----------|--------|
| Storage approach | Separate entity (not special shift type) |
| Structure | Templates + Instances (mirrors shifts) |
| Types | `vacation` \| `sick` |
| Local only | Yes - not submitted to backend |

### UX Flow

| Aspect | Vacation | Sick |
|--------|----------|------|
| Entry point | Long-press → Absences tab → Pick template | Long-press → Absences tab → Pick "Sick" |
| Default | From template (custom times) | Full day |
| Adjustment | Drag start/end grabbers | Drag start/end grabbers |
| Templates | Yes - reusable | No - always one-off |

### Visual Treatment

| View | Absence Appearance |
|------|-------------------|
| Week/Day view | Muted color block + icon overlay |
| Month view | Separate row below shift dots, icon only |
| 14-day overview | Icon row below bars/confirm indicators |

### Overlap Behavior

- Shifts remain visible but **dimmed** where absence overlaps
- Overlapped shift time **does not count** toward planned hours
- Actual tracked hours (GPS) are unaffected
- User responsibility to avoid accidental overlap

### Planned Hours Calculation

```
Effective Planned = Shift Hours - Absence Overlap Hours
Deviation = Actual Hours - Effective Planned
```

Absences are invisible in the 14-day bars - they simply reduce the planned portion.

---

## Data Model

### Database Schema

```sql
-- New table: absence_templates
CREATE TABLE absence_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('vacation', 'sick')),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  start_time TEXT,           -- HH:MM format, NULL for full-day templates
  end_time TEXT,             -- HH:MM format, NULL for full-day templates
  is_full_day INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- New table: absence_instances
CREATE TABLE absence_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT,          -- NULL for one-off sick days
  type TEXT NOT NULL CHECK (type IN ('vacation', 'sick')),
  date TEXT NOT NULL,        -- YYYY-MM-DD
  start_time TEXT NOT NULL,  -- HH:MM format
  end_time TEXT NOT NULL,    -- HH:MM format
  is_full_day INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES absence_templates(id) ON DELETE SET NULL
);

-- Index for efficient date queries
CREATE INDEX idx_absence_instances_date ON absence_instances(date);
```

### TypeScript Types

```typescript
// lib/calendar/types.ts

export type AbsenceType = 'vacation' | 'sick';

export interface AbsenceTemplate {
  id: string;
  type: AbsenceType;
  name: string;
  color: string;
  startTime: string | null;  // HH:MM or null for full-day
  endTime: string | null;
  isFullDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AbsenceInstance {
  id: string;
  templateId: string | null;  // null for one-off sick days
  type: AbsenceType;
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  isFullDay: boolean;
  createdAt: string;
  updatedAt: string;
}

// For calendar rendering
export interface AbsenceInstanceWithMeta extends AbsenceInstance {
  templateName?: string;
  templateColor: string;
}
```

### Default Templates

Create on first app launch:

| Type | Name | Color | Full Day |
|------|------|-------|----------|
| vacation | Vacation | `#9CA3AF` (muted gray) | Yes |
| vacation | Half Day AM | `#9CA3AF` | No (00:00-12:00) |
| vacation | Half Day PM | `#9CA3AF` | No (12:00-23:59) |
| sick | Sick Day | `#FBBF24` (muted amber) | Yes |

Note: Sick doesn't need multiple templates - users create one-off entries and adjust times.

---

## Icon Selection

Using `@expo/vector-icons` (already in project):

| Type | Icon | Library | Rationale |
|------|------|---------|-----------|
| Vacation | `umbrella-beach` | FontAwesome5 | Universal vacation symbol |
| Sick | `thermometer` | FontAwesome5 | Clear medical connotation |

Alternatives if needed:
- Vacation: `airplane`, `sunny` (Ionicons)
- Sick: `medical`, `medkit` (Ionicons)

---

## Implementation Phases

### Phase 1: Data Layer (Session 1)

**Files to create/modify:**

1. **`CalendarStorage.ts`** - Add absence table operations
   ```typescript
   // New methods
   createAbsenceTemplate(template: Omit<AbsenceTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AbsenceTemplate>
   updateAbsenceTemplate(id: string, updates: Partial<AbsenceTemplate>): Promise<void>
   deleteAbsenceTemplate(id: string): Promise<void>
   getAbsenceTemplates(): Promise<AbsenceTemplate[]>

   createAbsenceInstance(instance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<AbsenceInstance>
   updateAbsenceInstance(id: string, updates: Partial<AbsenceInstance>): Promise<void>
   deleteAbsenceInstance(id: string): Promise<void>
   getAbsenceInstancesForDateRange(startDate: string, endDate: string): Promise<AbsenceInstance[]>
   getAbsenceInstancesForDate(date: string): Promise<AbsenceInstance[]>
   ```

2. **`types.ts`** - Add AbsenceTemplate, AbsenceInstance types

3. **Database migration** - Add v2 migration for absence tables
   ```typescript
   // In CalendarStorage.ts initDatabase()
   if (currentVersion < 2) {
     await db.execAsync(`
       CREATE TABLE absence_templates (...);
       CREATE TABLE absence_instances (...);
       CREATE INDEX idx_absence_instances_date ...;
     `);
     await db.execAsync(`PRAGMA user_version = 2`);
   }
   ```

4. **Seed default templates** - Create defaults on first run

**Testing:**
- Unit tests for CRUD operations
- Migration test (v1 → v2)

---

### Phase 2: State Management (Session 1-2)

**Files to modify:**

1. **`calendar-reducer.ts`** - Add absence actions
   ```typescript
   // New action types
   | { type: 'LOAD_ABSENCE_TEMPLATES'; templates: AbsenceTemplate[] }
   | { type: 'ADD_ABSENCE_TEMPLATE'; template: AbsenceTemplate }
   | { type: 'UPDATE_ABSENCE_TEMPLATE'; id: string; updates: Partial<AbsenceTemplate> }
   | { type: 'DELETE_ABSENCE_TEMPLATE'; id: string }
   | { type: 'LOAD_ABSENCE_INSTANCES'; instances: AbsenceInstance[] }
   | { type: 'ADD_ABSENCE_INSTANCE'; instance: AbsenceInstance }
   | { type: 'UPDATE_ABSENCE_INSTANCE'; id: string; updates: Partial<AbsenceInstance> }
   | { type: 'DELETE_ABSENCE_INSTANCE'; id: string }
   ```

2. **`calendar-context.tsx`** - Add absence state and loaders
   ```typescript
   interface CalendarState {
     // ... existing
     absenceTemplates: AbsenceTemplate[];
     absenceInstances: AbsenceInstance[];
   }
   ```

3. **`calendar-utils.ts`** - Add absence helper functions
   ```typescript
   getAbsencesForDay(date: string, absences: AbsenceInstance[]): AbsenceInstance[]
   calculateEffectivePlannedHours(shifts: ShiftInstance[], absences: AbsenceInstance[]): number
   getShiftAbsenceOverlap(shift: ShiftInstance, absence: AbsenceInstance): { overlapMinutes: number, isFullyOverlapped: boolean }
   ```

---

### Phase 3: Week View Rendering (Session 2)

**Files to modify:**

1. **`WeekView.tsx`** - Render absence blocks

   New component within WeekView:
   ```typescript
   const AbsenceBlock = ({ absence, dayWidth, hourHeight }: AbsenceBlockProps) => {
     const icon = absence.type === 'vacation' ? 'umbrella-beach' : 'thermometer';
     const bgColor = absence.type === 'vacation' ? '#E5E7EB' : '#FEF3C7';

     return (
       <View style={[styles.absenceBlock, { backgroundColor: bgColor }]}>
         <FontAwesome5 name={icon} size={12} color="#6B7280" />
         <Text style={styles.absenceLabel}>{absence.templateName || absence.type}</Text>
       </View>
     );
   };
   ```

2. **Shift dimming logic:**
   ```typescript
   const getShiftOpacity = (shift: ShiftInstance, absences: AbsenceInstance[]) => {
     const overlap = absences.some(a => hasTimeOverlap(shift, a));
     return overlap ? 0.4 : 1.0;
   };
   ```

3. **Z-ordering:** Absences render below shifts (shifts on top but dimmed)

---

### Phase 4: Template Panel - Absences Tab (Session 2-3)

**Files to modify:**

1. **`TemplatePanel.tsx`** - Add Shifts/Absences tab switcher

   ```typescript
   const [activeTab, setActiveTab] = useState<'shifts' | 'absences'>('shifts');

   // Tab bar at top
   <View style={styles.tabBar}>
     <TouchableOpacity onPress={() => setActiveTab('shifts')}>
       <Text style={activeTab === 'shifts' ? styles.activeTab : styles.tab}>Shifts</Text>
     </TouchableOpacity>
     <TouchableOpacity onPress={() => setActiveTab('absences')}>
       <Text style={activeTab === 'absences' ? styles.activeTab : styles.tab}>Absences</Text>
     </TouchableOpacity>
   </View>

   // Render appropriate list
   {activeTab === 'shifts' ? <ShiftTemplateList /> : <AbsenceTemplateList />}
   ```

2. **Absence template list:**
   - Show vacation templates (Half Day AM, Half Day PM, Full Day)
   - Show "Sick Day" as special one-off option
   - "Add Custom" button for new vacation templates

3. **Placing absence on calendar:**
   - Tap vacation template → places instance on long-pressed day
   - Tap "Sick Day" → places full-day sick instance, can then drag to adjust

---

### Phase 5: Absence Edit Modal (Session 3)

**Files to create:**

1. **`AbsenceEditModal.tsx`** - For editing placed absences

   Features:
   - Type indicator (vacation/sick) with icon
   - Full day toggle
   - Start time picker (disabled if full day)
   - End time picker (disabled if full day)
   - Delete button

   ```typescript
   interface AbsenceEditModalProps {
     absence: AbsenceInstance;
     onSave: (updates: Partial<AbsenceInstance>) => void;
     onDelete: () => void;
     onClose: () => void;
   }
   ```

2. **Integration with WeekView:**
   - Tap absence block → open AbsenceEditModal
   - Long-press absence block → delete confirmation

---

### Phase 6: Month View (Session 3)

**Files to modify:**

1. **`MonthView.tsx`** - Add absence icon row

   ```typescript
   // In day cell rendering
   <View style={styles.dayCell}>
     <Text style={styles.dayNumber}>{day}</Text>
     <View style={styles.shiftDotsRow}>
       {shiftsForDay.map(s => <ShiftDot key={s.id} color={s.color} />)}
     </View>
     <View style={styles.absenceIconRow}>
       {absencesForDay.map(a => (
         <FontAwesome5
           key={a.id}
           name={a.type === 'vacation' ? 'umbrella-beach' : 'thermometer'}
           size={10}
           color="#6B7280"
         />
       ))}
     </View>
   </View>
   ```

---

### Phase 7: 14-Day Overview (Session 4)

**Files to modify:**

1. **`DashboardDataService.ts`** - Update planned hours calculation

   ```typescript
   // In loadDashboardData()
   const absencesForDay = await getAbsenceInstancesForDate(dateStr);
   const effectivePlanned = calculateEffectivePlannedHours(shiftsForDay, absencesForDay);

   // Return absence info for icon display
   return {
     ...dayData,
     plannedHours: effectivePlanned,  // Already reduced by absences
     hasVacation: absencesForDay.some(a => a.type === 'vacation'),
     hasSick: absencesForDay.some(a => a.type === 'sick'),
   };
   ```

2. **`HoursSummaryWidget.tsx`** - Add icon row

   ```typescript
   // Below confirm status row
   <View style={styles.absenceIconRow}>
     {data.map((day, i) => (
       <View key={i} style={styles.absenceIconCell}>
         {day.hasVacation && <FontAwesome5 name="umbrella-beach" size={8} />}
         {day.hasSick && <FontAwesome5 name="thermometer" size={8} />}
       </View>
     ))}
   </View>
   ```

---

### Phase 8: Translations (Session 4)

**Files to modify:**

1. **`translations/en.ts`**
   ```typescript
   absences: {
     title: 'Absences',
     vacation: 'Vacation',
     sick: 'Sick Day',
     fullDay: 'Full Day',
     halfDayAM: 'Half Day (Morning)',
     halfDayPM: 'Half Day (Afternoon)',
     addCustom: 'Add Custom',
     deleteConfirm: 'Delete this absence?',
   }
   ```

2. **`translations/de.ts`**
   ```typescript
   absences: {
     title: 'Abwesenheit',
     vacation: 'Urlaub',
     sick: 'Krankheitstag',
     fullDay: 'Ganzer Tag',
     halfDayAM: 'Halber Tag (Vormittag)',
     halfDayPM: 'Halber Tag (Nachmittag)',
     addCustom: 'Eigene hinzufügen',
     deleteConfirm: 'Diese Abwesenheit löschen?',
   }
   ```

---

## Testing Plan

### Unit Tests

| Test | Location |
|------|----------|
| Absence CRUD operations | `CalendarStorage.test.ts` |
| Overlap calculation | `calendar-utils.test.ts` |
| Effective planned hours | `calendar-utils.test.ts` |
| Reducer actions | `calendar-reducer.test.ts` |

### Manual Testing Checklist

- [ ] Create vacation template
- [ ] Place vacation on future day
- [ ] Place sick day (full day)
- [ ] Adjust sick day times via drag
- [ ] Verify shift dimming on overlap
- [ ] Verify 14-day overview reflects reduced planned hours
- [ ] Verify month view shows absence icons
- [ ] Delete absence
- [ ] Edit absence times via modal
- [ ] Confirm day with absence
- [ ] Overnight shift + absence interaction

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `AbsenceEditModal.tsx` | Modal for editing absence times |

### Modified Files

| File | Changes |
|------|---------|
| `types.ts` | Add AbsenceTemplate, AbsenceInstance types |
| `CalendarStorage.ts` | Absence tables, CRUD, migration v2 |
| `calendar-reducer.ts` | Absence actions and state |
| `calendar-context.tsx` | Absence state, loaders |
| `calendar-utils.ts` | Overlap calculation helpers |
| `WeekView.tsx` | Render absence blocks, shift dimming |
| `TemplatePanel.tsx` | Shifts/Absences tabs |
| `MonthView.tsx` | Absence icon row |
| `DashboardDataService.ts` | Effective planned hours calculation |
| `HoursSummaryWidget.tsx` | Absence icon row |
| `translations/en.ts` | Absence strings |
| `translations/de.ts` | Absence strings (German) |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Separate entity or special shift? | Separate entity |
| Templates for absences? | Yes for vacation, no for sick |
| Visual treatment? | Muted color + icon |
| Overlap behavior? | Shift dimmed, time doesn't count |
| Backend submission? | No - local only |
| Stripes rendering? | Dropped - using icons instead |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Icon not distinctive enough | Test with users, have alternatives ready |
| Month view too crowded | Limit to 2 icons per day, truncate |
| Performance with many absences | Virtualize if needed, lazy load |
| Migration breaks existing data | Test migration thoroughly, backup strategy |

---

## Session Breakdown

| Session | Focus | Deliverable |
|---------|-------|-------------|
| 1 | Data layer + State | Absence CRUD working |
| 2 | Week view rendering | Absences visible on calendar |
| 3 | Template panel + Edit modal | Full absence workflow |
| 4 | Month view + 14-day + i18n | Feature complete |

---

**Ready for implementation.** Start with Phase 1 (Data Layer).


---

## Implementation Summary (2026-01-06)

All phases completed in a single session:

| Phase | Status |
|-------|--------|
| 1. Data Layer | ✅ Done |
| 2. State Management | ✅ Done |
| 3. Week View Rendering | ✅ Done |
| 4. Template Panel | ✅ Done |
| 5. Month View + 14-day | ✅ Done |

**Files Modified:**
- `types.ts` - AbsenceTemplate, AbsenceInstance types
- `CalendarStorage.ts` - Migration v2, CRUD methods
- `calendar-reducer.ts` - Absence actions
- `calendar-context.tsx` - Load/persist absences
- `calendar-utils.ts` - Helper functions
- `WeekView.tsx` - AbsenceCard, placement, dimming
- `TemplatePanel.tsx` - Shifts/Absences tabs
- `MonthView.tsx` - Absence icons
- `DashboardDataService.ts` - Effective planned hours
- `HoursSummaryWidget.tsx` - Absence icon row
- `translations/en.ts`, `de.ts` - Absence strings

**Next:** Test on device, then increment build number for TestFlight.

---

## Refinements (2026-01-06 - Session 5)

After initial testing, several UX improvements were made:

### Bug Fixes

| Issue | Fix |
|-------|-----|
| Absences not staying armed when closing panel | Removed `DISARM_ABSENCE` from `handleClose()` in TemplatePanel |
| Long-press picker only showed shifts | Added Shifts/Absences tabs to quick picker modal |
| No way to adjust absence times after placing | Added drag handles (same UX as tracking records) |

### UX Improvements

| Change | Rationale |
|--------|-----------|
| Icon: Umbrella → TreePalm 🌴 | More recognizable vacation symbol |
| Removed Half Day AM/PM templates | Simpler UX - users can adjust via drag handles instead |
| MonthView two-row layout | Row 1: shift dots (top), Row 2: absence icons (bottom) - consistent positioning |
| Added `absence-armed` mode | Consistent with `shift-armed` mode |

### Drag Handles for Absences

AbsenceCard now supports the same drag interaction as tracking records:
- **Tap** absence to select (shows primary border + grabbers)
- **Drag top grabber** to adjust start time
- **Drag bottom grabber** to adjust end time
- **Tap elsewhere** to deselect
- Changes persist to database automatically

### Files Changed (Refinements)

- `WeekView.tsx` - AbsenceCard with PanResponder grabbers, adjustment handlers
- `TemplatePanel.tsx` - Removed disarm on close, TreePalm icon
- `MonthView.tsx` - Two-row layout with minHeight, TreePalm icon
- `HoursSummaryWidget.tsx` - TreePalm icon
- `CalendarStorage.ts` - Simplified default templates (removed half-day)
- `calendar-reducer.ts` - Added `absence-armed` mode to DISARM_ABSENCE
- `types.ts` - Added `absence-armed` to AppMode union

