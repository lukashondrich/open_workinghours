# Data Protection & Privacy Architecture

> **Note:** This document explains how we *design* data protection and privacy in the system. It is not legal advice. Final decisions should be reviewed by a qualified GDPR lawyer.

---

## 1. Goals

- Collect and analyse **real working hours** in hospitals.
- Protect individual staff members from re-identification and misuse of their data.
- Comply with **GDPR**, especially:
  - Lawfulness, fairness, transparency (Art. 5, 6, 13–14)
  - Data minimisation & storage limitation (Art. 5)
  - Security (Art. 32)
  - Data subject rights, especially **right to erasure** (Art. 17).

---

## 2. Key Concepts

**Personal data**  
Any information relating to an identified or identifiable natural person (e.g. name, email, combination of hospital affiliation + department + seniority at a small facility).

**Pseudonymous data**  
Data where direct identifiers are removed, but a person can still be identified via a key (e.g. internal `user_id`). Pseudonymous data **is still personal data under GDPR**.

**Anonymous data**  
Data where re-identification of an individual is **not reasonably possible** given technical and organisational controls. Anonymous data is **outside GDPR**.

**Aggregation & privacy safeguards**  
- **Aggregation:** combine many individuals into a group (e.g. “surgeons in Bavaria in Q1 2025”).
- **k-anonymity for aggregates:** only publish stats for groups with at least `k` distinct individuals.
- **Noise (Laplace / differential privacy):** add random noise to counts / averages to reduce the effect of any single individual.

---

## 3. High-Level Architecture

We separate the system into two logical layers:

1. **Internal Operational Layer (pseudonymous personal data)**  
2. **Public/Analytics Layer (aggregated & privacy-protected statistics)**

Only layer 1 contains data that can be linked back (indirectly) to a person.

### 3.1 Internal Operational Layer

**Purpose:**  
Run the app, store per-user working-time events, and support user rights (incl. deletion).

**Data examples:**

- `users` table
  - `user_id` (pseudonymous UUID, internal only)
  - `email_hash` (SHA-256 with secret salt, no plaintext stored)
  - `state_code` (required, one of 16 Bundesländer)
  - `profession` (physician or nurse)
  - `seniority` (closed enum per profession)
  - `department_group` (optional, one of 10 broad groups)
  - `specialization_code` (optional, physician specialization)
  - `hospital_ref_id` (optional, reference to named hospital from official dataset of ~1,220 German hospitals)

- `work_events` table
  - `event_id`
  - `user_id`
  - `date`, `planned_minutes`, `actual_minutes`

**Properties:**

- Data is **pseudonymous but still personal** under GDPR.
- Strong access control, encryption in transit and at rest.
- Access limited to backend services and authorised operators.
- Used to:
  - Generate aggregated statistics (see 3.2)
  - Provide user-facing features (personal history, exports, etc.)

---

### 3.2 Public/Analytics Layer

**Purpose:**  
Provide **aggregated, privacy-preserving statistics** for unions, hospitals, the public, or research use.

**Data examples (no user IDs):**

- `stats_by_state_specialty`
  - `country_code`
  - `state_code`
  - `department_group`
  - `period_start`, `period_end`
  - `n_users` (count of distinct users)
  - `avg_planned_hours_noised`, `avg_actual_hours_noised`
  - `planned_ci_half`, `actual_ci_half`, `overtime_ci_half` (90% confidence intervals)
  - `n_display` (rounded user count)

**Aggregation job (conceptual):**

1. Read from `users` + `work_events`.
2. Group by release family dimensions:
   - `state_code × department_group × period`
   - `hospital_ref_id × profession × period`
   - Cells are published when privacy thresholds are met (k≥5, dominance rule, warming period).
3. Compute:
   - count of distinct users (`n_users`)
   - averages / totals (e.g. overtime)
4. **Apply privacy checks:**
   - **k-minimum rule:** only keep rows where `n_users ≥ K_MIN` (K_MIN=5).
   - **Dominance rule:** suppress if top contributor's clipped actual hours > 30% of cell total.
   - **Noise:** add Laplace noise to clipped sums (not counts — see §6 Neighboring Relation):
     - `noised_sum = clipped_sum + Laplace(scale = sensitivity / ε)`
5. Write only the aggregated, noised rows into `stats_*` tables.

**API / UI constraints:**

- Public endpoints only read from `stats_*` tables.
- Only pre-defined, policy-compliant groupings are allowed.
- No access to per-user records or arbitrary SQL filters.

Under this model, `stats_*` tables are intended to be **effectively anonymous**: they describe groups, not individuals, and are protected by k-anonymity + noise.

---

## 4. Right to Erasure (Art. 17 GDPR)

### 4.1 What can be deleted

When a user requests deletion:

