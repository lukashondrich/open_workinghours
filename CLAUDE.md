# Claude Context: Open Working Hours

This file provides context for AI assistants (Claude) working on this project.

**Last Updated:** 2025-12-11 (Phase 3 deployment complete - LIVE IN PRODUCTION)

---

## Project Overview

**Open Working Hours** is a privacy-first platform for healthcare workers to track and report working hours transparently while complying with GDPR.

### Architecture (3 Components)

1. **Next.js Web Dashboard** (deployed to Vercel)
   - Public analytics and reporting
   - Calendar planning interface
   - Email verification flow
   - Location: Root of this repo

2. **React Native Mobile App** (in development)
   - Primary user interface
   - Geofencing-based automatic tracking ✅ Working (Module 1 complete)
   - Calendar with shift planning ✅ Working
   - Privacy-protected submissions 🔄 Redesigning (Module 2)
   - Local-first data storage (SQLite + encryption)
   - Location: `mobile-app/` directory

3. **FastAPI Backend** (partial implementation)
   - Email verification ✅ Working
   - Anonymous weekly submissions ✅ Working (deprecated)
   - Server-side aggregation with k-anonymity 🔴 Planning (redesign)
   - Location: `backend/` directory

---

## Documentation Strategy

We follow a **blueprint-centric** approach to keep documentation manageable:

### Permanent Documents (Always Current)

**1. blueprint.md** - System architecture & design decisions
- **Purpose:** Single source of truth for how the system works
- **Audience:** Developers (current & future), architects
- **Content:** Completed modules, design rationale, schemas, data flows
- **Update trigger:** When a module/feature is FINISHED and tested

**2. TODO.md** - Active work tracking
- **Purpose:** Track ongoing and planned work
- **Audience:** Current developers
- **Content:** Incomplete tasks, priorities, status
- **Update trigger:** Daily/weekly as work progresses

**3. CLAUDE.md** - AI assistant context (this file)
- **Purpose:** Onboard AI assistants quickly to current project state
- **Audience:** Claude, future AI assistants
- **Content:** Current state, recent decisions, where to find things
- **Update trigger:** After major changes or interruptions

**4. README.md** - User-facing setup guide
- **Purpose:** Help users install and run the project
- **Audience:** End users, contributors
- **Content:** Installation, quick start, links to other docs
- **Update trigger:** When setup process changes

**5. privacy_architecture.md** - Privacy design specification
- **Purpose:** Define privacy/GDPR approach (legal + technical)
- **Audience:** Developers, lawyers, auditors
- **Content:** Privacy layers, compliance strategy, data flows
- **Update trigger:** When privacy approach changes (rare)

### Temporary Documents (Planning → Archive)

**Planning docs:**
- Created: When starting a new module/feature
- Lifecycle: Active during development → Archive when finished
- Examples: `BACKEND_REDESIGN_PLAN.md`, `MODULE_1_PLAN.md` (archived)

**Progress tracking:**
- Created: To track complex multi-week work
- Lifecycle: Active during work → Delete when consolidated into blueprint
- Examples: `UX_IMPLEMENTATION_SUMMARY.md` (archived)

**Decision logs:**
- Created: To document implementation choices during development
- Lifecycle: Active during work → Merge into blueprint when finished
- Examples: `MODULE_2_DECISIONS.md` (archived)

### Lifecycle

```
1. Start feature → Create *_PLAN.md
2. During work → May create *_DECISIONS.md, *_SUMMARY.md
3. Feature complete → Extract key info into blueprint.md
4. Archive/delete planning docs
```

### When to Update Blueprint

Only when a module/feature is:
- ✅ Implemented
- ✅ Tested (unit + device/integration)
- ✅ Documented
- ✅ Stable

**Do NOT add planned features to blueprint** - they go in `TODO.md` or `*_PLAN.md`.

---

## Key Documents

