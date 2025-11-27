# Open Working Hours – High-Level TODO

**Last Updated:** 2025-11-22 (after calendar integration)
**Current Focus:** Module 2 – Privacy-Protected Weekly Submission

---

## Module Snapshot

| Module | Status | Notes |
|--------|--------|-------|
| Module 1 – Geofencing & Basic Tracking | ✅ Complete | Device-tested; see `UX_IMPLEMENTATION_SUMMARY.md` for final UX details. |
| Module 1 UX Enhancements | ✅ Complete | Navigation + calendar parity documented in `UX_IMPLEMENTATION_SUMMARY.md`. |
| Module 2 – Privacy & Submission | 🔴 In Planning | Scope + phases in `MODULE_2_PLAN.md`. |
| Future Modules (Polish, backend hosting, etc.) | ⏳ | TBD after Module 2. |

---

## Module 2 – Near-Term Tasks

See `MODULE_2_PLAN.md` for the detailed roadmap. High-level milestones:

1. **Weekly Aggregation & Locking**
   - Aggregate planned vs. actual hours per confirmed week.
   - Add friction for days without planned shifts.
   - Lock weeks after submission unless explicitly unlocked.

2. **Privacy Layer**
   - Implement Laplace noise helper (fixed epsilon in code).
   - Unit tests to ensure noise randomness.

3. **Submission Queue & UI**
   - Manual “Submit Week” action + confirmation modal.
   - Queue pending submissions in SQLite, simple error handling.
   - Status indicator in Settings → Data & Privacy.

4. **Backend Stub (FastAPI)**
   - Local `POST /submissions/weekly` endpoint storing noisy payloads.
   - Document how to run the backend locally for testing.

5. **Testing & Docs**
   - Manual device flow (confirm week → submit → verify backend).
   - Update README/onboarding with Module 2 setup instructions.

---

## References

- UX Summary: `mobile-app/UX_IMPLEMENTATION_SUMMARY.md`
- UX Plan / Phase 2 backlog: `mobile-app/UX_IMPROVEMENTS_MODULE_1_PLAN.md`
- Module 2 Plan: `MODULE_2_PLAN.md`
- Blueprint: `blueprint.md`
- Backend reference: `backend/README.md`

*Archived planning docs (Module 1) were deleted to avoid confusion.*
