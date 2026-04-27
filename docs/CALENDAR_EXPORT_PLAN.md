# Calendar Export — Revised Implementation Plan

**Date:** 2026-04-24  
**Branch:** `feature-calendar-export`  
**Status:** Planning / implementation handoff  
**Supersedes:** Earlier draft from the same day

---

## 1. Product Decision Summary

This revised plan keeps the original feature goal, but changes the implementation model.

- Export **planned shifts** and **absences** to a dedicated device calendar managed by the app
- Export **today and future** schedule data when creating new native events
- Never export **GPS tracking sessions**, **manual tracked hours**, or location data
- Keep the feature **fully on-device**; no backend changes
- Use a **root-level sync orchestrator** plus **SQLite-backed reconciliation**
- Treat the exported calendar as **managed app data** with explicit cleanup rules for privacy-sensitive flows

The goal is still best-in-class UX, but with a more reliable and more privacy-coherent implementation than the earlier draft.

---

## 2. What Changed From The Prior Draft

### A. Integration point changed

**Before:** Sync logic lived as `useEffect` side effects inside `CalendarProvider`.

**Now:** Sync is owned by a root-level `CalendarExportOrchestrator` mounted once for authenticated users.

**Why:** `CalendarProvider` only exists inside the Calendar tab. Settings-driven enable/disable, foreground recovery, and privacy cleanup should not depend on that screen being mounted.

### B. Sync model changed

**Before:** Compare `previous` vs `current` in-memory state and apply incremental diffs.

**Now:** Reconcile the desired exported state from SQLite against the actual managed native calendar.

**Why:** Reconciliation is more robust against:

- failed writes
- app restarts during sync
- permission revocation
- externally deleted events
- externally deleted calendar
- reinstall with surviving native calendar data

### C. Android strategy changed

**Before:** Start with local calendar only.

**Now:** Use a hybrid Android approach:

- prefer a writable synced/account-backed calendar when available
- otherwise offer a local-device fallback

**Why:** Local-only Android is reliable, but it breaks the core promise of sharing and cross-device visibility. The revised plan keeps reliability without permanently locking Android into a weaker UX.

### D. Privacy rules are now explicit

The earlier draft handled enable/disable well, but was vague on sign-out, local data deletion, and account deletion.

The revised plan defines exact behavior for those flows because this app is privacy-first and GDPR-sensitive.

### E. Event identity changed

**Before:** Native event identity relied mainly on local mapping storage.

**Now:** Use both:

- a local SQLite mapping table
- an app-owned marker in native event `notes`

**Why:** This makes reinstall recovery and duplicate cleanup much more reliable.

### F. Event styling simplified

**Before:** Plan assumed per-event color mapping.

**Now:** v1 should style the **calendar**, not individual events.

**Why:** The dedicated app calendar already gives strong visual grouping, and per-event color support is not a good dependency for v1.

---

## 3. Goals And Non-Goals

### Goals

- Let users see their schedule in Apple Calendar / Google Calendar / other calendar apps on the device
- Let users share that schedule with family or other apps via the OS calendar ecosystem
- Keep the feature local-first and privacy-preserving
- Make the sync resilient and self-healing
- Keep the settings UX clear about what is and is not exported

### Non-Goals For V1

- Bi-directional sync
- Exporting tracked hours
- Exporting GPS-derived presence
- Reminder/alarm configuration
- Per-event color customization
- Backend calendar subscriptions

---

## 4. Export Scope

| Data type | Export? | Notes |
|-----------|---------|-------|
| Planned shifts (`shift_instances`) | Yes | Main export target |
| Absences (`absence_instances`) | Yes | Full-day and partial-day |
| GPS sessions | No | Too sensitive; reveals actual presence patterns |
| Manual tracked hours | No | Internal tracking, not planning data |

### Sync window

Use a **future-facing creation window**.

Operational rule:

- shifts with `date >= today` are eligible for creation and update
- absences with `date >= today` are eligible for creation and update
- historical schedule rows should not be newly exported
- once a managed event has been written to the native calendar, it should **not** be auto-deleted just because its date has passed
- past managed events should only be removed on explicit delete flows:
  - user disables sync and chooses `Delete exported events`
  - delete local data
  - delete account

This keeps the feature forward-looking without making events disappear after the user has already seen them in their calendar.

