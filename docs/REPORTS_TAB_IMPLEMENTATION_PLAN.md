# Reports Tab — Implementation Plan (v2)

**Status:** UI prototype complete (mock data)
**Branch:** `feature/reports-tab`
**Date:** 2026-04-11
**Prerequisite:** `docs/REPORTS_TAB_UX_SPEC.md`

---

## Why this v2 exists

This version replaces the earlier draft with implementation details aligned to current code and backend contracts.

As of **2026-04-11**, current backend/mobile constraints are:

1. `POST /work-events` accepts today and past dates (future dates are rejected).
2. `POST /finalized-weeks` allows finalization when `week_end <= today` and all 7 work events exist.

**Practical effect:** true same-day Sunday finalization is possible once Sunday is confirmed.

---

## Resolved Decisions

1. **Canonical week identifier:** use `weekStart` (`YYYY-MM-DD`, Monday) everywhere. Do not use `weekNumber` as business identity.
2. **Calendar deep-link param:** reuse existing `Calendar` param `targetDate` (already implemented). Do not introduce `targetWeek`.
3. **Insights contract:** backend currently exposes `planned_mean_hours` and `overtime_mean_hours` (not `actual_mean_hours`). Derive actual as `planned + overtime` in mobile if needed for charting.
4. **User profile source:** read `stateCode` and `specialty` from auth state (`useAuth().state.user`) / `AuthStorage`, not from a new DB table.
5. **Queue model:** add a Reports-specific local queue table and leave legacy weekly-noise queue (`weekly_submission_queue`) untouched but unused by Reports flow.
6. **Reliability:** Tier C (send on app open/foreground) is the foundation; Tier B push remains deferred.

---

## Phase 0: Foundation and Migration

### Mobile DB migration (Schema v6)

**File:** `mobile-app/src/modules/geofencing/services/Database.ts`

Add migration to version 6:

```sql
CREATE TABLE IF NOT EXISTS reports_week_queue (
  week_start TEXT PRIMARY KEY,             -- Monday date YYYY-MM-DD
  status TEXT NOT NULL,                    -- 'queued' | 'sent'
  queued_at TEXT,
  sent_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_week_queue_status
  ON reports_week_queue(status);

CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Notes:
- Keep existing `weekly_submission_queue` and `daily_submission_queue` as-is.
- Reports uses `reports_week_queue` + `daily_submission_queue`.

### New DB helpers

Add query helpers needed by Reports:

```ts
getDailyActualsForRange(startDate: string, endDate: string): Promise<DailyActual[]>
getFirstDailyActualDate(): Promise<string | null>

upsertReportsWeekQueue(...)
getReportsWeekQueue(status?: 'queued' | 'sent')
getReportsWeekByStart(weekStart: string)

setPreference(key: string, value: string): Promise<void>
getPreference(key: string): Promise<string | null>

getDailySubmissionQueueForRange(startDate: string, endDate: string)
```

---

## Phase 1: Week State Read Model (real data)

**Goal:** replace mock weeks with week states derived from `daily_actuals` + queue status.

### 1.1 New service

**New file:** `mobile-app/src/modules/reports/services/WeekStateService.ts`

Responsibilities:
- Build week list from first tracked week to current week.
- Compute confirmed day count per week from `daily_actuals`.
- Merge queue state from `reports_week_queue`.
- Return:
  - active weeks (`unconfirmed`, `confirmed`, `queued`)
  - sent weeks (`sent`)

Week state rules:
- Current week: always `unconfirmed` in Reports (cannot finalize this week yet).
- Past week:
  - `sent` if queue row has `status='sent'`
  - `queued` if queue row has `status='queued'` and week still fully confirmed
  - `confirmed` if 7/7 confirmed and not queued/sent
  - `unconfirmed` otherwise

### 1.2 ReportsScreen wiring

**File:** `mobile-app/src/modules/reports/screens/ReportsScreen.tsx`

- Replace `MOCK_ACTIVE_WEEKS` and `MOCK_SENT_WEEKS` with service calls.
- Keep visual behavior; use real `weekStart` in state objects.
- Keep sort by date (`weekStart` desc), not by week number.

### 1.3 Tests

- Unit test week-state computation:
  - no data
  - sparse weeks with gaps
  - current week handling
  - queued week that becomes unconfirmed after edits

---

## Phase 2: Queue + Preferences Persistence

**Goal:** persist per-week queue toggles and auto-send preference.

### 2.1 Queue methods in WeekStateService

Add methods:

```ts
queueWeek(weekStart: string): Promise<void>
unqueueWeek(weekStart: string): Promise<void>
getQueuedWeeks(): Promise<string[]>

setAutoSend(enabled: boolean): Promise<void>
getAutoSend(): Promise<boolean>

setReportsFirstTimeSeen(seen: boolean): Promise<void>
getReportsFirstTimeSeen(): Promise<boolean>

