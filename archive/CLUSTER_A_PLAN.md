# Cluster A Implementation Plan: Quick Bug Fixes

**Created:** 2026-01-06
**Status:** In Progress
**Estimated Effort:** 1 session
**Reference:** [User Test Feedback](./user-test-feedback-2026-01.md)

---

## Overview

This plan addresses three bugs identified in user testing that need quick fixes to restore user trust:

1. **Zoom snapback on quick release** - Calendar zoom snaps back when releasing fingers quickly
2. **Bug report spinner stuck** - UI shows loading indefinitely after successful report submission
3. **Week view arrows broken** - Navigation arrows don't work on iOS 18/iPhone 13

---

## Issue 1: Zoom Snapback on Quick Release

### Problem Analysis

**User report:** "Beim zoomen vom Kalender springt es manchmal zurück, wenn man loslässt"
(When zooming the calendar, it sometimes jumps back when you release)

**Observed behavior:**
- Quick pinch-zoom-release → scale snaps back to previous value
- Holding fingers still for ~0.5s before release → scale sticks correctly

**Root cause:** The pinch gesture handler is recreated mid-gesture due to React state updates.

**Current code:** `WeekView.tsx:619-652`

```javascript
const pinchGesture = useMemo(() =>
  Gesture.Pinch()
    .onStart(() => {
      lastAppliedScale.current = currentScale;  // ❌ Reads from closure
    })
    .onUpdate((event) => {
      // ...
      setCurrentScale(newScale);  // ❌ Triggers re-render
    })
    .onEnd(() => {
      baseScale.current = lastAppliedScale.current;
    }),
  [currentScale, setCurrentScale, minZoom]  // ❌ currentScale in deps
);
```

**The bug flow:**
1. User starts pinching at scale 1.0
2. `onUpdate` calls `setCurrentScale(1.2)` → React re-renders
3. `useMemo` recreates gesture because `currentScale` changed (1.0 → 1.2)
4. Old gesture is orphaned, new gesture inherits stale state
5. User releases quickly → inconsistent state → snapback

### Solution: Option B - Keep Visual Updates, Fix Dependencies

**Approach:**
- Remove `currentScale` from `useMemo` dependencies (prevents gesture recreation)
- Keep calling `setCurrentScale()` during gesture (preserves real-time visual feedback)
- Don't READ from `currentScale` closure - only use refs

**Implementation:**

**File:** `mobile-app/src/modules/calendar/components/WeekView.tsx`

```javascript
// Lines 619-652 - Replace pinchGesture useMemo

const pinchGesture = useMemo(() =>
  Gesture.Pinch()
    .onStart(() => {
      setIsPinching(true);
      // DON'T read from currentScale closure here
      // baseScale.current already has correct value from previous onEnd
      hitZoomLimit.current = false;
    })
    .onUpdate((event) => {
      const rawScale = baseScale.current * event.scale;
      const newScale = Math.min(1.5, Math.max(minZoom, rawScale));

      // Haptic feedback when hitting zoom limits
      const isAtLimit = rawScale !== newScale;
      if (isAtLimit && !hitZoomLimit.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        hitZoomLimit.current = true;
      } else if (!isAtLimit) {
        hitZoomLimit.current = false;
      }

      // Skip if scale hasn't changed meaningfully
      if (Math.abs(newScale - lastAppliedScale.current) < 0.01) return;

      // Update both ref AND state for visual feedback
      lastAppliedScale.current = newScale;
      setCurrentScale(newScale);
    })
    .onEnd(() => {
      // Commit final scale to baseScale for next gesture
      baseScale.current = lastAppliedScale.current;
      setIsPinching(false);
    }),
  [setCurrentScale, minZoom]  // ✅ Removed currentScale from deps
);
```

**Key changes:**
1. Removed `currentScale` from dependency array
2. Removed `lastAppliedScale.current = currentScale` from `onStart`
3. `baseScale.current` persists between gestures (set in `onEnd`)