### Event mapping

**Shift event**

- Title: shift name
- Timed event
- Availability: busy
- No location
- Calendar-level color only

**Absence event**

- Title: absence name
- Full-day or timed depending on instance
- Availability: free

---

## 5. Privacy And GDPR Behavior

### User disclosure

The settings copy should clearly say:

> Shifts and absences will be written to your device calendar. If that calendar syncs with iCloud, Google, or is shared with others, those events may appear there too. GPS-tracked hours are never exported.

Add a lighter secondary note in the enable flow or "learn more" text:

> Exported events can be removed by the app while calendar access remains enabled. If calendar access is revoked later, automatic removal may require re-enabling access or deleting events manually.

This is the right product rule for a privacy-first app: be explicit about the downstream consequences of writing into the user's own calendar system.

### Deletion behavior

| Flow | Recommended behavior |
|------|----------------------|
| Disable sync | Ask: keep exported events or delete them |
| Sign out | Ask each time if sync is enabled; default to remove exported events |
| Delete local data | Automatically delete exported events/calendar |
| Delete account | Automatically delete exported events/calendar |

### Rationale

- **Delete account** and **Delete local data** are erasure flows. App-managed calendar data should not survive them.
- **Sign out** is weaker than erasure, so the user may choose to keep exported events, but privacy-first defaults should lean toward removal.

---

## 6. User Experience

### 6.1 Settings card

Add a new settings section with:

- title
- explanatory copy
- toggle
- warning state when permission is revoked

Suggested structure:

```text
Calendar Sync
Sync shifts and absences to your device calendar
Your schedule is written to a calendar on this device. If that calendar syncs
with iCloud/Google or is shared, those events may appear there too.
GPS-tracked hours are never exported.
[toggle]
```

### 6.2 Enable flow

1. User enables toggle
2. App requests calendar permission
3. If granted:
   - iOS: choose default writable source
   - Android: resolve export target
4. Create or recover managed calendar
5. Run initial full reconciliation
6. Show success state

### 6.3 Android target selection

Android should not silently claim Google sync if that is not true.

Recommended behavior:

- If exactly one good writable synced target is available, use it and tell the user
- If multiple viable targets exist, show a short picker
- If no synced target exists, offer:
  - `Device only`
  - explanatory copy that this will not sync across devices

### 6.4 Disable flow

When toggling off, show:

- `Keep exported events`
- `Delete exported events`

If the user chooses delete and calendar permission is still available, remove the managed calendar if possible. If platform deletion is flaky, delete all app-managed events, including past ones, and then remove the calendar metadata locally.

If the user chooses delete but calendar permission is currently revoked:

- do not claim cleanup succeeded
- explain that the app needs calendar access to remove exported events
- offer to open OS Settings and retry
- allow the user to turn sync off without deletion if they choose not to restore access

### 6.5 Revoked permission

If permission is revoked after enablement:

- stop syncing
- keep the setting enabled but mark it as unhealthy
- show a warning row in Settings
- re-enable automatically once permission is restored
- if the user later triggers a delete or erasure flow while permission is still revoked, treat native cleanup as best effort and warn that manual deletion may still be required

### 6.6 Externally deleted calendar

If the user deletes the managed calendar outside the app:

- recreate it on the next sync
- perform full reconciliation
- update stored calendar metadata

### 6.7 External edits to managed events

Exported events are app-managed. The app is the source of truth for:

- title
- start/end or all-day dates
- notes marker

If a user edits those fields directly in Apple Calendar, Google Calendar, or another calendar client, the next reconciliation may overwrite those edits. This should be documented in implementation and covered by tests.

---

## 7. Architecture

### 7.1 Core principle

The source of truth is **SQLite schedule data**, not React screen state.

Sync should be triggered by persisted schedule changes and app lifecycle events, not by whether the Calendar screen is currently mounted.

### 7.2 Recommended integration point

Mount the export orchestrator once for authenticated users near the app root, e.g. alongside the authenticated app shell in `AppNavigator`.

Do **not** tie ownership to `CalendarScreen` or `CalendarProvider`.

### 7.3 New files

```text
mobile-app/src/modules/calendar-export/
  services/
    DeviceCalendarService.ts
    CalendarExportReconciler.ts
    CalendarExportOrchestrator.ts
    CalendarExportSettings.ts
  types.ts
```

