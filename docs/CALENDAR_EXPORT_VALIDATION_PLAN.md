# Calendar Export — Validation Plan

**Date:** 2026-04-27  
**Branch:** `feature-calendar-export`  
**Status:** Draft for review  
**Related:** `docs/CALENDAR_EXPORT_PLAN.md`

---

## 1. Purpose

This document defines how the Calendar Export feature should be verified while it is being implemented.

The goal is to avoid two common failure modes:

- relying too heavily on manual testing for logic that should be covered by automated tests
- assuming automated tests can validate OS-level calendar behavior that really needs simulator or device checks

The validation strategy is therefore split into layers:

- unit tests for pure logic
- integration tests for services and persistence
- app-level UI tests
- E2E regression tests for app flows
- manual simulator checks
- final real-device checks for platform-specific behavior

---

## 2. Validation Principles

### 2.1 Source of truth

The feature’s core logic is:

- SQLite-backed desired state
- reconciliation against a managed native calendar
- privacy-aware cleanup flows

Those behaviors should be verified primarily with automated tests.

### 2.2 What E2E is for

Use E2E to verify:

- the app exposes the feature correctly
- the settings flows work
- toggles, warnings, and delete choices behave correctly
- existing calendar flows are not broken

Do **not** expect E2E to fully verify:

- Apple Calendar / Android calendar app contents
- account-backed sync to iCloud / Google
- external calendar sharing

### 2.3 What manual testing is for

Use simulator and real-device manual testing to verify:

- OS permission behavior
- native calendar creation and deletion
- actual event appearance in the device calendar
- platform quirks around all-day and timed events

---

## 3. Test Layers

### 3.1 Unit tests

Unit tests should cover pure logic with no real device or OS dependencies.

**Target modules:**

- event normalization helpers
- event fingerprint generation
- marker parsing and writing
- date-window eligibility
- timezone/date math helpers
- reconciliation diff logic
- cleanup policy decisions

**Must-cover scenarios:**

- timed shift becomes native event payload
- full-day absence becomes all-day native event payload
- overnight shift ends on next day
- future-facing creation window includes `today`
- historical rows are not newly exported
- already-exported past events are not selected for normal deletion
- explicit delete flows do include past managed events
- identical desired/native state produces no-op
- changed fingerprint produces update
- external edit to an app-managed field is overwritten by desired app state
- missing mapping but valid marker repairs mapping
- corrupted marker with valid mapping is rewritten on update

### 3.2 Integration tests

Integration tests should verify collaboration between modules with mocks/fakes.

**Target modules:**

- `DeviceCalendarService`
- `CalendarExportReconciler`
- `CalendarExportOrchestrator`
- `CalendarExportSettings`
- `CalendarStorage` migration and event emission behavior

**Mock dependencies:**

- `expo-calendar`
- time/clock helpers
- SQLite access where appropriate
- app lifecycle hooks where needed

**Must-cover scenarios:**

- permission granted / denied / revoked
- managed calendar created on first enable
- stored `calendar_id` wins over same-name calendars
- missing stored ID + exactly one marker-bearing calendar recovers cleanly
- multiple marker-bearing calendars produce unhealthy state instead of guesswork
- existing managed calendar recovered on startup
- externally deleted calendar recreated
- orchestrator runs single-flight and coalesces rapid changes
- `needsResync` behavior after overlapping triggers
- storage-layer event signal fires only after successful persistence
- settings state survives app restart
- `delete exported events` removes managed native items and clears local metadata
- `delete exported events` with revoked permission does not claim success
- `keep exported events` disables sync without native deletion
- delete-local-data / delete-account with revoked permission warn and continue as best effort

### 3.3 App-level UI tests

Use React Native component/screen tests for the feature UI.

**Target UI:**

- Settings card
- permission-revoked warning state
- disable-sync choice dialog
- Android target-picker UI if introduced

**Must-cover scenarios:**

- disclosure copy is visible
- toggle reflects enabled/disabled state
- warning appears when sync is unhealthy
- revoked-permission cleanup warning is specific and actionable
- disable flow presents keep/delete choices
- Android device-only fallback copy is honest and specific

### 3.4 E2E regression tests

Use the existing Appium/Jest stack in `mobile-app/e2e/`.

**Primary purpose:**

- verify app-owned flows work end-to-end
- ensure no regressions in existing calendar UX

**Recommended new E2E coverage:**

- enable sync from Settings
- disable sync with `Keep exported events`
- disable sync with `Delete exported events`
- permission-revoked warning state
- persistence of toggle state across relaunch
- no regression in shift/absence creation flows while export is enabled

**Important limitation:**

