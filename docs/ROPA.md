# Records of Processing Activities (RoPA)

**Organization:** Open Working Hours
**Controller:** Lukas Jonathan Hondrich
**Version:** 1.1
**Date:** May 2026 (extended with bug reports, calendar export, and social auth as separate processing activities; processor list expanded with Komoot/Photon, Apple, Google)
**Status:** Self-reviewed; legal review pending

---

> **Legal Basis:** Art. 30 GDPR requires controllers to maintain records of processing activities. This document fulfills that requirement.

---

## 1. Controller Information

| Field | Value |
|-------|-------|
| **Controller Name** | Lukas Jonathan Hondrich |
| **Address** | Karl-Marx-Straße 182, 12043 Berlin, Germany |
| **Contact Email** | lukashondrich@googlemail.com |
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
| **Categories of Personal Data** | Email hash, user ID, profile data (state, profession, seniority, department group, specialization code), hospital affiliation (optional, reference to named hospital), account creation date |
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
| **Categories of Personal Data** | Derived from work events: state, profession, seniority, department group, hospital affiliation, aggregated hours |
| **Recipients** | Public (anonymized statistics only) |
| **Third Country Transfers** | None |
| **Retention Period** | Indefinite (output is anonymous, not personal data) |
| **Technical/Organizational Measures** | K-anonymity (k≥5), differential privacy (ε=1.0), no individual data in output |

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

### 2.7 Bug Reports (Optional, User-Initiated)

| Field | Description |
|-------|-------------|
| **Processing Activity** | Bug Reports / "Report Issue" Feature |
| **Purpose** | Diagnose technical problems — especially geofencing reliability on Android — using real-world telemetry submitted voluntarily by users |
| **Legal Basis** | Art. 6(1)(a) - Consent (each report is user-initiated) |
| **Categories of Data Subjects** | Users who tap "Report Issue", review the confirmation sheet, and submit a report |
| **Categories of Personal Data** | Default report: optional user description, user_id if signed in, device model, OS name/version, app version/build, work-location/work-event counts, last ~100 geofence events with timestamps, event type, GPS accuracy, ignored flag/reason, and aggregate counts; no saved workplace names or coordinates by default. Optional location diagnostics: saved workplace names, approximate saved coordinates rounded to 3 decimals, and recent geofence events with workplace names. Hospital affiliation, specialty, role, and state are not stored with bug reports. |
| **Recipients** | Hetzner Online GmbH (hosting); the controller (for review in admin dashboard) |
| **Third Country Transfers** | None |
| **Retention Period** | 90 days, then auto-purged; deleted immediately on account deletion |
| **Technical/Organizational Measures** | Explicit confirmation before submission; optional location diagnostics checkbox unchecked by default; backend strips location details unless location diagnostics were selected; rate-limited submission (10/min/IP); structured JSON storage; daily retention cleanup; manual review by controller only |

---

### 2.8 Calendar Export (Optional, User-Initiated)

| Field | Description |
|-------|-------------|
| **Processing Activity** | Calendar Export to Device Calendar |
| **Purpose** | Allow users to sync their planned shifts and absences to their device's native calendar app for convenience |
| **Legal Basis** | Art. 6(1)(a) - Consent (user activates a toggle in Settings) |
| **Categories of Data Subjects** | Users who enable the calendar export toggle |
| **Categories of Personal Data** | Shift name, start/end time, color, absence type (vacation/sick) — written to the device's calendar app |
| **Recipients** | The user's device calendar (iOS Calendar / Android Calendar). If the user's calendar syncs with iCloud, Google Calendar, or another service, those events follow that sync. The controller never receives this data. |
| **Third Country Transfers** | Possible — but determined by the user's own calendar sync configuration, not by the controller. iCloud syncs to Apple Inc. (USA); Google Calendar syncs to Google LLC (USA). Both operate under the EU-US Data Privacy Framework. |
| **Retention Period** | Controlled by the user via the device calendar app (no controller-side retention) |
| **Technical/Organizational Measures** | Disclosed at toggle (`settings.calendarSyncDescription`); user-revocable in Settings |

---

### 2.9 Identity Verification (Social Sign-In, Optional)