### 7.4 Responsibilities

**DeviceCalendarService**

- permission checks
- list writable calendar targets
- create/recover/delete managed calendar
- fetch native events for the sync window
- create/update/delete native events

**CalendarExportReconciler**

- read desired exportable schedule rows from SQLite
- compute event fingerprints
- compare desired vs actual
- upsert changed items
- delete stale forward-looking managed events

**CalendarExportOrchestrator**

- single-flight sync queue
- debounced re-sync on schedule changes
- foreground re-sync
- recovery after permission/calendar issues
- initial full sync after enablement

**CalendarExportSettings**

- read/write enabled state
- read/write selected target metadata
- expose sync health state to Settings UI

---

## 8. Storage Additions

Add a new calendar DB migration.

### 8.1 `device_calendar_mappings`

```sql
CREATE TABLE IF NOT EXISTS device_calendar_mappings (
  app_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,      -- 'shift' | 'absence'
  native_event_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 8.2 `device_calendar_state`

```sql
CREATE TABLE IF NOT EXISTS device_calendar_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  calendar_id TEXT,
  target_source_id TEXT,
  target_mode TEXT,               -- 'ios-default' | 'android-account' | 'android-local'
  last_full_sync_at TEXT,
  last_sync_error TEXT,
  updated_at TEXT NOT NULL
);
```

### 8.2.1 Managed calendar identity and recovery

Use `calendar_id` as the authoritative identity of the managed calendar.

Rules:

- if the stored `calendar_id` still resolves to a writable calendar, use it
- never adopt a calendar just because the display name matches `Open Working Hours`
- if the stored ID is missing and exactly one calendar contains valid `owh:*` managed events, adopt that calendar and repair local state
- if multiple calendars contain valid `owh:*` managed events, do not guess; mark sync unhealthy and require explicit user action or reconnect flow

### 8.3 Native event marker

Each managed event should include a marker in `notes`, placed at the end of the notes field so it is unobtrusive when users open the event in their calendar app.

Suggested format:

```text
Fruehschicht - Open Working Hours