The E2E suite should validate **app behavior**, not the external calendar app, unless a dedicated test adapter is intentionally added.

---

## 4. What To Automate First

Implementation should not wait until the end to add tests.

Recommended order:

1. Unit tests for normalization, fingerprints, marker parsing, and delete policy
2. Integration tests for reconciler behavior
3. Integration tests for orchestrator single-flight and recovery logic
4. UI tests for Settings flows
5. E2E checks for app-level integration
6. Manual simulator and real-device validation

This order keeps the highest-risk logic under test before the OS-specific work starts to dominate.

---

## 5. Detailed Test Matrix

| Area | Risk | Best layer | Manual needed? |
|------|------|------------|----------------|
| Shift event mapping | Medium | Unit | Sometimes |
| Absence event mapping | Medium | Unit | Sometimes |
| Overnight shift handling | High | Unit + manual | Yes |
| All-day absence handling | High | Unit + manual | Yes |
| Future-facing creation window | High | Unit | No |
| Do not delete past events | High | Unit + integration | Yes, sanity check |
| Marker format and parsing | High | Unit | No |
| Mapping repair after reinstall | High | Integration | Yes |
| Calendar identity recovery | High | Integration + manual | Yes |
| Permission flows | Medium | Integration + E2E | Yes |
| Managed calendar recreation | High | Integration | Yes |
| Delete-flow cleanup | High | Integration + E2E | Yes |
| Revoked-permission cleanup honesty | High | Integration + UI + manual | Yes |
| Settings disclosure copy | Medium | UI test | Yes |
| Android target selection | High | UI + manual | Yes |
| Existing calendar UX regression | High | E2E | Yes |

---

## 6. Unit Test Plan

Create focused tests around pure helpers and reconciler logic.

### 6.1 Event normalization

Test cases:

- shift with same-day end
- shift crossing midnight
- absence full-day
- absence partial-day
- shift title and availability
- absence title and availability

### 6.2 Fingerprints

Test cases:

- same semantic event -> same fingerprint
- title change -> different fingerprint
- time change -> different fingerprint
- all-day flag change -> different fingerprint
- marker-only formatting change should not affect fingerprint

### 6.3 Date window rules

Test cases:

- `today` is included
- tomorrow is included
- yesterday is excluded from new export
- previously exported past event is not marked for normal deletion
- explicit delete flow includes historical managed events

### 6.4 Marker parsing/writing

Test cases:

- valid marker parses correctly
- missing marker returns null
- corrupted marker returns invalid
- marker round-trip preserves app ID and type

### 6.5 Reconciliation decision table

Test cases:

- desired + matching actual + same fingerprint -> no-op
- desired + matching actual + changed fingerprint -> update
- desired + matching actual + externally edited title/notes -> update back to app-owned state
- desired + no actual -> create
- forward-looking actual + no desired -> delete
- past actual + no desired -> ignore in normal reconciliation
- delete-all flow -> include past actual

---

## 7. Integration Test Plan

### 7.1 `DeviceCalendarService`

Mock `expo-calendar` and verify:

- permission request/check paths
- calendar creation with expected metadata
- calendar lookup/recovery
- same-name unrelated calendars are ignored during recovery
- event create/update/delete calls
- graceful handling when native event no longer exists

### 7.2 `CalendarExportReconciler`

Verify:

- reads export-eligible rows from SQLite
- compares against managed events only
- ignores unrelated native events
- does not clean up past events during normal sync
- cleans up past events during explicit delete flow
- rewrites app-managed events after external edits to owned fields
- repairs mapping from marker when mapping table is missing
- refuses ambiguous recovery when multiple marker-bearing calendars exist

### 7.3 `CalendarExportOrchestrator`

Verify:

- initial enable triggers sync
- rapid successive schedule changes produce one active sync plus one queued retry
- foreground re-entry triggers re-sync
- permission revoked marks unhealthy state instead of throwing
- recreated calendar triggers full reconciliation
- sign-out with sync enabled runs cleanup/disable logic before orchestrator unmount
- delete-local-data and delete-account use the shared cleanup path
- revoked-permission delete requests surface a best-effort result instead of false success

### 7.4 `CalendarStorage` and event emission

Verify:

- migration adds export tables cleanly
- schedule change signal fires after successful writes
- failed writes do not emit change signals
- both bulk replace paths and direct absence CRUD paths are covered

---

## 8. UI Test Plan

### 8.1 Settings card

Test:

- title is rendered
- disclosure text is rendered
- toggle reflects stored state

### 8.2 Warning state

Test:

- revoked permission shows unhealthy/warning state
- warning text is actionable and specific
- warning explains when manual deletion may still be required

