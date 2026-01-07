# Integration Testing Plan

## Goals
1. Automate the happy-path Module 2 flow (confirm week → submit → verify backend) so regressions are caught quickly **with deterministic privacy noise in tests**.
2. Keep backend/storage abstractions flexible so we can swap SQLite for Postgres without rewriting tests.
3. Capture automated screenshots from Expo/simulator for visual regression + documentation.
4. Add coverage for geofence/permission UX and privacy settings, not only the submission happy path.

## Scope (Phase 1 – MVP)
- **Backend**: run FastAPI with SQLite fallback (dev.db) using `scripts/start-backend.sh`. Provide a test helper that seeds/cleans the DB between scenarios.
- **Mobile**: use Expo + Detox or Playwright-native to drive the UI on iOS simulator (confirm days, submit week, check status). Prefer Detox since we already rely on React Native.
- **Privacy noise**: add a deterministic test mode (env flag) that swaps `Math.random()` in `LaplaceNoise` with a seeded PRNG so submissions are stable in CI.
- **Assertions**: after submission, hit `GET /submissions/weekly` and confirm the new row matches expected week start/end + **noisy** minutes that equal the on-device queue entry (we must not assert true minutes because only noisy data crosses the boundary).
- **Test flags**: use `TEST_DB_SEED=true` to preload the Expo SQLite + calendar stores with a verified user, location, and 7 confirmed days; use `TEST_PRIVACY_NOISE_SEED=<number>` for deterministic Laplace noise. Both can be supplied via Detox env or `expo.extra`.

## Architecture
1. **Test Harness**
   - `tests/integration/start_backend.ts` (or JS script) spawns the backend via the shell script, waits for `/healthz`, and tears it down.
   - Detox config for Expo-managed apps (`detox.config.js`) targeting iOS simulator.
2. **Shared Fixtures**
   - `tests/integration/utils/backendClient.ts` – wraps fetch calls so we can point at SQLite (`http://localhost:8000`) or the future Postgres deployment via env var.
   - `tests/integration/utils/calendar.ts` – helper functions to confirm a day, toggle review mode, etc.
   - `tests/integration/utils/deviceDb.ts` – helper to preload the Expo SQLite DB with locations, planned shifts, and daily_actual rows so tests don’t rebuild state every run. Fallback: scripted UI flow to create shifts when fixture load is not possible.
3. **Screenshots**
   - Detox supports `device.takeScreenshot('name')`. Add hooks in the happy-path test (after submission) to drop PNGs in `artifacts/screenshots/` which CI can collect.
4. **Manual ↔ Automated parity**
   - Mirror the steps in `docs/submission-smoke-test.md` so the automated suite stays aligned with the documented manual checklist.

## Roadmap
### Phase 1 (Local only)
- Wire Detox with Expo (use `detox build`/`detox test` commands, see Expo guide).
- Add deterministic-noise switch to the mobile app for tests (seeded PRNG or fixed epsilon override).
- Write a happy-path test: launches app, confirms 7 days via test IDs, taps Submit, awaits success toast, verifies backend endpoint (week window + noisy minutes match queue entry).
- Seed device DB with email verification + one location + 7 confirmed days via `deviceDb.ts` (`TEST_DB_SEED=true`); if seeding fails, fall back to scripted creation flow.
- Add testIDs to bottom tabs (`tab-calendar`), submission status (`week-status-*`), submit button (`submit-week-button`), and success toast (`toast-week-sent`) so Detox assertions are stable. Add day-level testIDs (`week-day-<YYYY-MM-DD>`, `confirm-day-<YYYY-MM-DD>`) for future granular checks.
- Add UI-driven shift-creation spec (no seed): create location, add/arm template, place shift, confirm day, submit week, and assert backend receives it.
- Save screenshots after submission success, privacy settings, and Data & Privacy list.

### Phase 2 (CI + Postgres-ready)
- Add ability to point backend client at remote URL (env var). Tests can run against staging Postgres once deployed.
- Seed/cleanup Postgres using API endpoints or direct SQL scripts so tests leave no residue.
- Integrate Detox run into CI pipeline (GitHub Actions) with macOS runners.

### Phase 3 (Extended flows)
- Add failure-path tests (backend offline, retry states) and ensure UI handles them.
- Add screenshot diffing (e.g., Loki or Percy) if we need visual regression across releases.
- Add shift creation/edit flows (planned shift template + ad-hoc insertion) to catch regressions in planning UX.
- Add geofence permission and activation flow (grant location, create geofence, verify active state).
- Add privacy settings flow (view epsilon/explanation, toggle submission opt-in if available).
- Consider Playwright for web dashboard E2E coverage in parallel.

## Open Questions
- Which CI provider/macOS runners do we have access to? (needed for Detox)
- Do we need Android coverage immediately? (Phase 1 focuses on iOS only)
- For Postgres cleanup, do we prefer API hooks (easier) or DB migrations (faster)?
- Do we want the deterministic-noise switch to live behind an env flag (`TEST_PRIVACY_NOISE_SEED`) or a build-time toggle?
- How do we prefer to load device fixtures? Options: (1) Expo SQLite preloaded file bundled with the test app, (2) Detox helper that writes into the DB via `expo-file-system`, (3) scripted UI setup only (slow).

---
Next steps: review this plan with the team, then start Phase 1 by wiring Detox + backend harness.
