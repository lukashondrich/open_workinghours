# Issue Planning - 2026-02-05

**Created:** 2026-02-05
**Status:** Complete — archived 2026-02-09. Content integrated into `mobile-app/ARCHITECTURE.md` and `blueprint.md`.

---

## Overview

7 issues identified from UX expert feedback and internal review. Grouped by file dependencies to minimize merge conflicts and enable parallel work.

| Group | Name | Issues | Complexity | Status |
|-------|------|--------|------------|--------|
| A | Geofencing Module Screens | 1, 2, 5 | Low | ✅ Complete |
| B | Authentication - Lock Screen | 4 | Low-Med | ✅ Complete |
| C | Calendar - Picker Unification | 3, 6 | Med-High | ✅ Complete |

---

## Group A: Geofencing Module Screens

**Issues:** 1, 2, 5
**Estimated effort:** ~85 lines changed
**Dependencies:** None - can start immediately

### Issue 1: Location List - Tap to Select, Not Navigate

**Problem:** Tapping a location in the list immediately navigates to TrackingScreen. Map doesn't show the selected location first.

**Expected:** Tap to select → show on map → pencil icon to edit → then navigate to edit screen.

**Files:**
- `mobile-app/src/modules/geofencing/screens/LocationsListScreen.tsx`

**Changes (~30 lines):**
- Split `handleLocationTap` into `handleLocationSelect` (select + pan map) and keep edit for navigation
- Add edit icon/button to `renderLocationCard` for selected location
- Single tap → select + pan map
- Edit button → navigate to TrackingScreen or SetupScreen

---

### Issue 2: Data & Privacy - Consent Status Color + Links

**Problem:** Consent status shows "not accepted" in green. Color should correspond to actual state.

**Files:**
- `mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx`

**Changes (~15 lines):**
- Change hardcoded `styles.summaryValueSuccess` to conditional:
  ```tsx
  style={[
    styles.summaryValue,
    authState.user?.termsAcceptedVersion
      ? styles.summaryValueSuccess
      : styles.summaryValueWarning
  ]}
  ```
- Add `summaryValueWarning` style if not exists (use `colors.warning.main` or neutral)
- (Optional) Add TouchableOpacity to link to actual Terms/Privacy documents

---

### Issue 5: Dismissable Permission Warning with 1-Week Re-show

**Problem:** Background permission warning banner has no dismiss option. Should be closable and re-appear after ~1 week.

**Files:**
- `mobile-app/src/modules/geofencing/components/PermissionWarningBanner.tsx`
- `mobile-app/src/modules/geofencing/screens/StatusScreen.tsx`

**Changes (~40 lines):**

**PermissionWarningBanner.tsx:**
- Add `onDismiss` prop
- Add X button (top-right corner)
- Call `onDismiss` when X tapped

**StatusScreen.tsx:**
- Add state: `permissionWarningDismissedAt`
- On mount: Check AsyncStorage for dismiss timestamp
- If dismissed < 7 days ago → hide banner
- If dismissed >= 7 days ago or never → show banner
- `handleDismissWarning`: Save current timestamp to AsyncStorage

**Storage key:** `permission_warning_dismissed_at`

---

## Group B: Authentication - Lock Screen

**Issues:** 4
**Estimated effort:** ~210 lines
**Dependencies:** None - can start immediately
**Status:** ✅ Complete (2026-02-06)

### Issue 4: Lock Screen with Face ID + Passcode Options

**Problem:** UX expert only sees Face ID option, no visible passcode alternative. Pattern A (like N26, Revolut) requested.

**Design:**
```
┌─────────────────────────────┐
│                             │
│      Open Working Hours     │
│           [Logo]            │
│                             │
│        [Face ID Icon]       │
│                             │
│   [ Unlock with Face ID ]   │  ← Primary button
│                             │
│    "Use device passcode"    │  ← Secondary link
│                             │
│     "Sign in with email"    │  ← Tertiary link
│                             │
└─────────────────────────────┘
```

