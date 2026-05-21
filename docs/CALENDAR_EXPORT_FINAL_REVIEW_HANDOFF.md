# Calendar Export Final Review Handoff

**Date:** 2026-05-21  
**Purpose:** code-quality review and iOS real-device validation planning for Calendar Export / Calendar Sync  
**Primary audience:** Claude Code or another reviewer working through the current repo state  
**Current branch baseline:** `main`, ahead of `origin/main` with calendar sync fixes  

## 1. Review Goal

Review the Calendar Export / Calendar Sync implementation for production readiness across:

1. Code quality: robustness, maintainability, failure modes, recovery behavior, platform boundaries.
2. Automated validation: unit/integration coverage around calendar export behavior.
3. Real-device validation: Android is now validated; iOS still needs a real-device pass.

Do not treat older review notes as automatically current. `docs/CALENDAR_EXPORT_CODE_REVIEW.md` is useful historical context, but it was written before several Android fixes landed. Re-check each concern against the current code.

## 2. Current Fix Stack

Relevant recent commits:

- `08fb334 fix(android): preserve all-day absence dates`
- `13bb5ae fix(android): harden calendar sync target validation`
- `446b1d8 fix(android): unblock calendar sync enable flow`
- `fb62f79 fix(android): repair calendar export visibility`

Important Android validation builds:

- Build before all-day fix: `434d1a86-b9c8-451b-b3cc-dacbfa51f2bc`
- Build with all-day fix: `f952997a-3476-4d4f-94e1-738b5c38ade5`
- Fixed APK: `https://expo.dev/artifacts/eas/wMETVJVicLJKsqNCdjmQ7a.apk`

Android real-device result on Samsung `SM_A145F`, serial `R58W910C8QD`:

- Calendar Sync could be enabled.
- Google, Samsung, and local calendar targets were visible and distinguishable.
- Managed `Open Working Hours` calendar was created/recovered.
- Timed shift exported to the correct day and time.
- Full-day absences initially reproduced an Android all-day off-by-one issue.
- `08fb334` fixed the all-day issue by writing Android all-day event boundaries as UTC midnights and mapping them back on read.
- Existing wrong all-day rows were reconciled in place, not duplicated.
- Manual create/edit/delete tests passed after fixed build installation.

## 3. Main Files To Review

Core services:

- `mobile-app/src/modules/calendar/services/DeviceCalendarService.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportManager.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportReconciler.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportNormalize.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportDateWindow.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportFingerprint.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportMarker.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportErrors.ts`
- `mobile-app/src/modules/calendar/services/CalendarExportOrchestrator.tsx`
- `mobile-app/src/modules/calendar/services/CalendarStorage.ts`

UI:

- `mobile-app/src/modules/calendar/screens/CalendarExportScreen.tsx`
- `mobile-app/src/lib/i18n/translations/en.ts`
- `mobile-app/src/lib/i18n/translations/de.ts`

Tests:

- `mobile-app/src/modules/calendar/services/__tests__/DeviceCalendarService.test.ts`
- `mobile-app/src/modules/calendar/services/__tests__/CalendarExportManager.test.ts`
- `mobile-app/src/modules/calendar/services/__tests__/CalendarExportReconciler.test.ts`
- `mobile-app/src/modules/calendar/services/__tests__/CalendarExportNormalize.test.ts`
- `mobile-app/src/modules/calendar/screens/__tests__/CalendarExportScreen.test.tsx`

Docs:

- `docs/CALENDAR_EXPORT_VALIDATION_PLAN.md`
- `docs/CALENDAR_EXPORT_E2E_RESULTS.md`
- `docs/CALENDAR_EXPORT_CODE_REVIEW.md`

## 4. Reviewer Instructions

Start with a code-review stance. Prioritize bugs, data loss, privacy risk, broken recovery, duplicate events, missed deletes, permission edge cases, and platform-specific date/time mistakes.

Expected workflow:

1. Inspect the current git state and recent commits:

   ```bash
   git status --short --branch
   git log --oneline --max-count=12
   ```

2. Read the files in section 3.
3. Compare current behavior to `docs/CALENDAR_EXPORT_VALIDATION_PLAN.md`.
4. Re-evaluate old findings in `docs/CALENDAR_EXPORT_CODE_REVIEW.md` and explicitly mark them as fixed, still valid, or obsolete.
5. Run focused tests:

   ```bash
   cd mobile-app
   npm test -- --runInBand src/modules/calendar src/lib/calendar
   ```

