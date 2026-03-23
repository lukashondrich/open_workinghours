# dp-group-stats: Implementation Status

**Created:** 2026-03-21
**Updated:** 2026-03-23
**Purpose:** Track implementation status of the DP pipeline against the specification.
**Source of truth:** `dp-group-stats-requirements-v2.md`, `dp-group-stats-accounting-model.md`, `dp-group-stats-simulation-spec.md`

---

## Current Deployed State

The DP pipeline covers:
- Laplace mechanism with ε split 0.2 planned / 0.8 actual (total 1.0 per family per period)
- **Adaptive ε schedule**: reduces ε per release as cumulative exposure approaches annual cap
- K_MIN=5, dominance rule (top-1, clipped actual, 30%)
- Temporal activation (2-week warming) and deactivation (2-week grace)
- Substitution neighboring relation (counts public, noise on sums only)
- SQL-level clipping: planned [0, 80h], actual [0, 120h]
- Per-cell and per-user ε ledgers (recording + querying)
- **Per-user budget monitoring**: admin summary endpoint, per-user budget endpoint, anomaly logging
- Fixed candidate cell universe (StateSpecialtyReleaseCell table)
- Finalized user-week immutability
- Single release family: state × specialty (weekly)
- Annual ε cap = 150 (config-time validation + runtime adaptive schedule)
- **Confidence intervals**: CI half-widths for planned/actual/overtime with n_display rounding
- Publication status collapsed to generic "published"/"suppressed" in public API
- Counts hidden from public API
- **Temporal coarsening infrastructure**: periods.py supports weekly/biweekly/monthly; aggregation supports multi-week CTE. Config for per-family cadence selection is deferred (PeriodType not yet exposed in config).

---

## Completed Items

### 1. Graceful Degradation (Adaptive ε Schedule) — DONE

**Spec:** Accounting-model §5.2, Requirements-v2 §7.5

**Implementation:**
- `compute_adaptive_epsilon()` in `dp_group_stats/accounting.py`: `min(config_epsilon, remaining / remaining_periods)`
- Integrated in aggregation pipeline: computes year-to-date spending, scales epsilon split proportionally
- Anomaly logging when adaptive_eps < 50% of configured value
- No hard cutoff — cells never go dark due to budget exhaustion

### 2. Per-User Budget Runtime Monitoring — DONE

**Spec:** Accounting-model §4.3, §4.2

**Implementation:**
- `user_annual_summary()`: per-user ε breakdown by year
- `worst_case_user_spend()`: identifies highest-exposure user
- `budget_monitoring_summary()`: admin-level overview (n_users, worst/avg spend, utilization %)
- `user_cumulative_spent()`: total ε since a given date
- Admin endpoint: `GET /stats/admin/privacy-budget-summary`
- Per-user endpoint: `GET /auth/me/privacy-budget` (Art. 15 transparency)

### 3. Temporal Coarsening Infrastructure — PARTIAL (by design)

**Spec:** Accounting-model §5.3, Simulation-spec §8

**Implementation:**
- `periods.py`: `get_period_bounds()`, `period_before()`, `compute_period_index()` for weekly/biweekly/monthly
- Aggregation supports multi-week CTE query with per-user averaging across weeks
- DB schema has `period_type` column on stats and ledger tables

**Deferred:** PeriodType config selection is not exposed — the system defaults to weekly. Per-family cadence is a product decision; the architecture supports it but the config knob is intentionally not wired up yet.

### 4. Error Bars / Confidence Intervals — DONE

**Spec:** Simulation-spec §10

**Implementation:**
- `laplace_ci_half_width()` in `dp_group_stats/mechanisms.py`: computes CI half-width for Laplace-noised mean
- `n_display = max(rounding, (n_users // rounding) * rounding)` — rounds down to nearest 5
- DB columns: `planned_ci_half`, `actual_ci_half`, `overtime_ci_half`, `n_display`
- API schema: CI fields returned for published cells only
- Overtime CI is conservative: `overtime_ci_half = planned_ci_half + actual_ci_half`

---

## Remaining: Not Gaps (Explicitly Deferred in Specs)

These are intentionally out of v1 scope:

| Item | Spec location | Why deferred |
|------|--------------|-------------|
| Per-family cadence config knob | Accounting-model §5.3 | Infrastructure ready; cadence selection is a product decision |
| Multiple release families | Accounting-model §10 | v1 has one family; data model is ready |
| Per-family ε allocation formulas | Accounting-model §3.3 | Admin-set is sufficient for v1 |
| Tighter composition (zCDP/PLD) | Accounting-model §10 | ~10-15% noise improvement, not blocking |
| Consistency post-processing | Requirements-v2 §6 | Only needed with multiple families |
| Public counts or count bands | Accounting-model §10 | Counts are internal in v1 |
| DP partition selection | Requirements-v2 §12 | Fixed universe sufficient for v1 |
| Backfills | Requirements-v2 §11.1 | Late-finalized weeks enter future windows only |

---

## Relationship to Other Docs

| Document | Relationship |
|----------|-------------|
| `dp-group-stats-requirements-v2.md` | Design spec (what and why) |
| `dp-group-stats-accounting-model.md` | Composition and budget design (how budgets work) |
| `dp-group-stats-simulation-spec.md` | Parameter validation (empirical evidence for parameter choices) |
| `privacy_architecture.md` | User/lawyer-facing privacy design (neighboring relation, data flows) |
| `backend/ARCHITECTURE.md` | Code-level documentation of what's deployed |
