# Open Working Hours – High-Level TODO

**Last Updated:** 2025-12-23 (All phases complete - Calendar UX verified on TestFlight)
**Current Focus:** Real-world testing and user feedback (Build #15)

---

## Module Snapshot

| Module | Status | Notes |
|--------|--------|-------|
| Module 1 – Geofencing & Tracking | ✅ Complete | Device-tested (iOS Build #15); see `blueprint.md` Section 4.1 |
| Module 2 – Privacy & Submission | ✅ Complete | Auth + daily submissions tested end-to-end |
| Backend Redesign | ✅ Complete | All phases complete; aggregation cron deployed (3 AM UTC daily) |
| Calendar Review Mode | ✅ Enhanced | Active sessions, auto-refresh, continuous drag, stable header (Build #15) |
| Future Modules (3-8) | ⏸️ On Hold | Pending user growth and real-world testing |

---

## Current Priority: Backend Redesign

**Goal:** Implement server-side privacy architecture per `privacy_architecture.md`

**Timeline:** 6-8 weeks total

### Phase 1: Backend Implementation (2-3 weeks) - ✅ 100% COMPLETE

**Database Schema:**
- [x] ✅ Create `users` table (user_id, hospital_id, specialty, role_level, state_code)
- [x] ✅ Create `work_events` table (user_id, date, planned_hours, actual_hours, source)
- [x] ✅ Create `stats_by_state_specialty` table (aggregated, k-anonymous)
- [x] ✅ Create `stats_by_hospital_role` table (aggregated, coarse)
- [x] ✅ Add foreign key constraints + indexes
- [x] ✅ Write Alembic migration script

**Authentication Endpoints:**
- [x] ✅ Implement `POST /auth/register` (email, hospital_id, specialty, role_level)
- [x] ✅ Implement `POST /auth/login` (reuse verification flow, return JWT)
- [x] ✅ Add JWT middleware for protected routes
- [x] ✅ Test auth flow with synthetic users

**Work Events Endpoints:**
- [x] ✅ Implement `POST /work-events` (authenticated, single day)
- [x] ✅ Implement `GET /work-events` (retrieve user's own data, with filters)
- [x] ✅ Implement `PATCH /work-events/{id}` (update work event)
- [x] ✅ Implement `DELETE /work-events/{id}` (right to erasure)
- [x] ✅ Test CRUD operations with real API calls

**Aggregation Job:**
- [x] ✅ Write aggregation script (group by state/specialty/role/period)
- [x] ✅ Implement k-anonymity filter (n_users ≥ 10)
- [x] ✅ Implement Laplace noise generator (ε=1.0)
- [x] ✅ Compute sensitivity for averages
- [x] ✅ Write aggregated stats to `stats_*` tables (UPSERT)
- [x] ✅ Test with synthetic data (verify noise, k-anonymity)
- [x] ✅ Schedule periodic job (cron on Hetzner - 3 AM UTC daily - 2025-12-19)

**Analytics Endpoints:**
- [x] ✅ Create new `GET /stats/by-state-specialty` endpoint (k-anonymous stats)
- [x] ✅ Create `GET /stats/by-state-specialty/latest` endpoint
- [x] ✅ Create `GET /stats/summary` endpoint (metadata)
- [x] ✅ Add pagination and filters (state, specialty, role, period)
- [x] ✅ Verify only groups with n_users >= K_MIN are returned
- [x] ✅ Test with integration tests

**Deprecation:**
- [x] ✅ Add deprecation warnings to `GET /analytics/*` (HTTP headers)
- [x] ✅ Add deprecation warnings to `POST /submissions/weekly`
- [x] ✅ Add deprecation warnings to `POST /reports/`
- [x] ✅ Set sunset date (2026-03-01) and alternate endpoints
- [x] ✅ Old endpoints remain functional (gradual migration)
- [ ] Mark `weekly_submissions` table for deletion (Phase 3)
- [ ] Document migration plan (Phase 3)

**Testing:**
- [x] ✅ Set up pytest infrastructure (pytest.ini, conftest.py, fixtures)
- [x] ✅ Unit tests for aggregation logic (10 tests - all passing)
- [x] ✅ Integration tests for stats endpoints (7 tests created)
- [x] ✅ Integration tests for work-events CRUD (11 tests created)
- [x] ✅ Integration tests for auth flow (6 tests created)
- [x] ✅ Test right to erasure CASCADE delete (1 test created)
- [x] ✅ Manual test aggregation job end-to-end
- [x] ✅ 37 tests total (10 unit + 27 integration), 36 implemented

---

### Phase 2: Mobile App Integration (2-3 weeks) - ✅ 100% COMPLETE

**Authentication UI:**
- [x] ✅ Install `expo-secure-store` package
- [x] ✅ Create auth types (auth-types.ts)
- [x] ✅ Implement `AuthStorage` class (SecureStore wrapper)
- [x] ✅ Create `AuthContext` with React Context + useReducer
- [x] ✅ Create `AuthService` (API calls to backend)
- [x] ✅ Implement `EmailVerificationScreen.tsx` (email + code input)
- [x] ✅ Implement `RegisterScreen.tsx` (collect hospital, specialty, role)
- [x] ✅ Implement `LoginScreen.tsx` (passwordless email verification)
- [x] ✅ Update `AppNavigator` with auth stack and conditional routing
- [x] ✅ Wrap `App.tsx` with `AuthProvider`
- [x] ✅ Update `app.json` (v2.0.0, buildNumber 9, backend URLs)
- [x] ✅ Fix backend response parsing issues (snake_case vs camelCase)
- [x] ✅ Test full auth flow (register → login → token persistence)
- [x] ✅ Add sign out button to Settings screen

**Remove Client-Side Noise:**
- [x] ✅ Delete `src/lib/privacy/LaplaceNoise.ts`
- [x] ✅ Delete `src/lib/privacy/constants.ts`
- [x] ✅ Delete `src/lib/privacy/__tests__/LaplaceNoise.test.ts`
- [x] ✅ Remove noise from submission flow (no longer applied client-side)

**Update Submission Flow:**
- [x] ✅ Add `daily_submission_queue` table to Database.ts
- [x] ✅ Add `DailySubmissionRecord` type to types.ts
- [x] ✅ Create `DailySubmissionService.ts` (replaces WeeklySubmissionService)
- [x] ✅ Submit to `POST /work-events` (authenticated, individual days)
- [x] ✅ Submit raw hours (planned_hours, actual_hours) without noise
- [x] ✅ Hook into `confirmDay()` in WeekView.tsx (automatic submission)
- [x] ✅ Update `CalendarHeader.tsx` (removed weekly submission UI)
- [x] ✅ Implement exponential backoff retry logic (1s → 32s, max 10 retries)
- [ ] Update `DataPrivacyScreen.tsx` to show daily queue (not critical - defer to Phase 3)
- [x] ✅ Test submission flow end-to-end (local backend)

**Update Onboarding:**
- [x] ✅ Add registration step after email verification
- [x] ✅ Collect hospital_id, specialty, role_level, state_code from user
- [x] ✅ Store auth token in SecureStore (JWT + expiry + user data)
- [x] ✅ Implement conditional routing (auth stack vs main app)
- [x] ✅ Test new user flow on device (simulator tested successfully)

**Testing:**
- [x] ✅ Test auth flow: register → login → token persistence across restarts
- [x] ✅ Test submission flow: confirm day → enqueue → send to backend
- [x] ✅ Verify backend receives authenticated work-events (confirmed in PostgreSQL)
- [x] ✅ Device testing on iOS simulator (Build #9 ready for TestFlight)

---

### Phase 3: Deployment & Migration (1 week) - ✅ COMPLETE

**Backend Deployment:**
- [x] ✅ Set up PostgreSQL on Hetzner (Germany)
- [x] ✅ Deploy FastAPI backend to Hetzner
- [x] ✅ Configure environment variables (JWT secret, DB URL)
- [x] ✅ Run database migrations (Alembic)
- [x] ✅ Test backend in production
- [ ] Schedule aggregation job (optional - can be done later)

**Mobile Deployment:**
- [x] ✅ Increment version to 2.0.0 (breaking change)
- [x] ✅ Update URLs to production backend (https://api.openworkinghours.org)
- [ ] Commit app.json changes
- [ ] Build new version with EAS (Build #9)
- [ ] Submit to TestFlight (iOS)
- [ ] Submit to Google Play Internal Testing (Android if ready)

**Data Migration:**
- [ ] Export existing `weekly_submissions` data (CSV for archival)
- [ ] Drop `weekly_submissions` table
- [ ] Drop `reports` table (old daily reports)
- [ ] Verify no data loss

**Communication:**
- [ ] Email testers about breaking change
- [ ] Update README with new setup instructions
- [ ] Update privacy policy (GDPR compliance)
- [ ] Announce update in TestFlight release notes

**Dashboard Update:**
- [ ] Update Next.js dashboard to query `stats_*` tables
- [ ] Remove queries to old `weekly_submissions` table
- [ ] Test dashboard with production backend
- [ ] Deploy dashboard update

**Post-Deployment:**
- [ ] Monitor aggregation job (verify it runs successfully)
- [ ] Monitor submission errors (check logs)
- [ ] Collect user feedback
- [ ] Measure backend performance

---

## Open Questions (Requires Decision)

- [ ] K_MIN value: 10 or 20? (minimum users per aggregate cell)
- [ ] Epsilon (ε) for noise: 1.0 or lower?
- [ ] Sensitivity calculation: global max or per-group empirical?
- [ ] Aggregation job frequency: hourly, daily, or on-demand?
- [ ] DPIA required? (Data Protection Impact Assessment)
- [ ] Privacy policy review timeline?

**Decision log:** Document answers in `BACKEND_REDESIGN_PLAN.md` Section 8.

---

## Future Modules (On Hold)

These are blocked until Module 2 (Backend Redesign) is complete:

- Module 3: Advanced Calendar Features (shift templates sharing, etc.)
- Module 4: Push Notifications
- Module 5: Multi-hospital Support
- Module 6: Analytics Dashboard Enhancements
- Module 7: Data Export & Portability
- Module 8: Onboarding & Polish

See `blueprint.md` Section 10 for full list of planned features.

---

## References

- **Current State:** `blueprint.md` Sections 4 & 5
- **Privacy Design:** `privacy_architecture.md`
- **Backend Plan:** `BACKEND_REDESIGN_PLAN.md`
- **Testing:** `integration-testing-plan.md`, `docs/e2e-status.md`
- **Archived Docs:** `archive/` directory

---

## Notes

**Why the redesign?**
- Old approach: Client-side noise, anonymous submissions
- Problems: No GDPR right to erasure, cannot link to hospitals, per-user noise is inefficient
- New approach: Server-side aggregation with k-anonymity, better privacy guarantees, GDPR compliant

**Breaking change:**
- Users will need to create accounts
- Old data cannot be migrated (anonymous, already noised)
- Hard cutover deployment (no backward compatibility)

**Timeline Risk:**
- Backend work is substantial (6-8 weeks is optimistic)
- Mobile integration depends on backend completion
- E2E testing may reveal issues requiring rework

**Mitigation:**
- Start with backend Phase 1 immediately
- Test aggregation logic thoroughly with synthetic data
- Incremental deployment (backend first, mobile second)
