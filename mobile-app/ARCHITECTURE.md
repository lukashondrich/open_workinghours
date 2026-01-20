# Mobile App Architecture

**Last Updated:** 2026-01-16
**Platform:** React Native + Expo
**Current Build:** #30 (TestFlight)

---

## Overview

The mobile app is the primary user interface for healthcare workers to track their working hours. It uses geofencing for automatic clock-in/out and provides a calendar for shift planning.

---

## Where Do I Find...?

Quick reference for common tasks:

| Task | File(s) |
|------|---------|
| **Add a translation** | `src/lib/i18n/translations/en.ts`, `de.ts` |
| **Change calendar behavior** | `src/lib/calendar/calendar-reducer.ts` |
| **Add a reducer action** | `src/lib/calendar/types.ts` (CalendarAction type) |
| **Modify shift rendering** | `src/modules/calendar/components/WeekView.tsx` |
| **Change template panel** | `src/modules/calendar/components/TemplatePanel.tsx` |
| **Edit geofence logic** | `src/modules/geofencing/services/GeofenceService.ts` |
| **Change clock-in/out** | `src/modules/geofencing/services/TrackingManager.ts` |
| **Cross-module events** | `src/lib/events/trackingEvents.ts` |
| **Modify auth flow** | `src/modules/auth/services/AuthService.ts` |
| **Edit database schema** | `src/modules/calendar/services/CalendarStorage.ts` |
| **Change navigation** | `src/navigation/AppNavigator.tsx` |
| **Add a new screen** | `src/modules/[module]/screens/` + update `AppNavigator` |
| **Modify 14-day dashboard** | `src/modules/geofencing/services/DashboardDataService.ts` |
| **Edit location setup** | `src/modules/geofencing/screens/SetupScreen.tsx` |

**Can't find something?** Check `CLAUDE.md` → `docs/debugging.md` for help.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.74 |
| Runtime | Expo SDK ~51.0 |
| Language | TypeScript 5.x |
| Navigation | React Navigation 6 |
| State | React Context + useReducer |
| Storage | expo-sqlite (SQLite) |
| Location | expo-location + expo-task-manager |
| Maps | react-native-maps |
| Gestures | react-native-gesture-handler |
| Haptics | expo-haptics |
| i18n | i18n-js + expo-localization |
| Testing | Jest + @testing-library/react-native |

---

## Directory Structure

```
mobile-app/
├── src/
│   ├── lib/                    # Shared utilities
│   │   ├── auth/               # Auth context, types
│   │   ├── calendar/           # Calendar context, reducer, types
│   │   ├── events/             # Cross-module event emitters
│   │   └── i18n/               # Translations (en.ts, de.ts)
│   │
│   ├── modules/
│   │   ├── auth/               # Login, registration screens
│   │   │   ├── screens/
│   │   │   └── services/       # AuthService
│   │   │
│   │   ├── calendar/           # Calendar feature
│   │   │   ├── components/     # WeekView, MonthView, TemplatePanel, CalendarFAB
│   │   │   └── services/       # CalendarStorage, DailyAggregator
│   │   │
│   │   └── geofencing/         # Location tracking
│   │       ├── components/     # Dashboard widgets
│   │       ├── screens/        # Status, Settings, Locations
│   │       └── services/       # GeofenceService, TrackingManager
│   │
│   ├── navigation/             # AppNavigator, tab config
│   └── test-utils/             # Demo data seeding
│
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
└── ARCHITECTURE.md             # This file
```

---

## Core Modules

### Module 1: Geofencing & Tracking

Automatic clock-in/out based on GPS location with robust hysteresis.

**Key Files:**
- `GeofenceService.ts` - Manages geofence regions, extracts GPS accuracy
- `TrackingManager.ts` - Handles clock-in/out logic with hysteresis
- `Database.ts` - SQLite operations, pending exit state management

**Behavior:**
- Clock-in: Triggered on geofence enter (accuracy recorded)
- Clock-out: Uses 4-layer protection before finalizing:
  1. **GPS accuracy filter**: Ignore exits with accuracy > 100m
  2. **Signal degradation**: Ignore if accuracy 3x worse than check-in
  3. **Pending exit state**: Wait 5 min before confirming exit
  4. **Re-entry cancellation**: Cancel pending exit if user returns
