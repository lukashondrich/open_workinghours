# Open Working Hours – High-Level TODO

**Last Updated:** 2025-12-09 (backend work events + aggregation complete)
**Current Focus:** Backend Redesign (server-side privacy architecture)

---

## Module Snapshot

| Module | Status | Notes |
|--------|--------|-------|
| Module 1 – Geofencing & Tracking | ✅ Complete | Device-tested (iOS Build #8); see `blueprint.md` Section 4.1 |
| Module 2 – Privacy & Submission | 🔄 In Progress | Backend 74% complete; see `SESSION_PROGRESS.md` |
| Backend Redesign | 🔄 In Progress | Work events + aggregation done; analytics pending |
| Future Modules (3-8) | ⏸️ On Hold | Pending Module 2 completion |

---

## Current Priority: Backend Redesign

**Goal:** Implement server-side privacy architecture per `privacy_architecture.md`

**Timeline:** 6-8 weeks total

### Phase 1: Backend Implementation (2-3 weeks) - 74% COMPLETE

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
- [ ] Schedule periodic job (cron or Celery)

**Analytics Endpoints:**
- [ ] Update `GET /analytics/*` to query `stats_by_state_specialty` table
- [ ] Add pagination and filters (state, specialty, period)
- [ ] Remove direct access to `work_events` table
- [ ] Test that no cells with n_users < K_MIN are returned

**Deprecation:**
- [ ] Mark `POST /submissions/weekly` as deprecated
- [ ] Mark `weekly_submissions` table for deletion
- [ ] Document migration plan

**Testing:**
- [ ] Unit tests for aggregation logic (postponed)
- [ ] Integration tests for auth flow (postponed)
- [ ] Integration tests for work-events CRUD (postponed)
- [ ] Integration tests for right to erasure (CASCADE) (postponed)
- [x] ✅ Manual test aggregation job end-to-end

---

### Phase 2: Mobile App Integration (2-3 weeks) - NOT STARTED

**Authentication UI:**
- [ ] Implement `RegisterScreen.tsx` (collect hospital, specialty, role)
- [ ] Implement `LoginScreen.tsx` (email + code verification)
- [ ] Implement JWT token storage (SecureStore)
- [ ] Add `AuthContext` for app-wide auth state
- [ ] Update navigation (require auth to access main app)

**Remove Client-Side Noise:**
- [ ] Delete `src/lib/privacy/LaplaceNoise.ts`
- [ ] Delete `src/lib/privacy/constants.ts`
- [ ] Remove noise calls from `WeeklySubmissionService.ts`
- [ ] Update tests (no noise expected)

**Update Submission Flow:**
- [ ] Create `DailySubmissionService.ts` (replaces WeeklySubmissionService)
- [ ] Change submission to `POST /work-events/batch` (authenticated)
- [ ] Submit raw hours (planned_hours, actual_hours) without noise
- [ ] Update `CalendarHeader.tsx` submission button logic
- [ ] Update `DataPrivacyScreen.tsx` queue viewer
- [ ] Test submission flow end-to-end (local backend)

**Update Onboarding:**
- [ ] Add registration step after email verification
- [ ] Collect hospital_id, specialty, role_level from user
- [ ] Store auth token in SecureStore
- [ ] Test new user flow on device

**Testing:**
- [ ] Unit tests for auth service
- [ ] Integration tests for submission flow
- [ ] E2E test: register → submit day → verify backend received it
- [ ] Device testing (iOS + Android if available)

---

### Phase 3: Deployment & Migration (1 week) - NOT STARTED

**Backend Deployment:**
- [ ] Set up PostgreSQL on Hetzner (Germany)
- [ ] Deploy FastAPI backend to Hetzner
- [ ] Configure environment variables (JWT secret, DB URL)
- [ ] Run database migrations (Alembic)
- [ ] Test backend in production
- [ ] Run initial aggregation job

**Mobile Deployment:**
- [ ] Increment version to 2.0.0 (breaking change)
- [ ] Update `EXPO_PUBLIC_SUBMISSION_BASE_URL` to production backend
- [ ] Build new version with EAS
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
