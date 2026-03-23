# dp-group-stats: Privacy Requirements

**Created:** 2026-03-19
**Purpose:** Document what the system must guarantee before deciding how to build it

---

## The Problem

Publish useful aggregate statistics (averages) about small professional groups at multiple granularity levels, repeatedly over time, without revealing individual data.

**Hierarchy levels (coarsest → finest):**
1. Country (all of Germany)
2. State × specialty (cardiologists in Bavaria)
3. State × specialty × role (junior cardiologists in Bavaria)
4. Hospital (all workers at Charité)
5. Hospital × specialty (cardiologists at Charité)

**Constraints:** Groups are small (5-50 people). Published weekly. Groups change slowly (join/leave over months).

---

## 1. Attacks to Defend Against

### Subtraction attacks (across hierarchy)
Publishing parent + all-but-one children → attacker computes the missing child. Dangerous when subtracted group is very small. Per Dinur-Nissim: if query answers have error substantially less than sqrt(n), reconstruction becomes possible.

### Intersection attacks (cross-dimensional)
If only one hospital in a state has cardiologists, the hospital-level stat IS the state-level stat. Same individuals appear in multiple published cells.

### Temporal differencing
One person joins/leaves between two weekly releases → change in published average reveals that person's hours. Subtraction attack across time.

### Homogeneity attack
All 10 cardiologists work ~60 hours → publishing "average: 60" reveals everyone's hours regardless of noise. This is NOT a mechanism failure — the data itself has no variation.

---

## 2. Formal Requirements

### MUST guarantee

| Requirement | Formal property | How |
|---|---|---|
| Individual contribution hidden | (ε,δ)-DP or ρ-zCDP | Calibrated noise on all published statistics |
| Multi-level consistency | Parent ≈ weighted avg of children | Post-processing via least squares (free — no budget cost) |
| Composition across levels | Total ε = sum of per-level εᵢ | Bottom-heavy budget allocation |
| Composition across time | Total ε grows with T releases | Budget tracking with annual cap |
| Small group protection | Suppress groups below threshold | K_MIN ≥ 11 |
| No reconstruction from overlapping queries | Noise ≥ O(√n) per query | Formal DP mechanism at each cell |

### SHOULD guarantee (best practice)

| Requirement | Rationale |
|---|---|
| Cumulative privacy budget tracking | Prevent unbounded degradation over years |
| Annual budget cap per user | Limit total information leakage about any individual |
| Dominance/concentration check | No single contributor > 25% of aggregate |
| DP partition selection | Don't leak group existence through suppression decisions |
| Sensitivity bounding via clipping | Control per-individual influence |

### CAN defer

| Item | Why |
|---|---|
| User-level DP (vs event-level) | Requires much more noise; event-level is defensible |
| Full TopDown optimization | Hay et al. consistency sufficient at our scale |
| Formal zCDP accounting | Start with pure ε tracking; upgrade later |
| Gradual privacy expiration | Useful but complex |
| Budget recycling (BR-DP) | Valuable but complex |

---

## 3. Composition Theory: Key Rules

**Sequential composition:** Queries on overlapping populations → ε_total = sum(εᵢ). This applies across hierarchy levels (state and hospital stats involve the same people) and across time (weekly releases of the same group).

**Parallel composition:** Queries on disjoint populations → ε_total = max(εᵢ). This applies within a hierarchy level (cardiologists in Bavaria vs cardiologists in Saxony are disjoint).

**Implication for budget splitting:** If publishing at L hierarchy levels, total ε per time period must be divided across L levels. Publishing at 3 levels with ε=1.0 means each level gets ~0.33 → more noise per level.

**Bottom-heavy allocation** (Ko et al. 2025): Optimal split gives more budget to lower/finer levels. ~10x lower bias, ~4x lower variance vs uniform split. Intuition: finer levels have smaller groups and suffer more from noise.

---

## 4. Repeated Release (Temporal)

**Naive composition:** After T weeks, ε_total = T × ε_per_week. After 1 year: 52× blowup.