| Field | Description |
|-------|-------------|
| **Processing Activity** | Identity Verification via Apple Sign-In or Google Sign-In |
| **Purpose** | Allow users to authenticate using Apple ID or Google account instead of email/code |
| **Legal Basis** | Art. 6(1)(b) - Necessary for performance of contract (account creation) when user chose the social-auth path |
| **Categories of Data Subjects** | Users who choose Apple or Google Sign-In |
| **Categories of Personal Data** | Identity token (JWT) from Apple/Google containing an opaque `sub` identifier; email is discarded by the controller for social-auth users |
| **Recipients** | Apple Inc. (USA) for Apple Sign-In; Google LLC (USA) for Google Sign-In. Backend fetches their public JWKS to verify the token signature. |
| **Third Country Transfers** | USA (Apple Inc. and/or Google LLC) under the EU-US Data Privacy Framework adequacy decision |
| **Retention Period** | Provider sub identifier stored until account deletion |
| **Technical/Organizational Measures** | Token signature verification against provider JWKS; provider sub stored only as an opaque string; email discarded |

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
| **DPA Status** | Signed 2026-01-13 |
| **DPA Reference** | Hetzner standard AVV |

### 3.2 Brevo (Sendinblue)

| Field | Value |
|-------|-------|
| **Processor Name** | Sendinblue GmbH |
| **Address** | Köpenicker Str. 126, 10179 Berlin, Germany |
| **Processing Activities** | Email delivery for verification codes |
| **Data Processed** | Email addresses (transient), verification codes |
| **Location** | EU |
| **DPA Status** | Signed (part of ToS) |
| **DPA Reference** | Brevo standard DPA |

### 3.3 Komoot GmbH (Photon)

| Field | Value |
|-------|-------|
| **Processor Name** | Komoot GmbH |
| **Address** | Potsdam, Germany |
| **Processing Activities** | Workplace geocoding (search query → place candidates) during user setup |
| **Data Processed** | Free-text search query; optionally the user's current GPS coordinates as proximity bias (no user identifier transmitted) |
| **Location** | Germany (Photon is hosted by Komoot) |
| **DPA Status** | Standard public-API usage; no individual DPA required given no user identifiers transmitted |
| **Notes** | Code reference: `mobile-app/src/modules/geofencing/services/GeocodingService.ts` L105 |

### 3.4 Apple Inc. (Sign in with Apple)

| Field | Value |
|-------|-------|
| **Processor Name** | Apple Inc. (and EU subsidiaries) |
| **Address** | One Apple Park Way, Cupertino, CA 95014, USA |
| **Processing Activities** | Identity-token issuance and JWKS endpoint for token verification |
| **Data Processed** | Apple ID authentication state; opaque `sub` identifier returned to the controller |
| **Location** | USA |
| **DPA Status** | Apple's developer agreement and EU-US Data Privacy Framework participation |
| **Notes** | Only invoked if a user chooses "Sign in with Apple". Code reference: `backend/app/social_auth.py` L24-25 |

### 3.5 Google LLC (Sign in with Google)

| Field | Value |
|-------|-------|
| **Processor Name** | Google LLC |
| **Address** | 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA |
| **Processing Activities** | Identity-token issuance and JWKS endpoint for token verification |
| **Data Processed** | Google account authentication state; opaque `sub` identifier returned to the controller |
| **Location** | USA |
| **DPA Status** | Google's developer agreement and EU-US Data Privacy Framework participation |
| **Notes** | Only invoked if a user chooses "Sign in with Google". Code reference: `backend/app/social_auth.py` L26 |

---

## 4. Technical and Organizational Measures (Art. 32)

### 4.1 Encryption

| Measure | Implementation |
|---------|----------------|
| Encryption in transit | TLS 1.3 for all API communications |
| Encryption at rest | Infrastructure-level encryption at rest (Hetzner) |
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
| Local-first data | GPS coordinates, sick days, schedules, and work-location coordinates stay on device during routine tracking/submission |
| Transmitted data | Confirmed hours and profile for core service; optional bug-report diagnostics only after explicit confirmation; workplace search may send a proximity coordinate to Komoot/Photon |
| No collection by default | Names, device IDs, IP addresses. Hospital affiliation is optional for profile/aggregation and is not stored with bug reports. |

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
| 1.1 | March 2026 | L. Hondrich | v2 taxonomy fields; hospital affiliation; k≥10→k≥5 fix; DPA status updated; encryption wording |

---

## 7. Review Schedule

This document shall be reviewed:
- Annually
- When processing activities change
- When new processors are engaged
- When significant changes to data flows occur

**Next Review Due:** January 2027