| File | Purpose | Status |
|------|---------|--------|
| `blueprint.md` | System architecture (completed modules) | ✅ Current |
| `TODO.md` | Active work tracking (backend redesign tasks) | ✅ Current |
| `privacy_architecture.md` | Privacy/GDPR design specification | ✅ Current |
| `BACKEND_REDESIGN_PLAN.md` | Backend redesign planning (active) | 🔴 Planning |
| `CLAUDE.md` | This file - AI assistant context | ✅ Current |
| `README.md` | User-facing setup guide | ✅ Current |
| `integration-testing-plan.md` | E2E testing strategy (Detox) | ⏸️ On hold |
| `docs/e2e-status.md` | E2E implementation status | ⏸️ On hold |
| `archive/` | Archived planning docs (Module 1, old Module 2) | 📦 Reference |

---

## Current State (2025-12-09)

### What Exists & Works

✅ **Next.js Web Dashboard** (Production on Vercel)
- Calendar with shift planning (drag-and-drop, templates)
- Week view and month view components
- Review mode (compare planned vs tracked)
- Email verification UI
- Analytics dashboard with Recharts
- Multi-language support (English/German via next-intl)
- Dark mode support
- **Tech:** Next.js 16.0.0, React 19.2.0, TypeScript, Tailwind CSS 4.1.9

