# E2E / Detox Status (2025-12-06)

## What’s in place
- Deterministic noise: `TEST_PRIVACY_NOISE_SEED` toggles seeded Laplace noise for stable backend assertions.
- Device fixtures: `TEST_DB_SEED=true` seeds Expo SQLite + calendar data (verified user, 1 location, 7 confirmed days) via `src/test-utils/deviceDbSeed.ts`.
- Test IDs & cues: bottom tabs, submission card/status (`week-status-*`), submit button, toast (`toast-week-sent`), week-day headers/columns (`week-day-*`), confirm buttons (`confirm-day-*`), template panel controls, review toggle.
- Feedback: submission success uses toast instead of alert.
- Specs: seeded happy-path (`e2e/happy-path.seeded.spec.ts`) and UI-driven shift creation (`e2e/shift-creation.spec.ts`), plus backend/start helpers.
- Harness/scripts: `detox.config.js`, `e2e/jest.config.js`, `scripts/run-detox-ios.sh`, npm scripts `e2e:ios` / `e2e:ios:shift`.
- CI workflow: `.github/workflows/e2e-ios.yml` builds Expo dev client on macOS-14, installs pods, sets backend env defaults, and runs the seeded spec headlessly.

## Current blockers
- Backend validation in CI: pydantic settings for `security.*` require long secrets; we added defaults, but runs still failing/ timing out in `beforeAll` when starting backend.
- iOS tooling locally: requires up-to-date Xcode; not available on the developer machine. Android Detox not set up yet.
- Jest/Detox timeouts: the happy-path suite times out in CI (`beforeAll` > 5s) and may leave open handles.
- Backend churn: privacy/data pipeline may change, so assertions could shift.

## Next steps (when we resume)
- Fix CI backend startup: verify `SECURITY__SECRET_KEY`/`SECURITY__EMAIL_HASH_SECRET` length and any other required settings; consider running backend in-process or a lightweight mock for tests.
- Tighten Detox config: ensure binaryPath matches CI build output; keep `--reuse --headless` and bump test timeouts if needed.
- Add log artifacts to CI (backend stdout, Metro, Detox) for quicker triage.
- Consider Android Detox path locally (no Xcode dependency) if iOS remains blocked.
- Revisit assertions after backend/privacy changes to avoid rework.***
