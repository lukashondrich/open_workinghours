# Calendar Export — Rework Plan

**Date:** 2026-04-30
**Branch:** `worktree-feature-calendar-export`
**Inputs:** `CALENDAR_EXPORT_CODE_REVIEW.md`, `CALENDAR_EXPORT_E2E_RESULTS.md`, `CALENDAR_EXPORT_PLAN.md` §18

---

## Overview

This plan covers two parallel workstreams after the initial calendar export implementation:

1. **Feature rework** — code review fixes, Settings subpage extraction, ICS file export
2. **E2E rework** — fix failing tests, adapt to new navigation, add ICS export coverage

The workstreams are mostly independent but share one dependency: the Settings subpage changes the navigation path to the calendar export UI, which affects E2E test helpers.

---

## Part 1: Feature Rework

### Phase 1A: Code Review Must-Fixes ✅

These are correctness and safety issues. No UI changes.

| # | Fix | File(s) | Notes | Status |
|---|-----|---------|-------|--------|
| 1 | DST-safe date arithmetic | `CalendarExportNormalize.ts`, `CalendarExportDateWindow.ts` | Added `getNextDateKey()` helper. Both full-day absence end and overnight partial-absence overflow now use `createLocalMidnight(getNextDateKey(...))` / `createLocalDate(getNextDateKey(...), endTime)` instead of `+ 86400000ms`. | ✅ Done |
| 2 | Local-time fingerprints | `CalendarExportFingerprint.ts` | Added `formatLocalDateTime()` using local getters. Hashes `[entityType, title, formatLocalDateTime(startDate), formatLocalDateTime(endDate), allDay]` instead of `toISOString()` UTC strings. | ✅ Done |
| 3 | try/catch in `runSyncIfEnabled` | `CalendarExportManager.ts` | Wrapped reconcile+persist block in try/catch. Persists `lastSyncError` on any error, then re-throws. | ✅ Done |
| 4 | Sign-out cleanup | `CalendarExportManager.ts` | **Decided: no auth-context wiring needed.** The orchestrator unmounts on auth state change so nothing syncs while signed out. Export state staying enabled is correct — it preserves the user's preference for next login. Native calendar events persist on device regardless of the flag. Originally extracted `bestEffortCalendarCleanupOnSignOut()` but removed it as dead code. | ✅ Resolved |
| 5 | Deduplicate plist keys | `app.json` | Removed manual `NSCalendarsUsageDescription` / `NSRemindersUsageDescription` from `infoPlist`. Also removed duplicate `"location"` entry in `UIBackgroundModes`. | ✅ Done |

### Phase 1A-test: Regression Coverage For Must-Fixes ✅

| Area | File(s) | Coverage | Status |
|------|---------|----------|--------|
| DST-safe normalization | `CalendarExportNormalize.test.ts` | Spring-forward, fall-back, overnight partial absence across DST boundary | ✅ 3 tests |
| Fingerprint stability | `CalendarExportFingerprint.test.ts` | Stable across equivalent Date constructions; changes on title change; changes on allDay change; excludes notes | ✅ 4 tests |
| Sync error persistence | `CalendarExportManager.test.ts` | `ensureManagedCalendar` throw persists error; reconciler throw persists error | ✅ 2 tests |

### Phase 1B: Code Review Should-Fixes ✅

| # | Fix | File(s) | Status |
|---|-----|---------|--------|
| 6 | Map `'restricted'` to `'denied'` | `DeviceCalendarService.ts` | ✅ Done |
| 7 | Typed error for multi-candidate calendar | `CalendarExportManager.ts` | ✅ `MultipleManagedCalendarsError` class |
| 8 | `Platform.OS` guard in `resolveEnableTarget` | `CalendarExportManager.ts` | ✅ Added `(!requestedTargetMode && Platform.OS === 'android')` condition |
| 9 | Verify no stale export state on account deletion | `DataPrivacyScreen.tsx` | ✅ Verified `deleteExportedCalendarData` clears state. Added `testID`. |
| 10 | Dedicated i18n key for Android picker | `CalendarExportScreen.tsx`, `en.ts`, `de.ts` | ✅ `calendarSyncAndroidPickerTitle` / `calendarSyncAndroidPickerMessage` |
| 11 | Reorder mapping save after `updateEvent` | `CalendarExportReconciler.ts` | ✅ Update now runs before mapping save |
| 12 | Reset singleton on rejection | `CalendarExportManager.ts`, `CalendarStorage.ts` | ✅ Both singletons reset on rejection |

### Deferred Low-Severity Items

Code review items 4.1-4.7 are intentionally deferred. They should not block this rework unless the touched files make one of them trivial to fix opportunistically.

### Already Done

The `ListItem` accessibility aggregation fix described in `CALENDAR_EXPORT_E2E_RESULTS.md` is already present on this branch in `ListItem.tsx`. It is not a work item in this rework plan.

### Phase 1C: Settings Subpage Extraction ✅

Moved calendar export from an inline section in SettingsScreen to a dedicated screen.

