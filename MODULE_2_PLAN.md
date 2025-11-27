# Module 2: Privacy-Protected Weekly Submission

**Goal:** Aggregate planned vs. actual hours at the weekly level, add Laplace noise client-side, and submit the noisy payload to a FastAPI endpoint (local for now).

## 1. Scope & Assumptions

- **Data sources**
  - Planned hours: sum of calendar shift durations (confirmed days only).
  - Actual hours: sum of confirmed tracking logs.
  - Only weeks where every day is confirmed can be submitted.
- **Privacy**
  - Laplace mechanism applied on-device before submission (fixed epsilon, not stored in DB).
  - Users receive the true values via email export; backend only stores noisy totals.
- **Submission workflow**
  - Manual “Submit Week” action with basic success/failure feedback.
  - Queue submissions locally; retries/backoff deferred to Phase 2.
- **Backend**
  - FastAPI endpoint (local) accepts `{ weekStart, weekEnd, plannedHours, actualHours }` (no epsilon).
  - Schema designed with future auth expansion in mind, but MVP can skip auth.

## 2. Mobile Implementation Plan

### Phase 1: Weekly Aggregation
1. Add persistence + aggregation helpers (see `MODULE_2_DATA_FLOW.md`):
   - `calendar.db`: new `confirmed_days` table so confirmations survive reload and expose lock state to UI.
   - `workinghours.db`: new `daily_actuals` table storing immutable per-day planned vs. actual minutes derived from calendar instances + tracking sessions.
   - Helper service that writes `daily_actuals` every time a day is confirmed, ensuring the reducer, storage, and upcoming queue reference the same canonical numbers.
2. Lock semantics (pre-submission): confirmed days default to `status='confirmed'`, and the user must explicitly “Unlock” before editing if a day was already part of a sent week.
3. Add friction prompts when confirming days without planned shifts (optional but recommended).

### Phase 2: Privacy Layer
1. Implement Laplace noise helper (`lib/privacy/LaplaceNoise.ts`) using `PRIVACY_EPSILON = 1.0` from `lib/privacy/constants.ts` (see data-flow doc).
2. Apply noise to both planned and actual totals (minutes → hours → noise → minutes) before enqueueing submissions; retain epsilon in config only.
3. Add unit tests to ensure each call produces different noise and mean ≈ original value.

### Phase 3: Submission Queue
1. Create the queue schema described in `MODULE_2_DATA_FLOW.md`:
   - `workinghours.db.weekly_submission_queue` stores true + noisy totals, epsilon, and status (`pending/sending/sent/failed`).
   - `weekly_submission_items` links each queued week to its constituent `daily_actuals` IDs.
2. Add a manual “Submit Week” button in Calendar > Week view once all days are confirmed. The button:
   - Validates `confirmed_days` coverage for the target week.
   - Aggregates `daily_actuals`, applies Laplace noise, persists queue entry, and updates `confirmed_days.status = 'locked'` with the queue id.
3. POST to the backend endpoint; if successful, mark queue row as `sent` and keep days locked. On failure, set `status='failed'` with `last_error` and surface a retry option (keeping the week locked until user unlocks explicitly).
4. Expose basic queue + lock status in Settings > Data & Privacy (e.g., “1 pending submission”, “Last week sent on …”) and offer an “Unlock week” CTA that clears the queue row + lock if the user needs to edit.

### Phase 4: UI/UX polish
1. Confirmation modal summarizing the week totals (pre-noise and noisy) before sending.
2. Add toast/toast-error messaging for submission success/failure.
3. Indicate locked weeks visually (e.g., badge on Month view, disable edit controls).

## 3. Backend Stub Plan (FastAPI)

1. **Endpoint**: `POST /submissions/weekly`
   - Payload: `{ week_start: date, week_end: date, planned_hours: float, actual_hours: float, client_version: str }`
   - Response: `{ id, received_at }`
2. **Storage**: Simple table with these fields plus timestamps (no epsilon).
3. **Dev workflow**: run locally (uvicorn) while mobile app hits `http://localhost:8000` during development.
4. **Future-proofing**: structure code to add auth headers later (e.g., optional `X-Device-Token`).

## 4. Testing Strategy (Initial)

- Unit tests for Laplace noise helper (distribution sanity checks).
- Integration test (mobile) that aggregates a mock week, adds noise, and enqueues submission.
- Manual tests: device flow confirming a week, submitting, and verifying backend receives noisy totals.
- Postponed: automated queue retry tests, end-to-end API tests (once backend hosted).

## 5. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Missing planned shift on a confirmed day | Block submission or require manual entry before confirming day (the `daily_actuals` helper should warn before writing). |
| Users editing after submission | `confirmed_days.status='locked'` + queue linkage enforce an explicit “unlock week” flow that clears or supersedes the prior submission before edits apply. |
| Laplace noise too large for small weeks | Display info tooltip (“noise may vary ±2h”) and allow larger epsilon tuning later. |
| Backend schema drift | Keep payload minimal; document fields + queue schema in README/blueprint so backend + mobile stay aligned. |
| Offline submission failures | Queue pending submissions and show status; add retry logic in Phase 2. |

---

**Next steps:**
1. Implement Phase 1 aggregation + locking.
2. Add Laplace helper + tests.
3. Build submission UI + queue.
4. Spin up FastAPI endpoint locally and connect mobile client.