6. Run broader checks if practical:

   ```bash
   cd mobile-app
   npx tsc --noEmit
   ```

   Note: as of 2026-05-21, `tsc --noEmit` has known unrelated failures elsewhere in the repo. Do not conflate those with calendar export changes unless the failures are in calendar export files or are caused by these commits.

7. Produce a findings-first report with file and line references.

## 5. Code Quality Review Checklist

### 5.1 Platform Boundaries

Verify that Android-specific behavior is contained in `DeviceCalendarService` / manager-level target resolution and does not leak into pure normalization logic.

Questions:

- Are Android all-day event UTC-boundary conversions correct for every create, update, and read path?
- Are iOS all-day events still passed in the form Expo/iOS expects?
- Are timed events unaffected by all-day conversion logic?
- Does reconciliation compare canonical app-level dates rather than raw provider-specific dates?
- Are DST transitions still safe after the Android boundary conversion?

### 5.2 Target Selection And Recovery

Review Android and iOS calendar target selection.

Questions:

- Are Google and Samsung provider calendars distinct when they share the same email address?
- Is the recommended target deterministic and sensible?
- Does fallback to local/device-only happen only when account-backed creation or validation fails?
- Is fallback state visible to the user through `lastSyncError` / warning copy?
- Does recovery from an existing managed calendar avoid guessing when multiple marker-bearing candidates exist?
- Is `targetSourceId` stable enough across provider refreshes and app restarts?

### 5.3 Create And Validation Flow

Review `CalendarExportManager.createAndValidateManagedCalendar`.

Questions:

- Does the created calendar get re-read before use?
- Is writability checked before reconcile writes?
- Does the write probe create, update, and delete without leaving temporary events behind on normal success?
- If probe cleanup fails, is the user shown a meaningful sync issue?
- Is Android visibility/sync repaired before events are written?
- If fallback local creation also fails, is the persisted error code specific enough?

### 5.4 Reconciliation

Review `CalendarExportReconciler`.

Questions:

- Can it update existing wrong all-day absence rows in place, based on marker or mapping?
- Does it avoid duplicate events when mapping is missing but marker exists?
- Does it repair mappings after recovery?
- Does it delete future exported events when app items are deleted?
- Does it avoid deleting past managed events during normal sync?
- Does explicit export cleanup include past managed events?
- Are event write failures wrapped as structured sync issues?
- Is mapping persistence ordered so failed native writes do not falsely mark a mapping as up to date?

### 5.5 Permission And Error State

Review permission handling and UI state.

Questions:

- Does `ensureCalendarPermission` request permission before Android target resolution?
- Are denied, restricted, and unavailable permission states handled correctly for Android and iOS?
- Are sync failures persisted as stable issue codes instead of raw exception strings?
- Does UI show actionable warnings for permission denial, fallback-local, and generic sync failure?
- Does disabling sync with revoked permission avoid claiming native deletion succeeded?

### 5.6 Data Privacy And Cleanup

Review sign-out, account deletion, local data deletion, and disable-sync flows.

Questions:

- Is calendar cleanup invoked from every sign-out path, not only one Settings button?
- Does account deletion either delete exported events or clearly leave them by user choice?
- Does `keep exported events` disable future sync without deleting native events?
- Does `delete exported events` remove native events/calendar and local mappings/state?
- Are failures during privacy cleanup surfaced honestly and safely?

### 5.7 Maintainability

Questions:

- Are abstractions still small and understandable?
- Are Android source/provider helpers easy to extend for more providers?
- Is the error-code list complete but not overfit?
- Is copy/i18n clear and not too technical?
- Are comments limited to genuinely non-obvious date/platform behavior?

## 6. Automated Test Gap Checklist

Check whether tests currently cover:

- Android all-day create conversion to UTC boundaries.
- Android all-day read conversion back to local date boundaries.
- iOS all-day path remains unchanged.
- Timed Android shift create/update remains local-time correct.
- Android duplicate Gmail address split between Samsung and Google providers.
- Android account target write-probe failure falls back to local.
- Android account calendar creation failure falls back to local.
- Fallback-local warning state persists and appears in UI.
- Multiple managed calendar recovery candidates persist `ambiguous-recovery`.
- Delete exported events with direct calendar delete failure falls back to per-event deletion.
- Reconciler no-op, update, delete, mapping repair, marker recovery, and explicit past deletion.
- DST spring-forward and fall-back full-day absence behavior.

