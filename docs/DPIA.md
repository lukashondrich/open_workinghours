# Data Protection Impact Assessment (DPIA)

**Project:** Open Working Hours
**Version:** 1.0 (Draft)
**Date:** January 2026
**Author:** Lukas Jonathan Hondrich
**Status:** Draft - Pending Legal Review

---

> **Note:** This DPIA is prepared as a best-practice document. While the processing may not strictly require a DPIA under Art. 35 GDPR, this assessment demonstrates due diligence and supports the privacy-by-design approach of the project.

---

## 1. Introduction

### 1.1 Purpose of This Assessment

This Data Protection Impact Assessment evaluates the privacy risks associated with the Open Working Hours platform, which collects working hour data from healthcare workers to generate anonymized, aggregated statistics about working conditions in the healthcare sector.

### 1.2 Why This DPIA Was Conducted

Although the processing may not trigger mandatory DPIA requirements under Art. 35 GDPR, we conduct this assessment because:

- The platform processes data about employment/working conditions
- The data subjects are healthcare workers (potentially vulnerable in employment context)
- The platform uses novel privacy-preserving techniques (k-anonymity, differential privacy)
- Demonstrating privacy-by-design builds trust with users and partners

### 1.3 Scope

This DPIA covers:
- The Open Working Hours mobile application (iOS)
- The backend API and database
- The aggregation and statistics publication process

Out of scope:
- The marketing website (processes no personal data)
- Future features not yet implemented

---

## 2. Description of Processing

### 2.1 Nature of Processing

| Aspect | Description |
|--------|-------------|
| **What data** | Email hash, working hours (planned/actual), profile data (state, specialty, role level), anonymous user ID |
| **Whose data** | Healthcare workers in Germany who voluntarily use the app |
| **Why** | To enable personal tracking and to generate aggregated statistics about healthcare working conditions |
| **How** | Mobile app collects data locally; confirmed days are submitted to backend; aggregation job produces k-anonymous statistics |

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S DEVICE                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Local SQLite Database (never transmitted)                    │   │
│  │  • GPS coordinates for geofencing                            │   │
│  │  • Shift templates and schedules                             │   │
│  │  • Sick days and vacation records                            │   │
│  │  • Unconfirmed tracking sessions                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                    User confirms day                                 │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Transmitted to Backend                                       │   │
│  │  • Date, planned_minutes, actual_minutes                     │   │
│  │  • Profile: state_code, specialty, role_level                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                          TLS 1.3
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Hetzner, Germany)                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Operational Layer (PostgreSQL) - Pseudonymous               │   │
│  │  • users: id, email_hash, profile data                       │   │
│  │  • work_events: user_id, date, planned/actual minutes        │   │
│  │  GDPR applies - Right to erasure honored                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                   Daily aggregation job                              │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Analytics Layer (PostgreSQL) - Anonymous                     │   │
│  │  • stats_by_state_specialty: aggregates only                 │   │
│  │  • K-anonymity: n_users ≥ 10                                 │   │
│  │  • Differential privacy: Laplace noise (ε=1.0)               │   │
│  │  No personal data - Retained after user deletion             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Categories

| Category | Data Elements | Storage | Retention |
|----------|---------------|---------|-----------|
| **Authentication** | Email (transient), email hash, verification codes | Backend | Hash: until deletion; Codes: 15 min |
| **Profile** | State code, specialty, role level | Backend | Until account deletion |
| **Work Events** | Date, planned minutes, actual minutes | Backend | Until account deletion |
| **Local Tracking** | GPS coordinates, shift templates, sick days | Device only | User-controlled |
| **Aggregates** | Group statistics with noise | Backend | Indefinite (anonymous) |

### 2.4 Legal Basis

| Processing Activity | Legal Basis | GDPR Article |
|--------------------|-------------|--------------|
| Account creation & authentication | Contract | Art. 6(1)(b) |
| Storing work events for user | Contract | Art. 6(1)(b) |
| Data export and deletion | Contract | Art. 6(1)(b) |
| Contribution to aggregated statistics | Consent | Art. 6(1)(a) |

