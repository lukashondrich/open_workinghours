# Accessibility Improvement Plan

**Created:** 2026-01-24
**Updated:** 2026-01-25
**Status:** In Progress - Phase 1-2 partially complete, Maestro compatibility investigated
**Goal:** Fix accessibility issues to improve both VoiceOver usability AND E2E test reliability

---

## Executive Summary

Accessibility and testability share the same foundation: the iOS/Android accessibility tree. Fixing accessibility issues will:
1. Make the app usable for people with disabilities (VoiceOver/TalkBack users)
2. Eliminate the need for fragile coordinate-based E2E tests
3. Allow testID-based element selection throughout the app
4. Enable automated accessibility verification via MCP tools

---

## Issues by Priority

### 🔴 CRITICAL (Blocking VoiceOver + Tests)

#### 1. HoursSummaryWidget - Breaks Accessibility Tree
**File:** `src/modules/geofencing/components/HoursSummaryWidget.tsx`
**Lines:** 82-227

**Problem:** The animated bar chart causes `kAXErrorInvalidUIElement` when iOS tries to inspect the accessibility tree. This crashes Maestro and likely breaks VoiceOver.

**Root cause:** `Animated.View` components with dynamic styles inside a complex nested structure.

**Fix approach:**
```tsx
// Wrap the entire chart in an accessible container with a summary
<View
  accessible={true}
  accessibilityRole="summary"
  accessibilityLabel={`Last 14 days: ${totalTracked} hours tracked, ${totalPlanned} hours planned, ${overtime >= 0 ? '+' : ''}${overtime} overtime`}
>
  {/* Existing chart code - mark as not individually accessible */}
  <View accessible={false}>
    {/* Bars render here */}
  </View>
</View>
```

**Why this works:**
- `accessible={true}` on parent makes it ONE element for VoiceOver (no tree inspection of children)
- `accessibilityLabel` provides meaningful summary for screen reader users
- `accessible={false}` on chart container prevents iOS from trying to enumerate broken elements
- Maestro can find the parent by accessibilityLabel

**Effort:** Medium (2-3 hours)
**Impact:** Fixes Status screen E2E tests + VoiceOver

---

#### 2. TemplatePanel - Edit Form Hidden from Accessibility
**File:** `src/modules/calendar/components/TemplatePanel.tsx`
**Line:** 324

**Problem:** We added `accessible={false}` to fix E2E tests, but this hides the entire edit form from VoiceOver users.

**Current code:**
```tsx
<View key={template.id} style={styles.editCard} testID={`template-edit-${template.id}`} accessible={false}>
```

**Fix approach:** Remove `accessible={false}` and instead fix the child elements:
```tsx
<View
  key={template.id}
  style={styles.editCard}
  testID={`template-edit-${template.id}`}
  accessibilityRole="form"
  accessibilityLabel={t('calendar.templates.editFormLabel')}
>
  {/* Each input needs proper accessibility */}
  <TextInput
    accessibilityLabel={t('calendar.templates.nameLabel')}
    testID="template-name-input"
    ...
  />

  {/* Save button */}
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={t('common.save')}
    testID="template-save"
    ...
  >
```

**Effort:** Low (1 hour)
**Impact:** Enables VoiceOver form editing + E2E testID matching

---

### 🟠 HIGH (Significantly Impairs Usability/Testing)

#### 3. CalendarHeader Navigation Arrows - No Accessibility Labels
**File:** `src/modules/calendar/components/CalendarHeader.tsx`
**Lines:** 95-100

**Problem:** Week/month navigation arrows are just icons with no accessibility labels. VoiceOver users can't navigate weeks.

**Current code:**
```tsx
<TouchableOpacity style={styles.navButton} onPress={handlePrev}>
  <ChevronLeft size={20} color={colors.text.primary} />
</TouchableOpacity>
```

**Fix approach:**
```tsx
<TouchableOpacity
  style={styles.navButton}
  onPress={handlePrev}
  accessibilityRole="button"
  accessibilityLabel={state.view === 'week'
    ? t('calendar.header.previousWeek')
    : t('calendar.header.previousMonth')}
  testID="calendar-prev"
>
  <ChevronLeft size={20} color={colors.text.primary} />
</TouchableOpacity>
```

