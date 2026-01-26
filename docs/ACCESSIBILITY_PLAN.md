# Accessibility Improvement Plan

**Created:** 2026-01-24
**Status:** Planning
**Goal:** Fix accessibility issues to improve both VoiceOver usability AND E2E test reliability

---

## Executive Summary

Accessibility and testability share the same foundation: the iOS accessibility tree. Fixing accessibility issues will:
1. Make the app usable for people with disabilities (VoiceOver users)
2. Eliminate the need for fragile coordinate-based E2E tests
3. Allow testID-based element selection throughout the app

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

#### 3. CalendarFAB - Inconsistent Element Detection
**File:** `src/modules/calendar/components/CalendarFAB.tsx`
**Lines:** 72-98 (menu options)

**Problem:** FAB menu items have testIDs but aren't consistently found by accessibility queries. The menu appears/disappears with animation which may cause timing issues.

**Fix approach:**
```tsx
{isOpen && (
  <View
    style={styles.menu}
    accessibilityViewIsModal={true}  // Focuses accessibility on this menu
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

#### 4. MonthView Day Cells - No Accessibility Descriptions
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

#### 5. Add testIDs to Location Components
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

#### 6. NextShiftWidget - No Accessibility Summary
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

### 🟢 LOW (Polish)

#### 7. ConsentBottomSheet - Nested Touch Handlers
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
| **Phase 2** | #3 CalendarFAB, #5 Location testIDs | 2 hours | Full E2E test coverage possible |
| **Phase 3** | #4 MonthView, #6 NextShiftWidget | 2.5 hours | VoiceOver users get full context |
| **Phase 4** | #7 ConsentBottomSheet | 30 min | Polish |

**Total estimated effort:** ~8 hours

---

## Testing Strategy

After each fix:
1. **VoiceOver test:** Navigate the affected screen with VoiceOver enabled
2. **E2E test:** Run Maestro flow with testID-based taps (remove coordinate workarounds)
3. **Regression:** Run full E2E suite

---

## Success Criteria

- [ ] All 3 E2E flows pass using testID-based taps (no coordinate workarounds)
- [ ] VoiceOver can navigate all screens without crashes
- [ ] All interactive elements have accessibilityLabel or are implicitly labeled
- [ ] Chart components provide summary descriptions

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/modules/geofencing/components/HoursSummaryWidget.tsx` | Wrap chart with accessible summary |
| `src/modules/calendar/components/TemplatePanel.tsx` | Remove `accessible={false}`, add proper labels |
| `src/modules/calendar/components/CalendarFAB.tsx` | Add `accessibilityViewIsModal`, roles |
| `src/modules/calendar/components/MonthView.tsx` | Add day cell descriptions |
| `src/modules/geofencing/screens/StatusScreen.tsx` | Add location card testIDs |
| `src/modules/geofencing/components/NextShiftWidget.tsx` | Add summary label |
| `src/modules/auth/components/ConsentBottomSheet.tsx` | Fix nested touch handlers |
| `src/lib/i18n/translations/en.ts` | Add accessibility label strings |
| `src/lib/i18n/translations/de.ts` | Add accessibility label strings (German) |

---

## Related Documentation

- `docs/E2E_TESTING_PLAN.md` - E2E test status and known issues
- `mobile-app/ARCHITECTURE.md` - App architecture
- [React Native Accessibility Guide](https://reactnative.dev/docs/accessibility)
