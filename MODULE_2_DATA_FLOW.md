# Module 2 – Data Flow & Storage Draft

This document bridges the existing calendar/geofencing modules with the new privacy-preserving weekly submission flow. It outlines where data lives, how confirmations propagate, and which SQLite tables we need before writing any business logic.

---

## 1. End-to-End Flow (High Level)

```
┌─────────────────┐      ┌───────────────────────┐      ┌────────────────────────────┐
│ Calendar (UI)   │      │ Daily Aggregator      │      │ Weekly Submission Service   │
│ shift_instances │◄──┐  │ (new module)          │  ┌──►│ + Laplace noise + queue     │
│ confirmed_days  │   │  │ • planned minutes     │  │   │                            │
└─────────────────┘   │  │ • actual minutes      │  │   └──────────────┬─────────────┘
                      │  └─────────────▲────────┘  │                  │
┌─────────────────┐   │                │           │      HTTP POST    │
│ Geofencing DB   │───┘  fetch daily   │           │  (after noise)    ▼
│ tracking_sessions│      sessions     │           │        ┌──────────────────────┐
│ user_locations   │                  │           └────────►│ FastAPI /submissions │
└─────────────────┘      store summary │                    └──────────────────────┘
                                        ▼
                              ┌────────────────────┐
                              │ workinghours.db    │
                              │ daily_actuals      │
                              │ weekly_queue       │
                              └────────────────────┘
```

**Key idea:** Calendar interactions stay in `calendar.db`, but once a day is confirmed we persist an immutable `daily_actuals` record inside `workinghours.db`, which also owns the weekly submission queue. That keeps all privacy-sensitive aggregates alongside tracking data while letting the calendar UI continue to use its own persistence for templates/instances.

---

## 2. Storage Additions

### 2.1 `calendar.db` (CalendarStorage)

| Table | Purpose | Columns |
|-------|---------|---------|
| `confirmed_days` | Track confirmation + lock status for the UI. | `date TEXT PRIMARY KEY`, `status TEXT CHECK(status IN ('pending','confirmed','locked'))`, `confirmed_at TEXT`, `locked_submission_id TEXT NULL`, `notes TEXT NULL` |

- Hydration: `CalendarProvider` loads `confirmed_days` into `CalendarState.confirmedDates` (and future lock badges) so Week/Month views match persisted state.
- Locking: when a week submission succeeds we update `status='locked'` for all dates inside that week and store the associated `locked_submission_id` to prevent edits until a user explicitly unlocks.

### 2.2 `workinghours.db` (Geofencing Database)

