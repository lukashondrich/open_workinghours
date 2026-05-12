# Calendar Export — Code Review

**Date:** 2026-04-30
**Branch:** `worktree-feature-calendar-export`
**Reviewed against:** `CALENDAR_EXPORT_PLAN.md` (rev. 2026-04-27), `CALENDAR_EXPORT_VALIDATION_PLAN.md`
**Diff scope:** 36 files changed, +4504 / -480 lines vs `main`

---

## 1. Overall Assessment

The implementation follows the plan well. Root-level orchestrator, SQLite-backed reconciliation, notes markers, single-flight queue, future-facing creation window, no auto-deletion of past events — all present and structurally correct. The code is well-organized across focused service files with clear separation of concerns.

The issues below are ordered by severity. Items 1-5 should be fixed before merging. Items 6-12 should be fixed before production release. Items 13+ are low severity.

---

## 2. Must-Fix Before Merge

### 2.1 DST-unsafe date arithmetic in `CalendarExportNormalize.ts`

Full-day absence end time uses fixed millisecond addition:

```typescript
const endDate = instance.isFullDay
  ? new Date(createLocalMidnight(instance.date).getTime() + 24 * 60 * 60000)
```

On Germany's spring-forward (March) and fall-back (October) nights, adding 86,400,000ms to midnight does not land on midnight of the next day — it's off by 1 hour.

Same issue in the overnight partial-absence overflow path further down.

**Fix:** Construct midnight of the next day by incrementing the date string:

```typescript
// Instead of: new Date(midnight.getTime() + 86400000)
// Use: createLocalMidnight(getNextDateKey(instance.date))
```

This is immune to DST transitions.

### 2.2 Fingerprint uses UTC via `toISOString()` in `CalendarExportFingerprint.ts`

```typescript
input.startDate.toISOString(),
input.endDate.toISOString(),
```

`toISOString()` returns UTC. A shift at 06:00 local in Berlin (UTC+2) produces `04:00:00.000Z`. If the device timezone changes (travel, DST transition), the same logical shift produces a different UTC string, the fingerprint changes, and the event gets spuriously re-updated.

**Fix:** Hash the logical local representation instead:

```typescript
input.dateKey,      // "2026-04-24"
input.startTime,    // "06:00"
String(input.duration),
```

This matches the plan's recommendation in section 17.7.C: `hash(name, date, startTime, duration)` for shifts.

### 2.3 No try/catch in `runSyncIfEnabled` — `CalendarExportManager.ts`

```typescript
const calendarResolution = await this.ensureManagedCalendar(state, now);
const result = await this.reconciler.reconcileManagedCalendar(...);
await this.persistState(state, { calendarId: ..., lastSyncError: null });
```

If `ensureManagedCalendar` or `reconcileManagedCalendar` throws, `persistState` is never called. `lastSyncError` stays null. The Settings UI cannot show the user that something went wrong. The error propagates to the orchestrator's generic catch, losing context.

**Fix:** Wrap the body in try/catch, persist the error:

```typescript
try {
  const calendarResolution = await this.ensureManagedCalendar(state, now);
  const result = await this.reconciler.reconcileManagedCalendar(...);
  await this.persistState(state, { ..., lastSyncError: null });
} catch (error) {
  await this.persistState(state, {
    lastSyncError: error instanceof Error ? error.message : 'unknown',
  });
  throw error;
}
```

### 2.4 Sign-out cleanup not wired into auth context

Calendar cleanup is only called from the SettingsScreen sign-out handler. If the user is signed out via session expiry, the LockScreen, or any other path, exported calendar data survives.

This is GDPR-relevant — app-managed calendar data should not persist after involuntary sign-out.

**Fix:** Wire `cleanupExportedCalendarData()` into the `signOut` function in `auth-context.ts` (or equivalent), not just the Settings UI handler. The orchestrator unmounts on auth state change, so cleanup must run before the state transition.

### 2.5 Duplicate permission keys in `app.json`

`NSCalendarsUsageDescription` and `NSRemindersUsageDescription` appear both in the expo-calendar plugin config AND in manual `infoPlist` entries. Depending on Expo SDK version, these may conflict or produce build warnings.

**Fix:** Remove one set. Either use the plugin's config exclusively, or set them manually in `infoPlist` and remove the plugin config strings.

---

## 3. Should Fix Before Production

### 3.1 `'restricted'` permission collapsed to `'undetermined'` — `DeviceCalendarService.ts`

```typescript
const status = response.status === 'granted' || response.status === 'denied'
  ? response.status
  : 'undetermined';
```

iOS returns `'restricted'` for MDM/parental-control-managed devices. Mapping it to `'undetermined'` causes the app to offer a permission prompt that will silently fail. Hospital devices — the target hardware — are often MDM-managed.

**Fix:** Map `'restricted'` to `'denied'`.

### 3.2 Multi-candidate calendar error is untyped — `CalendarExportManager.ts`

```typescript
if (markerBearing.length > 1) {
  throw new Error('Multiple managed calendar candidates were found; refusing to guess.');
}
```

This bare `Error` isn't caught specifically in `runSyncIfEnabled`, so it can't be persisted as a meaningful `lastSyncError`. The user sees nothing in the Settings UI.

**Fix:** Define a typed error (class or code enum), catch it in `runSyncIfEnabled`, persist a specific `lastSyncError` value.

### 3.3 `resolveEnableTarget` returns `'ios-default'` on Android — `CalendarExportManager.ts`

When `targetMode` is null, the code falls through to the iOS default branch with no `Platform.OS` guard. On Android with null `targetMode`, the app would skip Android target resolution entirely and use iOS-style calendar creation.

