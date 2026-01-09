# Data Retention Policy

**Organization:** Open Working Hours
**Version:** 1.0 (Draft)
**Date:** January 2026
**Status:** Draft - Pending Legal Review

---

## 1. Purpose

This policy defines how long personal data is retained and the procedures for data deletion. It ensures compliance with GDPR Art. 5(1)(e) (storage limitation) and Art. 17 (right to erasure).

---

## 2. Retention Schedule

### 2.1 Active Data

| Data Type | Retention Period | Justification | Deletion Trigger |
|-----------|-----------------|---------------|------------------|
| **User Account** | Until deletion requested | Necessary to provide service | User-initiated account deletion |
| **Email Hash** | Until account deletion | Account integrity/deduplication | Cascades with account |
| **Profile Data** | Until account deletion | Necessary for aggregation consent | Cascades with account |
| **Work Events** | Until account deletion | User's own records | Cascades with account |
| **Verification Codes** | 15 minutes | Security best practice | Automatic expiry |

### 2.2 Transient Data

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| **Email Address (plaintext)** | Not stored | Only used transiently for sending verification code |
| **IP Addresses** | Not logged | Privacy by design |
| **Device Identifiers** | Not collected | Not needed for service |

### 2.3 Aggregated Data

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| **K-anonymous Statistics** | Indefinite | Anonymous data (not personal data under GDPR) |

### 2.4 System Data

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| **Server Backups** | 30 days rolling | Disaster recovery |
| **Application Logs** | 7 days | Debugging and security monitoring |
| **Admin Access Logs** | 90 days | Security audit trail |

---

## 3. Deletion Procedures

### 3.1 User-Initiated Deletion (Right to Erasure)

When a user requests account deletion:

1. **Immediate actions:**
   - Delete `users` record
   - Cascade delete all `work_events` for that user
   - Revoke all active JWT tokens

2. **Within 30 days:**
   - User data removed from all backups through backup rotation

3. **Not deleted:**
   - Aggregated statistics (anonymous, cannot be linked to user)

### 3.2 Automatic Deletion

| Process | Schedule | What is Deleted |
|---------|----------|-----------------|
| Verification code cleanup | Every 15 minutes | Expired codes |
| Backup rotation | Daily | Backups older than 30 days |
| Log rotation | Daily | Logs older than retention period |

### 3.3 Deletion Verification

After user deletion:
- Database query confirms no records exist for deleted user_id
- No manual verification of backups (automated rotation)

---

## 4. Backup Management

### 4.1 Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Full database backup | Daily at 02:00 UTC | 30 days | Hetzner Germany |
| Transaction logs | Continuous | 7 days | Hetzner Germany |

### 4.2 Backup Security

- Backups are encrypted at rest
- Access restricted to authorized personnel only
- Stored in same jurisdiction as primary data (Germany)

### 4.3 Backup Deletion for Right to Erasure

When a user requests deletion:
- Active data deleted immediately
- Backup data deleted through normal 30-day rotation
- No individual-record deletion from backups (technically infeasible without full restore)

This approach is documented in the privacy policy:
> "Upon account deletion, your data is removed from our active systems immediately. Backup copies are automatically deleted within 30 days through our normal backup rotation process."

### 4.4 Backup Restoration

If a backup restoration is necessary:
- Check deletion requests since backup date
- Re-process any deletions that occurred after backup date
- Document the restoration and re-deletion

---

## 5. Special Categories

### 5.1 Data Never Stored on Backend

The following data is stored only on user devices and is never transmitted:

- GPS coordinates
- Sick day records
- Vacation records
- Shift templates and schedules
- Work location coordinates

Retention of this data is controlled entirely by the user through the mobile app.

### 5.2 Anonymous Statistics

K-anonymous aggregated statistics:
- Are not personal data under GDPR
- Are retained indefinitely
- Are not affected by individual user deletions
- Cannot be linked back to individuals due to:
  - Minimum group size (k ≥ 10)
  - Statistical noise (Laplace mechanism)
  - No individual identifiers in output

---

## 6. Legal Holds

In case of litigation or regulatory investigation:
- Normal deletion processes may be suspended for relevant data
- Legal counsel will advise on scope and duration
- Users will be notified if legally permissible

No legal holds are currently in effect.

---

## 7. Implementation

### 7.1 Technical Implementation

```python
# User deletion (cascade configured in database)
DELETE FROM users WHERE id = :user_id;
# This automatically deletes:
# - All work_events for this user (ON DELETE CASCADE)

# Verification code cleanup (scheduled job)
DELETE FROM verification_codes
WHERE expires_at < NOW();

# Backup rotation (cron job on server)
# Configured in Hetzner backup settings: 30-day retention
```

### 7.2 Monitoring

- Deletion requests logged (without personal data)
- Backup rotation verified weekly
- Annual audit of retention compliance

---

## 8. Responsibilities

| Role | Responsibility |
|------|----------------|
| Controller (L. Hondrich) | Policy approval and compliance oversight |
| Development | Implementation of deletion procedures |
| Operations | Backup management and log rotation |

---

## 9. Policy Review

This policy shall be reviewed:
- Annually
- When storage practices change
- When new data categories are introduced
- Following any data protection incident

**Next Review Due:** January 2027

---

## 10. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | L. Hondrich | Initial draft |

---

## Appendix: User Communication

Standard response for deletion confirmation:

> Your account and all associated personal data have been permanently deleted from our active systems. Any backup copies will be automatically removed within 30 days through our normal backup rotation process.
>
> Previously calculated anonymized statistics are retained, as they cannot be linked back to you (they contain only group-level information such as "surgeons in Bavaria" with no individual identifiers).
>
> Thank you for using Open Working Hours.
