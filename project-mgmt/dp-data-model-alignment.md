# DP Data Model Alignment

**Created:** 2026-03-23
**Status:** Analysis — open questions for product decision
**Context:** The DP pipeline (v1) is deployed. Before expanding to new release families (F2+), we need to understand the alignment between user-provided data, backend storage, and DP aggregation dimensions.

---

## Current State: What Flows Where

### User Registration (Mobile App)

Users provide 4 fields at registration (`RegisterScreen.tsx`):

| Field | Required | Input type | Notes |
|-------|----------|-----------|-------|
| `hospital_id` | Yes | Free text | No dropdown, no validation |
| `specialty` | Yes | Free text | No dropdown, no validation |
| `role_level` | Yes | Free text | No dropdown, no validation |
| `state_code` | No | Free text (max 2 chars) | Optional |

No profile update endpoint exists. Fields are frozen at registration.

### Backend Storage (User Model)

| Column | Source | Indexed | Used in v1 aggregation? |
|--------|--------|---------|------------------------|
| `email_hash` | Registration | Yes | No |
| `hospital_id` | Registration | Yes | **No** |
| `specialty` | Registration | Yes | **Yes** (GROUP BY) |
| `role_level` | Registration | No | **No** (hardcoded "all") |
| `state_code` | Registration | Yes | **Yes** (GROUP BY) |
| `country_code` | Hardcoded "DEU" | No | **Yes** (GROUP BY) |

### v1 Aggregation Dimensions

The pipeline groups by exactly: `country_code × state_code × specialty`

`role_level` is stored in `StatsByStateSpecialty` but always set to `"all"`.
`hospital_id` is stored in `FinalizedUserWeek` but not used in any aggregation query.

---

## Mismatches

### 1. Free text fields — fragmented cells

**Problem:** `hospital_id`, `specialty`, and `role_level` are all free text. Inconsistent input fragments groups:
- "Cardiology" vs "cardiology" vs "Kardiologie" → 3 separate cells
- Each cell may never reach K_MIN=5

**Impact:** Directly undermines k-anonymity. The DP pipeline silently produces suppressed (never-published) cells for misspelled or inconsistent entries.

**Options:**
- a) Dropdown with predefined values (standard approach, best data quality)
- b) Server-side normalization (map synonyms, case-insensitive, accept German/English)
- c) Both: dropdown with free-text fallback + server normalization

### 2. `state_code` optional — silent exclusion

**Problem:** Users who skip `state_code` don't appear in any state × specialty cell. No error, no warning. Their work hours are silently excluded from all statistics.

**Impact:** Biases statistics toward regions where users filled in state_code. Non-transparent to users.

**Options:**
- a) Make `state_code` required at registration
- b) Create an "Unknown" state bucket (but: this bucket could breach K_MIN or be confusing)
- c) Derive state_code from hospital (if hospital → state mapping exists)

### 3. `role_level` collected but unused

**Problem:** Users provide role_level at registration. It's stored and snapshotted in FinalizedUserWeek. But aggregation hardcodes `role_level = "all"`.

**Impact:** Dead data from user's perspective. Useful if we add a role dimension later (F5: state × specialty × role), but increases cell sparsity.

**Question:** Keep collecting for future use, or simplify registration?

### 4. `hospital_id` stored but no aggregation

**Problem:** hospital_id is required at registration, stored in User (indexed) and FinalizedUserWeek. `StatsByHospital` table exists in the schema. But no aggregation job populates it.

**Impact:** Data is ready for F2 (hospital × specialty) but:
- No aggregation logic
- No composition accounting for F1 + F2 overlap
- Hospital-level cells are very sparse (need many users per hospital)

### 5. No profile updates — frozen affiliations

**Problem:** No PUT/PATCH endpoint for profile fields. If a user changes hospitals or specialties, they must re-register. Old weeks stay attributed to old hospital/specialty forever.

**Impact:** For multi-week accounting, a user who changes jobs has their historical weeks misattributed. FinalizedUserWeek snapshots prevent within-week issues but not cross-week moves.

---

## Future Release Families

From `docs/dp-group-stats-accounting-model.md` §1:

| Family | Dimensions | Data ready? | Aggregation ready? | Notes |
|--------|-----------|-------------|-------------------|-------|
| **F1** | state × specialty (weekly) | Yes | **Yes (deployed)** | v1, running |
| **F2** | hospital × specialty (weekly) | Yes (hospital_id collected) | No | StatsByHospital table exists, no aggregation |
| **F3** | national total (weekly) | Yes (country_code) | No | Trivial to add |
| **F4** | state × specialty (monthly) | Yes | **Yes** (temporal coarsening infrastructure) | period_type supported |
| **F5** | state × specialty × role | Yes (role_level collected) | No | High sparsity risk |

**Composition overlap:** F1 and F2 share users. Publishing both requires accounting for parallel composition (same user's data appears in both state-level and hospital-level cells). The accounting model (§3) handles this via family-level ε budgets, but the code only implements F1.

---

## Open Questions (Product Decisions)

1. **Dropdowns vs free text:** Should we add predefined specialty/role lists? This is the most impactful change for data quality. What taxonomy? (German medical specialties have ~30 Facharzt categories.)

2. **state_code policy:** Required, optional-with-fallback, or derived from hospital?

3. **role_level future:** Keep collecting for F5, or defer/remove?

4. **F2 timeline:** When (if ever) do we want hospital-level statistics? This requires solving composition overlap and likely needs many more users per hospital.

5. **Profile mutability:** Should users be able to update hospital/specialty? If yes, what happens to already-finalized weeks?

---

## Related Docs

| Document | Relationship |
|----------|-------------|
| `docs/dp-group-stats-accounting-model.md` | Release family design, composition model |
| `docs/dp-group-stats-requirements-v2.md` | Cell granularity strategy (§11) |
| `docs/dp-group-stats-simulation-spec.md` | Sparsity analysis, pilot strategy |
| `privacy_architecture.md` | v2 Roadmap (deferred items) |
| `backend/ARCHITECTURE.md` | Database schema, current endpoints |
