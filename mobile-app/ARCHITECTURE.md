# Mobile App Architecture

**Last Updated:** 2026-02-09
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
| **Change inline picker** | `src/modules/calendar/components/InlinePicker.tsx` |
| **Change manual session form** | `src/modules/calendar/components/ManualSessionForm.tsx` |
| **Change lock screen** | `src/modules/auth/screens/LockScreen.tsx` |
| **Change biometric auth** | `src/lib/auth/BiometricService.ts` |
| **View work history / export CSV** | `src/modules/geofencing/screens/LogScreen.tsx`, `src/modules/geofencing/utils/exportHistory.ts` |
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
│   │   ├── auth/               # Login, registration, lock screen
│   │   │   ├── screens/        # WelcomeScreen, LoginScreen, LockScreen
│   │   │   └── services/       # AuthService
│   │   │
│   │   ├── calendar/           # Calendar feature
│   │   │   ├── components/     # WeekView, MonthView, InlinePicker, TemplatePanel, CalendarFAB, ManualSessionForm
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
- `ExitVerificationService.ts` - Scheduled GPS checks to verify exits (1/3/5 min)
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
EVENT_COOLDOWN_MS = 10000       // Debounce rapid geofence events (10s)
```

**Exit Verification Service (`ExitVerificationService.ts`):**
- On geofence exit → schedules 3 silent notifications at 1, 3, 5 minutes
- Each notification triggers a quick GPS check (`Location.Accuracy.Balanced`, 5s timeout)
- Confidence-based distance logic (Haversine): `isConfidentlyInside` / `isConfidentlyOutside` / `isUncertain`
- Confidently inside → cancel pending exit (false alarm)
- Confidently outside at 5 min → confirm clock-out + send notification
- Uncertain at 5 min → leave pending, let fallback handle it
- State persisted in SecureStore (survives app termination)
- Integrated into TrackingManager: scheduled on exit, cancelled on re-entry/manual clock-out
- Fallback: `processPendingExitsIfNeeded()` on StatusScreen focus

**GPS Telemetry & Accuracy:**
- Active GPS fetch when geofence events lack location data (common on both platforms)
- `accuracy_source` field tracks data origin: `'event'` (rare), `'active_fetch'` (common), or `null` (failed)
- Event debouncing: 10-second cooldown per location prevents rapid oscillation
- Stale exit cleanup: pending exits >24h auto-confirmed
- Telemetry included in Report Issue for parameter tuning
- Database schema v5 adds `accuracy_source` column

**Clock-out Reliability (Build #42):**
- Immediate clock-out for good GPS accuracy (<50m, no hysteresis)
- Expired pending exits (>5min) confirmed on next ENTER event
- App foreground trigger processes pending exits
- Philosophy: "bias toward logging out" — act on EXIT event if verification doesn't run

**Geofencing UX (Group A fixes):**
- Location list: tap to select + show on map, edit icon to navigate to edit screen
- Consent status: color now matches actual acceptance state (green/warning)
- Permission warning banner: dismissable with X button, re-shows after 1 week (AsyncStorage timestamp)

### Module 2: Authentication & Submission

Email-based passwordless auth with daily data submission, biometric unlock, and lock screen.

**Key Files:**
- `AuthService.ts` - Login, registration, token management
- `BiometricService.ts` - Face ID/Touch ID/Fingerprint auth, passcode fallback
- `LockScreen.tsx` - Lock screen with biometric + passcode + email options
- `WelcomeScreen.tsx` - Initial screen with Log In / Create Account choice
- `DailySubmissionService.ts` - Submits confirmed days to backend
- `ConsentBottomSheet.tsx` - GDPR consent modal
- `ConsentStorage.ts` - Local consent record persistence
- `consent-types.ts` - Consent types and version constants

**Auth Flow:**
```
App Launch
    │
    ▼
Token exists & valid?
    │
    ├── No → WelcomeScreen → "Log In" (single code) or "Create Account" (registration)
    │
    Yes
    │
    ▼
Biometric enabled? → No → Restore session → MainTabs
    │
    Yes → LockScreen
    │
    ├── Face ID/Touch ID → Success → MainTabs
    ├── "Use device passcode" → Passcode prompt → Success → MainTabs
    └── "Sign in with email" → Sign out → WelcomeScreen
