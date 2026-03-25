# GDPR Compliance Status

**Last Updated:** 2026-03-23
**Status:** Draft - Pending Legal Review
**Audience:** Controller (internal) + Legal Counsel

---

## Quick Status

| Area | Status | Notes |
|------|--------|-------|
| Privacy Architecture | Done | Technical design complete |
| Privacy Policy (App) | Draft | EN + DE, needs legal review |
| Terms of Service | Draft | EN + DE, needs legal review |
| DPIA | Draft | Needs legal review |
| RoPA | Draft | Needs legal review |
| Data Retention Policy | Draft | Needs legal review |
| Consent Flow | Deployed | Tested on device 2026-01-12 |
| Consent Withdrawal | Deployed | Tested 2026-01-12; see `CONSENT_WITHDRAWAL_PLAN.md` |
| Hetzner DPA | Signed | 2026-01-13 |
| Brevo DPA | Signed | Part of ToS (exported PDF) |
| Legal Review | Pending | No lawyer engaged yet |

---

## Documentation Index

### Technical Design

| Document | Purpose | Status |
|----------|---------|--------|
| [`privacy_architecture.md`](../privacy_architecture.md) | How we protect data technically (k-anonymity, two-layer design) | Complete |

### Legal Documents (For Lawyer Review)

| Document | GDPR Article | Purpose | Status |
|----------|--------------|---------|--------|
| [`DPIA.md`](DPIA.md) | Art. 35 | Data Protection Impact Assessment | Draft |
| [`ROPA.md`](ROPA.md) | Art. 30 | Records of Processing Activities | Draft |
| [`data-retention-policy.md`](data-retention-policy.md) | Art. 5(1)(e), 17 | How long data is kept, deletion procedures | Draft |

### User-Facing Policies

| Document | Language | URL (after deploy) | Status |
|----------|----------|-------------------|--------|
| App Privacy Policy | EN | `/app-privacy-policy` | Draft |
| App Privacy Policy | DE | `/de/app-privacy-policy` | Draft |
| Terms of Service | EN | `/terms` | Draft |
| Terms of Service | DE | `/de/terms` | Draft |

Website source files: `website/src/pages/`

### Implementation Specs

| Document | Purpose | Status |
|----------|---------|--------|
| [`consent-flow-spec.md`](consent-flow-spec.md) | Original UI specification | Complete |
| [`CONSENT_FLOW_IMPLEMENTATION_PLAN.md`](CONSENT_FLOW_IMPLEMENTATION_PLAN.md) | Detailed implementation plan with UX review | Complete |
| [`CONSENT_WITHDRAWAL_PLAN.md`](CONSENT_WITHDRAWAL_PLAN.md) | Consent withdrawal & account deletion (Art. 7, 17) | Draft |

### Differential Privacy Specifications

| Document | Purpose | Status |
|----------|---------|--------|
| [`dp-group-stats-requirements-v2.md`](dp-group-stats-requirements-v2.md) | Formal spec: threat model, neighboring relation, sensitivity bounds | Complete |
| [`dp-group-stats-accounting-model.md`](dp-group-stats-accounting-model.md) | Composition model: release families, budget accounting, ledger design | Complete |
| [`dp-group-stats-simulation-spec.md`](dp-group-stats-simulation-spec.md) | Parameter validation: 200+ simulation scenarios | Complete |

---

## Compliance Checklist

### Before Public Launch

- [x] **Sign Hetzner DPA** (Signed 2026-01-13)
  - AVV (Auftragsverarbeitungsvertrag) signed via Hetzner Console

- [x] **Sign Brevo DPA** (Part of ToS, exported PDF)
  - DPA included in Brevo Terms of Service

- [ ] **Legal review of all documents**
  - DPIA
  - RoPA
  - Data Retention Policy
  - App Privacy Policy (EN + DE)
  - Terms of Service (EN + DE)

- [ ] **Bump consent version to "2026-03"**
  - v2 taxonomy materially changes data collected (hospital affiliation, new profile fields)
  - Update `CURRENT_TERMS_VERSION` and `CURRENT_PRIVACY_VERSION` in `consent-types.ts`
  - Existing users will see re-consent screen on app update

- [ ] **Remove "Draft" banners from policies**
  - After lawyer approval, remove yellow warning banners from website pages

- [x] **Implement consent flow in app** (2026-01-09, deployed 2026-01-12)
  - [x] Backend: Added consent fields to User model
  - [x] Backend: Created `POST /auth/consent` endpoint
  - [x] Backend: Alembic migration `a1b2c3d4e5f6_add_consent_fields_to_users.py`
  - [x] Mobile: Created `ConsentBottomSheet` component
  - [x] Mobile: Integrated into `RegisterScreen`
  - [x] Mobile: Added `ConsentStorage` for local persistence
  - [x] Translations: EN + DE consent strings
  - [x] Deploy backend + run migration (2026-01-12)
  - [x] Build TestFlight + test on device (2026-01-12)

- [x] **Implement consent withdrawal** (Art. 7(3), Art. 17) (2026-01-12)
  - See [`archive/CONSENT_WITHDRAWAL_PLAN.md`](../archive/CONSENT_WITHDRAWAL_PLAN.md) for implementation details
  - [x] Backend: Add `DELETE /auth/me` endpoint
  - [x] Mobile: Add `deleteAccount()` to AuthService
  - [x] Mobile: Add consent status display to DataPrivacyScreen
  - [x] Mobile: Add withdrawal button with confirmation flow
  - [x] Translations: EN + DE withdrawal strings
  - [x] Deploy and test (2026-01-12)