### 8.3 Disable flow

Test:

- turning off presents both choices
- `Keep exported events` preserves enabled metadata correctly after disable
- `Delete exported events` invokes cleanup path

### 8.4 Android target picker

If implemented, test:

- one synced target -> auto-select path or confirmation copy
- multiple targets -> picker shown
- no synced targets -> `Device only` fallback copy shown

---

## 9. E2E Plan

Use the existing Appium setup documented in:

- `docs/testing/e2e-regression.md`
- `mobile-app/e2e/README.md`

### 9.1 New E2E scenarios

Add or extend tests for:

- open Settings and enable calendar sync
- deny permission and verify warning / disabled result
- grant permission and verify toggle stays on
- disable sync with `Keep`
- disable sync with `Delete`
- relaunch app and verify sync setting persists
- create/edit/delete a shift while sync is enabled and ensure the app flow still works
- create/edit/delete an absence while sync is enabled and ensure the app flow still works

### 9.2 E2E boundaries

Do not block implementation on Appium inspecting the native Calendar app.

If later needed, add a dedicated test-only adapter or debug surface to expose last sync status, but do not mix that with production logic by default.

### 9.3 Rebuild expectations

Because this feature adds a native dependency (`expo-calendar`), E2E validation must assume rebuilds are needed when:

- the dependency is added
- native config changes
- testIDs/accessibility props change
- TEST_MODE hooks change

---

## 10. Manual iOS Simulator Validation

This is the most useful manual environment during development.

### 10.1 Preconditions

- iOS Simulator booted
- app built with the required native module
- Calendar app available
- clean app state when needed

### 10.2 Manual test checklist

1. Enable sync from Settings without opening the Calendar tab first.
2. Confirm permission prompt appears and success path works.
3. Open Apple Calendar and confirm the managed `Open Working Hours` calendar exists.
4. Create a shift in-app and confirm the event appears in Calendar.
5. Edit the shift title/time and confirm the native event updates.
6. Delete the shift and confirm the native event disappears.
7. Create a full-day absence and confirm it lands on the correct date.
8. Create a timed absence and confirm it is not all-day.
9. Create an overnight shift and confirm it spans into the next day.
10. Disable sync with `Keep exported events` and confirm events remain.
11. Re-enable sync and confirm no duplicate events are created.
12. Disable sync with `Delete exported events` and confirm events are removed.
13. Delete the managed calendar in Apple Calendar, reopen the app, and confirm recreation on next sync.
14. Revoke calendar permission in iOS Settings and confirm the app shows unhealthy sync state.
15. While permission remains revoked, attempt a delete/cleanup flow and verify the app does not claim success; it should instruct the user to re-enable access or delete events manually.
16. Edit an exported event directly in Apple Calendar and confirm the next app reconciliation restores the app-owned title/time/marker.
17. Create another calendar named `Open Working Hours` if the simulator allows it, then relaunch and confirm the app continues using the stored managed calendar rather than switching by name.
18. Remove all calendar accounts from simulator (Settings -> Calendar -> Accounts -> delete all). Enable sync and verify graceful handling (error message or local-source fallback, no crash).

### 10.3 Useful simulator notes

Simulator is good for:

- permission flows
- native calendar creation
- event appearance and deletion
- basic update behavior

Simulator is not enough for:

- true iCloud propagation
- family sharing
- account-specific cloud sync behaviors

---

## 11. Manual Android Validation

Android emulator/device validation should focus on:

- permission flows
- target selection behavior
- device-only fallback behavior
- basic event creation/update/delete

### 11.1 Manual checklist

1. Enable sync and verify permission flow.
2. If account-backed targets exist, verify selection UI is understandable.
3. If no synced target exists, verify `Device only` fallback copy is accurate.
4. Create/edit/delete a shift and confirm event behavior in the available calendar app/provider.
5. Create/edit/delete an absence and confirm behavior.
6. Disable sync with `Keep`.
7. Disable sync with `Delete`.
8. Revoke permission and verify warning state.
9. While permission remains revoked, attempt a delete/cleanup flow and verify the app warns accurately instead of claiming deletion succeeded.

### 11.2 Android caveat

Android calendar-provider behavior is more variable than iOS. Real-device smoke testing is more important here than simulator-only confidence.

---

## 12. Real-Device Validation

Before considering the feature ready, do at least:

- one iPhone smoke test
- one Android device smoke test

### iPhone priorities

- iOS permission flow
- Apple Calendar event correctness
- overnight shifts
- all-day absences
- disable keep/delete behavior
- calendar recreation after external deletion

### Android priorities

- writable target selection
- fallback to device-only if needed
- event visibility in the chosen calendar target
- disable keep/delete behavior