**New file:** `CalendarExportScreen.tsx` in `modules/calendar/screens/` (Option A from Q1)

**What moved:**
- Calendar sync toggle, loading state, warning text
- `handleCalendarSyncToggle`, `selectAndroidTarget`, `handleDeleteBlocked` handlers
- `refreshCalendarSyncState`, `calendarSyncEnabled`, `calendarSyncLoading`, `calendarSyncWarning` state

**What stays in SettingsScreen:**
- Navigation `ListItem` with `testID="settings-calendar-export"`
- Sign-out button + sign-out calendar dialog (lazy-loads export state at sign-out time via `getCalendarExportManager().getState()`)

**Navigation:**
- `CalendarExport: undefined` added to `RootStackParamList` in `AppNavigator.tsx`
- `<Stack.Screen name="CalendarExport">` with platform-specific header options (same pattern as DataPrivacy, Profile)

**Layout:**
```text
← Calendar Export                    ← SettingsDetailLayout header

Live Sync
─────────────────────────────
[disclosure text]
[toggle]
[warning if unhealthy]

Download as File
─────────────────────────────
[description text]
[4 preset buttons]
```

**Post-review improvements:**
- `useFocusEffect` instead of `useEffect` — refreshes sync state on screen focus (catches background sync errors)
- `isMountedRef` guard — prevents setState-after-unmount on all async handlers

### Phase 1D: ICS File Export ✅

**New file:** `IcsFileGenerator.ts` in `modules/calendar/services/`

**Shared data model:** `CalendarExportEventDTO` in `CalendarExportTypes.ts` — decouples ICS from sync-specific event types. CalendarExportScreen maps `DesiredManagedCalendarEvent` → `CalendarExportEventDTO` before passing to the ICS generator.

**Date range presets (implemented):**

| Button | Label (EN / DE) | Range |
|--------|-----------------|-------|
| Next 4 weeks | "Next 4 weeks" / "Nächste 4 Wochen" | `today .. today + 28d` |
| Next 3 months | "Next 3 months" / "Nächste 3 Monate" | `today .. today + 90d` |
| All future | "All future events" / "Alle zukünftigen Einträge" | `today .. today + 730d` (practical cap) |
| Past month | "Past month" / "Letzter Monat" | `today - 30d .. today` |

**ICS compliance (implemented):**
- `VCALENDAR` wrapper with `VERSION:2.0`, `CALSCALE:GREGORIAN`, `PRODID:-//Open Working Hours//EN`
- `UID: {appId}@openworkinghours` (stable, globally unique)
- `DTSTAMP` (UTC) and `SEQUENCE:0` on every `VEVENT`
- Device IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (fallback: `Europe/Berlin`)
- `DTSTART;TZID={tz}` / `DTEND;TZID={tz}` for timed events
- `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE` for full-day absences
- `TRANSP:TRANSPARENT` for absences, `TRANSP:OPAQUE` for shifts
- No `VALARM`, no `RRULE`
- RFC 5545 line folding at 75 characters
- CRLF line endings
- Text escaping (backslash, semicolon, comma, newline)
- File naming: `open-working-hours-{start}-to-{end}.ics`
- Share via `expo-sharing` with `mimeType: 'text/calendar'`, `UTI: 'com.apple.ical.ics'`

**Unit tests (`IcsFileGenerator.test.ts`):** 10 tests covering VCALENDAR wrapper, UID/DTSTAMP/SEQUENCE, TZID formatting, VALUE=DATE, TRANSP, line folding, filename, text escaping, CRLF, multi-event ordering.

**Known accepted trade-offs:**
- No `VTIMEZONE` block — IANA timezone names resolve correctly in Apple Calendar, Google Calendar, and Outlook without embedded offset rules. Enterprise calendar systems (older Exchange, Lotus Notes) may not resolve them. Documented as a known gap.
- Line folding counts characters, not octets — only matters for multi-byte shift names (German umlauts) exceeding 75 chars. Most parsers are lenient.
- "All future" uses a fixed 730-day cap, not `max(stored date)` — simpler, predictable. Empty-range check handles the case where no events exist in the tail.
- Filename shows the requested window, not actual min/max event dates — simple, matches button label.

### Bonus improvements (not in original plan)

| Change | File(s) | Notes |
|--------|---------|-------|
| iOS calendar source retry | `DeviceCalendarService.ts` | `getPreferredIosSources()` tries default → LOCAL → any writable. `createManagedCalendar` retries next source on failure. 2 new tests. |
| CalendarStorage singleton race fix | `CalendarStorage.ts` | Stores instance only after `initialize()` completes — prevents second caller getting uninitialized instance. |
| SettingsScreen lazy export state | `SettingsScreen.tsx` | Sign-out handler loads export state at sign-out time via manager, not from preloaded screen state. |
| New testIDs | `SettingsScreen.tsx`, `DataPrivacyScreen.tsx` | `sign-out-button`, `delete-all-data-button` |

### Phase 1 test status