**Files:**
- `mobile-app/src/modules/auth/screens/LockScreen.tsx` (new)
- `mobile-app/src/lib/auth/auth-context.tsx`
- `mobile-app/src/lib/auth/BiometricService.ts`
- `mobile-app/src/navigation/AppNavigator.tsx`

**Changes:**

**LockScreen.tsx (new, ~150 lines):**
- App logo/branding
- "Unlock with Face ID" button → `BiometricService.authenticate()`
- "Use device passcode" link → `BiometricService.authenticateWithPasscodeOnly()`
- "Sign in with email" link → navigate to LoginScreen
- On success → call auth context to set authenticated

**auth-context.tsx (~30 lines):**
- Add `'locked'` to AuthState status type
- When app launches with saved token + biometric enabled → status = `'locked'`
- Add `unlock()` function to set status from 'locked' to 'authenticated'

**BiometricService.ts (~20 lines):**
- Add `authenticateWithPasscodeOnly()` method:
  ```tsx
  static async authenticateWithPasscodeOnly(reason?: string): Promise<boolean> {
    return LocalAuthentication.authenticateAsync({
      promptMessage: reason || 'Enter passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
      // This triggers passcode directly on iOS
    });
  }
  ```

**AppNavigator.tsx (~10 lines):**
- Add LockScreen to navigation
- Show LockScreen when `authState.status === 'locked'`

---

## Group C: Calendar - Picker Unification (REVISED)

**Issues:** 3, 6
**Estimated effort:** ~200 lines net (refactor, not removal)
**Dependencies:** Complete before Group D (shared files)
**Status:** ✅ Implementation complete — needs rebuild and testing

### Summary

**User testing feedback:** The inline picker (centered modal) is more intuitive than the slide-up TemplatePanel. Revising approach to unify on inline picker instead.

**Before:** Two UIs — TemplatePanel (FAB) and inline picker (long-press in WeekView)
**After:** Single unified inline picker, accessible from FAB, WeekView (tap/long-press), and MonthView (tap)

---

### Design Decisions (Revised)

| Topic | Decision |
|-------|----------|
| Unified UI | Inline picker (centered modal), not TemplatePanel |
| WeekView short-tap | Opens inline picker with target day |
| WeekView long-tap | Opens inline picker with target day |
| MonthView tap day | Opens inline picker with target day |
| FAB tap | Opens inline picker without target (arming mode) |
| Modal style | Centered modal (user preferred) |
| Target day indicator | Focus ring on day header |
| Template rows | Add pen/edit icon for editing |
| GPS tab | Keep in inline picker (already existed) |
| With target date | Select template → places immediately → closes |
| Without target date | Select template → arms it → close → double-tap to place |

---

### Architecture Change

**Lift inline picker to CalendarScreen** for shared access:

```
CalendarScreen.tsx
├── CalendarHeader
├── WeekView / MonthView (conditional)
├── CalendarFAB
└── InlinePicker (overlay, shared)  ← NEW: extracted component
```

This allows all entry points (WeekView, MonthView, FAB) to open the same picker.

---

### Implementation Phases

```
Phase 1: Extract & Refactor
├── Task 1.1: Create InlinePicker.tsx (extract from git history of WeekView)
├── Task 1.2: Add props for targetDate, onClose, mode
└── Task 1.3: Add to CalendarScreen as overlay

Phase 2: Entry Points
├── Task 2.1: WeekView — short-tap and long-tap dispatch OPEN_INLINE_PICKER
├── Task 2.2: MonthView — tap day dispatches OPEN_INLINE_PICKER
└── Task 2.3: CalendarFAB — tap opens inline picker (no target)

Phase 3: Enhancements
├── Task 3.1: Add focus ring to target day header
├── Task 3.2: Add pen/edit icon to template rows
└── Task 3.3: Verify GPS tab works

Phase 4: Cleanup
├── Task 4.1: Remove direct placement code from TemplatePanel
├── Task 4.2: Simplify or remove TemplatePanel if no longer needed
└── Task 4.3: Clean up unused state/actions
```

---

### Files to Change