### Optional but high-value checks

- account-backed sync propagation to another signed-in device
- editing exported events externally, then reopening app
- duplicate same-name calendar does not cause wrong calendar adoption

---

## 13. Validation Milestones During Implementation

### Milestone 1: Logic complete

Required before moving on:

- unit tests for normalization, marker parsing, fingerprints, delete policy
- integration tests for reconciler core behavior

### Milestone 2: Service/orchestrator complete

Required before wiring UI:

- integration tests for service/orchestrator flows
- migration verified
- storage-layer change signal verified

### Milestone 3: UI complete

Required before broad manual testing:

- Settings UI tests pass
- iOS simulator sanity checks pass
- no regression in existing shift/absence flows

### Milestone 4: Pre-merge / pre-release

Required:

- targeted E2E scenarios pass
- existing E2E suite passes at 48/48 (iOS) and 45/48 (Android, known flakiness excluded)
- iOS simulator manual checklist completed
- Android manual checklist completed as far as environment allows
- real-device smoke tests completed

---

## 14. Recommended Exit Criteria

The feature should not be considered done until all of the following are true:

- automated tests cover the reconciliation and cleanup rules
- normal reconciliation never deletes past managed events
- explicit delete flows do delete past managed events
- revoked-permission delete/erasure flows never claim cleanup succeeded when it was blocked
- permissions and unhealthy-state UX are verified
- no duplicates are created on re-enable or recovery
- calendar recovery never switches targets by name alone
- iOS simulator manual checks pass
- at least one real iPhone and one Android device smoke test are complete

---

## 15. Review Notes

**Reviewer:** Implementation agent (Opus)
**Date:** 2026-04-27

### 15.1 Addition: Sign-out and erasure flow integration tests

Section 7.3 (Orchestrator) should also cover the privacy-sensitive cleanup paths. These are high-risk and must be in the integration test plan:

- sign-out with sync enabled → cleanup runs before orchestrator unmounts
- sign-out with “keep events” → `device_calendar_state.enabled` set to `0`, native events remain
- delete-local-data → exported events + managed calendar deleted, state table wiped
- delete-account → same as delete-local-data

These are now added to Section 7.3 as required integration test scenarios.

### 15.2 Addition: “No calendar accounts” manual test

The iOS simulator manual checklist (Section 10.2) should include:

> Remove all calendar accounts from simulator (Settings → Calendar → Accounts → delete all). Enable sync → verify graceful handling (error message or local-source fallback, no crash).

This covers the `getDefaultCalendarAsync()` returning null edge case documented in the implementation plan.
It is now included in Section 10.2; numbering may change as additional checklist items are added.

### 15.3 Addition: Existing E2E suite regression

After adding `expo-calendar` (which requires a native rebuild), explicitly run the full existing 48-test E2E suite as a milestone gate. The native rebuild could introduce:

- new permission dialogs at startup
- different app launch timing
- accessibility tree changes from the new Settings section

Add to Milestone 4 (Section 13): “existing E2E suite passes at 48/48 (iOS) and 45/48 (Android, known flakiness excluded).”
This is now included in Section 13.

### 15.4 Resolved: Open questions

| Question | Decision |
|----------|----------|
| Debug surface for “last sync result”? | **Yes** — internal only, gated behind `__DEV__` or TEST_MODE. A `CalendarExportDebug.getLastSyncResult()` function (no UI) for integration tests and manual debugging. Low cost, high value. |
| Appium for enable/disable in first implementation? | **Start with UI tests + manual.** Add Appium E2E after the feature stabilizes. Avoids blocking on flaky permission-dialog automation. |
| “External edits overwritten” — test and document? | **Yes** — document as product behavior (“the app owns exported events; external edits may be overwritten on next sync”). Unit test that update rewrites the marker. |
| Revoked-permission delete/erasure behavior? | **Best effort only** — do not claim native cleanup succeeded if calendar access is revoked. Warn clearly and direct the user to re-enable access or delete events manually. |
| Same-name calendar recovery? | **Never trust name alone** — stored `calendar_id` is authoritative; marker-bearing recovery is allowed only when unambiguous. |
| Retention follow-up test plan? | **Not needed now.** If a “delete past events after N weeks” option is added later, it's a small extension to the date-window unit tests. |

---

## 16. Recommendation

The fastest safe path is:

1. heavy automated coverage of reconciliation logic
2. light but targeted E2E coverage of app flows
3. manual simulator validation for OS integration
4. real-device smoke tests for final confidence

That gives strong assurance without pretending the external calendar ecosystem can be fully validated by Jest or Appium alone.
