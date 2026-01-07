# Cluster D: Location Setup UX Improvements

**Created:** 2026-01-06
**Status:** Planning

---

## Issues to Address

| Issue | Original Feedback | Solution |
|-------|-------------------|----------|
| Location visibility in Status | "Im Status sollte es direkt einsehbar sein, wo Geofencing eingerichtet wird" | Clear CTA when no locations; tap existing location → navigate |
| Zoom button confusion | "+/- wird mit Größe des radius verwechselt" | Remove +/- zoom, pinch-only |
| Location setup flow | "Ortssuche wäre nice to have" + clunky pin-in-center UX | Search → Position → Name flow with Mapbox geocoding |

---

## Current State Analysis

### SetupScreen.tsx (Location Creation)
- Pin fixed at map center (line 269: `<Marker coordinate={region} draggable />` but region updates on pan)
- Name input shown alongside map (confusing order)
- `MapControls` shows +/- zoom buttons (confused with radius)
- Radius +/- buttons in bottom panel (correctly labeled but proximity to zoom causes confusion)

### StatusScreen.tsx (Main Dashboard)
- Empty state shows generic text (lines 292-298)
- No navigation link to location setup
- Existing locations show status but don't navigate to LocationsList

### MapControls.tsx
- Three buttons: +, −, 📍 (my location)
- +/- call `onZoomIn`/`onZoomOut` handlers

---

## Implementation Plan

### Part 1: Status Screen Location Link (Low effort)

**Goal:** Make it obvious how to set up or manage locations from Status screen.

**Changes to StatusScreen.tsx:**

1. **Empty state** (no locations): Replace generic text with tappable CTA
   ```
   "Set up your workplace"
   [📍 Add Location →]
   ```
   Tapping navigates to `Setup` screen.

2. **With locations**: Make the collapsed status line tappable
   - Tap location name → navigate to `LocationsList`
   - Keep check-in/out button functionality

**Files:** `StatusScreen.tsx`

---

### Part 2: Remove Zoom Buttons (Low effort)

**Goal:** Eliminate confusion between zoom and radius controls.

**Changes:**

1. **MapControls.tsx**: Remove +/− buttons, keep only 📍 (my location)
2. **SetupScreen.tsx**: Remove `onZoomIn`/`onZoomOut` handlers
3. **LocationsListScreen.tsx**: Remove `onZoomIn`/`onZoomOut` handlers

**Users can still:**
- Pinch-to-zoom (native gesture, always available)
- Tap 📍 to center on current location

**Files:** `MapControls.tsx`, `SetupScreen.tsx`, `LocationsListScreen.tsx`

---

### Part 3: New Location Setup Flow (Medium effort)

**Goal:** Intuitive flow: Search → Position → Name

#### New UX Flow

```
┌─────────────────────────────────────┐
│  Step 1: Find Your Workplace        │
│  ┌─────────────────────────────┐    │
│  │ 🔍 Search for address...    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │         [MAP]               │    │
│  │                             │    │
│  │     Tap to place pin        │    │
│  │         or search           │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                           [📍]      │
│                                     │
│  [ Continue → ]  (disabled until    │
│                   pin is placed)    │
└─────────────────────────────────────┘

         ↓ (after pin placed)

┌─────────────────────────────────────┐
│  Step 2: Confirm Position           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │    [MAP with draggable      │    │
│  │     pin + radius circle]    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Drag pin to fine-tune position     │
│                                     │
│  Radius: [−] 200m [+]               │
│                                     │
│  [ ← Back ]        [ Continue → ]   │
└─────────────────────────────────────┘

         ↓

┌─────────────────────────────────────┐
│  Step 3: Name This Location         │
│                                     │
│  [Mini map preview with pin]        │
│                                     │
│  Location name:                     │
│  ┌─────────────────────────────┐    │
│  │ e.g. "Charité Mitte"        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ ← Back ]        [ Save ✓ ]       │
└─────────────────────────────────────┘
```

#### Implementation Approach

**Option A: Multi-step wizard (new screens)**
- Create `SetupStep1Screen`, `SetupStep2Screen`, `SetupStep3Screen`
- Navigation stack manages back/forward
- Clean separation, but more files

**Option B: Single screen with steps (recommended)**
- Keep `SetupScreen.tsx` but add `step` state (1, 2, 3)
- Render different content based on step
- Simpler navigation, fewer files
- Can animate transitions between steps

**Recommendation:** Option B (single screen with steps)

#### Mapbox Integration

**Setup:**
1. Create Mapbox account (free tier: 100k requests/month)
2. Get access token
3. Store in `.env` as `MAPBOX_ACCESS_TOKEN`

