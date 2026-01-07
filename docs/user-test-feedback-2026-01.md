# User Test Feedback - January 2026

**Date:** 2026-01-06
**Tester:** Physician (iPhone 13, iOS 18.x)
**Status:** Triaging

---

## Raw Feedback (Original German)

### Feature Requests
- Dienste einfügen durch auf Kalender klicken
- Urlaubstage sollten möglich sein einzutragen
- Krankheitstage sollten möglich sein einzutragen
- Ortssuche wäre nice to have (ansonsten klarer machen, dass den Namen eintragen was anderes ist als suche)
- Im Status sollte es direkt einsehbar sein, wo Geofencing eingerichtet wird
- Plus / minus (zoom funktion) ist an untypischen Ort, wird mit Größe des radius verwechselt

### Bugs
- Wenn Dienste geändert werden sollten alle bereits gesetzten Dienste geändert werden
- Wenn die app neu runtergeladen wurde / neuer account eingerichtet wurde, sollte das in der 14 Tages Übersicht berücksichtigt werden (i.e. sollte nicht gesetzt werden, evt. sollte es nicht möglich sein in der Zeit Dienste zu setzen)
- Dienste können doppelt am selben Tag gesetzt werden
- Kurze fälschlicherweise eingetragene GPS Daten sind zu schwer auszuwählen und damit zu löschen
- Dienste sollten löschbar sein!
- Pfeile in der Wochenansicht funktionieren nicht (Monat funktioniert)
- Beim schicken vom bug report wird zwar etwas an das dashboard geschickt, allerdings bleibt es beim user beim „laden" hängen (symbol dreht sich einfach nur)
- Beim zoomen vom Kalender springt es manchmal zurück, wenn man loslässt

---

## Clarifications

1. **Duplicate shifts** - Allowed if not overlapping (need overlap detection)
2. **Template propagation** - Editing a template should update future instances only (past stays frozen)
3. **14-day overview for new accounts** - Show "No data yet" for days before account creation
4. **Vacation/Sick days** - Likely new "day type" that blocks shifts; needs design exploration
5. **Short GPS entries** - Visual size issue, too small to tap
6. **Week view arrows** - Works on iPhone 15/iOS 17, broken on iPhone 13/iOS 18
7. **Bug report spinner** - Report sends successfully, only UI feedback is broken

---

## Implementation Plan

### Cluster A: Quick Bug Fixes (1 session)
**Status:** In Progress - See [CLUSTER_A_PLAN.md](./CLUSTER_A_PLAN.md)

| Issue | Effort | Fix Applied | Status |
|-------|--------|-------------|--------|
| Bug report spinner stuck | Low | Added logging + fallback strings | [x] Needs device test |
| Week view arrows (iOS 18/iPhone 13) | Medium | Changed to PREV_WEEK/NEXT_WEEK actions + logging | [x] Needs device test |
| Zoom jump-back on release | Medium | Ref-based fix (reanimated attempted but crashed) | [x] Tested - acceptable |

#### Technical Details

**Zoom jump-back fix** (`WeekView.tsx`):
- Root cause: `currentScale` in `onEnd()` was a stale closure value from gesture creation time
- Fix: Added `lastAppliedScale` ref, updated during `onUpdate()`, read in `onEnd()`
- Files changed: `mobile-app/src/modules/calendar/components/WeekView.tsx`

**Bug report spinner fix** (`SettingsScreen.tsx`):
- Root cause: Unknown (code looked correct, added diagnostics)
- Fix: Added console logging + fallback strings for Alert
- Files changed: `mobile-app/src/modules/geofencing/screens/SettingsScreen.tsx`

**Week view arrows fix** (`CalendarHeader.tsx`):
- Root cause: Unknown (possibly date calculation closure issue)
- Fix: Changed from `SET_WEEK` with calculated date to `PREV_WEEK`/`NEXT_WEEK` actions (same as swipe nav)
- Files changed: `mobile-app/src/modules/calendar/components/CalendarHeader.tsx`