- From the **Operational Layer**:
  - Delete all `work_events` rows for that `user_id`.
  - Delete the `users` row for that `user_id`.
  - Delete or minimise any related application logs or cached data within a defined retention period.

This fulfils erasure for **personal / pseudonymous data**.

### 4.2 What is retained

- Aggregated statistics in the **Analytics Layer** are **not updated per individual deletion**.
- Justification:
  - They contain only group-level information with minimum group sizes and added noise.
  - They are designed so they **cannot be linked back to an individual** and are treated as **anonymous statistics**.

This must be clearly explained in the privacy notice, e.g.:

> “If you delete your account, we delete your user-level data. We retain only anonymised, aggregated statistics (e.g. ‘physicians in Internal Medicine in Bavaria’), which cannot reasonably be linked back to you and are not subject to erasure.”

---

## 5. Security & Organisational Measures (high level)

- **Access control**
  - Separation of roles: operational DB vs. analytics access.
  - Principle of least privilege for admins and developers.
- **Encryption**
  - In transit (HTTPS/TLS).
  - Infrastructure-level encryption at rest (Hetzner). Application-level encryption at rest planned.
- **Logging & monitoring**
  - Access logging for sensitive systems.
  - Rate limiting, anomaly detection for APIs.
- **Backups & retention**
  - Backups encrypted and retained only as long as necessary.
  - Erasure requests apply to active data; backup deletion happens through defined rotation (documented).
- **Documentation & DPIA**
  - Data Protection Impact Assessment for high-risk processing (e.g. health/work data).
  - Records of processing activities describing controllers, processors, and purposes.

---

## 6. Open Points / To Be Specified

### Current Working Values (2026-03-21)

These values are implemented and deployed. Validated by simulation (`docs/dp-group-stats-simulation-spec.md`).

| Parameter | Current Value | Rationale |
|-----------|---------------|-----------|
| `K_MIN` (minimum users per cell) | 5 | Appropriate for labour data (Art. 6 GDPR, not Art. 9); validated by simulation |
| Laplace noise ε (per release family per period) | 1.0 (split: 0.2 planned + 0.8 actual) | 80% budget on actual hours (primary stakeholder metric); accumulates over time under sequential composition |
| Annual per-user ε cap | 150 | Defensible for non-health employment data with central DP |
| Contribution bounds (planned) | [0, 80] hours/week | Contractual hours rarely exceed 80h |
| Contribution bounds (actual) | [0, 120] hours/week | Covers 99.9% of real-world cases; reduces sensitivity vs 140 |
| Dominance threshold | 30% top-1 (clipped actual) | Safety net; operationally redundant at K_MIN≥5 |
| Temporal activation | 2 consecutive eligible periods | Reduces threshold-crossing leakage |
| Temporal deactivation grace | 2 periods | Prevents abrupt disappearance leaking info |
| Release families | state × department_group, hospital × profession | Cells are published when privacy thresholds are met (k≥5, dominance rule, warming period) |
| Aggregation cadence | weekly (default), biweekly, monthly | Configurable via `period_type`; multi-week uses per-user mean of clipped weekly values |
| Adaptive ε | `min(config_ε, (cap − spent_ytd) / remaining)` | Never exceeds config default or annual cap |
| Confidence intervals | 90% Laplace CI per published cell | `ci_half = (sensitivity / ε) × ln(1/α) / n_display` |
| n_display | `max(5, (n // 5) × 5)` | Rounded user count; prevents exact count disclosure |

### Neighboring Relation (Substitution)

The DP mechanism uses the **substitution neighboring relation**: two datasets are neighbors if they differ in one user's contribution values, not in the user's presence. Both datasets have the same set of users.

This means:
- **Counts are public** — the true count `n` is used as-is. No noise is added, no ε is spent.
- **The DP guarantee protects contribution values only** — an attacker cannot distinguish what hours a specific user worked, but can observe how many users are in a group.
- **Published means** are derived as `noisy_sum / true_count`, which is less noisy than `noisy_sum / noisy_count`.

| Quantity | Sensitivity | ε spent |
|----------|-------------|---------|
| Planned sum | 80 (= planned_max − planned_min) | ε_planned = 0.2 |
| Actual sum | 120 (= actual_max − actual_min) | ε_actual = 0.8 |
| Count | 0 (public under substitution) | 0 |

This relation is documented in `docs/dp-group-stats-requirements-v2.md` §4.3.

### Privacy Accounting

Two ledger tables track ε expenditure:

- **Per-cell ledger** (`state_specialty_privacy_ledger`): records ε spent per cell per period, with mechanism and publication status.
- **Per-user ledger** (`user_privacy_ledger`): tracks cumulative ε per user across all cells and periods. Enables GDPR Art. 15 transparency requests ("how much privacy budget was spent on your data").