**Fix:** Add a `Platform.OS === 'android'` check, or throw if `targetMode` is null (it should always be set by the enable flow).

### 3.4 Stale state after account deletion — `DataPrivacyScreen.tsx`

`cleanupExportedCalendarData()` doesn't pass `clearState: true` (or equivalent) to `deleteExportedCalendarData()`. If the manager doesn't clear state by default on success, local export metadata survives account deletion.

**Fix:** Verify that `deleteExportedCalendarData` clears `device_calendar_state` on success. If not, add it.

### 3.5 Wrong string for Android account picker — `SettingsScreen.tsx`

`selectAndroidTarget()` reuses the privacy disclosure copy (`calendarSyncDescription`) as the Alert body for choosing a calendar account. This shows the user a paragraph about GPS tracking and iCloud when they need to pick a Google account.

**Fix:** Add a dedicated i18n key for the account picker prompt.

### 3.6 Mapping fingerprint saved before update succeeds — `CalendarExportReconciler.ts`

```typescript
await this.storage.saveDeviceCalendarMapping({ ... fingerprint: desiredEvent.fingerprint });
// If this next line throws, mapping is out of sync:
await this.deviceCalendarService.updateEvent(actualEvent.id, toUpsertInput(desiredEvent));
```

If `updateEvent` throws after the mapping is saved with the new fingerprint, the mapping and native event are out of sync. Self-heals on next run (notes mismatch detected), but reordering is a one-line fix.

**Fix:** Move `saveDeviceCalendarMapping` after `updateEvent`.

### 3.7 Singleton promise caches rejected state — `CalendarExportManager.ts`

```typescript
let calendarExportManagerPromise: Promise<CalendarExportManager> | null = null;
```

If `getCalendarExportManager()` rejects (e.g., SQLite init failure), the promise is cached and every subsequent call re-throws forever.

**Fix:**

```typescript
calendarExportManagerPromise = (async () => { ... })().catch((err) => {
  calendarExportManagerPromise = null;
  throw err;
});
```

Note: the same pattern exists in `getCalendarStorage`. Both should be fixed together.

---

## 4. Low Severity

### 4.1 `deleteExportedCalendarData` returns `deletedEvents: 0` on calendar deletion — `CalendarExportManager.ts`

When `deleteCalendar` succeeds (deleting the whole calendar at once), `deletedEvents` stays at 0. If the UI ever surfaces this count, it would confuse users. Either use a separate `calendarDeleted: boolean` field, or don't surface the count.

### 4.2 Stale mapping rows accumulate — `CalendarExportReconciler.ts`

If a user deletes a native event AND the marker was corrupted/removed, neither the mapping lookup nor the marker lookup finds it. The orphaned row in `device_calendar_mappings` stays forever. Over months, stale rows accumulate.

**Fix:** At the end of reconciliation, sweep the mappings table for `appId` values not in the desired set and not matched by any actual native event.

### 4.3 `CalendarExportOrchestrator.tsx` is `.tsx` with no JSX

The file renders `return null` but has no JSX elements. Could be `.ts` with a different integration pattern, but `.tsx` is harmless. Cosmetic only.

### 4.4 Redundant `authState.status` check in AppState handler — `CalendarExportOrchestrator.tsx`

The `useEffect` that registers the AppState listener only runs when `authState.status === 'authenticated'`, so the check inside the handler is always true. Not a bug, just dead code.

### 4.5 Marker injection via shift name

A shift name containing `owh:type=` would inject a spurious marker line into the notes field. Extremely unlikely in practice, but defensively fixable by escaping or validating.

### 4.6 `refreshCalendarSyncState()` after `signOut()` — `SettingsScreen.tsx`

Called after sign-out completes. By this point the component is likely unmounting (auth state changes to unauthenticated). May produce a React "setState on unmounted component" warning.

### 4.7 Duplicate `"location"` in `UIBackgroundModes` — `app.json`

Pre-existing issue, not introduced by this feature. Worth cleaning up in a separate pass.

---

## 5. Test Gaps

Compared against the validation plan's required coverage:

| Gap | Priority | Validation plan reference |
|-----|----------|--------------------------|
| No test for single-flight queue behavior (rapid successive triggers) | High | Section 7.3 |
| Fingerprint tests cover only 2 of 5 plan scenarios (missing: title change, allDay change, notes-excluded) | High | Section 6.2 |
| No reconciler test for "explicit delete includes past events" | Medium | Section 6.5 |
| No test for partial-day absence normalization | Medium | Section 6.1 |
| No reconciler test for no-op path (same fingerprint -> unchanged) | Medium | Section 6.5 |
| No test for privacy erasure paths (delete-local-data, delete-account, sign-out with keep) | Medium | Section 7.3 |
| No DeviceCalendarService test for Android calendar creation | Low | Section 7.1 |

---

## 6. What's Done Well

- Root-level orchestrator correctly mounted in `AppNavigator.tsx` as sibling to `Stack.Navigator`, not inside CalendarProvider
- Single-flight queue with `needsResyncRef` is correct and handles coalescing well
- `isPastManagedEvent` correctly protects past events from deletion during normal reconciliation
- Marker format and parsing is robust: handles CRLF, order-independent line matching, typed discriminated union results
- SQLite migration 4 is idempotent with `CREATE TABLE IF NOT EXISTS`
- Schedule event emitter fires from all write paths (both bulk replace and individual CRUD)
- E2E-compatible UI patterns followed in SettingsScreen (no Modal, proper testIDs)
- i18n strings complete and symmetric in both EN and DE
- MonthView, WeekView, and calendar-reducer changes are clearly separated from the export feature (no contamination)
- CalendarStorage additions follow existing patterns cleanly
