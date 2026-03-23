# dp-group-stats: Implementation Checklist

**Created:** 2026-03-19
**Updated:** 2026-03-20
**Purpose:** Turn the v2 privacy requirements into an implementation plan for a first working version.
**See also:** `dp-group-stats-accounting-model.md` for composition, budget, and ledger design.

---

## Current v1 scope

This checklist assumes the current v1 defaults already agreed:

- Protected unit: one finalized user-week
- Protected record: `(planned_weekly, actual_weekly, assignment_snapshot)`
- Finalized weeks are immutable for aggregation
- No historical backfills in v1
- Primary public release family: `state x specialty`
- Public outputs: `planned mean`, `overtime mean`
- Counts are internal only
- Public suppression is generic (`suppressed`), with no public reason codes
- Assignment snapshot is frozen at week finalization
- Temporal activation: `N = 2`
- Temporal deactivation grace: 2 weeks
- Candidate cell universe comes from configured taxonomies / allowed combinations
- Mechanism baseline: Laplace + simple additive `epsilon` accounting
- ε split: ε_planned = 0.3, ε_actual = 0.7 (no ε on counts — substitution relation)
- Dominance rule: top-1, clipped actual hours, 30% threshold
- Suppressed cells (K_MIN, dominance, warming_up): no noise, no ε cost. Cooling_down: costs ε.
- Budget accounting: per-user annual cap with per-user ledger
- Budget management: pre-computed schedule + time-based graceful degradation

Anything outside that scope should be treated as an explicit later extension.

---

## Current code touchpoints

These are the main existing backend seams this work will likely touch:

| File | Why it matters |
|------|----------------|
| `backend/app/models.py` | Current `WorkEvent`, `User`, and stats table definitions |
| `backend/app/aggregation.py` | Current state x specialty x role aggregation and Laplace noise logic |
| `backend/app/routers/stats.py` | Current stats API surface |
| `backend/app/schemas.py` | Public stats response models |
| `mobile-app/...` | Week finalization invariant likely starts in the client UX / submission flow |

---

## Phase 0: Freeze the implementation target

- [ ] Treat `project-mgmt/dp-group-stats-requirements-v2.md` as the source of truth for v1 defaults
- [ ] Record which items are still intentionally open: `epsilon`, annual cap, `K_MIN`, dominance threshold, final budget split
- [ ] Explicitly mark later extensions as out of scope for the first implementation:
- [ ] Public counts
- [ ] Hospital release family
- [ ] `state x specialty x role`
- [ ] zCDP / tighter accountant
- [ ] Backfills
- [ ] Public suppression reason codes

---

## Phase 1: Make the weekly protected unit real in the backend

Goal: the backend must have a reliable concept of one finalized user-week before DP aggregation begins.

- [ ] Confirm how the app currently represents "finalized week" and where that state lives
- [ ] If finalized-week state is not persisted server-side, add a backend representation for it
- [ ] Define the release cutoff rule: when does a finalized week become eligible for the next aggregation run?
- [ ] Ensure weeks used for aggregation cannot be edited retroactively
- [ ] Decide whether finalized user-weeks should be materialized into a dedicated table or derived on demand from immutable daily events
- [ ] If using a dedicated table, include at least:
- [ ] `user_id`
- [ ] `week_start`
- [ ] `week_end`
- [ ] `planned_weekly`
- [ ] `actual_weekly`
- [ ] `finalized_at`
- [ ] `assignment_snapshot`

---

## Phase 2: Define taxonomy and candidate cells

Goal: candidate release cells must come from configured dimensions, not from ad hoc runtime discovery.

- [ ] Create source-of-truth tables or config for:
- [ ] states
- [ ] specialties
- [ ] roles
- [ ] hospitals
- [ ] allowed combinations for v1 release family
- [ ] Define the v1 candidate cell universe for `state x specialty`
- [ ] Decide how unknown / unmapped dimension values are handled
- [ ] Ensure the aggregation pipeline evaluates candidate cells from the configured universe, not only from observed data

---

## Phase 3: Package the reusable DP core

Goal: isolate the logic that should become `dp-group-stats`, separate from FastAPI and SQLAlchemy details.

- [ ] Create a package/module boundary for reusable privacy logic
- [ ] Define config models for:
- [ ] clipping bounds
- [ ] `K_MIN`
- [ ] temporal activation / deactivation
- [ ] `epsilon` split (ε_planned, ε_actual — no count ε)
- [ ] annual cap (per-user)
- [ ] release family selection (granularity tuple model)
- [ ] dominance threshold
- [ ] Add Laplace mechanism utilities
- [ ] Add an accountant interface (see `dp-group-stats-accounting-model.md` §7.3 for Protocol)
- [ ] Implement per-cell ledger: additive `epsilon` per cell per period
- [ ] Implement per-user ledger: tracks cumulative ε per user across all cells and families
- [ ] Define release-family abstractions so later extensions can add more families without rewriting the core

---

## Phase 4: Build the release-policy layer

Goal: implement the non-DP rules that sit around the numeric mechanism.

- [ ] Implement minimum-group threshold gate (`K_MIN`)
- [ ] Implement dominance rule: top-1, clipped actual hours, 30% threshold
  - [ ] Check `max(clipped_actual) / sum(clipped_actual) > 0.30`
  - [ ] Suppress cell if dominance check fails (generic `suppressed` status)
  - [ ] No noise generated, no ε cost for dominance-suppressed cells