- Sessions < 5 min are kept (not deleted) with visual indicator
- Manual clock-in/out available as fallback
- GPS telemetry logged for parameter tuning (via Report Issue)

**Session States:**
- `active` - User is clocked in
- `pending_exit` - Exit detected, waiting for hysteresis period
- `completed` - Session finalized

**State Invariant:** `clockOut` and `state` must be consistent:
- If `clockOut` is NULL → `state` must be `'active'` or `'pending_exit'`
- If `clockOut` is set → `state` must be `'completed'`

All methods that modify sessions (`clockOut()`, `updateSession()`) enforce this invariant. Migration v4 repairs any inconsistent sessions.

**Constants (tunable):**
```typescript
EXIT_HYSTERESIS_MINUTES = 5     // Wait before confirming clock-out
GPS_ACCURACY_THRESHOLD = 100    // Ignore exits with accuracy > 100m
DEGRADATION_FACTOR = 3          // Ignore if accuracy 3x worse than check-in
```

### Module 2: Authentication & Submission

Email-based passwordless auth with daily data submission.

**Key Files:**
- `AuthService.ts` - Login, registration, token management
- `DailySubmissionService.ts` - Submits confirmed days to backend
- `ConsentBottomSheet.tsx` - GDPR consent modal
- `ConsentStorage.ts` - Local consent record persistence
- `consent-types.ts` - Consent types and version constants

**Flow:**
1. User enters email → receives 6-digit code
2. User enters code → receives JWT token
3. **User reviews Terms & Privacy Policy in consent modal**
4. User accepts → consent saved locally + sent to backend
5. Token stored in expo-secure-store
6. Daily submissions sent with JWT auth

**GDPR Consent:**
- Shown as bottom sheet modal during registration
- Links to Terms of Service and Privacy Policy
- Key points summary visible without internet
- Checkbox + "I Agree" button required
- Consent version stored locally and on backend

**GDPR Data Rights (DataPrivacyScreen):**
- Consent status display (Terms, Privacy, date accepted)
- "Export My Data" button - exports JSON via Share sheet (Art. 20)
- "Withdraw Consent & Delete Account" button (Art. 17)
  - Shows warning if pending submissions exist
  - Deletes backend account + local data + geofences
  - Automatically signs out

**Settings Screen Policy Links:**
- "Legal" section with Terms of Service + Privacy Policy
- Opens website in browser (localized EN/DE)

### Calendar Module

Shift planning with templates and instances.

**Key Files:**
- `WeekView.tsx` - Main calendar view with pinch-zoom
- `MonthView.tsx` - Monthly overview
- `TemplatePanel.tsx` - Shift/absence template management (compact radio list)
- `CalendarFAB.tsx` - Floating action button for adding shifts/absences
- `CalendarHeader.tsx` - Header with navigation and GPS visibility toggle
- `CalendarStorage.ts` - SQLite persistence
- `calendar-reducer.ts` - State management

**Week View Features:**
- Pinch-to-zoom with focal point
- Double-tap to place shifts/absences (or open template picker if none armed)
- Swipe to navigate weeks
- Drag handles to adjust times
- Absences (vacation, sick days) with full CRUD
- FAB for quick access to template panel
- GPS visibility toggle (eye icon) - shows tracked time on calendar
- Progressive disclosure - text hides at low zoom levels (thresholds: 32px/56px)

**Month View Features:**
- Grid uses fixed 6-week (42 cell) layout for consistent height across all months
- Day cells show: day number, shift dots (colored), tracked dot (rose), absence icons
- Per-day overtime for confirmed days (e.g., "+1h 30m ✓") - color-coded green/red/grey
- Unconfirmed days with activity show ? icon
- Monthly summary footer: tracked hours, planned hours, overtime, vacation/sick counts
- Confirmation nudge: "(X confirmed)" hint when some overtime is unconfirmed
- Swipe left/right to navigate months (with slide animation)
- Header title click navigates to current month
- GPS toggle and FAB hidden (month view is overview-only)
- Full month tracking data loaded when switching to month view in review mode
- Multi-day sessions correctly split across days using `getTrackedMinutesForDate()`