**Effort:** Low (30 min)
**Impact:** VoiceOver users can navigate calendar + E2E tests can use testID

---

#### 4. CalendarFAB - Inconsistent Element Detection
**File:** `src/modules/calendar/components/CalendarFAB.tsx`
**Lines:** 72-98 (menu options)

**Problem:** FAB menu items have testIDs but aren't consistently found by accessibility queries. The menu appears/disappears with animation which may cause timing issues.

**Fix approach:**
```tsx
{isOpen && (
  <View
    style={styles.menu}
    accessibilityViewIsModal={true}  // iOS: focuses accessibility on this menu
    accessibilityRole="menu"
  >
    <TouchableOpacity
      testID="fab-absences-option"
      accessibilityRole="menuitem"
      accessibilityLabel={t('calendar.fab.absences')}
      ...
    >
```

**Effort:** Low (1 hour)
**Impact:** Reliable FAB menu testing + proper VoiceOver menu navigation

---

#### 5. WeekView - Missing Accessibility on Interactive Elements
**File:** `src/modules/calendar/components/WeekView.tsx`

**Problem:** WeekView (1000+ lines) has only 3 testIDs. Shift blocks, tracking records, and controls lack accessibility labels.

**Missing accessibility on:**
- Shift template blocks (visual but not described)
- Tracking record badges (active sessions, breaks)
- Confirm day buttons (have testID but no label)
- Break panel controls

**Fix approach:** Add accessibilityLabel to key interactive elements:
```tsx
// Shift block
<View
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`${shift.name}, ${shift.startTime} to ${shift.endTime}`}
  testID={`shift-${shift.id}`}
>

// Tracking badge
<View
  accessible={true}
  accessibilityLabel={`Tracked session, ${formatDuration(record.duration)}, ${record.isActive ? 'active' : 'completed'}`}
  testID={`tracking-${record.id}`}
>
```

**Effort:** Medium (2-3 hours)
**Impact:** VoiceOver users can understand calendar content + E2E can target elements

---

#### 6. MonthView Day Cells - No Accessibility Descriptions
**File:** `src/modules/calendar/components/MonthView.tsx`
**Lines:** 32-98 (DayCell component)

**Problem:** Day cells show visual indicators (vacation icon, sick icon, confirmation checkmark, overtime text) but screen readers don't describe them.

**Fix approach:**
```tsx
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={buildDayLabel(day)}
  accessibilityHint="Double tap to view day details"
  ...
>

// Helper function
const buildDayLabel = (day: DayData): string => {
  const parts = [`${format(day.date, 'EEEE, MMMM d')}`];
  if (day.isVacation) parts.push('Vacation');
  if (day.isSick) parts.push('Sick day');
  if (day.overtime) parts.push(`${day.overtime} overtime`);
  if (day.isConfirmed) parts.push('Confirmed');
  return parts.join(', ');
};
```

**Effort:** Medium (2 hours)
**Impact:** VoiceOver users understand calendar state

---

#### 7. Add testIDs to Location Components
**Files:**
- `src/modules/geofencing/screens/StatusScreen.tsx`
- `src/modules/geofencing/screens/SetupScreen.tsx`

**Problem:** Location list items and map controls lack testIDs, limiting E2E test coverage.

**Fix approach:**
```tsx
// StatusScreen - location cards
<TouchableOpacity
  testID={`location-card-${index}`}
  accessibilityLabel={`${location.name}, ${location.isActive ? 'active' : 'inactive'}`}
  ...
>

// SetupScreen - map controls (if any custom controls exist)
<TouchableOpacity
  testID="map-center-button"
  accessibilityLabel="Center map on location"
  ...
>
```

**Effort:** Low (1 hour)
**Impact:** Enables location-related E2E tests

---

### 🟡 MEDIUM (Improves Experience)

#### 8. NextShiftWidget - No Accessibility Summary
**File:** `src/modules/geofencing/components/NextShiftWidget.tsx`
**Lines:** 30-75

**Problem:** Widget shows next shift info visually but has no accessibility summary.

