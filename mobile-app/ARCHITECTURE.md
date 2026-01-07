# Mobile App Architecture

**Last Updated:** 2026-01-07
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
│   │   └── i18n/               # Translations (en.ts, de.ts)
│   │
│   ├── modules/
│   │   ├── auth/               # Login, registration screens
│   │   │   ├── screens/
│   │   │   └── services/       # AuthService
│   │   │
│   │   ├── calendar/           # Calendar feature
│   │   │   ├── components/     # WeekView, MonthView, TemplatePanel
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

Automatic clock-in/out based on GPS location.

**Key Files:**
- `GeofenceService.ts` - Manages geofence regions
- `TrackingManager.ts` - Handles clock-in/out logic
- `Database.ts` - SQLite operations

**Behavior:**
- Clock-in: Triggered on geofence enter
- Clock-out: Triggered on geofence exit (5-min hysteresis)
- Sessions < 5 min are discarded (noise filtering)
- Manual clock-in/out available as fallback

### Module 2: Authentication & Submission

Email-based passwordless auth with daily data submission.

**Key Files:**
- `AuthService.ts` - Login, registration, token management
- `DailySubmissionService.ts` - Submits confirmed days to backend

**Flow:**
1. User enters email → receives 6-digit code
2. User enters code → receives JWT token
3. Token stored in expo-secure-store
4. Daily submissions sent with JWT auth

### Calendar Module

Shift planning with templates and instances.

**Key Files:**
- `WeekView.tsx` - Main calendar view with pinch-zoom
- `MonthView.tsx` - Monthly overview
- `TemplatePanel.tsx` - Shift/absence template management
- `CalendarStorage.ts` - SQLite persistence
- `calendar-reducer.ts` - State management

**Features:**
- Pinch-to-zoom with focal point
- Double-tap to place shifts
- Swipe to navigate weeks
- Drag handles to adjust times
- Absences (vacation, sick days)

### Status Dashboard

14-day overview of worked hours.

**Key Files:**
- `DashboardDataService.ts` - Aggregates data for display
- `HoursSummaryWidget.tsx` - Bar chart visualization
- `NextShiftWidget.tsx` - Upcoming shift preview

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

-- Tracking records (geofencing sessions)
tracking_records (
  id TEXT PRIMARY KEY,
  location_id TEXT,
  clock_in TEXT,        -- ISO timestamp
  clock_out TEXT,       -- ISO timestamp (null if active)
  break_minutes INTEGER DEFAULT 0
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