### Status Dashboard

14-day overview of worked hours with clock-in/out controls.

**Key Files:**
- `DashboardDataService.ts` - Aggregates data for display
- `HoursSummaryWidget.tsx` - Bar chart visualization
- `NextShiftWidget.tsx` - Upcoming shift preview
- `StatusScreen.tsx` - Main status page with location cards

**HoursSummaryWidget Features:**
- Side-by-side bars: green (planned) and rose (tracked)
- Dynamic Y-axis: 12h default, expands to 16h/24h based on data
- Day labels on X-axis (M, T, W, T, F, S, S)
- Faded bars (40% opacity) for unconfirmed days + "X to confirm" nudge
- Absence icons (vacation 🌴, sick 🌡️)
- Today excluded from unconfirmed count

**Clocked-in State Design:**
- Active card: green left border + light green tint
- Time badge pill: `● 2h 30m` showing elapsed time
- Subtle "End" button for clocking out
- Inactive card: normal styling with "Clock In" button

---

## Database Schema

### SQLite Tables (on-device)

```sql
-- Shift templates (reusable patterns)
shift_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  color TEXT,
  start_time TEXT,      -- "08:00"
  end_time TEXT,        -- "16:30"
  break_minutes INTEGER DEFAULT 0
)

-- Shift instances (placed on calendar)
shift_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  date TEXT,            -- "2026-01-07"
  start_time TEXT,
  end_time TEXT,
  FOREIGN KEY (template_id) REFERENCES shift_templates(id)
)

-- Tracking sessions (geofencing sessions)
tracking_sessions (
  id TEXT PRIMARY KEY,
  location_id TEXT,
  clock_in TEXT,              -- ISO timestamp
  clock_out TEXT,             -- ISO timestamp (null if active)
  duration_minutes INTEGER,
  tracking_method TEXT,       -- 'geofence_auto' | 'manual'
  state TEXT DEFAULT 'active', -- 'active' | 'pending_exit' | 'completed'
  pending_exit_at TEXT,       -- ISO timestamp when exit was triggered
  exit_accuracy REAL,         -- GPS accuracy at exit (meters)
  checkin_accuracy REAL,      -- GPS accuracy at check-in (meters)
  created_at TEXT,
  updated_at TEXT
)

-- Geofence events (telemetry for parameter tuning)
geofence_events (
  id TEXT PRIMARY KEY,
  location_id TEXT,
  event_type TEXT,            -- 'enter' | 'exit'
  timestamp TEXT,
  latitude REAL,
  longitude REAL,
  accuracy REAL,              -- GPS accuracy in meters
  ignored INTEGER DEFAULT 0,  -- 1 if event was filtered
  ignore_reason TEXT          -- 'poor_accuracy' | 'signal_degradation' | null
)

-- Absence templates
absence_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  color TEXT,
  icon TEXT             -- "TreePalm" or "Thermometer"
)

-- Absence instances
absence_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  date TEXT,
  start_time TEXT,
  end_time TEXT
)

-- Work locations (geofence regions)
locations (
  id TEXT PRIMARY KEY,
  name TEXT,
  latitude REAL,
  longitude REAL,
  radius INTEGER DEFAULT 100
)

-- Day confirmations
day_confirmations (
  date TEXT PRIMARY KEY,
  confirmed_at TEXT
)
```

---

## Key Patterns

### Calendar State Management

Uses `useReducer` with immutable updates:

```typescript
// calendar-reducer.ts
type CalendarAction =
  | { type: 'SET_WEEK'; payload: Date }
  | { type: 'PREV_WEEK' }
  | { type: 'NEXT_WEEK' }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SELECT_SHIFT'; payload: string }
  // ... more actions

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState
```

### Pinch-to-Zoom

Uses refs to avoid gesture handler recreation during zoom:

```typescript
// WeekView.tsx
const baseScale = useRef(1);
const lastAppliedScale = useRef(1);

const pinchGesture = useMemo(() =>
  Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = baseScale.current * e.scale;
      lastAppliedScale.current = newScale;
      setCurrentScale(newScale);
    })
    .onEnd(() => {
      baseScale.current = lastAppliedScale.current;
    }),
  [setCurrentScale, minZoom]  // No currentScale in deps!
);
```

