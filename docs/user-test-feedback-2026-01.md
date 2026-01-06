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
**Status:** Zoom fix tested - acceptable, others awaiting device test

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
**Status:** Pending

| Issue | Effort | Notes |
|-------|--------|-------|
| Larger tap targets for short GPS records | Low | Minimum height + expanded hit area |
| "No data yet" for pre-account days | Low | Check account creation date |

### Cluster D: Location Setup UX (1 session)
**Status:** Pending

| Issue | Effort | Notes |
|-------|--------|-------|
| Location search (or clearer manual entry) | Medium | Geocoding API or better labeling |
| Show geofences in Status screen | Low | More prominent location display |
| Zoom controls location/clarity | Low | Move +/- or relabel |

### Cluster E: Day Types - Vacation/Sick (needs design)
**Status:** Pending - Requires Design

| Issue | Effort | Notes |
|-------|--------|-------|
| Vacation days | Medium-High | Day-level flag, blocks shifts |
| Sick days | Medium-High | Same pattern as vacation |

**Design approach:** Start with day-level flags (simplest). A day can be Normal, Vacation, or Sick. Integrates with 14-day overview as "absence" rather than "0 hours".

---

## Suggested Order

1. **Cluster A** - Quick wins, restore trust
2. **Cluster C** - Address GPS deletion frustration
3. **Cluster B** - Core calendar improvements (biggest impact)
4. **Cluster D** - Location setup polish
5. **Cluster E** - After design validation

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

---

## Notes

- Week navigation arrows work in Month view but not Week view
- Zoom gesture works but sometimes "snaps back" on release
- Bug reports are received by backend, UI just doesn't show success state