**53/53 unit tests pass** across 10 test suites:
- CalendarExportDateWindow, CalendarExportFingerprint, CalendarExportManager, CalendarExportMarker, CalendarExportNormalize, CalendarExportReconciler, DeviceCalendarService, IcsFileGenerator, CalendarExportScreen, SettingsScreen.calendarExport

---

## Part 2: E2E Rework

### Phase 2D: Add `navigateToSettings` Helper ✅

Added to `actions.js`:

```javascript
async function navigateToSettings(driver) {
  await tapTestId(driver, 'settings-gear-button', 5000);
  await driver.pause(500);
}
```

Exported in `module.exports`. Test script `test:calendar-export` added to `e2e/package.json`.

### Phase 2A: Fix Existing Test Failures — TODO

Three changes fix all 15 failures (4 iOS + 11 Android):

**Fix 1 — Settings navigation** (`navigateToCalendarSync` helper)

Replace `navigateToTab(driver, 'settings')` with `tapTestId(driver, 'settings-gear-button')`.

Current code tries `tab-settings` testID (doesn't exist), falls back to text match "Settings" / "Einstellungen" (fails on Android because gear button has no visible text).

**Fix 2 — Sign-out assertion** (test 9, line 385)

Replace `existsTestId(driver, 'tab-settings')` with `existsTestId(driver, 'tab-status')`.

There is no `tab-settings` — Settings is accessed via a gear icon, not a tab.

**Fix 3 — Chained Alert synchronization** (tests 9, 10, 12)

The sign-out flow uses two chained `Alert.alert()` calls. After tapping "Abmelden" in the first dialog, the test should wait for the second calendar-specific dialog to appear before interacting with it.

Preferred implementation:
- Wait/poll for a second-dialog-specific button (`Keep events`, `Remove events`, etc.) with a timeout
- Use a short fallback pause only if a specific platform still needs it

**Expected result after fixes:**
- iOS: 13/13
- Android: 9-11/13 (sign-out chained dialogs may remain flaky on some emulators)

### Phase 2B: Adapt to Settings Subpage (after Phase 1C) — TODO

When calendar export moves to a dedicated screen, `navigateToCalendarSync()` needs an extra navigation step:

```javascript
async function navigateToCalendarSync() {
  // Step 1: Go to Settings
  await tapTestId(driver, 'settings-gear-button');
  await driver.pause(500);

  // Step 2: Tap "Calendar Export" list item to enter subpage
  await tapTestId(driver, 'settings-calendar-export');
  await driver.pause(500);

  // Step 3: Scroll to toggle if needed (unlikely — toggle is near top of subpage)
}
```

The sign-out tests (9, 10, 12, 13) stay on the main Settings screen — they don't navigate to the subpage.

### Phase 2C: Add ICS Export Tests (after Phase 1D) — TODO

New test cases:

| # | Test | Approach |
|---|------|----------|
| 14 | should show Download section on CalendarExport screen | Verify testID `ics-export-section` exists |
| 15 | should show all four preset buttons | Verify testIDs for each button |
| 16 | should tap "Next 4 weeks" and open share sheet | Tap button, verify share sheet appears (or dismiss it). On iOS: check for share activity controller. On Android: check for share intent. |

**Limitation:** We can verify the share sheet opens but cannot verify the ICS file contents via E2E. File content correctness is covered by unit tests on `IcsFileGenerator`.

### Phase 2 Implementation Order

```
2D (settings helper) ✅  ──→  2A (fix failures) TODO  ──→  2B (adapt to subpage) TODO  ──→  2C (ICS tests) TODO
```

---

## Resolved Questions

### Q1: Where should `CalendarExportScreen.tsx` live?

**Decision:** Option A — `modules/calendar/screens/`. The screen is about calendar data, the services already live in `modules/calendar/services/`.

### Q2: Should the sign-out calendar dialog move to CalendarExportScreen?

**Decision:** Keep in SettingsScreen. Sign-out handler lazily loads export state at sign-out time. No shared cleanup helper needed — non-Settings sign-out intentionally leaves export enabled (orchestrator unmounts, state resumes on next login).

### Q3: Should ICS export share the normalization code path with live sync?

**Decision:** Reuse normalization date math via a shared `CalendarExportEventDTO`. ICS generator consumes the DTO; live sync enriches it with marker notes/fingerprint separately.

### Q4: Should the E2E sign-out tests verify calendar cleanup actually happened?

**Decision:** Keep existing approach — test 13 verifies toggle is OFF after sign-out + re-login.

### Q5: TestID for the CalendarExport list item in Settings

**Decision:** `settings-calendar-export`.

---

## Remaining Work

```
2A (fix E2E failures)  ──→  2B (adapt to subpage)  ──→  2C (ICS export E2E tests)
                             ↓
                        Full E2E re-run → target 13/13 iOS, 11+/13 Android
                        Manual simulator validation per CALENDAR_EXPORT_VALIDATION_PLAN.md §10.2
```

Then: extract architecture to `mobile-app/ARCHITECTURE.md`, archive planning docs.