### Cluster B: Shift Instance Management (2 sessions)
**Status:** Pending

| Issue | Effort | Notes |
|-------|--------|-------|
| Tap-to-add shifts on calendar | Medium | New interaction pattern |
| Delete shift instances | Low | Extend existing delete pattern |
| Overlap detection | Medium | Allow multiple if non-overlapping |
| Template edits → update future instances | Medium | Past instances stay frozen |

### Cluster C: Tracking Data UX (1 session)
**Status:** ✅ Implemented - See [CLUSTER_C_PLAN.md](./CLUSTER_C_PLAN.md)

| Issue | Effort | Solution | Status |
|-------|--------|----------|--------|
| Short GPS records hard to tap | Low | Filter < 5 min at recording + 16px min visual height | ✅ Done |
| "No data yet" for pre-account days | Medium | Fetch `createdAt` from `/auth/me`, gray out pre-account days | ✅ Done |

### Cluster D: Location Setup UX (1 session)
**Status:** Pending

| Issue | Effort | Notes |
|-------|--------|-------|
| Location search (or clearer manual entry) | Medium | Geocoding API or better labeling |
| Show geofences in Status screen | Low | More prominent location display |
| Zoom controls location/clarity | Low | Move +/- or relabel |

### Cluster E: Day Types - Vacation/Sick
**Status:** ✅ Implemented + Refined - See [CLUSTER_E_PLAN.md](./CLUSTER_E_PLAN.md)

| Issue | Effort | Solution | Status |
|-------|--------|----------|--------|
| Vacation days | Medium-High | Separate Absence entity with templates | ✅ Done |
| Sick days | Medium-High | One-off entries, full day default | ✅ Done |
| Absence arming bug | Low | Fixed: absences now stay armed when closing panel | ✅ Done |
| Long-press picker missing absences | Medium | Added Shifts/Absences tabs to quick picker | ✅ Done |
| Drag handles for time adjustment | Medium | Added grabbers like tracking records | ✅ Done |
| MonthView layout | Low | Consistent two-row layout (shifts top, absences bottom) | ✅ Done |

**Design decisions (refined):**
- Separate `AbsenceTemplate` + `AbsenceInstance` tables (not special shift type)
- Simplified templates: just "Vacation" and "Sick Day" (removed half-day variants)
- Times adjustable via drag handles (same UX as tracking records)
- Visual: muted color block + icon (TreePalm 🌴 / Thermometer 🌡️)
- Overlap: shifts dimmed where absence overlaps, that time doesn't count toward planned
- 14-day overview: absences reduce planned hours, icon row shows absence days
- MonthView: consistent two-row layout (Row 1: shift dots, Row 2: absence icons)
- Local only - not submitted to backend

### Cluster F: UX Polish (Post-Testing)
**Status:** ✅ Complete - See [CLUSTER_F_PLAN.md](./CLUSTER_F_PLAN.md)

| Issue | Solution | Status |
|-------|----------|--------|
| Status location → specific view | Navigate to TrackingScreen | ✅ Done |
| Whitespace above map | Reduced header padding | ✅ Done |
| Keyboard squashing name input | Animated mini-map shrinks | ✅ Done |
| Absence obscures shifts | 50% transparent overlay | ✅ Done |
| POI search doesn't find hospitals | Photon API + healthcare sorting | ✅ Done |
| Double-tap conflict | Double-tap places, single tap clears | ✅ Done |
| Step indicator unclear | Added "Step X of 3" + step name | ✅ Done |
| Work Locations layout | Inverted: small map, big list | ✅ Done |

**Implemented 2026-01-07:**
- Photon geocoding with healthcare prioritization (hospital, clinic, etc. sorted first)
- Proximity bias for nearby results
- Step indicator shows "Step 1 of 3 - Find Your Workplace"
- Work Locations screen: 200px map preview, list as main content

---

## Suggested Order

