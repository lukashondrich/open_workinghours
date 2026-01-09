# Records of Processing Activities (RoPA)

**Organization:** Open Working Hours
**Controller:** Lukas Jonathan Hondrich
**Version:** 1.0 (Draft)
**Date:** January 2026
**Status:** Draft - Pending Legal Review

---

> **Legal Basis:** Art. 30 GDPR requires controllers to maintain records of processing activities. This document fulfills that requirement.

---

## 1. Controller Information

| Field | Value |
|-------|-------|
| **Controller Name** | Lukas Jonathan Hondrich |
| **Address** | Karl-Marx-Straße 182, 12043 Berlin, Germany |
| **Contact Email** | privacy@openworkinghours.org |
| **Data Protection Officer** | Not appointed (not required based on processing scale) |
| **EU Representative** | N/A (Controller is in EU) |

---

## 2. Processing Activities

### 2.1 User Account Management

| Field | Description |
|-------|-------------|
| **Processing Activity** | User Account Management |
| **Purpose** | Create and manage user accounts for the mobile application |
| **Legal Basis** | Art. 6(1)(b) - Contract |
| **Categories of Data Subjects** | Healthcare workers using the app |
| **Categories of Personal Data** | Email hash, user ID, profile data (state, specialty, role level), account creation date |
| **Recipients** | Hetzner (hosting) |
| **Third Country Transfers** | None |
| **Retention Period** | Until user deletes account |
| **Technical/Organizational Measures** | Encryption at rest/transit, access controls, pseudonymization |

---

### 2.2 Email Verification

| Field | Description |
|-------|-------------|
| **Processing Activity** | Email Verification |
| **Purpose** | Verify user identity during registration and login |
| **Legal Basis** | Art. 6(1)(b) - Contract |
| **Categories of Data Subjects** | Users registering or logging in |
| **Categories of Personal Data** | Email address (transient), verification code |
| **Recipients** | Brevo (email delivery) |
| **Third Country Transfers** | None (Brevo EU) |
| **Retention Period** | Email: transient (not stored); Verification code: 15 minutes |
| **Technical/Organizational Measures** | TLS encryption, code expiry, rate limiting |

---

### 2.3 Work Event Storage

| Field | Description |
|-------|-------------|
| **Processing Activity** | Work Event Storage |
| **Purpose** | Store confirmed daily working hours submitted by users |
| **Legal Basis** | Art. 6(1)(b) - Contract |
| **Categories of Data Subjects** | App users who confirm working hours |
| **Categories of Personal Data** | User ID, date, planned minutes, actual minutes |
| **Recipients** | Hetzner (hosting) |
| **Third Country Transfers** | None |
| **Retention Period** | Until user deletes account |
| **Technical/Organizational Measures** | Encryption, access controls, cascading delete on user deletion |

---

### 2.4 Statistical Aggregation

| Field | Description |
|-------|-------------|
| **Processing Activity** | Statistical Aggregation |
| **Purpose** | Generate anonymized statistics about healthcare working conditions |
| **Legal Basis** | Art. 6(1)(a) - Consent |
| **Categories of Data Subjects** | App users who have consented via Terms acceptance |
| **Categories of Personal Data** | Derived from work events: state, specialty, role level, aggregated hours |
| **Recipients** | Public (anonymized statistics only) |
| **Third Country Transfers** | None |
| **Retention Period** | Indefinite (output is anonymous, not personal data) |
| **Technical/Organizational Measures** | K-anonymity (k≥10), differential privacy (ε=1.0), no individual data in output |

---

### 2.5 User Data Export

| Field | Description |
|-------|-------------|
| **Processing Activity** | User Data Export |
| **Purpose** | Provide users with a copy of their personal data (Art. 15, 20) |
| **Legal Basis** | Art. 6(1)(c) - Legal obligation |
| **Categories of Data Subjects** | Users requesting export |
| **Categories of Personal Data** | All data associated with user account |
| **Recipients** | The requesting user only |
| **Third Country Transfers** | None |
| **Retention Period** | N/A (one-time export) |
| **Technical/Organizational Measures** | Authentication required, JSON format |