**Fix approach:**
```tsx
<View
  accessible={true}
  accessibilityRole="summary"
  accessibilityLabel={
    nextShift
      ? `Next shift: ${nextShift.name} on ${format(nextShift.date, 'EEEE')} at ${nextShift.startTime}`
      : t('status.noUpcomingShifts')
  }
>
```

**Effort:** Low (30 min)
**Impact:** VoiceOver users know their next shift

---

#### 9. Platform-Specific Accessibility Props
**Files:** Multiple (modals, bottom sheets, live status components)

**Problem:** iOS and Android have different accessibility APIs. Current code doesn't account for platform differences.

**Key differences:**

| Prop | iOS | Android |
|------|-----|---------|
| `accessibilityViewIsModal` | ✅ Works | ❌ No effect |
| `accessibilityLiveRegion` | ❌ No effect | ✅ Works |
| `importantForAccessibility` | ❌ No effect | ✅ Works |

**Fix approach:** Platform-specific handling:
```tsx
// For modals/bottom sheets - focus trapping
<View
  accessibilityViewIsModal={Platform.OS === 'ios'}
  importantForAccessibility={Platform.OS === 'android' ? 'yes' : undefined}
>

// For live status updates (clock-in/out notifications)
useEffect(() => {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  }
}, [statusMessage]);

<Text
  accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
>
  {statusMessage}
</Text>
```

**Effort:** Medium (1-2 hours)
**Impact:** Consistent behavior on both platforms

---

#### 10. Color Contrast Issues
**File:** `src/theme/colors.ts`

**Problem:** Some text colors fail WCAG AA contrast requirements (4.5:1 for normal text).

**Current issues:**

| Color | Hex | On White | Ratio | Status |
|-------|-----|----------|-------|--------|
| `text.tertiary` | #8E8E93 | White | ~3.5:1 | ⚠️ Fails for small text |
| `text.disabled` | #BDBDBD | White | ~1.9:1 | ❌ Fails |
| `grey.500` | #9E9E9E | White | ~3.0:1 | ❌ Fails for text |

**Fix approach:** Darken failing colors:
```tsx
text: {
  tertiary:  '#6B6B70',  // Darkened from #8E8E93 → 4.5:1
  disabled:  '#767676',  // Darkened from #BDBDBD → 4.5:1 (or accept for disabled state)
},
grey: {
  500: '#757575',  // Darkened from #9E9E9E → 4.5:1
},
```

**Note:** Disabled states are exempt from WCAG contrast requirements, but improving contrast still helps low-vision users.

**Effort:** Low (1 hour) - but requires visual review of affected UI
**Impact:** Better readability for low-vision users

---

### 🟢 LOW (Polish)

#### 11. ConsentBottomSheet - Nested Touch Handlers
**File:** `src/modules/auth/components/ConsentBottomSheet.tsx`
**Lines:** 173-185

**Problem:** TouchableOpacity wraps a Checkbox that also has onPress - redundant handlers.

**Fix approach:**
```tsx
// Remove onPress from inner Checkbox, keep only outer TouchableOpacity
<TouchableOpacity
  style={styles.checkboxRow}
  onPress={() => setAccepted(!accepted)}
  accessibilityRole="checkbox"
  accessibilityState={{ checked: accepted }}
  testID="consent-checkbox"
>
  <Checkbox
    checked={accepted}
    // Remove onPress - parent handles it
    size="md"
    pointerEvents="none"  // Prevent touch interception
  />
  <Text style={styles.checkboxText}>{t('consent.checkbox')}</Text>
</TouchableOpacity>
```

**Effort:** Low (30 min)
**Impact:** Cleaner accessibility tree, single touch target

---

## Implementation Order

| Phase | Issues | Effort | Outcome |
|-------|--------|--------|---------|
| **Phase 1** | #1 HoursSummaryWidget, #2 TemplatePanel | 3-4 hours | E2E tests can use testIDs on all screens |
| **Phase 2** | #3 CalendarHeader, #4 CalendarFAB, #7 Location testIDs | 2.5 hours | Full E2E test coverage possible |
| **Phase 3** | #5 WeekView, #6 MonthView | 4-5 hours | Calendar fully accessible |
| **Phase 4** | #8 NextShiftWidget, #9 Platform-specific | 2 hours | Cross-platform consistency |
| **Phase 5** | #10 Color contrast, #11 ConsentBottomSheet | 1.5 hours | Polish + compliance |