**API Usage:**
```typescript
// Geocoding search (forward)
const searchLocation = async (query: string) => {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${MAPBOX_ACCESS_TOKEN}&` +
    `country=de&` +  // Limit to Germany
    `types=address,poi&` +
    `limit=5`
  );
  const data = await response.json();
  return data.features; // Array of results with coordinates
};
```

**Search UI:**
- Text input with debounced search (300ms)
- Results dropdown below search bar
- Tap result → center map + place pin
- Results include: name, address, coordinates

#### Pin Interaction Changes

**Current:** Pin at center, pan map underneath
**New:** Tap map to place pin, drag pin to adjust

```typescript
// MapView props
<MapView
  onPress={(e) => {
    // Place pin at tap location
    setPinCoordinate(e.nativeEvent.coordinate);
  }}
>
  {pinCoordinate && (
    <Marker
      coordinate={pinCoordinate}
      draggable
      onDragEnd={(e) => {
        setPinCoordinate(e.nativeEvent.coordinate);
      }}
    />
  )}
</MapView>
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `StatusScreen.tsx` | Modify | Add location CTA, make locations tappable |
| `MapControls.tsx` | Modify | Remove +/− buttons, keep 📍 only |
| `SetupScreen.tsx` | Major rewrite | 3-step wizard with search |
| `LocationsListScreen.tsx` | Modify | Remove zoom handler calls |
| `.env` | Add | `MAPBOX_ACCESS_TOKEN` |
| `en.ts` / `de.ts` | Add | New translation strings |

---

## New Translation Strings Needed

```typescript
// en.ts
setup: {
  // Step 1
  step1Title: 'Find Your Workplace',
  searchPlaceholder: 'Search for address...',
  tapToPlace: 'Tap map to place pin, or search above',
  continue: 'Continue',

  // Step 2
  step2Title: 'Confirm Position',
  dragToAdjust: 'Drag pin to fine-tune position',
  back: 'Back',

  // Step 3
  step3Title: 'Name This Location',
  locationNameLabel: 'Location name',
  locationNamePlaceholder: 'e.g. "Charité Mitte"',
  save: 'Save',

  // Search
  searchNoResults: 'No results found',
  searchError: 'Search failed. Try again.',
}

// Status screen
status: {
  setupWorkplace: 'Set up your workplace',
  addLocation: 'Add Location',
  manageLocations: 'Manage locations',
}
```

---

## Testing Checklist

### Part 1: Status Screen
- [ ] Empty state shows "Add Location →" CTA
- [ ] Tapping CTA navigates to Setup
- [ ] Existing locations are tappable
- [ ] Tapping location navigates to LocationsList
- [ ] Check-in/out buttons still work

### Part 2: Zoom Removal
- [ ] +/− buttons removed from MapControls
- [ ] 📍 button still works
- [ ] Pinch-to-zoom works on all map screens
- [ ] SetupScreen works without zoom handlers
- [ ] LocationsListScreen works without zoom handlers

### Part 3: New Setup Flow
- [ ] Step 1: Search bar appears
- [ ] Step 1: Search results show on typing
- [ ] Step 1: Selecting result places pin + centers map
- [ ] Step 1: Tap on map places pin
- [ ] Step 1: Continue disabled until pin placed
- [ ] Step 2: Pin is draggable
- [ ] Step 2: Radius +/− works
- [ ] Step 2: Circle updates with pin drag
- [ ] Step 3: Name input works
- [ ] Step 3: Save creates location + registers geofence
- [ ] Back navigation works at each step
- [ ] German translations work

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mapbox rate limits | Medium | Free tier is 100k/month; unlikely to hit |
| Search API latency | Low | Debounce input, show loading state |
| Marker drag UX on small screens | Medium | Test on iPhone SE; ensure touch targets large enough |
| Breaking existing locations | High | Don't touch database schema; only UI changes |

---

## Estimated Effort

| Part | Sessions | Notes |
|------|----------|-------|
| Part 1: Status screen link | 0.5 | Quick UI changes |
| Part 2: Remove zoom buttons | 0.5 | Simple deletion |
| Part 3: New setup flow | 2-3 | Major rewrite, Mapbox integration |
| **Total** | **3-4 sessions** | |

---

## Decisions Made (2026-01-06)

1. **Search scope**: Worldwide (no country filter) — simpler, works for border areas
2. **Fallback**: Yes, fall back to manual tap-to-place if Mapbox unavailable
3. **Step indicators**: Dots (● ○ ○) at top of each step
4. **Entry button label**: "Add Workplace" (clearer than generic "Add Location")
5. **Implementation approach**: Option B (single screen with steps)
