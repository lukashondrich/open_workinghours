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
1. Add aggregation helpers (mobile) that:
   - Determine week boundaries based on confirmed shifts.
   - Sum planned hours from calendar instances on confirmed days.
   - Sum actual hours from confirmed tracking records.
2. Lock weeks once submitted (user must “unlock” before editing).
3. Add friction prompts when confirming days without planned shifts (optional but recommended).

### Phase 2: Privacy Layer
1. Implement Laplace noise generation (`LaplaceNoise.ts`), parameterized by epsilon (constants file).
2. Apply noise to both planned and actual totals; retain epsilon in code/config only.
3. Add unit tests to ensure each call produces different noise and mean ≈ original value.

### Phase 3: Submission Queue
1. Create a local queue table (SQLite) for pending weekly submissions (`status: pending/sent/failed`).
2. Add a manual “Submit Week” button in Calendar > Week view once all days are confirmed.
3. POST to the backend endpoint; if successful, mark as sent + lock week. On failure, retain `pending` status with error message.
4. Expose basic queue status in Settings > Data & Privacy (e.g., “No pending submissions / 1 pending”).

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
| Missing planned shift on a confirmed day | Block submission or require manual entry before confirming day. |
| Users editing after submission | Lock week and require explicit “unlock” flow (clears submission). |
| Laplace noise too large for small weeks | Display info tooltip (“noise may vary ±2h”) and allow larger epsilon tuning later. |
| Backend schema drift | Keep payload minimal; document fields in README. |
| Offline submission failures | Queue pending submissions and show status; add retry logic in Phase 2. |

---

**Next steps:**
1. Implement Phase 1 aggregation + locking.
2. Add Laplace helper + tests.
3. Build submission UI + queue.
4. Spin up FastAPI endpoint locally and connect mobile client.
