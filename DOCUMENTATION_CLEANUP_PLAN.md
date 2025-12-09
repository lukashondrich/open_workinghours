# Documentation Cleanup Plan

**Created:** 2025-12-08
**Status:** Planning → Execution
**Goal:** Consolidate scattered planning docs into a clean, maintainable structure

---

## Documentation Strategy

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

**3. CLAUDE.md** - AI assistant context
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
- Examples: MODULE_1_PLAN.md, BACKEND_REDESIGN_PLAN.md

**Progress tracking:**
- Created: To track complex multi-week work
- Lifecycle: Active during work → Delete when consolidated into blueprint
- Examples: DOCUMENTATION_STATUS.md, UX_IMPLEMENTATION_SUMMARY.md

**Decision logs:**
- Created: To document implementation choices during development
- Lifecycle: Active during work → Merge into blueprint when finished
- Examples: MODULE_2_DECISIONS.md, docs/e2e-status.md

---

## Current Documentation Inventory

### ✅ Keep & Update (Permanent)
- `blueprint.md` - Update with Module 1 (done), mark Module 2 as redesigned
- `TODO.md` - Update to reflect new backend plan
- `CLAUDE.md` - Update with current state (Module 2 redesign)
- `README.md` - Keep as-is (user setup guide)
- `privacy_architecture.md` - NEW, authoritative privacy design
- `BACKEND_REDESIGN_PLAN.md` - NEW, active planning doc

### 📦 Consolidate → Archive (Completed Work)

**Module 1 docs (geofencing - DONE):**
- `MODULE_1_PLAN.md` → Extract to `blueprint.md` Section 4.1, then archive
- `UX_IMPLEMENTATION_SUMMARY.md` → Extract UX patterns to blueprint, then delete
- `UX_IMPROVEMENTS_MODULE_1_PLAN.md` → Extract completed items to blueprint, move pending to TODO.md, then delete

**Module 2 docs (submission flow - OBSOLETE due to redesign):**
- `MODULE_2_PLAN.md` → Mark as obsolete (replaced by BACKEND_REDESIGN_PLAN), archive
- `MODULE_2_DATA_FLOW.md` → Mark as obsolete, archive
- `docs/MODULE_2_DECISIONS.md` → Extract still-relevant decisions to blueprint, archive
- `backend_plan.md` → Obsolete (replaced by BACKEND_REDESIGN_PLAN), archive

**Testing docs:**
- `integration-testing-plan.md` → Keep (E2E testing is ongoing)
- `docs/e2e-status.md` → Keep (tracks current blockers)
- `docs/submission-smoke-test.md` → Archive (manual test, will be replaced by automated)

**Meta-docs:**
- `DOCUMENTATION_STATUS.md` → Delete (replaced by this cleanup plan + strategy in CLAUDE.md)

### 🗑️ Delete (Outdated/Redundant)
- `mobile-app/DOCUMENTATION_STATUS.md` - Redundant with root-level tracking
- Any other `*_STATUS.md` or `*_PROGRESS.md` files found

---

## Consolidation Actions

### 1. Update blueprint.md

**Add Section 4: Mobile App Architecture**

```markdown
## 4. Mobile App (React Native + Expo)

### 4.1 Module 1: Geofencing & Tracking (✅ Complete)

**Purpose:** Automatic work-time tracking via GPS geofencing

**Architecture:**
[Extract key architecture from MODULE_1_PLAN.md]
- Database schema (workinghours.db)
- Services: GeofenceService, TrackingManager, Database
- Background tracking with expo-location + expo-task-manager

**Implementation notes:**
[Extract from UX_IMPLEMENTATION_SUMMARY.md]
- Geofencing tested on device (iOS)
- Manual clock-in/out fallback implemented
- 5-minute exit hysteresis (prevents false clock-outs)

**Known limitations:**
- iOS background location restrictions
- Battery usage ~X% over 8 hours (needs measurement)

**Files:**
- `mobile-app/src/modules/geofencing/` - Core module
- `mobile-app/src/modules/geofencing/__tests__/` - Unit tests

---

### 4.2 Module 2: Privacy & Submission (🔄 Redesigned)

**Status:** Old implementation exists but obsolete. See BACKEND_REDESIGN_PLAN.md for new approach.

**Old approach (deprecated):**
- Client-side Laplace noise
- Anonymous weekly submissions
- No user accounts

**New approach (planned):**
- Server-side aggregation with k-anonymity
- Authenticated daily submissions
- User accounts with right to erasure
- See: privacy_architecture.md + BACKEND_REDESIGN_PLAN.md

**Files (old implementation):**
- `mobile-app/src/lib/privacy/` - Client-side noise (to be removed)
- `mobile-app/src/modules/calendar/services/WeeklySubmissionService.ts` - To be rewritten
```