| File | Changes |
|------|---------|
| `InlinePicker.tsx` | **NEW** — extracted from old WeekView code |
| `CalendarScreen.tsx` | Render InlinePicker overlay, handle state |
| `WeekView.tsx` | Short-tap + long-tap dispatch open action |
| `MonthView.tsx` | Tap day dispatches open action |
| `CalendarFAB.tsx` | Open inline picker instead of TemplatePanel |
| `types.ts` | Add `inlinePickerOpen`, `inlinePickerTargetDate` state |
| `calendar-reducer.ts` | Handle OPEN_INLINE_PICKER, CLOSE_INLINE_PICKER |
| `TemplatePanel.tsx` | Remove GPS tab, direct placement (cleanup) |

---

### Reverting Previous Changes

We implemented the opposite direction (TemplatePanel-based). Need to:

1. **Restore inline picker code** from git history (`git show HEAD~N:path/to/WeekView.tsx`)
2. **Keep learnings:**
   - Target date concept
   - Focus ring indicator
   - Direct placement behavior
3. **Remove/simplify:**
   - TemplatePanel GPS tab
   - TemplatePanel direct placement mode
   - `templatePanelTargetDate` state (replace with `inlinePickerTargetDate`)

---

### Edge Cases (from previous implementation)

| Scenario | Behavior |
|----------|----------|
| Tap on locked/confirmed day | Block — picker doesn't open |
| Picker open, switch to Month view | Close picker, clear target date |
| FAB opens picker, user taps day | Could set target date (or ignore) |
| Existing armed template + open picker | Disarm first, then open |
| GPS tab with target date | Pre-fill ManualSessionForm date |
| Target day scrolled out of view | Auto-scroll to show it |

---

### Comparison: Previous vs Revised

| Aspect | Previous (TemplatePanel) | Revised (Inline Picker) |
|--------|-------------------------|------------------------|
| UI style | Slide-up panel | Centered modal |
| Entry from FAB | ✓ | ✓ |
| Entry from WeekView | Long-press only | Short-tap + long-press |
| Entry from MonthView | ✗ | ✓ |
| GPS tab | Added to TemplatePanel | Already in inline picker |
| User preference | — | ✓ Preferred in testing |

---

### Implementation Status (2026-02-09)

**✅ Implementation complete and manually tested**

#### Files Created
- `mobile-app/src/modules/calendar/components/InlinePicker.tsx` — New standalone component

#### Files Modified
| File | Changes |
|------|---------|
| `types.ts` | Added `inlinePickerOpen`, `inlinePickerTargetDate`, `inlinePickerTab` state; added actions |
| `calendar-reducer.ts` | Added `OPEN_INLINE_PICKER`, `CLOSE_INLINE_PICKER`, `SET_INLINE_PICKER_TAB` handlers |
| `CalendarScreen.tsx` | Renders InlinePicker overlay |
| `WeekView.tsx` | Removed old inline picker code, tap/long-tap dispatch `OPEN_INLINE_PICKER`, added focus ring, single-tap blocked when armed |
| `MonthView.tsx` | Single tap → navigate to WeekView, long press → open picker, double-tap → place armed shift, batch indicator |
| `CalendarFAB.tsx` | Shifts/Absences open inline picker (arming mode), hides when picker open |
| `en.ts`, `de.ts` | Added `calendar.picker.addTo`, `calendar.templates.createAndArm`, `calendar.absences.createAndArm` |

#### Features Implemented
- ✅ Unified inline picker (centered modal)
- ✅ Three tabs: Shifts, Absences, GPS
- ✅ Direct placement mode (with targetDate)
- ✅ Arming mode (without targetDate, from FAB)
- ✅ Focus ring on target day (WeekView + MonthView)
- ✅ Edit icon (Pencil) on LEFT side of template rows
- ✅ Inline edit form (no bottom sheet) with name, time, duration, color, break duration
- ✅ Target date indicator in header
- ✅ Blocked on locked/confirmed days
- ✅ Tab sync fix (FAB → Absences opens Absences tab correctly)
- ✅ 28 testIDs added for E2E compatibility
- ✅ MonthView: single tap → WeekView, long press → picker, double-tap → place armed shift
- ✅ MonthView: batch indicator (same as WeekView) shows when template armed
- ✅ Single-tap blocking when armed (both views) to allow double-tap detection