- [ ] Implement temporal activation state:
- [ ] track whether a cell is still warming up
- [ ] publish only after 2 consecutive eligible weeks
- [ ] Implement temporal deactivation state:
- [ ] keep a cell active during the 2-week grace period
- [ ] Define a small internal status enum, for example:
- [ ] `published`
- [ ] `suppressed`
- [ ] `warming_up`
- [ ] `cooling_down`
- [ ] `not_applicable`
- [ ] Keep suppression reasons internal; public API should collapse them to generic `suppressed`

---

## Phase 5: Replace the current averaging logic with count + sums

Goal: the numeric mechanism should operate on counts and clipped sums, not directly on means.

- [ ] Replace the current average-based logic in `backend/app/aggregation.py`
- [ ] Aggregate finalized user-weeks, not raw daily averages
- [ ] For each eligible cell and week, compute:
- [ ] true count `n` (public, not noised — substitution relation)
- [ ] clipped planned sum
- [ ] clipped actual sum
- [ ] Add noise to planned sum (ε_planned = 0.3) and actual sum (ε_actual = 0.7) only. No noise on counts.
- [ ] Derive public `planned mean` as `noisy_planned_sum / true_count` and `overtime mean` as `(noisy_actual_sum / true_count) - planned_mean`
- [ ] Keep counts internal in v1
- [ ] Record `epsilon` spend in per-cell ledger and per-user ledger
- [ ] Skip noise + ledger recording for suppressed cells (K_MIN, dominance, warming_up). Record for cooling_down.

---

## Phase 6: Storage and API changes

Goal: persist the right internal values and expose the right public values.

- [ ] Decide whether to adapt the current `StatsByStateSpecialty` table or create a new v1-specific stats table
- [ ] Remove or stop exposing public `n_users` from the v1 public schema
- [ ] Update stats schemas to expose:
- [ ] cell identifiers
- [ ] period
- [ ] `planned mean`
- [ ] `overtime mean`
- [ ] generic status (`published` or `suppressed`)
- [ ] Update stats API routes to match the new public surface
- [ ] Ensure suppressed cells return stable public shape with null numeric values

---

## Phase 7: Validation and simulation

Goal: verify the implementation and tune the still-open numeric parameters.

- [ ] Add unit tests for weekly materialization from daily events
- [ ] Add tests for finalized-week immutability and no-backfill behavior
- [ ] Add tests for clipping and sensitivity assumptions
- [ ] Add tests for temporal activation and deactivation behavior
- [ ] Add tests that suppressed cells have generic public status and no public reason code
- [ ] Add tests for per-cell `epsilon` ledger accumulation
- [ ] Add tests for per-user `epsilon` ledger accumulation across cells
- [ ] Add tests that suppressed cells (K_MIN, dominance, warming_up) record zero ε
- [ ] Add tests that cooling_down cells record full ε
- [ ] Add tests for dominance rule (top-1, 30% threshold, clipped actual)
- [ ] Add tests that config validation rejects family sets exceeding annual cap
- [ ] Build a small simulation / analysis script to measure:
- [ ] group-size distributions for `state x specialty`
- [ ] how many cells survive `K_MIN`
- [ ] how often cells flap around the threshold
- [ ] utility under different `epsilon` values
- [ ] utility under different `N` values
- [ ] utility under different `epsilon` splits

---

## Phase 8: Extract the public package shape

Goal: leave behind a standalone open-source package rather than app-specific glue.

- [ ] Ensure reusable code has no direct dependency on FastAPI routers
- [ ] Keep SQLAlchemy-specific persistence outside the core package where possible
- [ ] Add a minimal example using in-memory dataframes / plain Python records
- [ ] Write a reference config profile for "weekly small-group healthcare reporting"
- [ ] Document which parts are policy knobs vs fixed architecture
- [ ] Document later extension points:
- [ ] additional release families
- [ ] public counts or count bands
- [ ] stronger accountants
- [ ] richer consistency post-processing

---

## Decision gates before writing a lot of code

These should be answered before deep implementation:

- [x] Do we materialize finalized user-weeks explicitly, or derive them on demand? **Materialized.** `FinalizedUserWeek` table exists.
- [ ] Do we reuse the existing stats tables, or create a clean v1 schema?
- [x] Is `state x specialty` truly the only public family in the first release? **Yes.**
- [ ] What are the first simulation ranges for `epsilon`, annual cap, `K_MIN`, and dominance threshold?
- [x] How does composition work across families? **Resolved.** See `dp-group-stats-accounting-model.md`. Granularity-tuple model, parallel within family, sequential across families.
- [x] Per-cell or per-user budget? **Per-user.** See `dp-group-stats-accounting-model.md` §4.
- [x] What dominance rule? **Top-1, clipped actual, 30%.** See `dp-group-stats-accounting-model.md` §6.2.
- [x] ε on counts? **No.** Substitution neighboring relation → counts are public.

---

## What this checklist does not assume yet

The following remain intentionally open and should be informed by data / simulation:

- final `epsilon` and annual cap (leaning lenient for working hours)
- final `K_MIN` (working assumption: 11)
- final dominance threshold (working assumption: 30%)
- final `epsilon` split across planned / actual (working assumption: 0.3 / 0.7)
- whether hospital-level publication is viable at current scale
- whether a tighter accountant is worth the complexity
