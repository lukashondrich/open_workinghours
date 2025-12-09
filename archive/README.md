# Archive

This directory contains historical planning documents that have been superseded.

---

## module-1/

**Planning docs for Module 1 (Geofencing & Tracking)**

**Status:** ✅ Complete and merged into `blueprint.md` Section 4.1
**Archive date:** 2025-12-08

**Files:**
- `MODULE_1_PLAN.md` - Detailed implementation plan (TDD approach, database schema, service architecture)
- `UX_IMPLEMENTATION_SUMMARY.md` - UX state tracking and final decisions (if exists)
- `UX_IMPROVEMENTS_MODULE_1_PLAN.md` - UX enhancements plan (if exists)

**Reason:** Module 1 is complete, tested on device (iOS Build #8), and documented in blueprint.

**Current docs:** See `blueprint.md` Section 4.1 for architecture summary.

---

## module-2-old/

**Original Module 2 planning (client-side noise, anonymous submissions)**

**Status:** 🔄 Replaced by `BACKEND_REDESIGN_PLAN.md`
**Archive date:** 2025-12-08

**Files:**
- `MODULE_2_PLAN.md` - Original weekly submission plan (client-side noise)
- `MODULE_2_DATA_FLOW.md` - Data flow for old approach
- `MODULE_2_DECISIONS.md` - Implementation decisions (if exists)
- `backend_plan.md` - Backend planning for old approach (if exists)

**Reason:** Architecture changed to server-side aggregation with k-anonymity (see `privacy_architecture.md`). Old approach:
- Problems: No GDPR right to erasure, cannot link to hospitals, per-user noise inefficient
- Replaced by: Two-layer architecture (Operational + Analytics layers)

**Current docs:** See `privacy_architecture.md` + `BACKEND_REDESIGN_PLAN.md`.

---

## testing/

**Manual testing checklists**

**Status:** ⏸️ Replaced by automated E2E tests (planned)
**Archive date:** 2025-12-08

**Files:**
- `submission-smoke-test.md` - Manual end-to-end validation checklist (if exists)

**Reason:** Manual smoke tests will be replaced by automated Detox tests (see `integration-testing-plan.md` and `docs/e2e-status.md`).

**Current docs:** See `integration-testing-plan.md` for automated testing strategy.

---

## When to Reference Archived Docs

**Module 1:**
- If you need detailed TDD implementation patterns
- If you want to see original design rationale for geofencing services
- For historical context on UX decisions

**Module 2 (old):**
- **DO NOT use as reference** - architecture has fundamentally changed
- Kept for historical purposes only
- Use `privacy_architecture.md` + `BACKEND_REDESIGN_PLAN.md` instead

**Testing:**
- If automated tests aren't working, manual smoke test can be a fallback
- For understanding the submission flow validation steps

---

**Note:** Archived docs are **read-only**. All updates go to active docs (blueprint.md, TODO.md, etc.).