1. **Cluster A** - Quick wins, restore trust ✅
2. **Cluster C** - Address GPS deletion frustration ✅
3. **Cluster E** - Vacation/sick days ✅
4. **Cluster F** - UX polish from testing ✅
5. **Cluster B** - Core calendar improvements (biggest impact)
6. **Cluster D** - Location setup polish

---

## Test Device Info

From bug report dashboard:
- Device: iPhone 13 Pro
- iOS Version: 18.x
- App Build: TBD

## Session Log

**2026-01-06 (Session 1 - Morning):**
- Created feedback document from user test
- Investigated all Cluster A bugs
- Applied fixes:
  1. **Zoom jump-back**: Fixed stale closure issue with `lastAppliedScale` ref
  2. **Bug report spinner**: Added logging and fallback strings for diagnostics
  3. **Week view arrows**: Changed to use `PREV_WEEK`/`NEXT_WEEK` actions (same as swipe)
- **Zoom jitter improvement**: Removed throttling, increased skip threshold to 0.01
- Tested in iOS 17.5 simulator (no iOS 18 available without Xcode 16 upgrade)

**2026-01-06 (Session 2 - Reanimated Attempt):**
- Attempted `react-native-reanimated` for 60fps UI-thread zoom
- Installed reanimated, expo-dev-client, added babel plugin
- Implemented threshold-triggered hybrid approach (smooth transform + disclosure updates)
- **Builds #25, #26, #27** - all crashed on zoom after a few pinches
- Tried multiple simplifications - crashes persisted
- **Fully reverted** to ref-based approach
- Removed reanimated and expo-dev-client packages
- Tested in simulator - zoom works without crashes, behavior is "acceptable"
- Updated `eas.json` with `development-simulator` profile (kept for future use)

**Files changed this session:**
- `WeekView.tsx` - pinch gesture uses refs (reverted)
- `zoom-context.tsx` - reverted to original
- `babel.config.js` - removed reanimated plugin
- `package.json` - reanimated/dev-client removed
- `app.json` - build number now 28

**Remaining Cluster A items:**
- Week view arrows fix - needs device test (iOS 18/iPhone 13)
- Bug report spinner fix - needs device test

### Reanimated Attempt (2026-01-06 - Failed)

We attempted to use `react-native-reanimated` for smoother 60fps pinch zoom:

**Approach:**
1. Installed `react-native-reanimated` and `expo-dev-client`
2. Added babel plugin to `babel.config.js`
3. Created shared values for gesture-time scale
4. Used worklet callbacks for pinch gesture
5. Applied CSS transform via `useAnimatedStyle`

**Result:** App crashed on zoom after a few pinches. Tried multiple simplifications:
- Removed threshold-triggered disclosure updates
- Removed all runOnJS calls during gesture (pure UI thread)
- Crashes persisted even with minimal implementation

**Builds tested:** #25, #26, #27 - all crashed on zoom

**Root cause:** Unknown - possibly incompatibility with Expo SDK 54 / new architecture (`newArchEnabled: true`). The reanimated worklets caused crashes even in production builds.

**Resolution:** Fully reverted to non-reanimated approach:
- Removed `react-native-reanimated` and `expo-dev-client` packages
- Removed babel plugin
- Restored original ref-based pinch gesture
- Tested in simulator - zoom works without crashes, behavior is "acceptable"

**Lesson learned:** Reanimated + Expo SDK 54 + new architecture may have compatibility issues. Revisit in future Expo SDK version.

**2026-01-06 (Session 3 - Cluster C Planning):**
- Decided to tackle Cluster C next (vs Cluster B) based on technical practicality
- Explored codebase for both issues:
  - GPS tap targets: Found root cause in `WeekView.tsx` - Pressable height = visual height
  - 14-day overview: Found `DashboardDataService` hard-codes 14-day window, `createdAt` available but not used
- Analyzed risks and tradeoffs for different approaches
- Decided on two-part solution for GPS records:
  1. Filter sessions < 5 min at recording time (noise reduction)
  2. Minimum visual height of 16px (tappability)