| Table | Purpose | Columns |
|-------|---------|---------|
| `daily_actuals` | Canonical per-day snapshot derived from confirmed calendar days + tracking sessions. | `id TEXT PRIMARY KEY`, `date TEXT UNIQUE`, `planned_minutes INTEGER NOT NULL`, `actual_minutes INTEGER NOT NULL`, `source TEXT CHECK(source IN ('geofence','manual','mixed'))`, `confirmed_at TEXT NOT NULL`, `updated_at TEXT NOT NULL` |
| `weekly_submission_queue` | Queue of weekly payloads awaiting POST. | `id TEXT PRIMARY KEY`, `week_start TEXT NOT NULL`, `week_end TEXT NOT NULL`, `planned_minutes_true INTEGER NOT NULL`, `actual_minutes_true INTEGER NOT NULL`, `planned_minutes_noisy INTEGER NOT NULL`, `actual_minutes_noisy INTEGER NOT NULL`, `epsilon REAL NOT NULL`, `status TEXT CHECK(status IN ('pending','sending','sent','failed')) DEFAULT 'pending'`, `last_error TEXT NULL`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL` |
| `weekly_submission_items` | Join table linking queued weeks to the constituent days. | `submission_id TEXT NOT NULL`, `day_id TEXT NOT NULL`, `FOREIGN KEY(submission_id) REFERENCES weekly_submission_queue(id) ON DELETE CASCADE`, `FOREIGN KEY(day_id) REFERENCES daily_actuals(id) ON DELETE CASCADE`, `PRIMARY KEY(submission_id, day_id)` |

Notes:
- `daily_actuals.date` remains unique so re-confirming a day simply updates the existing row (and bumps `updated_at`).
- `weekly_submission_queue` captures both the true totals and the Laplace-perturbed numbers in the same record, letting the confirmation modal show both values without recomputing noise.
- Queue table doubles as the lock source: once `status='sent'`, the related `confirmed_days.locked_submission_id` is populated.

---

## 3. Aggregation Responsibilities

### 3.1 Daily Aggregator (new service)

1. Triggered when a user taps “Confirm Day” in Week view.
2. Pulls planned minutes from `shift_instances` for that date (summing overlapping instances) while respecting any manual edits the reducer already applied.
3. Fetches the corresponding `tracking_sessions` rows (geofence or manual) from `workinghours.db`, trims them to the target date, and sums durations.
4. Writes/updates the `daily_actuals` row and marks the date as `status='confirmed'` in `confirmed_days`.
5. Emits an in-memory event so the reducer can update `state.trackingRecords` from the canonical value rather than the simulated placeholder.

### 3.2 Weekly Submission Service

1. Validates that all 7 days within `[week_start, week_end]` exist in `confirmed_days` with `status IN ('confirmed','locked')`.
2. Reads the matching `daily_actuals` rows to compute aggregate planned/actual totals.
3. Applies Laplace noise (see §4) to each total, writes a queue entry in `weekly_submission_queue`, and immediately marks the relevant `confirmed_days` rows as `status='locked'` while storing the queue id.
4. Background worker (or manual “Submit now” action) dequeues pending rows, POSTs payload `{ week_start, week_end, planned_hours, actual_hours, client_version }` with the noisy values, then updates `status='sent'` (or `status='failed'` with `last_error`).

---

## 4. Laplace Helper & Constants

- `mobile-app/src/lib/privacy/constants.ts`
  ```ts
  export const PRIVACY_EPSILON = 1.0;
  export const HOURS_SENSITIVITY = 168; // 7 days * 24h (conservative upper bound)
  ```
- `mobile-app/src/lib/privacy/LaplaceNoise.ts`
  ```ts
  export function addLaplaceNoise(value: number, epsilon: number = PRIVACY_EPSILON) {
    const scale = 1 / epsilon;
    const u = Math.random() - 0.5;
    return value - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
  ```
- The helper always receives **hours**, not minutes. We convert minutes → hours before calling it and round the noisy result back to a single decimal (or minutes) for transmission.
- Tests can inject smaller epsilons to verify distribution, but the production code references the exported constant so we do not persist epsilon anywhere on device.

---

## 5. Locking & Unlock Flow

1. Successful submission → `weekly_submission_queue.status = 'sent'` and `confirmed_days.status = 'locked'` for that week.
2. Unlock UI triggers:
   - Deletes the associated queue row if still pending/failed, or creates a tombstone entry noting the unlock if already sent (future audit trail).
   - Resets `confirmed_days.status` back to `'confirmed'` and clears `locked_submission_id`.
   - Requires re-submission to send new data.

This ensures edits cannot silently diverge from what was sent to the backend.

---

## 6. Next Documentation Updates

- Once the above schema is approved we will:
  1. Add the table definitions to `blueprint.md` → Architecture ➜ Mobile privacy pipeline.
  2. Update `MODULE_2_PLAN.md` Phase 1/3 steps with explicit references to `daily_actuals` and `weekly_submission_queue`.
  3. Document unlock/submission flows in `UX_IMPLEMENTATION_SUMMARY.md` after implementation.

Let me know if you’d like an additional diagram (e.g., swimlane) before we start wiring the database migrations.