```

**Lock Screen (N26/Revolut pattern):**
- Auto-prompts biometric on mount
- Primary: "Unlock with Face ID/Touch ID" button
- Secondary: "Use device passcode" link → `BiometricService.authenticateWithPasscodeOnly()`
- Tertiary: "Sign in with email" link → full sign out
- TEST_MODE bypass for E2E testing
- Auth state `'locked'` → renders LockScreen in AppNavigator

**Biometric Service:**
- `authenticate()` — biometric with passcode fallback
- `authenticateWithPasscodeOnly()` — passcode-only prompt
- `isEnabled()` / `setEnabled()` — preference in SecureStore
- `getBiometricType()` — localized string ("Face ID", "Fingerprint", etc.)
- Settings toggle in SettingsScreen (hidden when device lacks biometrics)

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

Shift planning with templates, instances, and a unified inline picker.

**Key Files:**
- `WeekView.tsx` - Main calendar view with pinch-zoom
- `MonthView.tsx` - Monthly overview with summary footer
- `InlinePicker.tsx` - Unified shift/absence/GPS picker (centered modal)
- `ManualSessionForm.tsx` - Manual tracked session creation form
- `TemplatePanel.tsx` - Shift/absence template management (compact radio list)
- `CalendarFAB.tsx` - Floating action button (Shifts/Absences/Log Hours)
- `CalendarHeader.tsx` - Header with navigation, week badge, GPS toggle
- `CalendarStorage.ts` - SQLite persistence
- `calendar-reducer.ts` - State management

**InlinePicker (Unified Picker UI):**
- Centered modal with three tabs: Shifts, Absences, GPS
- Two modes: **direct placement** (with targetDate → places immediately) and **arming** (without targetDate → arms for double-tap)
- Entry points: FAB, WeekView (tap/long-press), MonthView (long-press)
- Edit icon (pencil) on LEFT of template rows, inline edit form with name/time/color/break duration
- Focus ring on target day in both WeekView and MonthView
- Blocked on locked/confirmed days
- 28 testIDs for E2E compatibility

**Interaction Model:**

| View | Action | Not Armed | Armed |
|------|--------|-----------|-------|
| WeekView | Single tap | Open InlinePicker | Blocked |
| WeekView | Double tap | Open InlinePicker | Place shift/absence |
| WeekView | Long press | Open InlinePicker | Open InlinePicker |
| MonthView | Single tap | Navigate to WeekView | Delayed navigate (allows double-tap) |
| MonthView | Double tap | Navigate to WeekView | Place armed shift |
| MonthView | Long press | Open InlinePicker | Open InlinePicker |

**Week View Features:**
- Pinch-to-zoom with focal point (ref-based, platform-specific gesture handling)
- Swipe to navigate weeks
- Drag handles to adjust shift/tracking times
- Absences (vacation, sick days) with full CRUD
- FAB for quick access to InlinePicker
- GPS visibility toggle (eye icon) — shows tracked time on calendar
- Progressive disclosure at 4 zoom levels:
  - Full (≥56px): start/end times + duration (12px font)
  - Reduced (32-55px): duration only (12px font)
  - Compact (20-31px): duration + end time (9px font)
  - Minimal (12-19px): end time only (9px font)
- First-time "Submit" tooltip explaining confirmation permanence
- Submit button (was "Confirm?") with review mode header hint

**Month View Features:**
- Grid uses fixed 6-week (42 cell) layout for consistent height across all months
- Day cells show: day number, shift dots (colored), tracked dot (rose), absence icons
- Per-day overtime for confirmed days (e.g., "+1h 30m ✓") — color-coded green/red/grey
- Unconfirmed days with activity show ? icon
- Monthly summary footer: tracked hours, planned hours, overtime, vacation/sick counts
- Confirmation nudge: "(X confirmed)" hint when some overtime is unconfirmed
- Swipe left/right to navigate months (with slide animation)
- Header title click navigates to current month
- GPS toggle and FAB hidden (month view is overview-only)
- Full month tracking data loaded when switching to month view in review mode
- Multi-day sessions correctly split across days using `getTrackedMinutesForDate()`
- Armed shift banner in fixed-height slot inside `Animated.View` (no layout shift)

**Manual Session Creation:**
- Allows manual entry of tracked hours when GPS fails completely
- Entry via FAB "Log Hours" or long-press "Log Tracked Hours"
- Form: Location dropdown → Date → Start time → End time → Save
- Uses existing `tracking_method: 'manual'` field for auditing
- Validates: no future dates, end > start, no same-location overlaps
- Emits `tracking-changed` event for immediate calendar refresh

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

### Month View UX Improvements (2026-01-16)
- **Expanded grid**: Dynamic cell heights fill available space (removed fixed `aspectRatio: 1`)
- **Confirmation icons**: ✓ (confirmed, teal) and ? (unconfirmed with activity, grey) replace green background tint
- **Monthly summary footer**: tracked hours, planned hours, overtime (color-coded), vacation/sick counts
- **Per-day overtime**: "+1h 30m ✓" display, confirmation nudge when partial
- **Swipe navigation**: PanResponder with 200ms slide animation
- **Multi-day session fix**: `getTrackedMinutesForDate()` with proper overlap calculation and proportional break allocation
- **Month tracking data**: Full month loaded when switching to month view in review mode
- **Header title click**: Navigates to current month
- **Consistent layout**: Always 42 cells (6 weeks), absence row with minHeight, hint reserves space
- **Code cleanup**: Deduplicated time helpers in `calendar-utils.ts` (single source of truth)

### Manual Session Creation (2026-01-18)
- **Problem**: No way to record hours when GPS fails completely
- **Solution**: `ManualSessionForm.tsx` — location dropdown, date, start/end time pickers
- **Entry points**: FAB "Log Hours" option + long-press "Log Tracked Hours" in WeekView
- **Data model**: Uses existing `tracking_method: 'manual'` field, `state: 'completed'`
- **Validation**: No future dates, end > start, no same-location overlaps
- **Refresh**: Emits `tracking-changed` event for immediate calendar update

### Auth UX Improvements (2026-01-19)
- **WelcomeScreen**: Initial screen with "Log In" / "Create Account" choice
- **Streamlined login**: Returning users go directly to LoginScreen (single code, no double verification)
- **Email preview fix**: Verification code moved to first line of email body for inbox preview visibility
- **Biometric unlock**: Face ID/Touch ID/Fingerprint via `expo-local-authentication`
  - `BiometricService.ts` with `authenticate()`, `authenticateWithPasscodeOnly()`, `isEnabled()`/`setEnabled()`
  - Settings toggle (hidden when device lacks biometrics)
  - Preference stored in `expo-secure-store`
  - iOS `NSFaceIDUsageDescription` configured in `app.json`

### Confirm Action Clarity (2026-01-19)
- **First-time tooltip**: Modal explaining "this sends hours to the study, can't be edited after"
- **Stored in AsyncStorage**: `hasSeenConfirmTooltip` flag, shown once then dismissed forever
- **Button relabeling**: "Confirm?" → "Submit" (compact: "✓")
- **Review mode hint**: "Submit each day to finalize your hours" in header
- **New file**: `src/lib/storage/onboardingStorage.ts` for onboarding flags

### Zoomed-Out Timing Info (2026-01-19)
- **Problem**: Tracking blocks showed no timing info at low zoom levels
- **Solution**: Added two compact disclosure levels with 9px font (`xxs` in typography.ts)
- **Compact (20-31px)**: Duration centered + end time at bottom edge (9px)
- **Minimal (12-19px)**: End time only at bottom edge (9px)
- **Thresholds**: `DISCLOSURE_COMPACT_HEIGHT = 20`, reuses existing 32px/56px levels

### Work History Screen (2026-01-22)
- **Replaced placeholder LogScreen** with full work history for a location
- **SectionList** grouped by date with session cards (time, duration, method, active badge)
- **Date range filters**: Week / Month / All preset tabs
- **Summary card**: Total hours + session count
- **CSV export**: Via share sheet (`exportHistory.ts`), format: Date/Day/Clock In/Out/Duration/Method/Status
- **Confirmation status**: Date headers show confirmed ✓ or "Tap to confirm", tapping navigates to Calendar
- **States**: Loading, empty (icon + hint), data, exporting
- **Pull-to-refresh** and refresh on screen focus
- **Database**: `getSessionsInRange()` method with optional date bounds
- **i18n**: Full EN + DE translations
- **Files**: `LogScreen.tsx` (rewrite), `exportHistory.ts` (new), `Database.ts` (new method)

### Geofencing Robustness: GPS Telemetry (2026-01-24)
- **Active GPS fetch**: Requests position when geofence events lack location data
- **Event debouncing**: 10-second cooldown prevents rapid oscillation (database-backed, not in-memory)
- **Telemetry**: `accuracy_source` field tracks GPS data origin (event/active_fetch/null)
- **Permission warning**: Re-enabled on StatusScreen
- **Android notification channels**: `tracking` (silent) and `alerts` (audible)
- **Stale exit cleanup**: Pending exits >24h auto-confirmed
- **Clock-out reliability (Build #42)**: Immediate clock-out for accuracy <50m, expired pending exits confirmed on ENTER, app foreground trigger
- **Database migration v5**: Adds `accuracy_source` column to `geofence_events`
- **Backend**: `accuracy_source` field added to `GpsTelemetryEvent` schema

### UX Expert Feedback — Group A: Geofencing Screens (2026-02-05)
- **Location list tap**: Split into select (pan map) + edit icon (navigate to edit screen)
- **Consent status color**: Conditional styling — green when accepted, warning when not
- **Permission warning dismiss**: X button with 1-week re-show via AsyncStorage timestamp
- **Files**: `LocationsListScreen.tsx`, `DataPrivacyScreen.tsx`, `PermissionWarningBanner.tsx`, `StatusScreen.tsx`

### UX Expert Feedback — Group B: Lock Screen (2026-02-06)
- **New LockScreen**: N26/Revolut pattern with Face ID + passcode + email options
- **Auth state**: Added `'locked'` status to AuthState, `SET_LOCKED` and `UNLOCK` actions
- **BiometricService**: Added `authenticateWithPasscodeOnly()` method
- **AppNavigator**: Renders LockScreen when `authState.status === 'locked'`
- **Auto-prompt**: Biometric prompted on mount, TEST_MODE bypass for E2E
- **Files**: `LockScreen.tsx` (new), `auth-context.tsx`, `BiometricService.ts`, `AppNavigator.tsx`, `auth-types.ts`

### UX Expert Feedback — Group C: InlinePicker Unification (2026-02-09)
- **Unified picker**: `InlinePicker.tsx` replaces duplicate picker UIs (TemplatePanel + old WeekView inline picker)
- **Three tabs**: Shifts, Absences, GPS (Log Hours)
- **Two modes**: Direct placement (targetDate set) and arming (targetDate null, from FAB)
- **Edit UX**: Edit button on LEFT, inline edit form with color picker + break duration
- **MonthView interactions**: Single tap → WeekView, long press → picker, double-tap → place armed shift
- **WeekView interactions**: Single tap blocked when armed, double-tap places, long press opens picker
- **Batch indicator**: Armed shift banner in fixed-height slot (no layout shift) in both views
- **28 testIDs** added for E2E compatibility
- **Tab sync fix**: FAB → Absences correctly opens Absences tab
- **Files**: `InlinePicker.tsx` (new), `CalendarScreen.tsx`, `WeekView.tsx`, `MonthView.tsx`, `CalendarFAB.tsx`, `types.ts`, `calendar-reducer.ts`

### Visual Polish (2026-02-09)
- **CalendarHeader title overflow**: `flex: 1` + `adjustsFontSizeToFit` with `minimumFontScale={0.8}`, same-month range shortening ("Apr. 20 - 26")
- **MonthView banner layout shift**: Banner inside `Animated.View` with fixed-height slot (height: 44, marginBottom: 8)
- **Android tab bar overlap**: Wrapper View with `paddingBottom: Math.max(insets.bottom, 48)` for Android 15+ edge-to-edge
- **Key learnings**: Android hot reload can silently fail; sibling Views after `Animated.View flex:1` may not render on Android; Android 15+ enforces edge-to-edge regardless of config

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
  // InlinePicker state
  inlinePickerOpen: boolean
  inlinePickerTargetDate: string | null    // YYYY-MM-DD when opened via tap/long-press
  inlinePickerTab: 'shifts' | 'absences' | 'gps'
  // Manual session state
  manualSessionFormOpen: boolean
  manualSessionFormDate: string | null     // Pre-filled date from long-press
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
  // InlinePicker
  | { type: "OPEN_INLINE_PICKER"; date?: string; tab?: 'shifts' | 'absences' | 'gps' }
  | { type: "CLOSE_INLINE_PICKER" }
  | { type: "SET_INLINE_PICKER_TAB"; tab: 'shifts' | 'absences' | 'gps' }
  // Manual session
  | { type: "OPEN_MANUAL_SESSION_FORM"; payload?: { date?: string } }
  | { type: "CLOSE_MANUAL_SESSION_FORM" }
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

### E2E Testing (Appium)

Cross-platform E2E testing using [Appium](https://appium.io/) with WebdriverIO.

**Why Appium:**
- Works on both iOS and Android (Maestro has Android connection issues)
- Uses existing testIDs from the app code
- JavaScript tests with full IDE debugging support

**Prerequisites:**
```bash
# Node 22 required (Appium 3.x doesn't support Node 23)
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# Install dependencies
cd mobile-app/e2e
npm install