**Why this works:**
- Gesture handler is NOT recreated during pinching (deps don't change)
- Visual updates still happen via `setCurrentScale()`
- Refs track the true state across gesture lifecycle
- `baseScale.current` carries correct value from previous `onEnd` to next `onStart`

### Testing (Issue 1)

1. **Quick pinch test:** Pinch quickly and release immediately → Scale should stick
2. **Slow pinch test:** Pinch slowly and release → Scale should stick
3. **Multiple consecutive pinches:** Pinch, release, pinch again → Each starts from previous scale
4. **Min zoom limit:** Pinch to minimum → Should hit limit with haptic, no snapback
5. **Max zoom limit:** Pinch to maximum → Should hit limit with haptic, no snapback
6. **Double-tap toggle:** Double-tap still toggles between 1.0x and previous scale

### References

- [React Native Gesture Handler - Pinch Gesture](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pinch-gesture/)
- [Pinch to zoom pattern](https://gist.github.com/intergalacticspacehighway/9e931614199915cb4694209f12bf6f11)

---

## Issue 2: Bug Report Spinner Stuck

### Problem Analysis

**User report:** "Beim schicken vom bug report wird zwar etwas an das dashboard geschickt, allerdings bleibt es beim user beim 'laden' hängen"
(When sending bug report, something is sent to dashboard, but user sees endless loading)

**Observed behavior:**
- User taps "Report Issue" in Settings
- Loading spinner appears
- Report is received by backend (confirmed in admin dashboard)
- Spinner never stops, success alert never shown

**Current code:** `SettingsScreen.tsx` - `handleReportIssue()`

**Previous fix applied:** Added logging and fallback strings for Alert (Build #28)

**Status:** Needs device test to verify fix works

### Solution: Diagnostics Already Applied

The code was reviewed and diagnostics added in Session 1. The Alert call appeared correct, but we added:
- Console logging at each step
- Fallback strings for Alert title/message

**Next step:** Test on device (iOS 18/iPhone 13) to see console output and verify behavior.

### Testing (Issue 2)

1. **Device test:** Connect iPhone 13 to Xcode, open Console
2. **Submit report:** Tap "Report Issue" in Settings
3. **Check logs:** Look for `[SettingsScreen]` log entries
4. **Expected result:** Success alert appears OR logs show where it fails

---

## Issue 3: Week View Arrows Broken

### Problem Analysis

**User report:** "Pfeile in der Wochenansicht funktionieren nicht (Monat funktioniert)"
(Arrows in week view don't work, month view works)

**Observed behavior:**
- Week view: Tapping left/right arrows does nothing
- Month view: Arrows work correctly
- Swipe navigation: Works in both views
- Device: iPhone 13 / iOS 18 (works on iPhone 15 / iOS 17)

**Current code:** `CalendarHeader.tsx`

**Previous fix applied:** Changed from `SET_WEEK` with calculated date to `PREV_WEEK`/`NEXT_WEEK` actions (Build #28)

**Rationale:** Swipe navigation uses `PREV_WEEK`/`NEXT_WEEK` and works. Arrow buttons used `SET_WEEK` with date calculation that may have closure issues.

**Status:** Needs device test to verify fix works on iOS 18

### Solution: Already Applied

Changed arrow handlers to use same actions as swipe:
- Left arrow: `dispatch({ type: 'PREV_WEEK' })`
- Right arrow: `dispatch({ type: 'NEXT_WEEK' })`

### Testing (Issue 3)

1. **Device test:** Test on iPhone 13 / iOS 18 specifically
2. **Arrow navigation:** Tap left/right arrows in week view
3. **Expected result:** Week changes correctly
4. **Comparison:** Verify swipe still works (should use same code path now)

---

## Implementation Order

1. **Issue 1:** Apply zoom snapback fix (Option B)
2. **Build #29:** Create new TestFlight build
3. **Device test all three issues** on iPhone 13 / iOS 18
4. **Iterate if needed** based on test results

---

## Files Changed

| File | Issue | Change |
|------|-------|--------|
| `WeekView.tsx` | Zoom snapback | Remove `currentScale` from deps, remove closure read in `onStart` |
| `SettingsScreen.tsx` | Bug report (already done) | Added logging + fallback strings |
| `CalendarHeader.tsx` | Week arrows (already done) | Changed to `PREV_WEEK`/`NEXT_WEEK` actions |

---

## Success Criteria

- [ ] Quick pinch-zoom-release no longer snaps back
- [ ] Bug report shows success alert (or logs reveal actual issue)
- [ ] Week view arrows work on iOS 18 / iPhone 13
- [ ] No regressions in zoom, navigation, or settings functionality