owh:type=shift
owh:id=instance-123
owh:fp=abc123
```

If there is no human-readable note content, the marker block alone is acceptable.

This is important for:

- reinstall recovery
- duplicate detection
- mapping repair
- cleanup of stale forward-looking managed events

If a user edits the event notes and corrupts the marker:

- if the local mapping is still valid, updating the event should rewrite the marker
- if neither mapping nor valid marker is available, treat the event as missing and recreate it if needed

---

## 9. Sync Trigger Strategy

### 9.1 Trigger sources

Run reconciliation when:

- user enables sync
- a shift is persisted
- an absence is persisted
- app returns to foreground
- managed calendar is recreated
- permission is restored

### 9.2 Recommended change signal

Add a small schedule-data event emitter, fired at the **successful persistence boundary** for shift/absence changes.

This is stronger than listening to React state because current writes happen through a mix of:

- reducer-driven persistence
- direct storage writes in UI components

The export system should listen to **persisted data changes**, not component-local mutations.

In practice, that means the signal should be emitted from the storage layer after successful writes, covering both:

- bulk replace paths such as `replaceInstances` and `replaceAbsenceInstances`
- direct CRUD paths such as `createAbsenceInstance`, `updateAbsenceInstance`, and `deleteAbsenceInstance`

### 9.3 Single-flight queue

Only allow one sync run at a time.

If new change events arrive during a run:

- mark `needsResync = true`
- immediately run one more reconciliation after the current run finishes

This prevents overlap and keeps behavior predictable under rapid edits.

---

## 10. Reconciliation Algorithm

### 10.1 Desired state

Load all export-eligible shifts and absences from SQLite for `today .. +365 days`.

Normalize each item into a desired event record:

- stable app ID
- entity type
- title
- start/end or all-day dates
- availability
- notes marker
- fingerprint

This desired set is used for **creation and update** of forward-looking events. It is not a signal to delete already-exported past events.

### 10.2 Actual state

For normal reconciliation, load all events from the managed calendar for the same forward-looking date window.

Partition them into:

- app-managed events with valid `owh:*` markers
- unrelated user events, which must be ignored

Past managed events are outside normal reconciliation scope. They remain in the device calendar unless the user explicitly chooses a delete flow.

### 10.3 Matching order

1. Match by local mapping table if valid
2. Otherwise match by native notes marker
3. Otherwise treat as missing and create a new event

### 10.4 Operations

- If desired item exists and fingerprint changed: update event
- If desired item exists and fingerprint unchanged: no-op
- If desired item is missing: create event and save mapping
- If a forward-looking managed native event has no desired counterpart: delete event and delete mapping

Important rule:

- do **not** delete past managed events during normal reconciliation just because they are no longer in the desired forward-looking set
- delete past managed events only during explicit delete flows

### 10.5 Recovery rules

- missing native event ID but mapping exists: recreate
- missing mapping but marker exists: repair mapping
- stored `calendar_id` missing but exactly one marker-bearing calendar exists: adopt it and repair state
- multiple marker-bearing calendars exist: do not guess and do not pick by name; report unhealthy state
- managed calendar missing: recreate and full sync
- permission revoked: stop and report unhealthy state
- external edits to app-managed fields: desired app state wins on next reconciliation and rewrites the native event as needed

---

## 11. Platform-Specific Behavior

### 11.1 iOS

- Use the default writable source when available
- Create a dedicated calendar named `Open Working Hours`
- Use calendar-level color
- Treat iCloud-backed sharing as a possible downstream effect, not a guarantee

Important copy rule: do not promise that events will always sync via iCloud. They will sync according to the user's chosen/default calendar source.

### 11.2 Android

Resolve writable targets in this order:

1. writable synced/account-backed calendar
2. writable local calendar

If the app cannot confidently pick a synced target, ask the user.

This is the key Android UX tradeoff:

- **Account-backed target:** better cross-device sync and sharing, more setup complexity
- **Local target:** simpler and more reliable, but device-only

### 11.3 Timezone handling

Use the device timezone consistently for event construction.

Rules:

- never pass an empty timezone string
- build timed events from local date + local time
- build all-day absences in a way that preserves the intended day on both platforms
- overnight shifts should use `start + duration`, not a naive same-day end time parse

---

## 12. Settings Copy Principles

The copy should always answer:

- what gets exported
- what does not get exported
- where the data goes
- what happens if the device calendar syncs externally

Minimum disclosures:

- shifts and absences are exported
- GPS-tracked hours are not exported
- calendar sync may propagate through iCloud/Google/shared calendars depending on device setup
- turning sync off does not automatically delete past exported events unless the user chooses delete

---

## 13. Implementation Sequence

1. Install `expo-calendar` and verify native config on real builds
2. Add DB migration for export state and mappings
3. Add schedule-data change emitter for persisted shift/absence writes
4. Build `CalendarExportSettings`
5. Build `DeviceCalendarService`
6. Build `CalendarExportReconciler`
7. Build `CalendarExportOrchestrator`
8. Mount orchestrator at authenticated app root
9. Add Settings UI and disclosure copy
10. Implement privacy cleanup in sign-out, delete-local-data, and delete-account flows
11. Test on real iOS and Android devices

Performance note:

- normal reconciliation should be fast enough that no progress UI is expected
- verify initial full sync on real devices
- if initial creation of many future events takes more than roughly 2-3 seconds, add a brief loading state to the toggle

---

## 14. Testing Matrix

Must test on real devices:

- enable sync from Settings without ever opening Calendar tab
- shift create/update/delete
- absence create/update/delete
- overnight shift
- full-day absence
- disable sync: keep
- disable sync: delete
- permission revoked and restored
- managed calendar deleted externally
- reinstall with surviving native calendar
- sign out with sync enabled
- delete local data
- delete account
- Android synced target
- Android local fallback target

---

## 15. Main Risks And Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Screen-local implementation misses updates when Calendar tab is unmounted | High | Root-level orchestrator |
| Android source selection is wrong or misleading | High | Explicit target resolution and honest copy |
| Duplicate events after reinstall or same-name calendar confusion | High | `calendar_id` authority + notes marker recovery + no name-based adoption |
| Exported events survive erasure flows | High | Automatic cleanup when permission is available + explicit warning when OS permission blocks removal |
| Permission revoked mid-lifecycle | Medium | Health state + foreground recovery |
| Rapid local edits cause race conditions | Medium | Single-flight queue and debounced reconcile |
| Timezone/all-day bugs | Medium | Centralized event construction helpers and real-device testing |

---

## 16. Recommendation

This feature should ship as a **managed device calendar export system**, not a thin UI toggle over ad hoc event writes.

That means:

- root-owned sync
- DB-backed reconciliation
- explicit privacy rules
- honest Android behavior

This is the best path if the goal is strong UX from the start without creating a fragile sync implementation that later needs to be replaced.

---

## 17. Implementation Review Notes

**Reviewer:** Implementation agent (Opus)
**Date:** 2026-04-25

The revised plan is architecturally sound and well-motivated. The root-level orchestrator, SQLite-backed reconciliation, privacy cleanup rules, and honest Android behavior are all the right calls for a feature that needs to work well on first use for new users on both platforms.

These review notes are retained as implementation context. The requested changes below have been folded into the main plan where noted.

### 17.1 ACCEPTED: Do not delete past events

**Section affected:** 4 (Export Scope — Sync window)

An earlier version said:

> if older managed events still exist, reconciliation should delete them

This concern was accepted and incorporated into sections 4, 6.4, and 10.

**Final rule:**

- **Creation filter:** Only *create* new events for `date >= today`. Don't export historical shifts that the user never saw in their calendar.
- **No deletion of past events:** Once an event is written to the native calendar, leave it there regardless of whether its date has passed. Past events are harmless — they're calendar entries for things that already happened. Users may want to look back at their schedule.
- **Deletion only on explicit user action:** Past managed events should only be removed when the user disables sync and chooses "Delete exported events", or during erasure flows (delete local data, delete account).

This is now the agreed behavior.

If privacy concerns arise later about long-lived calendar entries, a configurable retention window (e.g., "keep events for N weeks after they pass") can be added as a future enhancement. But the default should be: don't delete.

### 17.2 ACCEPTED: Notes marker format and resilience

**Section affected:** 8.3 (Native event marker)

This was accepted and incorporated into section 8.3.

**Formatting:** The marker is visible to users who open an event in their calendar app. Place it at the end of the notes field, separated by a blank line, to minimize visual disruption:

```text
Frühschicht — Open Working Hours