# Install Appium (if not already)
npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2
```

**Run tests:**
```bash
# Terminal 1: Start Appium server
cd /tmp/appium-test  # or any dir with Appium installed
npx appium --allow-cors --relaxed-security

# Terminal 2: Run tests
cd mobile-app/e2e
node run-tests.js ios all        # All tests on iOS
node run-tests.js android all    # All tests on Android
node run-tests.js ios calendar   # Single flow
```

**Test status:**

| Flow | iOS | Android |
|------|-----|---------|
| Calendar navigation | ✅ | ✅ |
| Calendar FAB (testID) | ✅ | ✅ |
| Week nav buttons | ✅ | ⚠️ testID not exposed |
| Location settings | ✅ | ✅ |
| Auth state check | ✅ | ✅ |

**Known gap (2026-02-09):** E2E tests need updating after InlinePicker refactor — tests were written for TemplatePanel flow. Current: 35/48 iOS, 30/48 Android. 28 new testIDs added but test scripts not yet updated.

**Directory structure:**
```
e2e/
├── package.json
├── run-tests.js          # Test runner
├── README.md             # Setup instructions
├── helpers/
│   ├── driver.js         # Appium connection
│   ├── selectors.js      # Cross-platform testID helpers
│   └── actions.js        # Common test actions
└── flows/
    ├── calendar.test.js
    ├── location.test.js
    └── auth.test.js