### Internationalization

```typescript
// Usage
import { t } from '@/lib/i18n';

<Text>{t('calendar.header.title')}</Text>
<Text>{t('calendar.confirmButton', { count: 3 })}</Text>
```

### Cross-Module Events

For communication between modules (e.g., Geofencing → Calendar), we use a simple EventEmitter pattern:

```typescript
// src/lib/events/trackingEvents.ts
export const trackingEvents = new TrackingEventEmitter();

// Emitting (in TrackingManager.ts)
import { trackingEvents } from '@/lib/events/trackingEvents';
trackingEvents.emit('tracking-changed');

// Subscribing (in calendar-context.tsx)
useEffect(() => {
  const handler = () => { /* refresh data */ };
  trackingEvents.on('tracking-changed', handler);
  return () => trackingEvents.off('tracking-changed', handler);
}, []);
```

**Current events:**
- `tracking-changed` — Emitted on clock-in/clock-out (auto or manual). Calendar subscribes to refresh tracking records in review mode.

**When to use:**
- Cross-module communication where React Context isn't accessible (e.g., from service classes)
- Decoupled notifications (emitter doesn't need to know about subscribers)

---

## Recent Implementations

### Cluster A: Bug Fixes (2026-01-06)
- Zoom snapback fix (ref-based gesture handling)
- Week navigation arrows (PREV_WEEK/NEXT_WEEK actions)
- Bug report spinner (logging + fallback strings)

### Cluster C: Tracking Data UX (2026-01-06)
- Sessions < 5 min filtered at recording time
- Minimum 8px visual height + 20px hit slop for tap targets
- Pre-account days shown as "—" in 14-day overview

### Cluster E: Vacation/Sick Days (2026-01-06)
- Separate AbsenceTemplate + AbsenceInstance tables
- TreePalm (vacation) and Thermometer (sick) icons
- Drag handles for time adjustment
- 50% transparent overlay (shifts visible underneath)

### Cluster F: UX Polish (2026-01-07)
- Photon geocoding (replaces Mapbox, GDPR-friendly)
- Healthcare results prioritized in search
- Double-tap to place shifts (single tap clears)
- Step indicator: "Step 1 of 3 - Find Your Workplace"
- Work Locations: inverted layout (small map, big list)

### Cluster B: Shift Instance Management (2026-01-07)
- **Overlap detection**: `findOverlappingShift()` prevents shifts on same day from overlapping
- **Template propagation**: Editing template updates all future instances (past frozen)
- **Instance editing**: Start time only - duration/breaks come from template
- **Template deletion**: Cascade deletes future instances, orphans past (grey styling)
- **Tap interactions**: Tap shift → Edit Start Time / Delete / Cancel popup
- **Template picker**: Long-press empty space → modal with colored template list

### Cluster D: Location Setup UX (2026-01-07)
- **3-step wizard**: Find → Position → Name (single screen with step state)
- **Photon search**: Type-ahead geocoding with healthcare prioritization
- **Pin placement**: Tap map to place, drag to adjust (not pan-under-fixed-pin)
- **Zoom buttons removed**: Pinch-only zoom, keeps only 📍 (my location) button
- **Status screen link**: Tappable locations navigate to LocationsList
- **Keyboard avoiding**: Mini-map shrinks when keyboard appears

### GDPR Consent Flow (2026-01-09)
- **ConsentBottomSheet**: Bottom sheet modal with Terms/Privacy links
- **Key points summary**: Visible without internet (aggregation, GPS local, deletion rights)
- **Checkbox + Button**: Affirmative action required before registration
- **ConsentStorage**: Local persistence using expo-secure-store
- **Backend integration**: Consent version sent with registration, `/auth/consent` endpoint for updates
- **Translations**: Full EN + DE support
- **Pre-announcement**: "By continuing, you'll review our Terms" text before button

### Geofence Robustness Improvements (2026-01-15)
- **Exit hysteresis**: 5-min pending state before confirming clock-out
- **GPS accuracy filtering**: Ignore exits with accuracy > 100m
- **Signal degradation detection**: Ignore if accuracy 3x worse than check-in
- **Session preservation**: Short sessions (< 5 min) kept, not deleted
- **Visual indicator**: Short sessions shown faded with clock icon in calendar
- **GPS telemetry**: Accuracy data included in Report Issue for parameter tuning
- **Database migration**: Schema v2 adds state, accuracy columns to tracking_sessions

### Calendar UX Improvements (2026-01-15)
- **Header redesign**:
  - Removed green "Daily Submissions" bar
  - Removed "Dienste" button (moved to FAB)
  - GPS toggle now uses Eye/EyeOff icons with red theme when active
- **CalendarFAB**: New floating action button
  - Bottom-right position, primary color with "+" icon
  - Popup menu: "Absences" (top) / "Shifts" (bottom)
  - Hides when overlays are open (templatePanelOpen, time picker, etc.)
  - Uses `hideFAB` context state for external control
- **TemplatePanel refactor**:
  - Compact radio list design (replaced card-based selection)
  - Layout: [Edit pencil] [Info] [Color dot] [Radio selector]
  - Radio on right for easier thumb reach
  - Mutually exclusive selection (shift deselects absence, vice versa)
  - Removed rose color from shift options (conflicts with tracked time display)
- **Absence templates**: Full CRUD support
  - Create via "+" button in Absences tab
  - Edit form: name, type (vacation/sick), full-day toggle, start/end times
  - Persistence added (was missing, causing FK constraint errors)
- **Interaction changes**:
  - Double-tap on empty space opens template picker (same as long-press)
  - Progressive disclosure thresholds raised: 32px (reduced), 56px (full)
- **State changes**:
  - Added `hideFAB: boolean` to CalendarState
  - Added `SET_HIDE_FAB` action

### Cross-Module Event System (2026-01-16)
- **Problem**: Calendar didn't immediately reflect clock-in/clock-out (60s delay)
- **Solution**: EventEmitter for cross-module notifications
- **New file**: `src/lib/events/trackingEvents.ts`
- **TrackingManager changes**: Emits `tracking-changed` on all clock events
- **CalendarProvider changes**: Subscribes and refreshes tracking records in review mode

### Android Gesture System (2026-01-20)
- **Problem**: RNGH GestureDetector wrapping ScrollView causes gesture conflicts on Android (scroll doesn't work reliably, pinch zoom broken)
- **Root cause**: Android lacks iOS's native gesture coordination between RNGH and ScrollView
- **Solution**: Platform-specific gesture handling in WeekView.tsx

**iOS (unchanged):**
- Uses `<GestureDetector>` wrapper with `Gesture.Simultaneous(pinchGesture, edgeSwipeGesture)`
- Week navigation via overscroll bounce detection
- Works because iOS has native gesture coordination

**Android (new approach):**
- No GestureDetector wrapper (removed to avoid ScrollView conflicts)
- Pinch zoom via custom PanResponder (`androidPinchResponder`) attached to `gridRow`
- Week navigation via velocity-based edge detection (`handleHorizontalScrollEndDragAndroid`)
- Edge position tracked at drag start (`wasAtEdgeOnDragStart` ref)

**Key implementation details:**
```typescript
// Platform-conditional content wrapper
const calendarContent = (<View>...</View>);
return Platform.OS === 'ios' ? (
  <GestureDetector gesture={composedGesture}>{calendarContent}</GestureDetector>
) : calendarContent;

// Separate scroll handlers per platform
const handleHorizontalScrollEndDrag = Platform.OS === 'ios'
  ? handleHorizontalScrollEndDragIOS
  : handleHorizontalScrollEndDragAndroid;
```

**What didn't work on Android (for future reference):**
- RNGH GestureDetector + any ScrollView combination (native RN or RNGH ScrollView)
- Adjusting Pan gesture thresholds (`.minDistance()`, `.activeOffsetX()`, `.failOffsetY()`)
- Manual gesture activation (`.manualActivation(true)`)
- Platform-specific gesture composition (pinch only, no Pan)
- `scrollEnabled` toggling based on `isPinching` state

**See also:** `docs/ANDROID_GESTURE_FIX_PLAN.md` for full exploration history

---

## Key Types

Core TypeScript interfaces from `src/lib/calendar/types.ts`:

### ShiftTemplate
```typescript
interface ShiftTemplate {
  id: string
  name: string
  duration: number          // minutes
  startTime: string         // "HH:mm"
  color: ShiftColor         // "teal" | "blue" | "green" | "amber" | "rose" | "purple" | "cyan"
  breakMinutes?: number     // default 0
}
```

### ShiftInstance
```typescript
interface ShiftInstance {
  id: string
  templateId: string
  date: string              // "YYYY-MM-DD"
  startTime: string         // "HH:mm"
  duration: number          // minutes
  endTime: string           // "HH:mm"
  color: ShiftColor
  name: string              // snapshot from template
}
```

### TrackingRecord
```typescript
interface TrackingRecord {
  id: string
  date: string
  startTime: string
  duration: number
  isActive?: boolean        // true if currently clocked in
  breakMinutes?: number
}
```

### AbsenceInstance
```typescript
interface AbsenceInstance {
  id: string
  templateId: string | null // null for one-off sick days
  type: 'vacation' | 'sick'
  date: string              // "YYYY-MM-DD"
  startTime: string
  endTime: string
  isFullDay: boolean
  name: string
  color: string
}
```

### CalendarState
```typescript
interface CalendarState {
  mode: AppMode             // "viewing" | "template-editing" | "shift-armed" | "instance-editing" | "absence-armed"
  view: CalendarView        // "week" | "month"
  templates: Record<string, ShiftTemplate>
  instances: Record<string, ShiftInstance>
  armedTemplateId: string | null
  editingTemplateId: string | null
  editingInstanceId: string | null
  currentWeekStart: Date
  currentMonth: Date
  templatePanelOpen: boolean
  reviewMode: boolean
  trackingRecords: Record<string, TrackingRecord>
  confirmedDates: Set<string>
  confirmedDayStatus: Record<string, ConfirmedDayStatus>
  // Absence state
  absenceTemplates: Record<string, AbsenceTemplate>
  absenceInstances: Record<string, AbsenceInstance>
  armedAbsenceTemplateId: string | null
  // UI state
  hideFAB: boolean          // Hide FAB when overlays are open
}
```

### Key Actions
```typescript
type CalendarAction =
  // Navigation
  | { type: "SET_WEEK"; date: Date }
  | { type: "PREV_WEEK" }
  | { type: "NEXT_WEEK" }
  // Shifts
  | { type: "ARM_SHIFT"; templateId: string }
  | { type: "PLACE_SHIFT"; date: string; timeSlot?: string }
  | { type: "UPDATE_INSTANCE_START_TIME"; id: string; startTime: string }
  | { type: "DELETE_INSTANCE"; id: string }
  // Templates
  | { type: "UPDATE_TEMPLATE"; id: string; template: Partial<ShiftTemplate> }
  | { type: "DELETE_TEMPLATE"; id: string }
  // Tracking
  | { type: "UPDATE_TRACKING_START"; id: string; startTime: string }
  | { type: "UPDATE_TRACKING_BREAK"; id: string; breakMinutes: number }
  | { type: "CONFIRM_DAY"; date: string }
  // Absences
  | { type: "ARM_ABSENCE"; templateId: string }
  | { type: "ADD_ABSENCE_INSTANCE"; instance: AbsenceInstance }
  // ... and more
```

---

## Testing

### Unit Tests

```bash
cd mobile-app
npm test

# Run specific test
npm test -- --testPathPattern=GeofenceService
```

### Manual Testing

| Feature | Test Method |
|---------|-------------|
| Geofencing | Real device, walk in/out of location |
| Zoom | Option+drag in simulator, pinch on device |
| Haptics | Device only (no simulator feedback) |
| Background tasks | Kill app, verify tracking continues |

### TestFlight

1. Increment `buildNumber` in `app.json`
2. Run `eas build --platform ios --profile production`
3. Run `eas submit --platform ios`
4. Wait for Apple processing (~15-30 min)
5. Testers manually update via TestFlight app