#### MonthView Interaction Summary
| Action | Not Armed | Armed |
|--------|-----------|-------|
| Single tap | Navigate to WeekView | Delayed navigate to WeekView (allows double-tap) |
| Double tap | Navigate to WeekView | Place armed shift/absence |
| Long press | Open InlinePicker | Open InlinePicker |

#### WeekView Interaction Summary (when armed)
| Action | Behavior |
|--------|----------|
| Single tap | Blocked (does nothing) |
| Double tap | Place armed shift/absence |
| Long press | Open InlinePicker |

#### Visual Polish (2026-02-09)

Two visual refinements applied after Group C implementation:

**1. CalendarHeader — Week title overflow**
- **Problem:** Week range title + week badge (e.g. "Apr. 20 - Apr. 26 W17") pushed Woche/Monat toggle off-screen
- **Root cause:** No flex constraints on title side; title text grew unbounded
- **Fix (CalendarHeader.tsx):**
  - `flex: 1` + `marginRight` on title container
  - `flex: 1, flexShrink: 1` on title Text
  - `adjustsFontSizeToFit` with `minimumFontScale={0.8}` — scales font instead of truncating
  - Same-month week ranges shortened: "Apr. 20 - 26" instead of "Apr. 20 - Apr. 26"

**2. MonthView — Armed banner layout shift + footer compaction**
- **Problem:** Batch indicator banner appearing/disappearing caused month grid to shift vertically
- **Root cause (banner):** Views rendered as siblings OUTSIDE `Animated.View` were invisible on Android. Additionally, hot reload was not applying changes to MonthView on Android — a fresh debug build (`expo run:android`) was required.
- **Root cause (layout shift):** Banner in normal document flow caused `flex: 1` grid to resize
- **Fix (MonthView.tsx):**
  - Compacted summary footer: `summaryValue` font `lg` → `md`, divider height 40 → 28px, reduced padding
  - Banner rendered INSIDE `Animated.View` (after the grid) in a fixed-height slot (`height: 44, marginBottom: 8`) — always present to prevent layout shift, content shown only when armed
- **Status:** ✅ Both platforms working

**3. Android tab bar overlapped by system navigation buttons**
- **Problem:** Android 15+ enforces edge-to-edge rendering — app draws behind system nav bar, tab bar labels partially covered by back/home/recent buttons
- **Root cause:** `edgeToEdgeEnabled` in `app.json` is irrelevant on Android 15+ (enforced by OS). Neither `react-native-safe-area-context` insets nor `Dimensions` screen/window difference reliably reported the nav bar height in this configuration.
- **Fix (AppNavigator.tsx):** Wrapped `Tab.Navigator` in a `View` with `paddingBottom: Math.max(insets.bottom, 48)` on Android + matching background color. Uses safe area insets when available, falls back to 48dp (3-button nav height).
- **Status:** ✅ Android working, iOS unaffected

**Investigation log (banner — 2026-02-09):**

| Attempt | Approach | Result |
|---------|----------|--------|
| 1-7 | Various flow/absolute approaches (see git history) | All invisible on Android — stale hot reload was the root cause |
| 8 | Normal flow slot between grid and footer | Android: still invisible (hot reload stale) |
| 9 | **Slot INSIDE `Animated.View`** + fresh `expo run:android` debug build | ✅ Both platforms working |

**Key learnings:**
- Android hot reload can silently fail for some components — code executes (console.log fires) but visual changes don't apply. Always verify with a fresh build.
- On Android, sibling Views after an `Animated.View` with `flex: 1` may not render. Place dynamic content inside the `Animated.View`.
- Android 15+ enforces edge-to-edge regardless of app config. Must handle nav bar insets in app code.

**Files in current state:**
- `MonthView.tsx`: Banner inside `Animated.View` with fixed-height slot. Footer compaction done. Both platforms verified.
- `CalendarHeader.tsx`: Title overflow fix complete and verified on both platforms.
- `AppNavigator.tsx`: Android tab bar padding via wrapper View.