setLastRewardWeek(weekStart: string): Promise<void>
getLastRewardWeek(): Promise<string | null>
```

### 2.2 Auto-send reconciliation

When auto-send is ON:
- Queue all eligible past weeks with 7/7 confirmations.
- Do not queue current week.

On each refresh/mount:
- Reconcile queue rows with confirmation state.
- If a queued week is no longer 7/7 confirmed, revert it to not queued.

### 2.3 ReportsScreen wiring

- Load auto-send + first-time flags from `app_preferences`.
- `handleToggleSend` persists queue state.
- `handleAutoSendToggle` persists preference and queues eligible weeks.

---

## Phase 3: Reliable Finalization (Tier C)

**Goal:** send eligible queued weeks on app start/foreground and persist sent state.

### 3.1 New service

**New file:** `mobile-app/src/modules/reports/services/WeekFinalizationService.ts`

Core method:

```ts
sendEligibleQueuedWeeks(): Promise<SendResult[]>
```

Algorithm per queued week:
1. Skip unless week has ended (`weekEnd <= today` in local timezone).
2. Ensure local 7/7 confirmations still exist.
3. Ensure all 7 daily submissions are sent:
   - process pending queue
   - retry failed entries for this week, then process again
4. Call `POST /finalized-weeks { week_start }`.
5. Handle response:
   - `201`: mark local week as `sent`
   - `409`: treat as already finalized and mark local week as `sent` (idempotent recovery)
   - other errors: keep queued, store `last_error`
6. On sent, lock local confirmed days for that week in calendar storage (`status='locked'`).

### 3.2 Triggering strategy

Trigger `sendEligibleQueuedWeeks()`:
- on app becoming authenticated
- on app state change to `active` while authenticated

Preferred integration point:
- `mobile-app/src/navigation/AppNavigator.tsx` (has auth context already)

### 3.3 Monday reward card

- Reward appears if at least one week transitions to `sent` since last seen reward key.
- Persist last shown reward `weekStart` in `app_preferences`.

### 3.4 Critical reliability detail

Add a helper in `DailySubmissionService` for recovery paths:
- process both `pending` and `failed` (with controlled retries), at least for targeted dates.

Without this, queued weeks can stall forever after transient failures.

---

## Phase 4: Calendar Deep-Link

**Goal:** tapping a week card opens Calendar on that week.

### 4.1 Use existing navigation contract

Current contract already supports:

```ts
Calendar: { targetDate?: string }
```

So Reports should navigate with:

```ts
navigation.navigate('Calendar', { targetDate: weekStart });
```

No navigator type change required.

### 4.2 ReportsScreen change

Replace current placeholder navigation with weekStart-based navigation.

---

## Phase 5: Collective Insights (real data)

**Goal:** unlock first insights card when published stats exist for user’s state × specialty.

### 5.1 New service

**New file:** `mobile-app/src/modules/reports/services/CollectiveInsightsService.ts`

Fetch:

```ts
GET /stats/by-state-specialty?country_code=DEU&state_code={stateCode}&specialty={specialty}&limit=1
```

Parse fields:
- `planned_mean_hours`
- `overtime_mean_hours`
- `planned_ci_half`
- `actual_ci_half`
- `overtime_ci_half`
- `n_display`
- `status`
- `period_start`, `period_end`

Derived value (mobile-side):
- `actual_mean_hours = planned_mean_hours + overtime_mean_hours` (inference)

### 5.2 Unlock logic

Unlock card only if:
- user has at least one sent week
- API row exists with `status='published'`
- required numeric fields are non-null

Otherwise show locked placeholder.

### 5.3 User context source

Use:
- `useAuth().state.user?.stateCode`
- `useAuth().state.user?.specialty`

If missing, keep card locked.

### 5.4 Deferred insight cards

- Card 2 (hospital/regional): defer until backend endpoint exists.
- Card 3 (trend): can be added by querying multiple periods from same endpoint later.

---

## Phase 6: Export (CSV)

**Goal:** export sent history as shareable CSV.

### 6.1 Data source

- `reports_week_queue` where `status='sent'`
- `daily_actuals` for each sent week’s 7 dates

### 6.2 Implementation

**New file:** `mobile-app/src/modules/reports/services/ExportService.ts`

Flow:
1. Collect sent weeks + daily records
2. Build CSV rows:
   - week_start
   - date
   - planned_hours
   - actual_hours
   - overtime_hours
   - source
3. Write to `FileSystem.cacheDirectory`
4. Share via `expo-sharing`

Dependencies already present in `mobile-app/package.json`:
- `expo-file-system`
- `expo-sharing`

---

## Phase 7: Push Notifications (Tier B, deferred)

Keep deferred until Phases 1–5 are stable.

When implemented:
- push token registration endpoint
- backend scheduled push for users with queued eligible weeks
- notification tap just wakes app; Tier C does actual send

Note: Sunday-moment behavior is now compatible with backend/date validation, subject to app-open/push timing.

---

## Recommended Build Order

1. Phase 0 (migration + DB helpers)
2. Phase 1 (week read model)
3. Phase 2 (queue + preferences)
4. Phase 3 (Tier C send + retry + locking)
5. Phase 4 (deep-link)
6. Phase 5 (insights card 1)
7. Phase 6 (CSV export)
8. Phase 7 (push deferred)

**Critical path:** 1 → 2 → 3

---

## Testing Plan

### Unit tests

- `WeekStateService`
  - week computation, gaps, current week behavior
  - queue reconciliation
- `WeekFinalizationService`
  - success path (`201`)
  - idempotent path (`409`)
  - skip path when daily submissions incomplete
  - retry path with failed daily submissions
- `CollectiveInsightsService`
  - published vs suppressed mapping
  - null-safe parsing

### Integration checks on device

1. Confirm 7 days for a past week -> week shows confirmed.
2. Queue week -> persists after app restart.
3. Put app background/foreground -> eligible queued week finalizes and moves to sent.
4. Simulate network failure -> queued remains, retries next foreground.
5. Sent week days become locked in Calendar.
6. Reports card tap jumps Calendar to the correct week.

### E2E (Detox)

Add/extend tests for:
- reports tab rendering with real data
- auto-send toggle persistence
- queue toggle behavior
- sent history expansion

---

## Remaining Product/Backend Questions

1. **Transmission semantics:** Should we enforce an optional Sunday cutoff time (e.g., 18:00 local) or allow finalization any time Sunday?
2. **Queue UX:** keep per-card queue switches (current prototype) vs switch to single bulk queue action from UX text?
3. **Insights contract:** should backend expose `actual_mean_hours` directly to remove mobile-side inference?
