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
Any information relating to an identified or identifiable natural person (e.g. name, email, combination of hospital + rare specialty + small team).

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
  - `hospital_id`  
  - `specialty` (e.g. surgery, radiology, anaesthesiology)  
  - `role_level` (assistant, specialist, senior, nurse, etc.)  
  - `region` / `state` / `country`  
  - optional: limited contact info (if needed for accounts/support)

- `work_events` table  
  - `event_id`  
  - `user_id`  
  - `start_time`, `end_time`  
  - derived metrics: `hours_worked`, `overtime_hours`, etc.

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
  - `specialty`  
  - `role_level`  
  - `period_start`, `period_end`  
  - `n_users` (count of distinct users)  
  - `avg_overtime_hours_noised`  

- `stats_by_hospital_role` (with more conservative grouping)  
  - `hospital_id`  
  - `role_group` (coarser: doctor / nurse / other)  
  - `period_start`, `period_end`  
  - `n_users`  
  - `avg_overtime_hours_noised`  

**Aggregation job (conceptual):**

1. Read from `users` + `work_events`.
2. Group by allowed dimensions, e.g.  
   - `state_code × specialty × role_level × quarter`  
   - `hospital_id × role_group × quarter` (without specialty)
3. Compute:
   - count of distinct users (`n_users`)
   - averages / totals (e.g. overtime)
4. **Apply privacy checks:**
   - **k-minimum rule:** only keep rows where `n_users ≥ K_MIN` (e.g. 10 or 20).
   - **Noise:** add Laplace noise to sensitive measures:
     - `noised_value = true_value + Laplace(scale = λ)`
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

> “If you delete your account, we delete your user-level data. We retain only anonymised, aggregated statistics (e.g. ‘surgeons in Bavaria’), which cannot reasonably be linked back to you and are not subject to erasure.”

---

## 5. Security & Organisational Measures (high level)

- **Access control**
  - Separation of roles: operational DB vs. analytics access.
  - Principle of least privilege for admins and developers.
- **Encryption**
  - In transit (HTTPS/TLS).
  - At rest for operational databases and backups.
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

### Current Working Values (2026-01-07)

These values are implemented but not yet legally reviewed:

| Parameter | Current Value | Status |
|-----------|---------------|--------|
| `K_MIN` (minimum users per cell) | 10 | Working value - may adjust based on legal review |
| Laplace noise epsilon (ε) | 1.0 | Working value - balances privacy vs utility |
| Aggregation dimensions | state × specialty × role × period | Implemented |

### Pending Legal Review

- Formal approval of anonymisation claim for the Analytics Layer
- Final wording of privacy policy and consent text
- Confirmation that working values meet GDPR requirements

---