If any item is uncovered, recommend the smallest focused test to cover it.

## 7. iOS Real-Device Validation Plan

Android real-device validation is complete enough for this ticket. iOS is still outstanding.

### 7.1 Build

Use an EAS preview iOS build for real-device validation. Avoid production unless intentionally submitting to TestFlight/App Store.

Recommended command:

```bash
cd /Users/user01/open_workinghours/mobile-app
eas build --platform ios --profile preview --non-interactive --wait
```

Before building:

```bash
git status --short --branch
git log --oneline --max-count=8
```

Record:

- commit hash
- EAS build URL
- device model
- iOS version
- iCloud calendar setting state
- whether the device has an "On My iPhone" local calendar source

### 7.2 iOS Permission Flow

Test cases:

1. Fresh install or revoked calendar permission:
   - Open Calendar Export.
   - Enable Calendar Sync.
   - Confirm iOS permission prompt appears.
   - Grant permission.
   - Confirm sync enables and no warning remains.

2. Permission denied:
   - Revoke calendar permission in iOS Settings.
   - Open app and try sync.
   - Confirm the app does not claim success.
   - Confirm warning copy is specific and actionable.

3. Restricted/managed device, if available:
   - Confirm restricted calendar access is treated like denied/unavailable, not as an endlessly requestable prompt.

### 7.3 iOS Calendar Creation And Recovery

Test cases:

1. Enable sync with iCloud calendars available:
   - Managed `Open Working Hours` calendar should be created or recovered in a writable iOS source.
   - Calendar should be visible in Apple Calendar.

2. Disable and keep exported events:
   - Sync turns off.
   - Existing exported events stay in Apple Calendar.
   - Re-enable sync should recover the managed calendar/events rather than create duplicates.

3. Delete managed calendar externally:
   - Delete `Open Working Hours` in Apple Calendar.
   - Return to app and trigger sync by editing a shift/absence.
   - App should recreate or recover cleanly.

4. Multiple managed calendars:
   - If two marker-bearing `Open Working Hours` calendars can be created manually, confirm the app refuses to guess and surfaces an unhealthy state.

### 7.4 iOS Event Date/Time Matrix

Use one controlled week and verify in Apple Calendar:

- Timed shift on Friday, for example 08:00 to 16:00.
- Full-day sick absence on Saturday.
- Full-day vacation absence on Sunday.
- Overnight shift crossing midnight.
- Partial-day absence, if supported in the UI.
- Full-day absence on a DST transition date if practical.

Expected:

- Timed shifts keep local start/end times.
- Full-day absences appear on the exact selected date, not the previous or next date.
- Edits update existing events, not duplicates.
- Deletes remove exported events.
- Notes/markers do not show confusing user-facing text if visible in Apple Calendar.

### 7.5 iOS Reconciliation Flow

After initial export:

1. Rename a shift.
2. Move an absence to another day.
3. Delete a shift.
4. Delete an absence.
5. Relaunch the app.
6. Verify Apple Calendar after each step.

Expected:

- Existing native events are updated in place.
- No duplicate managed events.
- Deleted app items disappear from the managed calendar unless they are historical and protected by normal-sync policy.

### 7.6 iOS Cleanup Flow

Test:

1. Disable Calendar Sync and choose `Delete exported events`.
2. Confirm `Open Working Hours` calendar/events are removed.
3. If permission is revoked before cleanup, confirm app warns and does not claim it removed events.

## 8. Suggested Reviewer Output Format

Claude Code should return:

1. Findings, ordered by severity.
2. For each finding:
   - file path and line reference
   - concrete failure mode
   - recommended fix
   - whether it blocks merge or can be follow-up
3. Automated tests run and results.
4. iOS validation status:
   - not run, blocked, passed, or failed
   - exact device/build details
5. Residual risks.
6. A final merge recommendation.

## 9. Current Acceptance Criteria

Treat the ticket as ready only when:

- Calendar-focused Jest suite passes.
- Android real-device validation remains passed.
- iOS real-device validation has passed or the remaining iOS risk is explicitly accepted.
- No high-severity code-review findings remain open.
- Any medium-severity findings have clear follow-up tickets.

