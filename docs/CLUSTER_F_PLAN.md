# Cluster F: UX Polish - Implementation Plan

**Date:** 2026-01-07
**Status:** ✅ Complete
**Source:** User testing feedback (post-Cluster C/E)

---

## Overview

This cluster addressed UX polish issues discovered during testing of the Cluster C/E implementations, plus additional improvements identified during implementation.

| # | Issue | Status |
|---|-------|--------|
| F1 | Status location tap → TrackingScreen | ✅ Done |
| F2a | Whitespace above map in SetupScreen | ✅ Done |
| F2b | Keyboard avoiding in location naming | ✅ Done |
| F3 | Absence overlay transparency | ✅ Done |
| F4 | Photon geocoding + healthcare prioritization | ✅ Done |
| F5 | Double-tap for shift insertion | ✅ Done |
| F6 | Step indicator with labels | ✅ Done |
| F7 | Work Locations screen layout (inverted) | ✅ Done |

---

## Completed Implementations

### F1: Status Location Tap → TrackingScreen

**Problem:** Tapping a location on Status screen navigated to Work Locations overview instead of the specific location.

**Solution:** Navigate directly to TrackingScreen with the location ID.

**Files changed:**
- `StatusScreen.tsx` - `handleLocationPress()` now navigates to Tracking
- `AppNavigator.tsx` - Added `viewOnly` param to Setup route (kept for future use)

---

### F2a: Whitespace Above Map

**Problem:** Too much whitespace between native header and step indicator in SetupScreen.

**Solution:** Reduced headerBar padding since native header handles safe area.

**Files changed:**
- `SetupScreen.tsx` - `headerBar.paddingTop` reduced to `spacing.sm`

---

### F2b: Keyboard Avoiding in Location Naming

**Problem:** Keyboard squashed the "Name Location" step, hiding input and Save button.

**Solution:** Mini-map animates from 200px to 100px when keyboard appears.

**Implementation:**
- Added keyboard visibility tracking with `Keyboard.addListener`
- Animated mini-map height using `Animated.Value`
- Reduced `keyboardVerticalOffset` to 100

**Files changed:**
- `SetupScreen.tsx` - Added keyboard tracking, animated mini-map

---

### F3: Absence Overlay Transparency

**Problem:** Absences fully obscured shifts underneath.

**Solution:** Absences render at 50% opacity, shifts underneath remain visible.

**Implementation:**
- Added `hexToRgba()` helper function
- Absence background: `hexToRgba(absence.color, 0.5)`
- Shift dimming reduced from 0.4 to 0.85 opacity

**Files changed:**
- `WeekView.tsx` - `hexToRgba()`, AbsenceCard styling, reduced shift dimming

---

### F4: Photon Geocoding with Healthcare Prioritization

**Problem:** Mapbox couldn't find hospitals reliably.

**Solution:** Replaced Mapbox with Photon (free, OSM-based, GDPR-friendly).

**Implementation:**
- Photon API: `https://photon.komoot.io/api/`
- German language default (`lang=de`)
- Proximity bias (`location_bias_scale=0.6`)
- Healthcare results sorted to top (hospital, clinic, doctors, pharmacy, etc.)

**Files changed:**
- `GeocodingService.ts` - Complete rewrite for Photon API

---

### F5: Double-Tap for Shift Insertion

**Problem:** Single tap placed shifts accidentally; double-tap zoom reset conflicted.

**Solution:**
- Removed double-tap zoom reset (pinch is sufficient)
- Single tap: clears selection only
- Double-tap: places armed shift/absence

**Implementation:**
- Added `lastTapRef` for double-tap detection
- 300ms double-tap delay
- Haptic feedback on placement

**Files changed:**
- `WeekView.tsx` - Removed doubleTapGesture, modified handleHourPress

---

### F6: Step Indicator with Labels

**Problem:** Three dots alone didn't communicate which step user was on.

**Solution:** Added "Step X of 3" and step name above dots.

**Layout:**
```
      Step 1 of 3
   Find Your Workplace
        ●  ○  ○
```

**Files changed:**
- `SetupScreen.tsx` - Updated `StepIndicator` component
- `en.ts` / `de.ts` - Added `stepOf` translation

---

### F7: Work Locations Screen Layout (Inverted)

**Problem:** Map dominated the screen, locations squashed at bottom.

**Solution:** Inverted layout - small map preview at top, location list as main content.

**Layout:**
```
┌──────────────────────────┐
│     Map Preview (200px)  │
╭──────────────────────────╮
│  Work Locations (2/5)    │
│  ────────────────────    │
│  📍 Hospital One         │
│  📍 Clinic Two           │
│  [+ Add New Location]    │
╰──────────────────────────╯
```

**Files changed:**
- `LocationsListScreen.tsx` - Inverted layout, removed collapse/expand

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `SetupScreen.tsx` | F2a (whitespace), F2b (keyboard), F6 (step indicator) |
| `StatusScreen.tsx` | F1 (navigation to TrackingScreen) |
| `AppNavigator.tsx` | F1 (viewOnly param), navigation config |
| `WeekView.tsx` | F3 (absence opacity), F5 (double-tap gesture) |
| `GeocodingService.ts` | F4 (Photon API, healthcare sorting) |
| `LocationsListScreen.tsx` | F7 (inverted layout) |
| `en.ts` | F6 (stepOf translation), navigation.back |
| `de.ts` | F6 (stepOf translation), navigation.back |

---

## Testing Checklist

- [x] Location tap on Status → TrackingScreen
- [x] SetupScreen whitespace reduced
- [x] Keyboard shrinks mini-map in Step 3
- [x] Absences semi-transparent, shifts visible
- [x] Photon search finds hospitals
- [x] Double-tap places shifts, single tap clears selection
- [x] Step indicator shows "Step X of 3" + name
- [x] Work Locations has smaller map, prominent list

---

## Notes

- All changes are mobile-app only (no backend changes)
- Photon requires no API key (free, always available)
- Build number should be incremented for TestFlight