---

#### E2E Test Status
- iOS: 35/48 (testIDs added, but E2E tests need updating for new UI flow)
- Android: 30/48 (same issue)
- **Note:** E2E tests were written for TemplatePanel flow; need updating to match InlinePicker flow

#### Manual Testing Completed
- ✅ FAB → Shifts/Absences/Log Hours
- ✅ WeekView tap/long-press
- ✅ MonthView single tap, double-tap, long-press
- ✅ Batch indicator in both views
- ✅ Edit button on left + inline edit form
- ✅ Color picker and break duration in edit form
- ✅ Template create flow
- ✅ Absence create flow

---

### Design Decisions

| Topic | Decision |
|-------|----------|
| Single-tap when armed (Issue 3) | Ignore on empty space (only double-tap places); taps on existing items still work for editing |
| GPS tab | Add as third tab in TemplatePanel |
| Direct placement behavior | One-and-done: place → close panel → not armed |
| Target day indicator | Focus ring on day header (iOS/Android native focus style) |
| Target date cleared when | Panel closes (any reason), or panel opened via FAB |
| Armed + long-press interaction | Disarm first, then open with target date (separate workflows) |
| Conflicts (shift + absence) | Allow — absences cancel out shifts in time calculations |
| Locked/confirmed days | Block long-press entirely (no panel opens) |
| Past days | Allow long-press if not locked/confirmed |
| GPS tab date | Pre-fill ManualSessionForm with target date, but allow editing |
| View switch to Month | Clear target date |
| Auto-scroll | Scroll WeekView to show target day column when panel opens |
| Accessibility | Focus ring with sufficient contrast; screen reader announces target date |

---

### Issue 3: Disable Single-Tap When Shift Armed

**Problem:** When a shift template is armed, single-tap still opens time picker menu. Should only allow double-tap to place.

**Solution:** Resolved as part of Issue 6. When inline picker is removed:
- Single-tap on empty space when armed → ignored
- Single-tap on existing shift/absence/tracking → still opens edit (unchanged)
- Double-tap when armed → places shift (unchanged)

---

### Issue 6: Unify Picker UIs + Add GPS/Log Hours Tab

**Problem:** Two different picker UIs with duplicated code (~300 lines in WeekView).

**Goal:**
- Remove inline picker from WeekView
- Long-press opens TemplatePanel with target date
- Add "Log Hours" tab to TemplatePanel
- Support direct placement mode (place immediately when template selected with target date)

---

### Files to Change

| File | Changes |
|------|---------|
| `types.ts` | Add `templatePanelTargetDate: string \| null`, add `'gps'` to tab union, add `OPEN_TEMPLATE_PANEL_FOR_DATE` action |
| `calendar-reducer.ts` | Handle new action, clear target date on close, place-and-close logic |
| `TemplatePanel.tsx` | Add GPS tab, direct placement mode, auto-close after placing with target date |
| `WeekView.tsx` | Remove inline picker (~300 lines), update long-press handler, add focus ring styling, block long-press on locked days, auto-scroll to target day |
| `CalendarFAB.tsx` | "Log Hours" opens TemplatePanel with GPS tab |
| `translations` | Verify GPS tab i18n strings exist |

---

### Implementation Phases

```
Phase 1: Foundation (Sequential)
├── Task 1.1: types.ts - Add state fields and action types
└── Task 1.2: calendar-reducer.ts - Handle new actions

Phase 2: UI Components (Can parallelize after Phase 1)
├── Task 2.1: TemplatePanel.tsx - GPS tab + direct placement
└── Task 2.2: WeekView.tsx - Remove picker + add focus ring

Phase 3: Integration (Sequential)
├── Task 3.1: CalendarFAB.tsx - Wire up GPS tab
├── Task 3.2: Translations - Verify i18n
└── Task 3.3: Manual testing of all flows
```

---

### Detailed Changes