---

### 2.6 Account Deletion

| Field | Description |
|-------|-------------|
| **Processing Activity** | Account Deletion |
| **Purpose** | Delete user account and associated data on request (Art. 17) |
| **Legal Basis** | Art. 6(1)(c) - Legal obligation |
| **Categories of Data Subjects** | Users requesting deletion |
| **Categories of Personal Data** | All data associated with user account |
| **Recipients** | None (data deleted) |
| **Third Country Transfers** | None |
| **Retention Period** | Immediate deletion; backups within 30 days |
| **Technical/Organizational Measures** | Cascading delete, backup rotation |

---

## 3. Processors

### 3.1 Hetzner Online GmbH

| Field | Value |
|-------|-------|
| **Processor Name** | Hetzner Online GmbH |
| **Address** | Industriestr. 25, 91710 Gunzenhausen, Germany |
| **Processing Activities** | Server hosting, database storage |
| **Data Processed** | All backend data (user accounts, work events) |
| **Location** | Germany |
| **DPA Status** | Pending signature |
| **DPA Reference** | Hetzner standard AVV |

### 3.2 Brevo (Sendinblue)

| Field | Value |
|-------|-------|
| **Processor Name** | Sendinblue GmbH |
| **Address** | Köpenicker Str. 126, 10179 Berlin, Germany |
| **Processing Activities** | Email delivery for verification codes |
| **Data Processed** | Email addresses (transient), verification codes |
| **Location** | EU |
| **DPA Status** | Pending signature |
| **DPA Reference** | Brevo standard DPA |

---

## 4. Technical and Organizational Measures (Art. 32)

### 4.1 Encryption

| Measure | Implementation |
|---------|----------------|
| Encryption in transit | TLS 1.3 for all API communications |
| Encryption at rest | Database encryption on Hetzner |
| Email hashing | SHA-256 with secret salt |

### 4.2 Access Control

| Measure | Implementation |
|---------|----------------|
| API authentication | JWT tokens (30-day expiry) |
| Admin access | HTTP Basic Auth with strong password |
| Database access | No direct access; API-only |
| Server access | SSH key authentication only |

### 4.3 Pseudonymization

| Measure | Implementation |
|---------|----------------|
| User identification | Random UUID, not linked to email |
| Email storage | One-way hash only |
| Statistics | Aggregated, no individual identifiers |

### 4.4 Data Minimization

| Measure | Implementation |
|---------|----------------|
| Local-only data | GPS coordinates, sick days, schedules |
| Transmitted data | Only confirmed hours and profile |
| No collection | Names, employers, device IDs, IP addresses |

### 4.5 Backup and Recovery

| Measure | Implementation |
|---------|----------------|
| Backup frequency | Daily |
| Backup retention | 30 days rolling |
| Backup location | Germany (Hetzner) |
| Deletion propagation | Within backup retention window |

---

## 5. Data Subject Rights Procedures

| Right | Procedure | Response Time |
|-------|-----------|---------------|
| **Access (Art. 15)** | In-app export function | Immediate |
| **Rectification (Art. 16)** | In-app editing | Immediate |
| **Erasure (Art. 17)** | In-app account deletion | Immediate (backups: 30 days) |
| **Portability (Art. 20)** | In-app JSON export | Immediate |
| **Withdraw Consent** | Account deletion | Immediate |
| **Complaint** | Contact privacy@openworkinghours.org | 30 days |

---

## 6. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | L. Hondrich | Initial draft |

---

## 7. Review Schedule

This document shall be reviewed:
- Annually
- When processing activities change
- When new processors are engaged
- When significant changes to data flows occur

**Next Review Due:** January 2027