Suppressed cells (K_MIN, dominance, warming_up) record **zero ε**. Cooling_down cells record **full ε** (stopping noise abruptly would leak information).

**Adaptive ε schedule:** Before each aggregation run, the system queries year-to-date spending and computes `ε_period = min(config_ε, (annual_cap − spent_ytd) / remaining_periods)`. This ensures the annual cap is never exceeded even under irregular aggregation schedules. The epsilon split ratio (planned/actual) is preserved proportionally. An anomaly warning is logged if `adaptive_ε < 50%` of the expected per-period budget.

**Budget monitoring endpoints:**
- `GET /auth/me/privacy-budget` — authenticated users can see their own ε exposure for the year (GDPR Art. 15).
- `GET /stats/admin/privacy-budget-summary` — admin overview of worst-case user spend, average spend, and cap utilization.

### Confidence Intervals

Published statistics include 90% confidence intervals derived from the Laplace mechanism:

```
ci_half_width = (sensitivity / ε) × ln(1 / α) / n_display
```

Where `α = 0.05` (for 90% CI) and `n_display = max(5, (n_users // 5) × 5)` is a rounded user count that avoids disclosing exact group sizes below the display threshold.

- `planned_ci_half`: CI for planned hours mean
- `actual_ci_half`: CI for actual hours mean
- `overtime_ci_half = planned_ci_half + actual_ci_half` (conservative, triangle inequality)

CI values are null for suppressed cells.

### Pending Legal Review

- Formal approval of anonymisation claim for the Analytics Layer
- Final wording of privacy policy and consent text
- Confirmation that DP parameters meet GDPR requirements
- Assessment of hospital affiliation risk profile (DPIA R7)

---

## 7. Deferred Items

The following items are supported by the architecture but deferred. They require product decisions or additional implementation.

| Item | Spec reference | Why deferred |
|------|---------------|--------------|
| Per-family cadence config knob | Accounting-model §5.3 | Infrastructure ready; cadence selection is a product decision |
| Per-family ε allocation formulas | Accounting-model §3.3 | Admin-set allocation sufficient for now |
| Tighter composition (zCDP/PLD) | Accounting-model §10 | ~10-15% noise improvement, not blocking |
| Consistency post-processing | Requirements-v2 §6 | Only needed when multiple families produce overlapping cells |
| Public counts or count bands | Accounting-model §10 | Counts are internal for now |
| DP partition selection | Requirements-v2 §12 | Fixed universe sufficient for now |
| Backfills | Requirements-v2 §11.1 | Late-finalized weeks enter future windows only |

---

## 8. Formal Specifications

| Document | Purpose |
|----------|---------|
| [`docs/dp-group-stats-requirements-v2.md`](docs/dp-group-stats-requirements-v2.md) | Formal spec: threat model, neighboring relation, sensitivity bounds, non-DP safeguards |
| [`docs/dp-group-stats-accounting-model.md`](docs/dp-group-stats-accounting-model.md) | Composition model: release families, budget accounting, ledger design |
| [`docs/dp-group-stats-simulation-spec.md`](docs/dp-group-stats-simulation-spec.md) | Parameter validation: 200+ simulation scenarios, evidence for K_MIN=5, ε=1.0, bounds |

---

## 9. Related Documentation (Added 2026-01-07)

The following GDPR compliance documents have been prepared for legal review:

| Document | Purpose | Location |
|----------|---------|----------|
| **App Privacy Policy** | Art. 13/14 compliant user-facing policy | `website/src/pages/app-privacy-policy.astro` (EN/DE) |
| **Terms of Service** | Contract legal basis, user agreement | `website/src/pages/terms.astro` (EN/DE) |
| **DPIA** | Data Protection Impact Assessment | `docs/DPIA.md` |
| **RoPA** | Records of Processing Activities (Art. 30) | `docs/ROPA.md` |
| **Data Retention Policy** | Retention periods, deletion procedures | `docs/data-retention-policy.md` |
| **Consent Flow Spec** | In-app consent UI specification | `docs/consent-flow-spec.md` |

### Legal Basis Decision

The platform uses a **Consent + Contract hybrid** approach:
- **Contract (Art. 6(1)(b))**: Account management, data storage, export/deletion
- **Consent (Art. 6(1)(a))**: Contribution to aggregated statistics

### Outstanding Actions

| Action | Owner | Status |
|--------|-------|--------|
| Sign Hetzner DPA (AVV) | Controller | ✅ Signed 2026-01-13 |
| Sign Brevo DPA | Controller | ✅ Signed (part of ToS) |
| Implement consent flow in app | Development | ✅ Deployed 2026-01-12 |
| Legal review of all documents | External counsel | Pending |

---