**Event-level vs user-level privacy:**
- Event-level: protects one shift/day. Sensitivity = max change from one event.
- User-level: protects entire user history. Sensitivity = max total contribution (huge → huge noise).
- W-event privacy (Kellaris 2014): protect any w consecutive time steps. Practical middle ground.

**Recommendation:** Event-level privacy is practical. W-event with w=4-8 weeks is a reasonable upgrade.

**Tree mechanism** (Dwork et al. 2010): Organize time steps as binary tree leaves, add noise to partial sums → error O(log² T) instead of O(T). Applicable to our setting.

**Budget recycling** (Bo et al. 2024): Tighter composition for repeated queries on slowly-changing data. Directly applicable but adds complexity. Defer to later.

---

## 5. The "Homogeneity" Problem

**l-diversity** (Machanavajjhala 2007) was designed for microdata release, NOT aggregate statistics. It doesn't formally apply to our case.

**What we actually need:** A dominance/concentration rule. Standard approach used by ABS, Eurostat, BLS:
- **(n,k) rule:** Suppress if top n contributors account for > k% of the aggregate
- **Example:** (1,25) rule = no single contributor > 25% of cell value
- This is NOT a DP mechanism — it's an additional safeguard layered on top

**Formal name for our check:** "Dominance rule" or "concentration rule" (not l-diversity).

---

## 6. Practical Requirements

### What unions/researchers need

| Need | Granularity | Timeliness | Accuracy |
|---|---|---|---|
| Policy arguments | National/state | Monthly | ±3 hours |
| Collective bargaining | Hospital level | Monthly/quarterly | ±3 hours |
| Identify problem areas | Specialty × role | Quarterly | ±5 hours |
| Campaign pressure | Any | Weekly | ±5 hours |

### Signal-to-noise at different group sizes (ε=1.0, range [35,80] hours)

| Group size | Noise std dev | Can detect 10h overtime? | Can detect 5h difference? |
|---|---|---|---|
| 5 | 12.7h | No | No |
| 10 | 6.4h | Marginal | No |
| 20 | 3.2h | Yes | Marginal |
| 50 | 1.3h | Yes | Yes |
| 100 | 0.6h | Yes | Yes |

**Practical minimum useful group size:** ~20 with ε=1.0.

### Epsilon selection

No consensus on "correct" ε. Ranges from 0.01 (academic) to 19.46 (Census). Apple uses 2-8, Google uses 2.64-8.9.

For our setting (healthcare, EU/GDPR, small groups): **ε=1.0-3.0 per week per hierarchy level** is defensible. Track cumulative ε across all releases.

---

## 7. Recommended Approach for Our Scale

**Option A (recommended): Independent Noise + Hay et al. Consistency Post-Processing**

1. Define hierarchy tree
2. Add noise independently at each node, budget split bottom-heavy
3. Apply Hay et al. (2010) consistency: project noisy values onto consistent solutions via least squares
4. Suppress cells below K_MIN + dominance rule
5. Track cumulative ε per group per level

Why: computationally trivial at our scale (hundreds of groups, not millions), provably reduces MSE vs independent noise alone, post-processing is free (no additional budget cost).

**NOT needed:** Full Census TopDown (overkill for our scale), user-level DP (event-level is practical), zCDP (start with pure ε, upgrade later).

---

## 8. Validation & Simulation

### How to verify the implementation works

**Three levels of validation**, in priority order:

**Level 1: Implementation correctness** (does the code do what we think?)
- Noise distribution: KS test against `scipy.stats.laplace` with 100k samples
- Sensitivity calculation: unit tests for bounded mean = (U-L)/n
- Budget accounting: verify cumulative ε matches theory after T queries, compare against Google's `dp-accounting` library
- Clamping: values outside bounds are clipped before aggregation
- Suppression: groups below K_MIN are never published

