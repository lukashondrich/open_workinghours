# Privacy Parameters Analysis

**Status**: Draft - Active Research
**Last Updated**: 2026-01-09
**Purpose**: Document risks, mitigations, and decisions for anonymization parameters

---

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [Known Risks & Attack Vectors](#known-risks--attack-vectors)
3. [Mitigation Options](#mitigation-options)
4. [Literature & Precedents](#literature--precedents)
5. [Open Questions](#open-questions)
6. [Decision Log](#decision-log)

---

## Current Implementation

### Parameters (as of 2026-01-09)

| Parameter | Value | Location | Justification |
|-----------|-------|----------|---------------|
| K-anonymity threshold | k=10 | `backend/app/aggregation.py:20` | Arbitrary - needs justification |
| Differential privacy ε | ε=1.0 | `backend/app/aggregation.py:21` | Arbitrary - needs justification |
| Sensitivity | 168 hrs/week ÷ n_users | `aggregation.py:140-141` | Based on max possible hours |
| Noise mechanism | Laplace | `aggregation.py:41-64` | Standard for numeric queries |

### Group Definition

Groups are **fixed-dimension**, always aggregated by:
```
country_code × state_code × specialty × role_level × ISO_week
```

- No hierarchical rollup (e.g., no "all physicians in Germany")
- Groups below k threshold are fully suppressed
- Each group is independent (no cross-group queries)

### What Gets Published

| Field | Type | Privacy Treatment |
|-------|------|-------------------|
| n_users | count | Exact (but only if ≥k) |
| avg_planned_hours | average | Laplace noise added |
| avg_actual_hours | average | Laplace noise added |
| avg_overtime_hours | average | Laplace noise added |

---

## Known Risks & Attack Vectors

### Risk 1: Temporal Boundary Attack

**Severity**: Medium
**Status**: Unmitigated

**Description**: When group membership changes across time periods, attackers can infer individual contributions.

**Scenario**:
```
Week 1: Group "Cardiologists/Bavaria/Attending" → suppressed (n=9)
Week 2: Same group → published (n=10), avg=55 hours
```
Attacker inference: "The new member works approximately 55 hours."

**Worse scenario** (departure):
```
Week 2: avg=55 hours, n=10 → total ≈ 550 hours
Week 3: suppressed (n=9)
```
If attacker knows week 3's would-be average, they can compute the departed person's hours.

**Potential Mitigations**:
- [ ] Temporal stability requirement (only publish after N consecutive weeks ≥k)
- [ ] Publish only "stable cohorts" (users present entire period)
- [ ] Increase noise when group size is near threshold

---

### Risk 2: Composition Attack (Privacy Degradation Over Time)

**Severity**: Medium-High
**Status**: Unmitigated

**Description**: Publishing the same population repeatedly with fresh noise allows attackers to average out the noise.

**Math**:
- Single release: ε=1.0
- 52 weekly releases: effective ε ≈ 52 (if same population)
- Noise averages out: std_error decreases by √n_releases

**Potential Mitigations**:
- [ ] Track cumulative privacy budget per group
- [ ] Cap total releases per group per year
- [ ] Use correlated noise across time (same noise seed for same cohort)
- [ ] Increase ε budget to account for composition

---

### Risk 3: Homogeneity Attack

**Severity**: Medium
**Status**: Unmitigated

**Description**: k-anonymity guarantees "hidden among k people" but if all k people have similar values, the attacker learns the value anyway.

**Scenario**:
```
Group: 10 cardiologists in Bavaria
All work 58-62 hours/week
Published average: 60.2 hours (with noise)
```
Attacker knows: "Any cardiologist in Bavaria works ~60 hours" - k-anonymity provides no protection.

**Potential Mitigations**:
- [ ] Add l-diversity requirement (minimum variance in sensitive values)
- [ ] Add t-closeness requirement (distribution similar to population)
- [ ] Suppress groups with low variance

---

### Risk 4: Intersection/Differencing Attack

**Severity**: High (if triggered)
**Status**: Currently mitigated by design

**Description**: Publishing overlapping groups at different granularities allows subtraction attacks.

**Example** (if we published both):
```
"Physicians in Bavaria"        → avg 52 hrs, n=100
"Non-cardiologists in Bavaria" → avg 50 hrs, n=90
```
Attacker computes: Cardiologists = (52×100 - 50×90) / 10 = 70 hrs

**Current Mitigation**: Fixed-dimension grouping prevents this.

**Risk if changed**: Adding "flexible grouping" or "hierarchical rollups" would open this vector.

---

### Risk 5: Auxiliary Information Attack

**Severity**: Varies
**Status**: Inherent limitation of k-anonymity

**Description**: External knowledge can defeat k-anonymity guarantees.

**Scenario**:
```
Attacker knows: "Dr. Schmidt is the only interventional cardiologist at Rural Hospital X"
Published: "Cardiologists in Bavaria" includes Dr. Schmidt
```
Even with k=10, if attacker has identifying auxiliary info, they can isolate the individual.

**Potential Mitigations**:
- [ ] Broader geographic grouping (country instead of state)
- [ ] Coarser specialty grouping (physician vs. cardiologist)
- [ ] Higher k threshold
- [ ] Differential privacy provides mathematical bounds regardless of auxiliary info

---

### Risk 6: Small Population Exploitation

**Severity**: Medium
**Status**: Partially mitigated

**Description**: Some specialty×region combinations may have very small total populations, making k-anonymity less meaningful.

**Scenario**:
```
Total pediatric surgeons in Saarland: 12
Published group: n=10 (the 10 who submitted data)
```
Attacker knows there are only 12 total - the "anonymity set" is effectively 12, not infinite.

**Current Mitigation**: k=10 means at least 10 in published set.

**Potential Mitigations**:
- [ ] Require k to be fraction of total population (e.g., k ≤ 50% of known population)
- [ ] Suppress groups where total population is estimable and small

---

### Risk 7: Exact n_users Disclosure

**Severity**: Low-Medium
**Status**: Unmitigated

**Description**: Publishing exact user counts (n_users) without noise leaks information.

**Scenario**:
```
Week 1: n=15
Week 2: n=14
```
Attacker inference: "Someone left the group this week."

**Potential Mitigations**:
- [ ] Add noise to n_users (but this complicates k-anonymity semantics)
- [ ] Publish n_users in ranges (10-20, 20-50, 50+)
- [ ] Don't publish n_users at all

---

## Mitigation Options

### Option A: Temporal Stability

**Mechanism**: Only publish groups that have been ≥k for N consecutive periods.

| Pros | Cons |
|------|------|
| Prevents boundary attacks | Delays data availability |
| Simple to implement | May suppress valid groups indefinitely |
| No additional noise needed | Requires tracking group history |

**Implementation complexity**: Low
**Utility impact**: Medium (delays publication)

---

### Option B: L-Diversity

**Mechanism**: Require minimum variance/diversity in sensitive values within each group.

| Pros | Cons |
|------|------|
| Prevents homogeneity attacks | May suppress many groups |
| Well-established technique | Requires defining "diverse enough" |
| Complements k-anonymity | Additional computation |

**Implementation complexity**: Medium
**Utility impact**: Medium-High (may suppress many groups)

---

### Option C: Privacy Budget Tracking

**Mechanism**: Track cumulative ε spent per group, stop publishing when budget exhausted.

| Pros | Cons |
|------|------|
| Formal composition guarantees | Complex accounting |
| Prevents long-term degradation | May "run out" of budget |
| Mathematically principled | Requires defining yearly budget |

**Implementation complexity**: Medium-High
**Utility impact**: High (groups eventually go dark)

---

### Option D: Coarser Grouping

**Mechanism**: Aggregate at country level instead of state level.

| Pros | Cons |
|------|------|
| Larger anonymity sets | Less useful/specific data |
| Fewer suppressed groups | Loses regional insights |
| Simpler | May not meet user needs |

**Implementation complexity**: Low
**Utility impact**: High (less granular data)

---

### Option E: Increase k Threshold

**Mechanism**: Raise k from 10 to 20 or higher.

| Pros | Cons |
|------|------|
| Stronger anonymity guarantee | More groups suppressed |
| Simple change | May make data useless for small regions |
| Aligns with stricter standards | Doesn't address other attacks |

**Implementation complexity**: Trivial
**Utility impact**: Medium-High

---

### Option F: Range-Based User Counts

**Mechanism**: Publish n_users as ranges instead of exact counts.

| Pros | Cons |
|------|------|
| Prevents membership inference | Less precise |
| Simple | Complicates downstream analysis |
| No impact on averages | May look "suspicious" |

**Implementation complexity**: Low
**Utility impact**: Low

---

## Literature & Precedents

### K-Anonymity Thresholds

| Source | Recommended k | Context |
|--------|---------------|---------|
| EMA / Health Canada | k=11 | Clinical trial data disclosure |
| Common practice (research) | k=5 | Minimum acceptable |
| HIPAA Safe Harbor | k≈20 implied | Geographic areas >20k population |
| Our current | k=10 | No formal justification yet |

**Key paper**: [El Emam et al. (2009)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2744718/) - "A Globally Optimal k-Anonymity Method for the De-Identification of Health Data"

**Finding**: k=5 common minimum, values above 15 rare in practice. Risk threshold of 0.09 (k≈11) recommended for external disclosure.

---

### Differential Privacy Epsilon

| Organization | Epsilon | Context |
|--------------|---------|---------|
| Academic recommendation | 0.001 - 1.0 | Theoretical |
| Apple | 2 - 16 | Local DP, per user/day |
| Google Mobility | 2.64 | Central DP |
| US Census 2020 | 13.64 - 49.21 | Varies by product |
| Our current | 1.0 | At upper edge of academic range |

**Key insight**: Large gap between academic recommendations (ε≤1) and industry practice (ε=2-50). No successful attacks reported on industry systems despite high ε values.

**Key paper**: [Dwork & Roth (2014)](https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf) - "The Algorithmic Foundations of Differential Privacy"

---

### Healthcare-Specific Guidance

| Regulation | Requirement | Notes |
|------------|-------------|-------|
| GDPR Art. 26 | "Anonymous" = no re-identification reasonably likely | Context-dependent |
| GDPR Recital 26 | Consider "all means reasonably likely to be used" | Includes future tech |
| HIPAA Safe Harbor | 18 identifiers removed + geographic >20k | US-specific |
| HIPAA Expert Determination | Statistical/scientific principles | Requires expert |

**Open question**: Does k=10 + ε=1.0 satisfy GDPR "anonymous data" standard?

---

## Open Questions

### For Legal Review

1. **Does our approach constitute "anonymous data" under GDPR?**
   - If yes: GDPR doesn't apply to published stats
   - If no: Need legal basis for processing

2. **Is k=10 (or k=11) defensible for healthcare worker data?**
   - Consider: Sensitivity of hours data, threat model, auxiliary info availability

3. **Can aggregated stats be retained after user deletion?**
   - Current claim: "Yes, because anonymous"
   - Risk: If not truly anonymous, this violates right to erasure

4. **Do we need a DPIA specifically for the aggregation/publication?**
   - Current DPIA covers collection; publication may need separate assessment

### For Technical Research

5. **What is the actual population size for each specialty×state?**
   - Needed to assess whether k=10 is meaningful fraction

6. **What is the variance in working hours across groups?**
   - Needed to assess homogeneity attack risk

7. **How to handle composition over 52+ weeks?**
   - Need formal budget accounting or accept degradation

8. **Should n_users be noised or bucketed?**
   - Trade-off: Precision vs. membership inference protection

---

## Decision Log

| Date | Decision | Rationale | Decided By |
|------|----------|-----------|------------|
| 2026-01-09 | Created this document | Need systematic approach before lawyer meeting | - |
| TBD | k threshold value | Pending research + legal | - |
| TBD | ε value | Pending research + legal | - |
| TBD | Temporal stability | Pending risk assessment | - |
| TBD | l-diversity | Pending risk assessment | - |

---

## Next Steps

1. [ ] Research: Get actual population sizes for specialty×state combinations
2. [ ] Research: Analyze variance in submitted hours data (homogeneity risk)
3. [ ] Research: Model composition attack over 52 weeks
4. [ ] Legal: Review this document with lawyer
5. [ ] Decision: Finalize k and ε values with justification
6. [ ] Decision: Choose which mitigations to implement
7. [ ] Implementation: Update aggregation.py with chosen parameters
8. [ ] Documentation: Update privacy_architecture.md and DPIA

---

## References

- El Emam, K. et al. (2009). A Globally Optimal k-Anonymity Method for the De-Identification of Health Data. JAMIA.
- Dwork, C. & Roth, A. (2014). The Algorithmic Foundations of Differential Privacy.
- NIST (2021). Differential Privacy Guidelines.
- EMA (2019). External Guidance on Clinical Trial Data Anonymization.
- GDPR Recital 26 - Definition of Anonymous Data.