**Total estimated effort:** ~13-15 hours

---

## Testing Strategy

### Manual Testing
After each fix:
1. **VoiceOver test (iOS):** Navigate the affected screen with VoiceOver enabled
2. **TalkBack test (Android):** Navigate the affected screen with TalkBack enabled
3. **E2E test:** Run Maestro flow with testID-based taps (remove coordinate workarounds)
4. **Regression:** Run full E2E suite

### Automated Verification via MCP

Claude Code can verify accessibility fixes using MCP tools:

#### 1. Accessibility Tree Inspection
```
Tool: mcp__mobile-mcp__mobile_list_elements_on_screen
```
This returns the accessibility tree - exactly what VoiceOver/TalkBack see. Use it to verify:
- Elements have `accessibilityLabel` (appears in element list)
- Interactive elements are discoverable
- Hidden elements (`accessible={false}`) don't appear

**Verification pattern:**
```
1. Navigate to screen
2. Call mobile_list_elements_on_screen
3. Check that expected labels appear in results
4. If element is missing or has no label → fix not working
```

#### 2. Label-Based Interaction
```
Tool: mcp__maestro__tap_on (with text parameter)
```
Maestro can tap elements by accessibility label. If it succeeds, the element is accessible.

**Verification pattern:**
```
1. After fix, try tapping by label: tap_on(text="Previous week")
2. If tap succeeds → element is accessible
3. If tap fails → element not in accessibility tree
```

#### 3. Accessibility Audit Checklist (per screen)

**Status Screen:**
- [ ] `mobile_list_elements_on_screen` returns "Last 14 days..." summary
- [ ] `tap_on(text="Next shift")` or similar works
- [ ] Location cards have labels like "Work, active"

**Calendar Screen:**
- [ ] `tap_on(text="Previous week")` works
- [ ] `tap_on(text="Next week")` works
- [ ] Week/Month toggle has labels
- [ ] FAB menu items have labels

**Settings Screen:**
- [ ] All buttons have labels
- [ ] Toggle switches have labels + state

---

## Success Criteria

- [ ] All E2E flows pass using testID/label-based taps (no coordinate workarounds)
- [ ] VoiceOver can navigate all screens without crashes
- [ ] TalkBack can navigate all screens without crashes
- [ ] All interactive elements have accessibilityLabel or are implicitly labeled
- [ ] Chart components provide summary descriptions
- [ ] `mobile_list_elements_on_screen` returns expected labels for each screen
- [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for UI components)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/modules/geofencing/components/HoursSummaryWidget.tsx` | Wrap chart with accessible summary |
| `src/modules/calendar/components/TemplatePanel.tsx` | Remove `accessible={false}`, add proper labels |
| `src/modules/calendar/components/CalendarHeader.tsx` | Add labels to navigation arrows |
| `src/modules/calendar/components/CalendarFAB.tsx` | Add `accessibilityViewIsModal`, roles |
| `src/modules/calendar/components/WeekView.tsx` | Add labels to shift blocks, tracking badges |
| `src/modules/calendar/components/MonthView.tsx` | Add day cell descriptions |
| `src/modules/geofencing/screens/StatusScreen.tsx` | Add location card testIDs + labels |
| `src/modules/geofencing/components/NextShiftWidget.tsx` | Add summary label |
| `src/modules/auth/components/ConsentBottomSheet.tsx` | Fix nested touch handlers, platform props |
| `src/theme/colors.ts` | Adjust contrast-failing colors |
| `src/lib/i18n/translations/en.ts` | Add accessibility label strings |
| `src/lib/i18n/translations/de.ts` | Add accessibility label strings (German) |

---

## MCP Verification Workflow

When implementing fixes, Claude Code can verify each change:

### Before/After Pattern
```
1. Navigate to screen (via tap or launch_app)
2. BEFORE: Call mobile_list_elements_on_screen, save baseline
3. Apply accessibility fix
4. Rebuild app (eas build or expo start)
5. AFTER: Call mobile_list_elements_on_screen, compare
6. Verify new labels appear in results
7. Test interaction via tap_on(text="Expected Label")
```

### Quick Verification Commands

| Screen | Verification |
|--------|--------------|
| Status | Look for "Last 14 days" or hours summary in element list |
| Calendar | `tap_on(text="Previous week")` should work |
| Calendar | `tap_on(text="Templates")` should open FAB menu |
| Settings | All items should have text labels visible |

### Known MCP Limitations
- `mobile_list_elements_on_screen` may timeout on complex screens
- Animated elements may cause `kAXErrorInvalidUIElement` (this is the bug we're fixing)
- Need simulator running with app installed

---

## Maestro-iOS Compatibility (Investigated 2026-01-25)

### Root Cause: Nested Accessible Elements

Maestro cannot find elements by `id:` or `text:` when they're inside a container View on iOS. This is due to how iOS accessibility tree traversal works with nested accessible elements.

**Symptom:**
```yaml
# Fails even though testID exists
- tapOn:
    id: "calendar-fab"  # Element not found