```

**Cross-platform selectors:**

testIDs are exposed differently on each platform:

```javascript
// helpers/selectors.js
function byTestId(driver, testId) {
  if (driver.isIOS) {
    return driver.$(`~${testId}`);           // accessibility id
  } else {
    return driver.$(`android=new UiSelector().resourceId("${testId}")`);
  }
}
```

**Android testID limitations:**

Some testIDs don't work on Android. Common fixes:

**1. Regular components** - Add accessibility props:

```tsx
// Before (testID not exposed on Android)
<TouchableOpacity testID="calendar-prev" onPress={handlePrev}>

// After (testID exposed on Android)
<TouchableOpacity
  testID="calendar-prev"
  accessible={true}
  accessibilityRole="button"
  onPress={handlePrev}
>
```

**2. React Navigation Tab Bar** - Use correct property name:

```tsx
// WRONG - tabBarTestID doesn't exist in React Navigation v7
<Tab.Screen options={{ tabBarTestID: 'tab-status' }} />

// CORRECT - tabBarButtonTestID passes testID to the button component
<Tab.Screen options={{ tabBarButtonTestID: 'tab-status' }} />
```

The `tabBarButtonTestID` property is passed through to `PlatformPressable` which properly exposes it to UiAutomator2 on Android.

**Test mode:**

The app has a `TEST_MODE` flag for mock API responses:
- Set in `app.json` → `expo.extra.TEST_MODE`
- Or via env var: `TEST_MODE=true npx expo start`
- Mock responses in `src/lib/testing/mockApi.ts`

---

### Legacy: Maestro (iOS only)

Maestro flows are kept in `.maestro/` for reference but are **iOS-only** due to Android connection issues (Maestro 2.1.0 cannot connect to Android emulators).

```bash
# Run Maestro on iOS only
maestro test .maestro/flows/auth/registration.yaml
```

See `docs/E2E_TESTING_PLAN.md` for historical context and migration details.

**Screenshots:** Gitignored. Delete after debugging sessions.

**For detailed status and known issues:** See `docs/E2E_TESTING_PLAN.md` (planning doc)
