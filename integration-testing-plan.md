# Integration Testing Plan

## Goals
1. Automate the happy-path Module 2 flow (confirm week → submit → verify backend) so regressions are caught quickly.
2. Keep backend/storage abstractions flexible so we can swap SQLite for Postgres without rewriting tests.
3. Capture automated screenshots from Expo/simulator for visual regression + documentation.

## Scope (Phase 1 – MVP)
- **Backend**: run FastAPI with SQLite fallback (dev.db) using `scripts/start-backend.sh`. Provide a test helper that seeds/cleans the DB between scenarios.
- **Mobile**: use Expo + Detox or Playwright-native to drive the UI on iOS simulator (confirm days, submit week, check status). Prefer Detox since we already rely on React Native.
- **Assertions**: after submission, hit `GET /submissions/weekly` and confirm the new row matches expected week start/end + true minutes.

## Architecture
1. **Test Harness**
   - `tests/integration/start_backend.ts` (or JS script) spawns the backend via the shell script, waits for `/healthz`, and tears it down.
   - Detox config for Expo-managed apps (`detox.config.js`) targeting iOS simulator.
2. **Shared Fixtures**
   - `tests/integration/utils/backendClient.ts` – wraps fetch calls so we can point at SQLite (`http://localhost:8000`) or the future Postgres deployment via env var.
   - `tests/integration/utils/calendar.ts` – helper functions to confirm a day, toggle review mode, etc.
3. **Screenshots**
   - Detox supports `device.takeScreenshot('name')`. Add hooks in the happy-path test (after submission) to drop PNGs in `artifacts/screenshots/` which CI can collect.

## Roadmap
### Phase 1 (Local only)
- Wire Detox with Expo (use `detox build`/`detox test` commands, see Expo guide).
- Write a happy-path test: launches app, confirms 7 days via test IDs, taps Submit, awaits success toast, verifies backend endpoint.
- Save screenshots after submission success and after viewing Data & Privacy list.

### Phase 2 (CI + Postgres-ready)
- Add ability to point backend client at remote URL (env var). Tests can run against staging Postgres once deployed.
- Seed/cleanup Postgres using API endpoints or direct SQL scripts so tests leave no residue.
- Integrate Detox run into CI pipeline (GitHub Actions) with macOS runners.

### Phase 3 (Extended flows)
- Add failure-path tests (backend offline, retry states) and ensure UI handles them.
- Add screenshot diffing (e.g., Loki or Percy) if we need visual regression across releases.
- Consider Playwright for web dashboard E2E coverage in parallel.

## Open Questions
- Which CI provider/macOS runners do we have access to? (needed for Detox)
- Do we need Android coverage immediately? (Phase 1 focuses on iOS only)
- For Postgres cleanup, do we prefer API hooks (easier) or DB migrations (faster)?

---
Next steps: review this plan with the team, then start Phase 1 by wiring Detox + backend harness.