```

**Root cause:** The FAB button is inside a container View:
```tsx
<View style={styles.container}>  {/* Parent intercepts accessibility */}
  <TouchableOpacity testID="calendar-fab" ...>
```

### Fix: `accessible={false}` on Containers

Add `accessible={false}` to container Views that wrap interactive elements:

```tsx
// BEFORE - Maestro can't find child elements
<View style={styles.container}>
  <TouchableOpacity testID="calendar-fab" ...>
</View>

// AFTER - Maestro finds child elements by testID
<View style={styles.container} accessible={false}>
  <TouchableOpacity testID="calendar-fab" ...>
</View>
```

**Files fixed:**
| File | Line | Change |
|------|------|--------|
| `CalendarFAB.tsx` | 69 | Added `accessible={false}` to container |
| `CalendarHeader.tsx` | 94 | Added `accessible={false}` to navigation View |

**Verified working after fix:**
- `tapOn: id: "calendar-fab"` ✅
- `tapOn: id: "calendar-prev"` ✅
- `tapOn: id: "calendar-next"` ✅
- `tapOn: id: "template-add"` ✅

### Caveat: `accessibilityViewIsModal` Hides Children

Using `accessibilityViewIsModal={true}` on modal panels **hides all children from Maestro**. The modal becomes a single opaque element in the view hierarchy.

**Symptom:**
```
Maestro inspect_view_hierarchy shows:
  - element: "accessibilityText=Vorlagen-Bereich; enabled=true"
  - (no children visible)
```

**Solution:** Remove `accessibilityViewIsModal` if E2E testing of modal contents is needed:
```tsx
// BEFORE - children hidden from Maestro
<View accessibilityViewIsModal={Platform.OS === 'ios'}>

// AFTER - children visible to Maestro
<View accessible={false}>
```

**Trade-off:** Without `accessibilityViewIsModal`, VoiceOver won't trap focus inside the modal. For this app, E2E testability is prioritized over focus trapping.

### Remaining Issue: Complex Form Accessibility

Elements inside complex nested forms (like TemplatePanel's edit form) still have accessibility traversal issues. Both `mobile_list_elements_on_screen` and Maestro fail when the edit form is open.

**Workaround:** Use coordinate-based taps for save/cancel buttons inside forms:
```yaml
# Coordinates still needed for form buttons
- tapOn:
    point: "25%,87%"  # Save button
```

### Summary Table

| Element Location | testID Works? | Fix Applied |
|------------------|---------------|-------------|
| Main screen buttons | ✅ Yes | `accessible={false}` on container |
| FAB button | ✅ Yes | `accessible={false}` on container |
| Modal panel (simple) | ✅ Yes | Removed `accessibilityViewIsModal` |
| Modal panel (edit form) | ❌ No | Use coordinates |
| Tab bar | ✅ Yes | Use text regex: `"Kalender.*"` |

---

## Related Documentation

- `docs/E2E_TESTING_PLAN.md` - E2E test status and known issues
- `mobile-app/ARCHITECTURE.md` - App architecture
- `.mcp.json` - MCP server configuration (maestro + mobile-mcp)
- [React Native Accessibility Guide](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