**Level 2: Utility** (is the output useful?)
- Accuracy vs group size: MAE and relative error at n=11, 20, 50, 100
- Trend detection: can a 2h/week overtime increase over 10 weeks be detected from noisy data?
- Comparison power: two groups differing by 5h — how often does noisy data preserve the ordering?
- Pareto frontier: plot ε vs MAE to find the useful range

**Level 3: Privacy** (does it resist attacks?)
- Neighboring database test: construct (D, D') pairs differing by 1 record, run mechanism 50k times each, verify max output ratio ≤ e^ε
- Subtraction attack: attacker knows k-1 members' hours, tries to infer the k-th. Measure error distribution.
- Temporal differencing: one person joins in week t, attacker observes stats for weeks t-1 and t. Measure inference accuracy.
- Membership inference: optimal likelihood ratio test, verify success rate ≤ e^ε - 1

### Simulation design

**Synthetic population:**
- N workers (e.g., 500) assigned to a hierarchy: country → state × specialty → hospital × specialty
- Group sizes varying realistically (some at k threshold, some large)
- Per-worker weekly hours drawn from Normal(μ_group, σ) with μ varying by group
- Include: overtime patterns, part-time workers, workers joining/leaving over time

**Monte Carlo simulation (1000-10000 runs per scenario):**
1. Sample each worker's hours for T weeks
2. Compute true group statistics at each hierarchy level
3. Apply DP mechanism (noise + suppression + consistency post-processing)
4. Record noisy outputs, compare to truth

**Metrics per run:**
- MAE and RMSE of noisy means vs true means (by group size and hierarchy level)
- Relative error (especially for small groups)
- Consistency violations before/after post-processing
- Cumulative ε consumed after T weeks
- Reconstruction attack success rate (LP-based)

### Key insight from literature

Most real DP bugs are caught by simple tests (noise distribution, sensitivity, composition). Attack simulations validate the **design** (is ε=1 enough for groups of 11?), not the **implementation** (is the code correct?). Both matter, but unit tests come first.

### Constraints for our case

- **Temporal resolution: weekly** (daily is too noisy and not meaningful for overtime detection)
- **Minimum useful group size: ~20** for ε=1.0 (K_MIN=11 is the suppression floor, but signal emerges around 20)
- **Event-level privacy** (protect one day/shift, not entire user history)

### Tools to use

| Tool | Purpose |
|---|---|
| `scipy.stats` | KS tests, noise distribution verification |
| `google dp-accounting` (PyPI) | Budget accounting verification, composition bounds |
| `IBM diffprivlib` | Reference implementation to compare against |
| Custom synthetic data generator | Monte Carlo simulation with known ground truth |

---

## 9. Open Design Questions

Before implementing, we need to decide:

1. **How many hierarchy levels to publish simultaneously?** Each additional level costs ε budget. Start with 2 (state × specialty + hospital) or go for 3+?
2. **Budget allocation across levels:** uniform or bottom-heavy (Ko et al.)? Need to simulate to find optimal split for our population distribution.
3. **Annual ε budget per user:** What cap? 10? 20? 52? This determines how many weeks we can publish before suppressing a group for the year.
4. **Temporal stability N:** How many consecutive weeks above k threshold before first publication? N=1 (no delay) vs N=4 (one month delay)?
5. **Dominance rule threshold:** (1, 25%) is standard but what's right for our group sizes?
6. **Consistency post-processing:** Hay et al. least squares is the plan, but do we need it if we only publish means (not sums/counts)?

These questions are best answered by simulation, not theory alone.

---

## 10. Key References

- Dinur & Nissim 2003 — Reconstruction attacks
- Dwork et al. 2010 — Continual observation DP, tree mechanism
- Hay et al. 2010 — Consistency post-processing (least squares)
- Ko et al. 2025 — Optimal bottom-heavy budget allocation
- Bo et al. 2024 — Budget recycling (IEEE S&P)
- Kellaris et al. 2014 — W-event privacy
- NIST SP 800-226 (2025) — Evaluating DP guarantees
- Census TopDown (2022) — Full hierarchical DP system
- ABS/Eurostat — Dominance rules for aggregate statistics