---

## 3. Necessity and Proportionality

### 3.1 Purpose Limitation

The data is processed for two clear purposes:
1. **Primary:** Enable users to track their own working hours
2. **Secondary:** Generate anonymized statistics for transparency reporting

No other purposes are pursued. Data is not used for marketing, profiling, or sold to third parties.

### 3.2 Data Minimization

| Principle | Implementation |
|-----------|----------------|
| **Collect only necessary data** | No names, no employer names, no precise locations transmitted |
| **Local-first architecture** | GPS coordinates, sick days, schedules stay on device |
| **Pseudonymization** | Email hashed; users identified by random UUID |
| **Aggregation** | Individual data contributes to groups, not published individually |

### 3.3 Storage Limitation

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| User account data | Until user deletes account | Necessary to provide service |
| Work events | Until user deletes account | User's own records |
| Verification codes | 15 minutes | Security best practice |
| Server backups | 30 days rolling | Disaster recovery |
| Aggregated statistics | Indefinite | Anonymous, no personal data |

### 3.4 Accuracy

- Users control their own data and can correct it
- Work events are confirmed by users before submission
- No automated decision-making based on the data

---

## 4. Risk Assessment

### 4.1 Risk Identification

| Risk ID | Risk Description | Likelihood | Impact | Inherent Risk |
|---------|------------------|------------|--------|---------------|
| R1 | Re-identification from aggregated statistics | Low | High | Medium |
| R2 | Unauthorized access to operational database | Low | High | Medium |
| R3 | Employer discovers employee uses the app | Medium | Medium | Medium |
| R4 | Data breach exposing email hashes | Low | Medium | Low |
| R5 | User submits inaccurate data affecting statistics | Medium | Low | Low |
| R6 | Service provider (processor) data breach | Low | Medium | Low |

### 4.2 Risk Analysis

#### R1: Re-identification from Aggregated Statistics

**Description:** An attacker uses background knowledge to identify an individual from published statistics.

**Existing Controls:**
- K-anonymity (k=10): Statistics only published for groups of 10+ users
- Cell suppression: Groups below threshold completely hidden
- Laplace noise (ε=1.0): Statistical noise masks individual contributions
- Limited dimensions: Only predefined groupings allowed

**Residual Risk:** LOW - Multiple overlapping privacy protections make re-identification practically infeasible.

#### R2: Unauthorized Database Access

**Description:** Attacker gains access to the operational database.

**Existing Controls:**
- Encrypted at rest
- Strong access controls
- No direct database exposure (API-only access)
- EU data residency (Hetzner Germany)
- Regular security updates

**Residual Risk:** LOW - Standard security measures in place.

#### R3: Employer Discovery

**Description:** Employer discovers that an employee is using the app to track working hours.

**Existing Controls:**
- No employer access to any data
- No employer relationship with the platform
- User's personal device, personal app
- Clear communication that this is not an employer tool

**Residual Risk:** MEDIUM - Outside technical control. Mitigated through clear positioning and privacy-first communication. Users should understand this is a personal tool.

#### R4: Email Hash Exposure

**Description:** Breach exposes email hashes, which could be reversed via rainbow tables.

**Existing Controls:**
- Email hashes use secret salt (EMAIL_HASH_SECRET)
- Original emails not stored
- Salted hashing prevents simple rainbow table attacks

**Residual Risk:** LOW - Salted hashing provides adequate protection.

#### R5: Inaccurate Data

**Description:** Users submit false data, skewing statistics.

**Existing Controls:**
- Users must manually confirm each day
- Statistical noise absorbs some outliers
- Aggregation across many users dilutes individual errors
- Clear communication that data is self-reported

**Residual Risk:** LOW - Accepted limitation of self-reported data. Statistics clearly labeled as self-reported.

#### R6: Processor Data Breach

**Description:** Hetzner or Brevo experiences a security incident.