**Add Section 5: Backend Architecture**

```markdown
## 5. Backend (FastAPI + PostgreSQL)

### 5.1 Current State (MVP - Anonymous)

**Schema:**
- `verification_requests` - Email verification codes
- `reports` - Old daily reports (deprecated)
- `weekly_submissions` - Anonymous submissions (to be replaced)

**Endpoints:**
- POST /verification/request, /verification/confirm
- POST /submissions/weekly (anonymous)
- GET /analytics (queries weekly_submissions directly)

**Limitations:**
- No user accounts
- Cannot support GDPR right to erasure
- No hospital/specialty tracking

---

### 5.2 Planned State (Privacy Architecture)

See BACKEND_REDESIGN_PLAN.md for full specification.

**Two-layer architecture:**
1. Operational Layer (pseudonymous): users, work_events
2. Analytics Layer (anonymous): stats_by_state_specialty, stats_by_hospital_role

**Key changes:**
- User authentication (JWT)
- Raw daily work events (no client-side noise)
- Server-side aggregation with k-anonymity + noise
- Right to erasure (DELETE user → cascades to work_events)

**Timeline:** 6-8 weeks (backend + mobile + deployment)
```

### 2. Update TODO.md

**Current structure:**
```markdown
# Module 1: ✅ Complete
# Module 2: 🔴 In Planning → Change to "🔄 Redesigning"
# Module 3-8: Pending
```

**New structure:**
```markdown
# Module 1: Geofencing & Tracking ✅ Complete
- Tested on device
- Known issues: [link to blueprint section]

# Module 2: Privacy & Submission 🔄 Architecture Redesign
- Old implementation exists (client-side noise, anonymous)
- New architecture defined: BACKEND_REDESIGN_PLAN.md
- Blocked on: Backend implementation

## Phase 1: Backend Redesign (Current Priority)
- [ ] Implement new schema (users, work_events, stats_*)
- [ ] Implement auth endpoints
- [ ] Implement work-events endpoints
- [ ] Implement aggregation job
- [ ] Test with synthetic data

## Phase 2: Mobile Integration
- [ ] Implement auth screens
- [ ] Remove client-side noise
- [ ] Change submission to authenticated daily events
- [ ] Test against new backend

## Phase 3: Deployment
- [ ] Deploy backend to Hetzner (PostgreSQL)
- [ ] Deploy mobile app update
- [ ] Communicate breaking changes to users

# Modules 3-8: On Hold (pending Module 2 completion)
```

### 3. Update CLAUDE.md

**Add section: Documentation Strategy**
```markdown
## Documentation Strategy

We follow a blueprint-centric approach:

### Permanent Docs
- **blueprint.md** - Architecture of completed features
- **TODO.md** - Active work tracking
- **CLAUDE.md** - This file (AI assistant context)
- **privacy_architecture.md** - Privacy/GDPR design
- **README.md** - User setup guide

### Temporary Docs (Planning → Archive)
- **Planning docs** (e.g., BACKEND_REDESIGN_PLAN.md)
  - Created when starting new work
  - Archived when work is complete and merged into blueprint
- **Progress tracking** (e.g., UX_IMPLEMENTATION_SUMMARY.md)
  - Active during complex work
  - Deleted when work is complete
- **Decision logs** (e.g., MODULE_2_DECISIONS.md)
  - Active during implementation
  - Merged into blueprint when feature is done

### Lifecycle
1. Start feature → Create *_PLAN.md
2. During work → May create *_DECISIONS.md, *_SUMMARY.md
3. Feature complete → Extract key info into blueprint.md
4. Archive/delete planning docs

### When to Update Blueprint
Only when a module/feature is:
- ✅ Implemented
- ✅ Tested (unit + device/integration)
- ✅ Documented
- ✅ Stable

Do NOT add planned features to blueprint - they go in TODO.md or *_PLAN.md.
```