- Decided on graceful degradation for 14-day overview:
  1. Fetch `createdAt` from `/auth/me` after login
  2. Gray out pre-account days with "—" indicator
- Created `CLUSTER_C_PLAN.md` with detailed implementation steps

**2026-01-06 (Session 4 - Cluster C Implementation):**
- Implemented all Cluster C changes with refinements based on testing:

**Issue 1: Short GPS records hard to tap**
- Added `MIN_SESSION_MINUTES = 5` constant to `TrackingManager.ts`
- Modified `handleGeofenceExit()` and `clockOut()` to delete sessions < 5 min
- Added "Session Discarded" notification when short session is deleted
- Added `MIN_TRACKING_HEIGHT = 8` (reduced from 16 for less clunky look)
- Added `MIN_TRACKING_HIT_SLOP = 20` for expanded tap target via hitSlop
- Changed duration format from "0.3 hours" to "20min" using `formatDuration()`

**Issue 2: 14-day overview for new accounts**
- Added `createdAt?: string` to `User` interface in `auth-types.ts`
- Added `createdAt: string` to `MeResponse` interface
- Updated `AuthService.getCurrentUser()` to extract `created_at` from response
- Updated `AuthService.register()` to call `getCurrentUser()` after registration
- Added `isPreAccount: boolean` to `DailyHoursData` interface
- Modified `loadDashboardData()` to accept `accountCreatedAt` parameter
- Updated `Bar` component in `HoursSummaryWidget.tsx` to show "—" for pre-account days
- Updated `HoursSummaryWidget` to use `formatDuration()` for consistent format
- Updated `StatusScreen.tsx` to pass `authState.user?.createdAt` to `loadDashboardData()`

**Files changed:**
- `mobile-app/src/modules/geofencing/services/TrackingManager.ts`
- `mobile-app/src/modules/calendar/components/WeekView.tsx`
- `mobile-app/src/lib/auth/auth-types.ts`
- `mobile-app/src/modules/auth/services/AuthService.ts`
- `mobile-app/src/modules/geofencing/services/DashboardDataService.ts`
- `mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx`
- `mobile-app/src/modules/geofencing/screens/StatusScreen.tsx`

**Ready for Build #29**

**2026-01-06 (Session 5 - Cluster E Refinements):**
- Fixed absence arming bug: absences now stay armed when closing TemplatePanel (like shifts)
- Added `absence-armed` mode to AppMode type for consistency
- Added Shifts/Absences tabs to long-press quick picker modal
- Changed vacation icon from Umbrella to TreePalm
- Simplified default absence templates: removed "Half Day AM/PM", kept only "Vacation" and "Sick Day"
- Added drag handles to AbsenceCard for adjusting start/end times:
  - Tap absence to select (shows grabbers + primary border)
  - Drag top grabber to adjust start time
  - Drag bottom grabber to adjust end time
  - Same UX as tracking records
- Updated MonthView for consistent two-row layout:
  - Row 1 (top): Shift dots (minHeight: 8px)
  - Row 2 (bottom): Absence icons (minHeight: 10px)
  - Both rows always rendered for consistent spacing

**Files changed:**
- `mobile-app/src/modules/calendar/components/WeekView.tsx` - AbsenceCard with grabbers, handlers
- `mobile-app/src/modules/calendar/components/TemplatePanel.tsx` - Fixed arming, TreePalm icon
- `mobile-app/src/modules/calendar/components/MonthView.tsx` - Two-row layout, TreePalm icon
- `mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx` - TreePalm icon
- `mobile-app/src/modules/calendar/services/CalendarStorage.ts` - Simplified default templates
- `mobile-app/src/lib/calendar/calendar-reducer.ts` - absence-armed mode
- `mobile-app/src/lib/calendar/types.ts` - AppMode type updated

---

## Notes

- Week navigation arrows work in Month view but not Week view
- Zoom gesture works but sometimes "snaps back" on release
- Bug reports are received by backend, UI just doesn't show success state
