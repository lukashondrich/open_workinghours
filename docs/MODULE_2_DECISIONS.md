# Module 2 – Implementation Notes

This file captures the key decisions made while wiring the privacy-preserving weekly submission flow (mobile + backend).

## Mobile Client
- **Confirmed day aggregation** now persists the true number of minutes the user approved on the Week view. We first sum the manual tracking records shown in review mode; only when a day has no local adjustments do we fall back to the background tracking sessions stored in `workinghours.db`.
- **Daily actuals** continue to live in `daily_actuals` so Month/Week UI, the lock badge, and the queue all share a canonical snapshot.
- **Week view confirm CTA** is available even if a day has zero shifts or tracking entries (users can explicitly confirm “off” days).
- **Weekly Submission card** shows the exact true totals (hours + minutes) and lists every submission inside a scrollable list instead of truncating after three rows. Noisy values are only kept inside the queue payload that gets sent to the backend.

## Backend
- Added `POST /submissions/weekly` and `GET /submissions/weekly` (dev helper). Payload is `{ week_start, week_end, planned_hours, actual_hours, client_version }` and responses include `{ id, received_at }`.
- Persistence: new `weekly_submissions` table (UUID PK, week_start/end, noisy hours, client_version, created_at).
- The FastAPI app defaults to a local SQLite database (`dev.db`) when `DATABASE__URL` is not set. This lets Expo developers run the backend with zero external dependencies.
- Helper script `scripts/start-backend.sh` creates the virtualenv, installs dependencies, and runs uvicorn on `0.0.0.0:8000` so mobile devices/simulators can connect over LAN.

## Testing Workflow
- Documented end-to-end submission validation in [`docs/submission-smoke-test.md`](./submission-smoke-test.md). The checklist covers starting the backend, setting `EXPO_PUBLIC_SUBMISSION_BASE_URL`, submitting a week from the Expo app, and verifying the stored rows.

Keep this file updated whenever we tweak Module 2 UX, storage, or API contracts.