owh:type=shift
owh:id=instance-123
owh:fp=abc123
```

If the event has no other content, just use the marker block. The "— Open Working Hours" line in the main notes gives human-readable attribution without looking like debug output.

**Corrupted markers:** If a user edits the notes in their calendar app and breaks the marker, the reconciler should handle this gracefully:

- If the mapping table has a valid entry for a desired event, but the native event's marker is corrupted/missing → update the native event (which rewrites the marker) and keep the mapping
- If no mapping exists and no valid marker is found → treat as missing, create a new event (this may create a duplicate if the user removed the marker from an existing event, but this is a very rare edge case and acceptable)

### 17.3 CONFIRMED: Enabled flag storage location

**Section affected:** 8.2 (device_calendar_state)

The plan puts the enabled/disabled state in a SQLite table (`device_calendar_state`). All other boolean app settings (biometric toggle, onboarding tooltip) use `expo-secure-store`. This creates a split where developers need to check two different storage mechanisms for settings.

**Options:**

- **Keep as planned (SQLite):** Advantage: the enabled state, calendar ID, and target metadata live together in one place. The state table is more than just a boolean — it includes `calendar_id`, `target_source_id`, `target_mode`, `last_full_sync_at`, and `last_sync_error`. SQLite makes sense for this structured record.
- **Split:** Put the simple `enabled` boolean in SecureStore (consistent with other toggles), keep the rest in SQLite.

**Recommendation:** Keep as planned. The `device_calendar_state` table is a coherent unit — splitting the boolean out just to match the SecureStore pattern adds complexity without real benefit. The table also correctly gets wiped during "delete local data" (since it's in calendar.db), which is the right behavior.

### 17.4 ACCEPTED: Schedule-data event emitter scope

**Section affected:** 9.2 (Recommended change signal)

This was accepted and incorporated into section 9.2.

Implementation note: the emitter should fire from the `CalendarStorage` persistence methods (`replaceInstances`, `replaceAbsenceInstances`, `createAbsenceInstance`, `updateAbsenceInstance`, `deleteAbsenceInstance`). Currently, some mutations go through the CalendarProvider's `useEffect` persistence (shifts), while others are written directly from UI components (absence create/delete in InlinePicker). The emitter must cover both paths.

A simple approach:

```typescript
// In a new file: src/lib/events/scheduleEvents.ts
const scheduleEvents = new EventEmitter();
export type ScheduleChangeEvent = { type: 'shifts' | 'absences' };

