# Android Gesture Fix Plan - WeekView Calendar

**Created:** 2026-01-20
**Status:** Complete
**Goal:** Fix Android-specific gesture issues (scroll conflicts, pinch jitter) in WeekView calendar while maintaining iOS compatibility.

**Outcome:** Successfully implemented platform-specific gesture systems. iOS keeps RNGH GestureDetector, Android uses PanResponder for pinch and separate scroll handlers.

---

## Problem Summary

**Symptoms on Android:**
- Panning (drag to scroll) randomly works/fails
- Pinch zoom is jerky/stuttery

**Root Causes:**
1. `edgeSwipeGesture` (Pan) with `.activeOffsetX([-10, 10])` activates after just 10px, intercepting ScrollView touches before Android's native scroll can respond
2. State updates during pinch (`setIsPinching`, `setCurrentScale`) cause unnecessary re-renders
3. `scrollEnabled` toggling causes layout thrashing on Android

**Why iOS Works:**
- Native gesture coordination handles RNGH + ScrollView better
- `bounces={true}` provides natural overscroll for week navigation
- Different touch event handling at the OS level

---

## What We Tried (2026-01-20)

### Attempt 1: Adjust Pan gesture thresholds
- Changed `.minDistance(10)` → `.minDistance(25)` and `.activeOffsetX([-10,10])` → `.activeOffsetX([-25,25])`
- Added `.failOffsetY([-15, 15])` to fail on vertical movement
- **Result:** Scroll worked, but week navigation became unreliable and sometimes triggered tab switch

### Attempt 2: Manual activation for Pan gesture
- Used `.manualActivation(true)` with `onTouchesDown`/`onTouchesMove`
- Only activate Pan when truly at scroll edge
- **Result:** Scroll still broken, Pan gesture still interfered

### Attempt 3: Platform-specific gesture composition
- Android: Only pinch gesture (removed Pan entirely)
- iOS: Keep both pinch + edge swipe
- **Result:** Scroll STILL broken even without Pan gesture

### Attempt 4: RNGH ScrollView
- Replaced RN's ScrollView with `react-native-gesture-handler`'s ScrollView on Android
- Better native gesture coordination
- **Result:** Scroll worked! But zoom stopped working (two-finger captured as scroll)

### Attempt 5: RNGH ScrollView + isPinching check
- Keep RNGH ScrollView
- Re-add `scrollEnabled={!isPinching}` to disable scroll during pinch
- **Result:** Neither scroll nor zoom work reliably

### Root Cause Analysis

The fundamental issue: **On Android, GestureDetector + ScrollView don't coordinate well**, regardless of:
- Which ScrollView (RN vs RNGH)
- Which gestures are in the composition
- Whether we use state-based scroll disabling

iOS works because Apple's gesture system has built-in coordination. Android/RNGH lacks this.

---

## New Approach: Platform-Specific Gesture Systems (2026-01-20)

**Decision:** Keep iOS as-is, build separate gesture system for Android using PanResponder.

### Strategy

1. **iOS:** Keep RNGH GestureDetector wrapping ScrollView (works well)
2. **Android:** Remove GestureDetector, use PanResponder for pinch zoom

### Implementation Steps

#### Step 1: Platform-Conditional GestureDetector

Only wrap content in GestureDetector on iOS:

```typescript
const content = (
  <View style={styles.wrapper} onLayout={handleContainerLayout}>
    {/* ... existing content ... */}
  </View>
);

return Platform.OS === 'ios' ? (
  <GestureDetector gesture={composedGesture}>
    {content}
  </GestureDetector>
) : (
  content  // Android: no GestureDetector
);
```

#### Step 2: Android PanResponder for Pinch Zoom

Custom two-finger detection using PanResponder:

```typescript
const pinchBaseDistance = useRef<number | null>(null);
const pinchBaseScale = useRef<number>(1);

const androidPinchResponder = useRef(
  Platform.OS === 'android'
    ? PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt) => {
          return evt.nativeEvent.touches.length === 2;
        },
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            const distance = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
            pinchBaseDistance.current = distance;
            pinchBaseScale.current = currentScale;
            setIsPinching(true);
          }
        },
        onPanResponderMove: (evt) => {
          if (evt.nativeEvent.touches.length === 2 && pinchBaseDistance.current) {
            const [t1, t2] = evt.nativeEvent.touches;
            const distance = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
            const scale = (distance / pinchBaseDistance.current) * pinchBaseScale.current;
            const clampedScale = Math.min(1.5, Math.max(minZoom, scale));
            setCurrentScale(clampedScale);
          }
        },
        onPanResponderRelease: () => {
          pinchBaseDistance.current = null;
          setIsPinching(false);
        },
      })
    : null
).current;
```

#### Step 3: Week Navigation

- Use existing velocity-based detection in `handleHorizontalScrollEndDrag`
- Existing week nav buttons remain as backup
- No RNGH edge swipe needed on Android

---

## Expected Results

| Feature | iOS | Android |
|---------|-----|---------|
| Horizontal scroll | ✅ Native + RNGH | ✅ Native only |
| Vertical scroll | ✅ Native + RNGH | ✅ Native only |
| Pinch zoom | ✅ RNGH Gesture.Pinch | ✅ PanResponder |
| Week nav (buttons) | ✅ Existing | ✅ Existing |
| Week nav (flick) | ✅ Velocity + RNGH | ✅ Velocity only |
| Double-tap | ✅ onPress | ✅ onPress |
| Drag handles | ✅ PanResponder | ✅ PanResponder |

---

## Files to Modify

| File | Changes |
|------|---------|
| `mobile-app/src/modules/calendar/components/WeekView.tsx` | Platform-conditional GestureDetector, Android PanResponder |

---

## Final Implementation Summary

### What Changed in WeekView.tsx

1. **Platform-conditional GestureDetector wrapper**
   - iOS: Uses RNGH `<GestureDetector>` wrapping content
   - Android: No GestureDetector wrapper (avoids ScrollView conflicts)

2. **Android PanResponder for pinch zoom**
   - Custom two-finger detection via `androidPinchResponder`
   - Applied to `gridRow` View on Android only
   - Uses `lastAppliedScale.current` to avoid stale closure issues

3. **Separate week navigation handlers**
   - `handleHorizontalScrollEndDragIOS`: Original overscroll + bounce detection
   - `handleHorizontalScrollEndDragAndroid`: Velocity-based edge flick detection
   - `handleHorizontalScrollBeginDrag`: Tracks edge position at drag start (Android only)

---

## Testing Checklist

### Android (verified working)
- [x] Horizontal scroll smooth
- [x] Vertical scroll smooth
- [x] Pinch zoom in/out works
- [x] Week flick at edges works
- [x] Week buttons work

### iOS (verified no regression)
- [x] All existing functionality unchanged

---

## Verification Steps

1. Run on Android emulator: `npx expo start --android`
2. Navigate to Calendar tab
3. Test scroll in all directions
4. Test two-finger pinch zoom
5. Test week navigation (flick at edge + buttons)
6. Run on iOS simulator to verify no regression

---

## Completion Checklist

- [x] Implementation complete and tested
- [ ] Update `mobile-app/ARCHITECTURE.md` with Android gesture notes
- [ ] Update `docs/ANDROID_BUILD_PLAN.md` Known Issues section
- [ ] Archive this plan to `archive/ANDROID_GESTURE_FIX_PLAN.md`
- [ ] Brief mention in `CLAUDE.md` Recent Updates
