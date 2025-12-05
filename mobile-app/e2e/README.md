# E2E / Integration Test Notes

Current test flags (set via Detox env or `expo.extra`):
- `TEST_DB_SEED=true` preloads the Expo SQLite + calendar stores with a location, 7 confirmed days, and tracking/instances for a ready-to-submit week (see `src/test-utils/deviceDbSeed.ts`).
- `TEST_PRIVACY_NOISE_SEED=<number>` enables deterministic Laplace noise for stable backend assertions.

Happy-path flow (seeded) – see `happy-path.seeded.spec.ts`:
1. Start backend via `e2e/utils/startBackend.ts` (uses `scripts/start-backend.sh`, dev-e2e.db, `/healthz` wait).
2. Launch app with `TEST_DB_SEED=true` and `TEST_PRIVACY_NOISE_SEED=<number>`; fixtures are pre-seeded.
3. Navigate to Calendar (`tab-calendar`), verify ready state (`week-status-ready`), submit week (`submit-week-button`), expect success toast (`toast-week-sent`).
4. Hit backend `GET /submissions/weekly` and assert the newest record matches the week window/noisy hours.
5. Capture screenshots post-submission and in privacy/settings screens.

Planned UI-driven shift-creation flow:
1. Launch without `TEST_DB_SEED` to start empty (`shift-creation.spec.ts`).
2. Add location/geofence via Setup screen testIDs, open Templates, create + arm template, place a shift on the week grid, enter review, confirm day.
3. Submit week and expect the success toast (`toast-week-sent`).

TODO (when Detox is wired):
- Finalize `detox.config.js` for the chosen simulator + dev-client build.
- Stabilize shift-creation spec once dev-client build/testIDs are verified on device.
- Plumb backend URL/env into tests so we can point at SQLite or staging Postgres.