**Update "Current State" section:**
```markdown
## Current State

### What Exists (Production, on Vercel)

✅ **Next.js Web Dashboard**
[existing content...]

### What Exists (Mobile - TestFlight)

✅ **Module 1: Geofencing & Tracking** (Complete)
- Automatic time tracking via GPS
- Manual clock-in/out fallback
- Local SQLite storage (workinghours.db)
- Tested on iOS devices

🔄 **Module 2: Privacy & Submission** (Redesigning)
- OLD: Client-side noise + anonymous submissions (implemented but obsolete)
- NEW: Server-side aggregation + auth (planned, see BACKEND_REDESIGN_PLAN.md)
- Blocked on: Backend implementation

✅ **Backend (FastAPI - Local Dev)**
- Email verification
- Anonymous weekly submissions (to be replaced)
- SQLite fallback (dev.db)

### What's Next

**Current Priority:** Backend Redesign (Module 2)
- Implement privacy_architecture.md
- See: BACKEND_REDESIGN_PLAN.md
- Timeline: 6-8 weeks

**Blocked:** All other modules pending Module 2 completion
```

### 4. Create archive directory

```bash
mkdir -p archive/module-1
mkdir -p archive/module-2-old
mkdir -p archive/testing
```

### 5. Move files to archive

```bash
# Module 1 (completed)
mv MODULE_1_PLAN.md archive/module-1/
mv UX_IMPLEMENTATION_SUMMARY.md archive/module-1/
mv UX_IMPROVEMENTS_MODULE_1_PLAN.md archive/module-1/

# Module 2 (obsolete)
mv MODULE_2_PLAN.md archive/module-2-old/
mv MODULE_2_DATA_FLOW.md archive/module-2-old/
mv docs/MODULE_2_DECISIONS.md archive/module-2-old/
mv backend_plan.md archive/module-2-old/

# Testing (manual smoke test obsolete)
mv docs/submission-smoke-test.md archive/testing/

# Meta-docs (no longer needed)
rm DOCUMENTATION_STATUS.md
rm mobile-app/DOCUMENTATION_STATUS.md
```

### 6. Create archive README

```markdown
# Archive

This directory contains historical planning documents that have been superseded.

## module-1/
Planning docs for Module 1 (Geofencing & Tracking).
- Status: ✅ Complete and merged into blueprint.md
- Archive date: 2025-12-08

## module-2-old/
Original Module 2 planning (client-side noise, anonymous submissions).
- Status: 🔄 Replaced by BACKEND_REDESIGN_PLAN.md
- Archive date: 2025-12-08
- Reason: Architecture changed to server-side aggregation (privacy_architecture.md)

## testing/
Manual testing checklists.
- Status: Replaced by automated E2E tests (integration-testing-plan.md)
- Archive date: 2025-12-08
```

---

## Execution Checklist

- [ ] Create archive/ directory structure
- [ ] Update blueprint.md (add Sections 4 & 5)
- [ ] Update TODO.md (restructure for backend redesign)
- [ ] Update CLAUDE.md (add strategy + current state)
- [ ] Move completed planning docs to archive/
- [ ] Delete redundant meta-docs
- [ ] Create archive/README.md
- [ ] Commit changes with message: "docs: consolidate planning docs into blueprint, archive completed work"

---

## Post-Cleanup Document Count

**Root directory:**
- blueprint.md (updated)
- TODO.md (updated)
- CLAUDE.md (updated)
- README.md (unchanged)
- privacy_architecture.md (new)
- BACKEND_REDESIGN_PLAN.md (new, active)
- integration-testing-plan.md (keep, active)
- LICENSE

**docs/ directory:**
- e2e-status.md (keep, active)

**archive/ directory:**
- module-1/ (3 files)
- module-2-old/ (4 files)
- testing/ (1 file)
- README.md

**Total root .md files:** 9 (down from ~15)

---

**Status:** Ready to execute
**Next:** Run through execution checklist