✅ **React Native Mobile App** (TestFlight Build #9 - v2.0.0)

**Module 1: Geofencing & Tracking** (Complete)
- Background GPS geofencing with `expo-location`
- Automatic clock-in on geofence enter, clock-out on exit
- 5-minute exit hysteresis (prevents false clock-outs)
- Manual clock-in/out fallback
- Local SQLite storage (workinghours.db with encryption)
- Unit tests (Database, GeofenceService, TrackingManager)
- **Files:** `mobile-app/src/modules/geofencing/`

**Module 2: Authentication & Submission** (✅ Complete - Tested)
- Email verification flow (passwordless authentication)
- User registration (hospital_id, specialty, role_level, state_code)
- JWT token storage with expo-secure-store (encrypted)
- Auth state management with React Context
- Daily submission service (authenticated POST /work-events)
- Auto-submit on day confirmation (no weekly batching)
- Client-side noise removed (server-side k-anonymity instead)
- Exponential backoff retry logic (1s → 32s, max 10 retries)
- Sign out button in Settings screen
- **Files:** `mobile-app/src/modules/auth/`, `mobile-app/src/lib/auth/`
- **Status:** ✅ Fully tested end-to-end (register, login, submit, sign out)

✅ **Backend (FastAPI - PostgreSQL Dev + Local SQLite)**
- Email verification (verification codes via email)
- Authentication (JWT with 30-day expiry)
- Work events CRUD (`POST /work-events`, `GET /work-events`, etc.)
- Privacy-preserving aggregation (k-anonymity ≥ 10 + Laplace noise ε=1.0)
- Stats API (`GET /stats/by-state-specialty`, etc.)
- 37 tests (10 unit + 27 integration) - all passing
- **Status:** 95% complete (only scheduling aggregation job pending)
- **Files:** `backend/app/`

### What's Deprecated (Old Architecture)

❌ **Old Module 2 Implementation** (Removed)
- Client-side Laplace noise - **DELETED**
- Anonymous weekly submissions - **DEPRECATED** (old endpoints still work)
- `LaplaceNoise.ts` - **DELETED**
- `WeeklySubmissionService.ts` - **SUPERSEDED** by `DailySubmissionService.ts`

⚠️ **Old Backend Endpoints** (Deprecated but functional)
- `GET /analytics/*` - Returns HTTP 410 with deprecation headers
- `POST /submissions/weekly` - Returns HTTP 410 with deprecation headers
- Sunset date: 2026-03-01
- Use new endpoints: `GET /stats/*`, `POST /work-events`

### What's Next (Current Priority)

✅ **Phase 1: Backend Complete** (95% - only scheduling pending)
- All endpoints implemented and tested
- K-anonymity + Laplace noise working
- 37 tests passing (10 unit + 27 integration)

✅ **Phase 2: Mobile Integration Complete** (100% - tested end-to-end)
- Authentication flow tested (email verification → register/login ✅)
- Daily submission service tested (authenticated POST /work-events ✅)
- Client-side noise removed ✅
- Token persistence across app restarts ✅
- Sign out functionality ✅
- Backend verified receiving work-events in PostgreSQL ✅
- App version 2.0.0, Build #9

✅ **Testing Complete:** All Phase 2 features validated
- Auth flow: register → login → token persistence ✅
- Submission flow: confirm day → POST /work-events → backend storage ✅
- Sign out → clears auth → returns to login ✅
- Verified in backend database: work_events table receiving data

✅ **Phase 3: Deployment** (COMPLETE - deployed 2025-12-11)
- Backend live at https://api.openworkinghours.org
- PostgreSQL on Hetzner (Germany) ✅
- Nginx + SSL (Let's Encrypt) ✅
- Mobile app connected to production ✅
- End-to-end tested (auth + submissions working) ✅
- Remaining: TestFlight Build #9 distribution

**See:** `TODO.md` and `PHASE_2_MOBILE_INTEGRATION_PLAN.md` for detailed status

---

## Privacy Architecture

### ⚠️ Architecture Transition

**OLD (Deprecated):**
- Client-side Laplace noise (ε=1.0)
- Anonymous submissions
- Local Differential Privacy (LDP)
- No user accounts

**NEW (Planning):**
- Server-side aggregation with k-anonymity
- Authenticated daily submissions (raw data)
- User accounts with right to erasure
- Two-layer architecture:
  1. **Operational Layer:** `users`, `work_events` (pseudonymous, GDPR applies)
  2. **Analytics Layer:** `stats_*` tables (k-anonymous + noised, treated as anonymous)

**See:** `privacy_architecture.md` for full specification

**Key Changes:**
- Mobile submits RAW confirmed daily data (no noise)
- Backend aggregates by state/specialty/role/period
- Only publish cells with n_users ≥ K_MIN (e.g., 10)
- Add Laplace noise to aggregates (not individuals)
- Right to erasure: DELETE user → cascades to work_events
- Stats tables retained (anonymous)

---

## Deployment Protection Strategy

### Problem
- Web app is deployed to Vercel (production)
- Mobile app development ongoing
- Need to ensure mobile work doesn't break web deployment

### Solution

**File:** `.vercelignore`
```
mobile-app/
```

**How it works:**
1. Vercel ignores the entire `mobile-app/` directory
2. Web app only rebuilds when files in `app/`, `components/`, `lib/`, etc. change
3. Mobile development can proceed without triggering deployments

---

## Development Workflow

### Current Focus

```bash
# Backend redesign (Phase 1)
cd backend
# Implement new schema, auth endpoints, aggregation job

# Mobile app (waiting for backend)
cd mobile-app
# Module 1 complete, Module 2 blocked on backend
```

### Testing

**Mobile:**
- Unit tests: `npm test` (geofencing module)
- E2E tests: Detox (on hold due to CI issues)
- Device testing: TestFlight (iOS Build #8)

**Backend:**
- Unit tests: TBD (aggregation logic)
- Integration tests: TBD (auth, work-events)

---

## Key Design Decisions

### Data Architecture
- **Choice:** Two-layer (Operational + Analytics)
- **Rationale:** GDPR compliance (right to erasure), better privacy (k-anonymity)

### Privacy Method
- **Choice:** Server-side aggregation with k-anonymity + noise
- **Rationale:** More accurate than per-user noise, flexible analytics, GDPR compliant
- **Parameters:** K_MIN = 10, ε = 1.0, sensitivity = computed per-group

### Aggregation Granularity
- **Choice:** Mobile submits confirmed daily data (not weekly)
- **Rationale:** Flexible for backend to aggregate at different time scales

### User Authentication
- **Choice:** JWT tokens, reuse email verification flow
- **Rationale:** Minimal friction, already built, GDPR requires user linkage

### Database
- **Choice:** PostgreSQL (Hetzner, Germany)
- **Rationale:** EU data residency, GDPR compliance, robust aggregation queries

### Mobile Platform
- **Choice:** React Native + Expo
- **Rationale:** iOS + Android support, TypeScript reuse, TestFlight compatibility

---

## Technical Concerns & Risks

### Backend Redesign (Current)
- **Timeline risk:** 6-8 weeks is optimistic, may take longer
- **Complexity:** Aggregation job is non-trivial (k-anonymity + noise)
- **Migration:** Hard cutover, users must create accounts, old data lost
- **Mitigation:** Test aggregation thoroughly with synthetic data, incremental deployment

### Geofencing Reliability (Module 1 - Mitigated)
- **Concern:** iOS/Android background restrictions
- **Status:** Tested on iOS (Build #8), works in most scenarios
- **Fallback:** Manual clock-in/out available
- **Outstanding:** Battery usage not yet measured

### Privacy Parameters
- **Concern:** K_MIN = 10 may be too sparse in some cells (e.g., rare specialties)
- **Concern:** ε = 1.0 may add too much noise for small groups
- **Decision needed:** Tune after testing with real data

### Legal Compliance
- **Concern:** DPIA (Data Protection Impact Assessment) may be required
- **Concern:** Privacy policy needs legal review
- **Action:** Consult GDPR lawyer before production deployment

---

## Shared Code Between Web & Mobile

### Currently Shared

```typescript
// lib/types.ts (partially shared)
export interface ShiftTemplate { ... }
export interface ShiftInstance { ... }
```

### Strategy

**Short-term:** Copy types to mobile app, diverge as needed
**Long-term:** Consider shared `packages/types/` if codebase grows

---

## Git Repository Status

### Branches

**main**
- Production web app (auto-deploys to Vercel)
- Mobile app (TestFlight builds)
- Backend (local dev only)

**No dev branches** (solo developer, not needed)

### Recent Commits

```
Latest: docs: consolidate planning docs into blueprint, archive completed work
Previous: add BACKEND_REDESIGN_PLAN.md
Previous: add privacy_architecture.md
```

---

## Tech Stack Details

### Web App

```json
{
  "framework": "Next.js 16.0.0",
  "react": "19.2.0",
  "typescript": "5.x (strict)",
  "styling": "Tailwind CSS 4.1.9",
  "ui": "Radix UI",
  "charts": "Recharts 2.15.4",
  "i18n": "next-intl 4.5.3",
  "packageManager": "pnpm 10.20.0"
}
```

### Mobile App

```json
{
  "framework": "React Native 0.74",
  "runtime": "Expo ~51.0",
  "typescript": "5.x",
  "navigation": "React Navigation 6",
  "state": "Zustand-style (calendar context)",
  "storage": "expo-sqlite (SQLite + SQLCipher planned)",
  "location": "expo-location + expo-task-manager",
  "maps": "react-native-maps",
  "testing": {
    "unit": "Jest",
    "component": "@testing-library/react-native",
    "e2e": "Detox (on hold)"
  }
}
```

### Backend

```python
{
  "framework": "FastAPI",
  "database": "SQLite (dev) → PostgreSQL (prod)",
  "orm": "SQLAlchemy",
  "validation": "Pydantic",
  "auth": "JWT (to be implemented)",
  "migrations": "Alembic",
  "hosting": "Hetzner (Germany) - planned"
}
```

---

## Important Constraints

### Legal/Compliance

1. **GDPR compliant** (German healthcare context)
2. **Data residency:** EU only (Hetzner, Germany)
3. **Privacy by design:** Required by law (Article 25)
4. **Data minimization:** Required
5. **Right to erasure:** Must implement (now possible with new architecture)

### Technical

1. **iOS background limitations:** Geofencing works but may fail in edge cases
2. **Android battery optimization:** May kill background tasks (not yet tested)
3. **SQLite performance:** Limited to on-device data (not a concern)
4. **K-anonymity sparsity:** May suppress cells with rare specialties/hospitals
5. **Noise variance:** ε=1.0 may be too noisy for small groups (TBD)

### User Experience

1. **Healthcare workers:** Busy, low tolerance for bugs
2. **Hospital environments:** May block personal phones (geofencing may fail)
3. **Shift work:** Irregular hours, overnight shifts
4. **Legal requirement:** Working hour tracking (Arbeitszeitgesetz)
5. **Account creation:** Users will need to create accounts (new requirement)

---

## When Working on This Project

### Do's

✅ **Read privacy_architecture.md first** - It defines the new approach
✅ **Follow test-driven development** - Tests before implementation
✅ **Test on real devices early** - Simulators lie about geofencing
✅ **Consider privacy implications** - Every feature decision
✅ **Keep web app stable** - It's in production
✅ **Update docs when modules are finished** - Not while in progress

### Don'ts

❌ **Don't edit web app accidentally** - Check your working directory
❌ **Don't skip testing** - Privacy/geofencing are too critical
❌ **Don't assume geofencing works** - Validate on real devices
❌ **Don't hardcode secrets** - Use environment variables
❌ **Don't add planned features to blueprint** - Use TODO.md instead
❌ **Don't create docs for incomplete work** - Wait until stable

### Questions to Always Ask

1. **Privacy:** Does this leak user data?
2. **GDPR:** Does this support right to erasure?
3. **Battery:** Will this drain battery?
4. **Reliability:** Does this work when app is killed?
5. **Testing:** How do I test this automatically?
6. **Documentation:** Where should this be documented?

---

## Communication Style

### User Preferences

- Solo developer
- Wants modular, testable code
- Values privacy and compliance
- Prefers planning before execution
- Asks clarifying questions
- Appreciates detailed technical analysis

### Response Guidelines

- Provide options with pros/cons
- Explain tradeoffs clearly
- Highlight risks early
- Test-driven approach
- Don't over-engineer for solo dev
- Practical > theoretical

---

## Next Steps

### Immediate (Current Sprint)

1. **Start Backend Phase 1** (see `TODO.md`)
   - Implement new database schema
   - Implement auth endpoints
   - Implement work-events endpoints
   - Implement aggregation job

2. **Test aggregation with synthetic data**
   - Verify k-anonymity filter (n_users ≥ 10)
   - Verify Laplace noise is applied correctly
   - Verify sensitivity calculation

3. **Document decisions** in `BACKEND_REDESIGN_PLAN.md` Section 8

### Medium-term

1. **Complete Backend Phase 1** (2-3 weeks)
2. **Start Mobile Phase 2** (add auth, remove noise)
3. **Test end-to-end** (register → submit → verify backend)
4. **Update blueprint.md** with Module 2 (when finished)

### Long-term

1. **Deploy to production** (Hetzner + TestFlight)
2. **Communicate breaking changes** to users
3. **Monitor aggregation job** in production
4. **Collect feedback** and iterate

---

## Resources

### Documentation

- **Blueprint:** `blueprint.md` (system architecture)
- **TODO:** `TODO.md` (active work)
- **Privacy:** `privacy_architecture.md` (GDPR approach)
- **Backend Plan:** `BACKEND_REDESIGN_PLAN.md` (current planning)
- **Archive:** `archive/` (historical planning docs)

### External References

- Differential Privacy: https://en.wikipedia.org/wiki/Differential_privacy
- GDPR Article 25: https://gdpr-info.eu/art-25-gdpr/
- GDPR Article 17: https://gdpr-info.eu/art-17-gdpr/ (right to erasure)
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- React Native Geofencing: https://github.com/transistorsoft/react-native-background-geolocation

### Potential Issues

- iOS background location: https://developer.apple.com/documentation/corelocation/getting_the_user_s_location/handling_location_events_in_the_background
- Android battery optimization: https://dontkillmyapp.com/
- K-anonymity pitfalls: https://en.wikipedia.org/wiki/K-anonymity#Limitations

---

## Mobile App Debugging

**Tools:**
- Xcode Console: Connect iPhone → Xcode → Devices → Open Console
- Simulator first, device second (geofencing needs device)
- Screenshots of errors are diagnostic gold

**Common Issues:**
1. Browser APIs don't work in RN → Use Expo equivalents (`expo-crypto` not `uuid`)
2. Google Maps needs API key → Use native maps instead
3. Increment `buildNumber` in app.json for each TestFlight upload (current: 8)
4. TestFlight updates are manual (tap "Update")

**Deployment:**
- EAS Build ($29/month) bypasses Xcode version issues
- Simulator ≠ Device (especially location/background tasks)
- Test with humans for real-world scenarios (walking, battery drain)

---

**Last Updated:** 2025-12-11
**Status:** Phase 1, 2 & 3 complete - LIVE IN PRODUCTION
**Current Focus:** TestFlight distribution + monitoring
**Production URL:** https://api.openworkinghours.org