**Existing Controls:**
- DPAs in place (to be signed)
- Reputable EU-based providers
- Limited data shared with processors
- Brevo receives only email addresses transiently

**Residual Risk:** LOW - Standard processor risk, mitigated by choosing reputable EU providers.

### 4.3 Risk Matrix Summary

| Risk Level | Count | Risks |
|------------|-------|-------|
| HIGH | 0 | — |
| MEDIUM | 1 | R3 (Employer discovery) |
| LOW | 5 | R1, R2, R4, R5, R6 |

---

## 5. Measures to Address Risks

### 5.1 Technical Measures

| Measure | Addresses Risk | Status |
|---------|----------------|--------|
| K-anonymity (k≥10) | R1 | Implemented |
| Differential privacy (ε=1.0) | R1 | Implemented |
| TLS 1.3 encryption in transit | R2 | Implemented |
| Encryption at rest | R2 | Implemented |
| Salted email hashing | R4 | Implemented |
| EU-only data storage | R2, R6 | Implemented |
| Local-only storage for sensitive data | R2, R3 | Implemented |

### 5.2 Organizational Measures

| Measure | Addresses Risk | Status |
|---------|----------------|--------|
| Privacy policy and transparency | R3 | Implemented |
| Data Processing Agreements with processors | R6 | Pending |
| Clear "not an employer tool" messaging | R3 | Implemented |
| User-controlled deletion | R1, R2, R4 | Implemented |
| Data export functionality | All | Implemented |
| Regular security reviews | R2 | Planned |

### 5.3 Measures for Residual Medium Risk (R3)

The employer discovery risk cannot be fully mitigated technically. Measures:

1. **Clear communication:** Platform explicitly positioned as employee-empowerment tool
2. **No employer relationships:** We will never partner with or sell data to employers
3. **User education:** Privacy FAQ explaining the personal nature of the app
4. **Legal independence:** No legal relationship between platform and user's employer

---

## 6. Consultation

### 6.1 Data Subject Views

As a new platform, formal consultation with data subjects has not yet been conducted. However:

- The platform was developed in response to healthcare worker concerns about overtime
- User testing with healthcare workers informed the privacy design
- Feedback channels (in-app, email) are available

### 6.2 DPO Consultation

No Data Protection Officer is appointed (not required for this processing scale). This DPIA serves as the privacy governance documentation.

### 6.3 Legal Review

**Status:** Pending

This DPIA and associated documents are prepared for review by qualified GDPR legal counsel before public launch.

---

## 7. Conclusions

### 7.1 Assessment Outcome

The Open Working Hours platform implements privacy-by-design principles and addresses identified risks through technical and organizational measures. The residual risks are acceptable given:

- Strong technical privacy protections (k-anonymity, differential privacy)
- Voluntary participation with clear consent
- Transparent privacy practices
- User control over their data
- No high-risk processing activities identified

### 7.2 Recommendations

1. **Complete DPA signatures** with Hetzner and Brevo before processing user data at scale
2. **Obtain legal review** of this DPIA and privacy policy before broad launch
3. **Monitor k-anonymity thresholds** - consider increasing k if user base grows significantly
4. **Annual review** of this DPIA to account for changes in processing or risk landscape

### 7.3 Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Controller | Lukas Jonathan Hondrich | | Pending |
| Legal Counsel | | | Pending review |

---

## 8. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | L. Hondrich | Initial draft |

---

## Appendix A: Privacy Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| K-anonymity threshold | k = 10 | Industry standard for statistical disclosure control |
| Differential privacy epsilon | ε = 1.0 | Balanced privacy/utility tradeoff |
| Backup retention | 30 days | Sufficient for disaster recovery |
| Verification code expiry | 15 minutes | Security best practice |

These values are working parameters subject to adjustment based on legal review.

---

## Appendix B: Related Documents

- `privacy_architecture.md` - Technical privacy design
- `app-privacy-policy` - User-facing privacy policy
- `terms` - Terms of Service
- `ROPA.md` - Records of Processing Activities
- `data-retention-policy.md` - Data retention policy