// In CalendarStorage.ts — after each successful write:
scheduleEvents.emit('schedule-changed', { type: 'shifts' });
```

This keeps the change signal at the storage layer, which is the right level of abstraction — the orchestrator doesn't care whether the mutation came from a reducer effect or a direct UI call.

### 17.5 ACCEPTED AS IMPLEMENTATION NOTE: Reconciliation performance expectation

**Section affected:** 10 (Reconciliation Algorithm)

This was accepted as an implementation note and incorporated into section 13 without changing the overall architecture.

If the sync window is `today .. +365 days` as specified in section 10.1, and a user has been using the app for a year with weekly shifts, that's ~250 shift events plus absences. Still fast. No batching or progress UI needed for reconciliation itself (unlike the original draft's concern about "syncing 142 shifts...").

The initial full sync after enablement *could* involve creating many native events at once. If the user has 6 months of future shifts already planned, that's ~130 creates. This should be fast enough to not need a progress indicator, but worth verifying on a real device. If it takes more than 2-3 seconds, a brief loading state on the toggle would be appropriate.

### 17.6 CONFIRMED: Hydration does not cause problems for the emitter

**Section affected:** 9.2 (Recommended change signal)

CalendarProvider's hydration loads data from SQLite, dispatches `HYDRATE_STATE`, then sets `isHydrated = true`. The persistence `useEffect` fires on the next render and calls `replaceInstances()` — writing back the same data just loaded. This triggers the emitter, which triggers a reconciliation that finds nothing changed.

This is harmless: one no-op reconciliation when the Calendar tab first mounts. The orchestrator's debounce absorbs it. No special "suppress during hydration" guard is needed.

### 17.7 OPEN: Remaining gaps and implementation uncertainties

The following items are not architectural problems but need explicit decisions or handling during implementation.

**A. Sign-out sequencing**

The orchestrator is mounted "for authenticated users" and unmounts when auth state changes. But cleanup (deleting exported events) must happen *before* the orchestrator unmounts. The sign-out handler must call cleanup directly rather than relying on orchestrator lifecycle. Additionally, even if the user chooses "keep events" on sign-out, `device_calendar_state.enabled` must be set to `0` — otherwise a subsequent login (same or different user) inherits stale sync state.

**B. No default calendar on iOS**

`getDefaultCalendarAsync()` can return null on a device with no calendars configured (fresh device, iCloud disabled, no accounts). `DeviceCalendarService` needs a fallback: either create a local-only source, or show a clear message explaining that a calendar account is needed. This should be handled in the `getOrCreateCalendar` path.

**C. Fingerprint composition must be explicit**

Section 10 mentions fingerprints but doesn't define the fields. Recommended:

- Shift fingerprint: `hash(name, date, startTime, duration)`
- Absence fingerprint: `hash(name, type, date, startTime, endTime, isFullDay)`

Color is excluded (calendar-level only). If the fingerprint misses a field, updates to that field won't propagate to the native event.

**D. DST transitions**

Germany switches clocks in March and October. A shift at 02:30 on the switch day could be ambiguous. Since we pass `timeZone: 'Europe/Berlin'` and let the OS resolve it, this should work correctly, but it should be an explicit test case in both unit tests (event construction) and manual simulator testing.

### 17.8 Summary

| Item | Type | Action |
|------|------|--------|
| Don't delete past events | Accepted | Future-facing creation, no automatic past-event cleanup |
| Notes marker format | Accepted | Place at end of notes, handle corrupted markers |
| Enabled flag in SQLite | Confirmed | Keep as planned, SQLite is the right choice |
| Schedule-data emitter | Accepted | Emit at persistence boundary in storage layer |
| Reconciliation performance | Accepted note | Likely fast enough, verify initial sync on device |
| External edits policy | Confirmed | App-owned native fields are overwritten by desired app state on reconcile |
| Revoked-permission cleanup | Confirmed | Best effort only; warn clearly if OS permission blocks native deletion |
| Calendar identity recovery | Confirmed | `calendar_id` is authoritative; never recover by name alone |