**types.ts:**
```tsx
// Add to CalendarState:
templatePanelTargetDate: string | null  // YYYY-MM-DD when opened via long-press

// Update tab type:
templatePanelTab: 'shifts' | 'absences' | 'gps'

// Add action:
| { type: "OPEN_TEMPLATE_PANEL_FOR_DATE"; date: string; tab?: 'shifts' | 'absences' | 'gps' }
```

**calendar-reducer.ts:**
```tsx
case 'OPEN_TEMPLATE_PANEL_FOR_DATE':
  return {
    ...state,
    templatePanelOpen: true,
    templatePanelTargetDate: action.date,
    templatePanelTab: action.tab || 'shifts',
    // Disarm any armed template (separate workflow)
    armedTemplateId: null,
    armedAbsenceTemplateId: null,
  };

case 'TOGGLE_TEMPLATE_PANEL':
  return {
    ...state,
    templatePanelOpen: !state.templatePanelOpen,
    // Clear target date when closing
    templatePanelTargetDate: state.templatePanelOpen ? null : state.templatePanelTargetDate,
  };
```

**TemplatePanel.tsx:**
- Add GPS tab with button to open ManualSessionForm (pre-filled with target date)
- When template selected AND `state.templatePanelTargetDate` is set:
  - Dispatch `PLACE_SHIFT` with target date
  - Dispatch `TOGGLE_TEMPLATE_PANEL` to close
  - Do NOT arm the template

**WeekView.tsx:**
- Remove: `showTemplatePicker`, `pickerTab`, `pendingPlacementDate`, `showCreateForm`, `createFormData`, `showCreateAbsenceForm`, `createAbsenceFormData`
- Remove: `handleTemplateSelected`, `handleAbsenceTemplateSelected`, `handleCreateAndPlace`, `handleCreateAbsenceAndPlace`, `dismissTemplatePicker`, `openCreateForm`, `openCreateAbsenceForm`
- Remove: Inline picker JSX (lines ~2325-2620)
- Remove: Picker-related styles
- Update `handleHourLongPress`:
  ```tsx
  // Check if day is locked
  const dateKey = formatDateKey(date);
  const dayStatus = state.confirmedDayStatus[dateKey];
  if (dayStatus?.status === 'locked') return; // Block long-press

  dispatch({ type: 'OPEN_TEMPLATE_PANEL_FOR_DATE', date: dateKey });
  ```
- Add focus ring to day header when `state.templatePanelTargetDate` matches
- Auto-scroll to target day column when panel opens
- When armed, ignore single-tap on empty space (keep existing item tap handlers)

**CalendarFAB.tsx:**
```tsx
const handleLogHoursPress = () => {
  setMenuVisible(false);
  dispatch({ type: 'SET_TEMPLATE_PANEL_TAB', tab: 'gps' });
  dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
};
```

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Long-press on locked day | No-op (panel doesn't open) |
| FAB opened while target date set | Target date cleared (FAB = arming mode) |
| Panel closed without selection | Target date cleared |
| Switch to Month view with target date | Target date cleared |
| Target day scrolled out of view | Auto-scroll to show it |
| Armed template + long-press | Disarm first, then open with target date |
| GPS tab with target date | ManualSessionForm pre-filled with date (editable) |
| Single-tap on empty when armed | Ignored |
| Single-tap on existing item when armed | Opens edit (unchanged) |

---

## Implementation Order

```
┌─────────────────┐     ┌─────────────────┐
│    Group A      │     │    Group B      │
│   Geofencing    │     │  Auth/Lock      │
│  Issues 1,2,5   │     │    Issue 4      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  (parallel)           │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│              Group C                     │
│      Calendar - Picker Unification       │
│            Issues 3, 6                   │
└─────────────────────────────────────────┘
```

---

## Summary

| Group | Issues | Files | Est. Lines | Status |
|-------|--------|-------|------------|--------|
| A | 1, 2, 5 | 4 | ~85 | ✅ Complete |
| B | 4 | 4 | ~210 | ✅ Complete (2026-02-06) |
| C | 3, 6 | 5 | ~500 (new) | ✅ Complete (2026-02-09) |

**All groups complete.** Content integrated into `mobile-app/ARCHITECTURE.md` and `blueprint.md`.