- [x] **Link policies from app Settings** (2026-01-12)
  - [x] Settings screen links to Privacy Policy and Terms
  - [x] Data export button added to Data & Privacy screen (GDPR Art. 20)

### Ongoing Compliance

- [ ] **Establish policy review cadence**
  - Review privacy architecture annually or when processing changes
  - Update RoPA when new processing activities are added

- [ ] **Document deletion request handling**
  - Currently: User deletes via app (self-service)
  - Consider: What if user emails requesting deletion?

- [ ] **Backup deletion verification**
  - Verify backup rotation is working (30-day retention)

---

## Legal Basis Summary

| Processing Activity | Legal Basis | GDPR Article |
|--------------------|-------------|--------------|
| Account creation, authentication | Contract | Art. 6(1)(b) |
| Storing work events | Contract | Art. 6(1)(b) |
| Data export/deletion | Contract + Legal obligation | Art. 6(1)(b), (c) |
| Contribution to aggregated statistics | Consent | Art. 6(1)(a) |

Consent is collected via in-app acceptance of Terms + Privacy Policy before first data submission.

---

## Processors

| Processor | Purpose | DPA Status | Location |
|-----------|---------|------------|----------|
| Hetzner Online GmbH | Server hosting | Signed 2026-01-13 | Germany |
| Brevo (Sendinblue) | Email delivery | Signed (part of ToS) | EU |

**DPA Storage:** Signed DPAs are stored in a private location (not in this repo). Contact the project maintainer for access.

No processors outside EU/EEA.

### Processor Notes

**Hetzner (Backup Retention):**
- Daily PostgreSQL backups to Hetzner Object Storage (configured 2026-02-03)
- **COMPLIANCE mode Object Lock**: Backups are immutable for 30 days
- When a user deletes their account, their data persists in backups until rotation
- This is documented in the Privacy Policy and accepted as standard practice
- After 30 days, deleted user data is fully purged
- See `docs/deployment.md` → Database Backups section for technical details

**Brevo (Email Delivery):**
- Used only for transient email delivery (verification codes)
- No user data stored permanently in Brevo
- Brevo retains delivery logs per their standard retention policy
- User email addresses are only used for sending, not marketing

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Legal basis for stats | Consent (not legitimate interest) | Cleaner, user can withdraw |
| Single consent checkbox | Terms + Privacy combined | Both required, simpler UX |
| K-anonymity threshold | k = 5 | Sufficient for group-level statistics with differential privacy |
| Differential privacy | Laplace mechanism with per-user annual ε budget cap of 150; adaptive schedule reduces noise calibration as budget is consumed | See `docs/dp-group-stats-accounting-model.md` for composition model |
| Sick days | Local only, never transmitted | Avoids health data classification |
| Email storage | Hash only, no plaintext | Pseudonymization |
| Hospital affiliation | Optional, from named reference dataset (~1,220 German hospitals) | Enables facility-level statistics for public transparency, union advocacy, and research; optional to limit re-identification risk |
| Backup retention | 30 days | Balance of recovery needs vs. right to erasure |

---

## For Lawyer Review

When engaging legal counsel, provide:

1. **This document** - Overview of compliance status
2. **`DPIA.md`** - Risk assessment
3. **`ROPA.md`** - Processing activities
4. **`data-retention-policy.md`** - Retention periods
5. **App Privacy Policy** - User-facing (website)
6. **Terms of Service** - User-facing (website)
7. **`privacy_architecture.md`** - Technical background

### Questions for Lawyer

1. Are the k-anonymity (k=5) and differential privacy parameters (Laplace mechanism, per-user annual ε cap of 150, substitution neighboring relation) sufficient to claim the analytics layer is "anonymous" under GDPR? See `docs/dp-group-stats-requirements-v2.md` and `docs/dp-group-stats-accounting-model.md` for full specification.
2. Is the Consent + Contract hybrid legal basis approach appropriate?
3. Are the draft Privacy Policy and Terms sufficient for German/EU requirements?
4. Is the DPIA adequate given we're not strictly required to have one?
5. Any issues with retaining aggregated statistics after user deletion?
6. Does collecting optional hospital affiliation (reference to ~1,220 named German hospitals) change the risk profile sufficiently to require additional safeguards beyond those described in the DPIA (R7)?

---

## Document History

| Date | Change |
|------|--------|
| 2026-01-07 | Initial creation of all GDPR compliance documents |
| 2026-01-12 | Consent flow deployed and tested; added consent withdrawal plan |
| 2026-03-21 | Updated DP parameters to simulation-validated values (K_MIN=5, annual cap 150); updated privacy architecture with substitution neighboring relation |
| 2026-03-25 | v2 taxonomy: hospital affiliation added to Key Decisions; lawyer question on hospital risk; consent version bump added to checklist |

---

## Related Files

```
/Users/user01/open_workinghours/
├── privacy_architecture.md              # Technical privacy design
├── docs/
│   ├── GDPR_COMPLIANCE.md               # This file (hub)
│   ├── DPIA.md                          # Data Protection Impact Assessment
│   ├── ROPA.md                          # Records of Processing Activities
│   ├── data-retention-policy.md         # Retention policy
│   ├── consent-flow-spec.md             # Consent UI spec
│   ├── CONSENT_FLOW_IMPLEMENTATION_PLAN.md  # Consent flow implementation
│   └── CONSENT_WITHDRAWAL_PLAN.md       # Consent withdrawal & account deletion
└── website/src/pages/
    ├── app-privacy-policy.astro         # EN privacy policy
    ├── terms.astro                      # EN terms of service
    └── de/
        ├── app-privacy-policy.astro     # DE privacy policy
        └── terms.astro                  # DE terms of service
```
