# Backend Redesign Plan – Server-Side Privacy Architecture

**Status:** Planning
**Created:** 2025-12-08
**Architectural Decisions:**
1. ✅ Server-side noise only (no client-side noise)
2. ✅ Mobile submits confirmed daily data (not raw events or weekly aggregates)
3. ✅ Hard cutover (breaking change, no backward compatibility)

---

## 1. Overview

### Current State (MVP - Anonymous)
```
Mobile App (local SQLite)
  ↓ Adds Laplace noise to weekly totals
  ↓ POST /submissions/weekly (anonymous)
Backend (dev.db SQLite)
  ↓ Stores noisy data as-is
  └─ weekly_submissions (no user_id)
Dashboard
  └─ Queries weekly_submissions directly
```

**Problems:**
- No user authentication
- Cannot support right to erasure
- Cannot link submissions to hospitals/specialties
- Dashboard queries raw submissions (not aggregated stats)
- Noise applied too early (per-user, not per-group)

### Target State (Privacy Architecture)
```
Mobile App (local SQLite)
  ↓ Confirmed daily data (planned/actual minutes, NO noise)
  ↓ POST /work-events/daily (authenticated)
Backend (PostgreSQL)
  ├─ users (user_id, hospital_id, specialty, role_level)
  ├─ work_events (user_id, date, planned_hours, actual_hours)
  └─ Aggregation Job (periodic)
      ↓ Group by state/specialty/role/period
      ↓ Apply k-anonymity (n_users ≥ K_MIN)
      ↓ Add Laplace noise
      └─ stats_by_* tables
Dashboard
  └─ Queries stats_* tables only (anonymous aggregates)
```

**Benefits:**
- ✅ GDPR compliant (right to erasure)
- ✅ Better privacy (k-anonymity + noise on aggregates)
- ✅ Flexible analytics (multiple grouping dimensions)
- ✅ User features possible (personal history, exports)

---

## 2. Database Schema Changes

### 2.1 New Tables (Operational Layer)

```sql
-- User accounts (pseudonymous personal data)
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash VARCHAR(64) UNIQUE NOT NULL,        -- SHA256(email)
  hospital_id VARCHAR(255) NOT NULL,             -- e.g., "uniklinik-muenchen"
  specialty VARCHAR(100) NOT NULL,               -- e.g., "surgery", "anaesthesiology"
  role_level VARCHAR(50) NOT NULL,               -- e.g., "assistant", "specialist", "senior", "nurse"
  state_code VARCHAR(10),                        -- e.g., "BY" (Bavaria), "BE" (Berlin)
  country_code VARCHAR(3) DEFAULT 'DEU',         -- ISO 3166-1 alpha-3
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_submission_at TIMESTAMP
);

CREATE INDEX idx_users_hospital ON users(hospital_id);
CREATE INDEX idx_users_specialty ON users(specialty);
CREATE INDEX idx_users_state ON users(state_code);

-- Daily work events (per confirmed day)
CREATE TABLE work_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,                             -- Confirmed day date
  planned_hours NUMERIC(5,2) NOT NULL,            -- Planned hours (from calendar)
  actual_hours NUMERIC(5,2) NOT NULL,             -- Actual tracked hours (from geofencing/manual)
  source VARCHAR(20) NOT NULL,                    -- 'geofence', 'manual', 'mixed'
  submitted_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, date)                           -- One entry per user per day
);

CREATE INDEX idx_work_events_user ON work_events(user_id);
CREATE INDEX idx_work_events_date ON work_events(date);
CREATE INDEX idx_work_events_submitted ON work_events(submitted_at);
```

### 2.2 New Tables (Analytics Layer)

```sql
-- Aggregated statistics by state/specialty/role
CREATE TABLE stats_by_state_specialty (
  stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(3) NOT NULL,
  state_code VARCHAR(10) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  role_level VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  n_users INTEGER NOT NULL,                       -- Count of distinct users
  avg_planned_hours_noised NUMERIC(5,2),          -- Noised average
  avg_actual_hours_noised NUMERIC(5,2),
  avg_overtime_hours_noised NUMERIC(5,2),         -- actual - planned

  k_min_threshold INTEGER NOT NULL,               -- K_MIN used for this stat
  noise_epsilon NUMERIC(4,2) NOT NULL,            -- ε parameter used
  computed_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(country_code, state_code, specialty, role_level, period_start)
);

CREATE INDEX idx_stats_state_spec_period ON stats_by_state_specialty(state_code, specialty, period_start);

-- Aggregated statistics by hospital/role (coarser)
CREATE TABLE stats_by_hospital_role (
  stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id VARCHAR(255) NOT NULL,
  role_group VARCHAR(50) NOT NULL,               -- Coarse: 'doctor', 'nurse', 'other'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  n_users INTEGER NOT NULL,
  avg_planned_hours_noised NUMERIC(5,2),
  avg_actual_hours_noised NUMERIC(5,2),
  avg_overtime_hours_noised NUMERIC(5,2),

  k_min_threshold INTEGER NOT NULL,
  noise_epsilon NUMERIC(4,2) NOT NULL,
  computed_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hospital_id, role_group, period_start)
);

CREATE INDEX idx_stats_hospital_period ON stats_by_hospital_role(hospital_id, period_start);
```

### 2.3 Tables to Deprecate

```sql
-- Old tables (delete after migration)
DROP TABLE IF EXISTS weekly_submissions;        -- Anonymous submissions
DROP TABLE IF EXISTS reports;                    -- Old daily reports
DROP TABLE IF EXISTS verification_requests;      -- May keep if reusing verification
```

---

## 3. API Changes

### 3.1 Authentication Endpoints (New/Modified)

```python
# POST /auth/register
# Register new user account
{
  "email": "doctor@uniklinik-muenchen.de",
  "hospital_id": "uniklinik-muenchen",
  "specialty": "surgery",
  "role_level": "specialist",
  "state_code": "BY"
}
→ Response: { "user_id": "...", "token": "JWT..." }

# POST /auth/login (or reuse /verification/confirm)
# Login existing user
{
  "email": "doctor@uniklinik-muenchen.de",
  "code": "123456"  # Email verification code
}
→ Response: { "user_id": "...", "token": "JWT..." }
```

### 3.2 Work Events Endpoints (New)

```python
# POST /work-events/daily
# Submit a confirmed day's data
# Headers: Authorization: Bearer <JWT>
{
  "date": "2025-12-08",
  "planned_hours": 8.5,
  "actual_hours": 9.2,
  "source": "geofence"
}
→ Response: { "event_id": "...", "submitted_at": "..." }

# POST /work-events/batch
# Submit multiple days at once
# Headers: Authorization: Bearer <JWT>
{
  "events": [
    { "date": "2025-12-01", "planned_hours": 8.0, "actual_hours": 8.5, "source": "geofence" },
    { "date": "2025-12-02", "planned_hours": 7.5, "actual_hours": 8.0, "source": "manual" },
    ...
  ]
}
→ Response: { "created_count": 7, "updated_count": 0 }

# GET /work-events/me?from=2025-11-01&to=2025-12-01
# Retrieve user's own work events
# Headers: Authorization: Bearer <JWT>
→ Response: { "events": [...] }

# DELETE /work-events/me
# Delete all user's work events (right to erasure)
# Headers: Authorization: Bearer <JWT>
→ Response: { "deleted_count": 42 }
```

### 3.3 Analytics Endpoints (Modified)

```python
# GET /analytics/by-state?state=BY&specialty=surgery&from=2025-Q1
# Query aggregated stats (no raw data)
→ Response: {
  "stats": [
    {
      "state_code": "BY",
      "specialty": "surgery",
      "role_level": "specialist",
      "period_start": "2025-01-01",
      "period_end": "2025-03-31",
      "n_users": 45,  # >= K_MIN, safe to publish
      "avg_overtime_hours_noised": 12.3
    }
  ]
}

# GET /analytics/by-hospital?hospital_id=uniklinik-muenchen&from=2025-Q1
# Query hospital-level stats (coarse role groups only)
→ Response: { ... }
```

### 3.4 Deprecated Endpoints

```python
# DELETE /submissions/weekly          # No longer needed
# POST /reports/                      # Replaced by /work-events/daily
```

---

## 4. Aggregation Job

### 4.1 Job Specification

**Trigger:** Periodic (daily at 2 AM UTC)

**Input:** All `work_events` rows

**Output:** Updated `stats_by_*` tables

**Algorithm:**

```python
def aggregate_stats(period_start: date, period_end: date):
    """
    Aggregate work_events into privacy-preserving statistics.
    """
    K_MIN = 10  # Minimum users per group
    EPSILON = 1.0  # Differential privacy budget

    # 1. Query raw data
    events = db.query("""
        SELECT
            u.state_code,
            u.specialty,
            u.role_level,
            e.date,
            e.planned_hours,
            e.actual_hours,
            u.user_id
        FROM work_events e
        JOIN users u ON e.user_id = u.user_id
        WHERE e.date >= :start AND e.date <= :end
    """, start=period_start, end=period_end)

    # 2. Group by dimensions
    groups = events.groupby(['state_code', 'specialty', 'role_level'])

    # 3. Compute aggregates
    stats = []
    for (state, specialty, role), group in groups:
        n_users = group['user_id'].nunique()

        # Apply k-anonymity threshold
        if n_users < K_MIN:
            continue  # Skip groups that are too small

        avg_planned = group['planned_hours'].mean()
        avg_actual = group['actual_hours'].mean()
        avg_overtime = avg_actual - avg_planned

        # Add Laplace noise
        sensitivity = compute_sensitivity(group)  # Max possible contribution per user
        scale = sensitivity / EPSILON

        avg_planned_noised = avg_planned + laplace_noise(scale)
        avg_actual_noised = avg_actual + laplace_noise(scale)
        avg_overtime_noised = avg_overtime + laplace_noise(scale)

        stats.append({
            'country_code': 'DEU',
            'state_code': state,
            'specialty': specialty,
            'role_level': role,
            'period_start': period_start,
            'period_end': period_end,
            'n_users': n_users,
            'avg_planned_hours_noised': round(avg_planned_noised, 2),
            'avg_actual_hours_noised': round(avg_actual_noised, 2),
            'avg_overtime_hours_noised': round(avg_overtime_noised, 2),
            'k_min_threshold': K_MIN,
            'noise_epsilon': EPSILON,
        })

    # 4. Write to stats table (upsert)
    db.bulk_insert('stats_by_state_specialty', stats, on_conflict='update')

    return len(stats)
```

### 4.2 Sensitivity Calculation

```python
def compute_sensitivity(group: pd.DataFrame) -> float:
    """
    Compute L1 sensitivity for differential privacy.

    Sensitivity = max possible change in aggregate if one user is removed.

    For average over n users:
    - If one user has max contribution MAX_HOURS_PER_DAY
    - Sensitivity = MAX_HOURS_PER_DAY / n

    Conservative approach: use global max across all users.
    """
    MAX_HOURS_PER_DAY = 24.0  # Physical maximum
    DAYS_IN_PERIOD = (period_end - period_start).days + 1
    MAX_TOTAL_HOURS = MAX_HOURS_PER_DAY * DAYS_IN_PERIOD

    n_users = group['user_id'].nunique()

    # Sensitivity for average
    sensitivity = MAX_TOTAL_HOURS / n_users

    return sensitivity
```

---

## 5. Mobile App Changes

### 5.1 New Authentication Flow

```typescript
// src/lib/api/auth.ts

export async function registerUser(data: {
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode: string;
}): Promise<{ userId: string; token: string }> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function loginUser(email: string, code: string): Promise<{ userId: string; token: string }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return response.json();
}
```

### 5.2 Modified Submission Flow

**Before (Anonymous with Client-Side Noise):**
```typescript
// Old: WeeklySubmissionService.ts
const trueTotal = computeWeekTotal(days);  // e.g., 42.0 hours
const noisyTotal = addLaplaceNoise(trueTotal);  // e.g., 43.7 hours
await submitWeekly({ total_hours: noisyTotal });  // Anonymous POST
```

**After (Authenticated, No Noise):**
```typescript
// New: DailySubmissionService.ts
const confirmedDays = getDailyActuals(weekDates);  // Array of 7 days

const events = confirmedDays.map(day => ({
  date: day.date,
  planned_hours: day.plannedMinutes / 60,  // Convert to hours
  actual_hours: day.actualMinutes / 60,
  source: day.source,  // 'geofence', 'manual', 'mixed'
}));

// Submit without noise
await fetch(`${API_BASE}/work-events/batch`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,  // JWT authentication
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ events }),
});
```

### 5.3 Files to Modify

```
mobile-app/src/
├── lib/
│   ├── api/
│   │   ├── auth.ts (NEW)
│   │   └── workEvents.ts (NEW, replaces submissions.ts)
│   ├── auth/
│   │   └── tokenStorage.ts (NEW - SecureStore for JWT)
│   └── privacy/
│       ├── LaplaceNoise.ts (DELETE - no longer used)
│       └── constants.ts (DELETE)
├── modules/
│   ├── auth/ (NEW)
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   └── context/
│   │       └── AuthContext.tsx
│   └── calendar/
│       └── services/
│           ├── WeeklySubmissionService.ts (MODIFY)
│           └── DailySubmissionService.ts (NEW)
└── navigation/
    └── AppNavigator.tsx (MODIFY - add auth check)
```

---

## 6. Migration Strategy (Hard Cutover)

### 6.1 Timeline

**Phase 1: Backend Development (2-3 weeks)**
1. Implement new schema (users, work_events, stats_*)
2. Implement auth endpoints
3. Implement work-events endpoints
4. Implement aggregation job
5. Test aggregation with synthetic data

**Phase 2: Mobile Development (2-3 weeks)**
1. Implement auth screens
2. Implement JWT token storage
3. Modify submission flow (remove noise, add auth)
4. Update onboarding flow (register user)
5. Test against new backend locally

**Phase 3: Deployment (1 week)**
1. Deploy new backend (PostgreSQL on Hetzner)
2. Run initial aggregation job
3. Deploy new mobile app version
4. Update dashboard to query stats_* tables
5. Announce breaking change to users

### 6.2 Data Migration

**Existing `weekly_submissions` data:**
- ❌ Cannot migrate to new schema (no user_id, already noised)
- ✅ Export as CSV for archival purposes
- ✅ Drop table after migration complete

**User Impact:**
- All users must create accounts after update
- Historical data (pre-migration) will not be visible in app
- Anonymous submissions will be archived but not displayed

### 6.3 Communication Plan

**Email to current testers:**
```
Subject: Open Working Hours - Important Update Required

We're releasing a major update that improves privacy and adds new features:
- User accounts for better data protection
- Right to erasure (GDPR compliance)
- More detailed analytics coming soon

ACTION REQUIRED:
1. Update to version 2.0.0
2. Create an account using your hospital email
3. Re-enter your hospital, specialty, and role

Your previous anonymous data will be archived but won't appear in the new app.

Questions? Reply to this email.
```

---

## 7. Privacy & Compliance

### 7.1 GDPR Compliance Checklist

- ✅ **Lawful basis:** Consent + legitimate interest (research/transparency)
- ✅ **Data minimization:** Only collect necessary fields
- ✅ **Right to erasure:** Implemented via `DELETE /work-events/me` (cascades)
- ✅ **Data portability:** Export via `GET /work-events/me`
- ✅ **Anonymization:** Stats tables are k-anonymous + noised
- ✅ **Retention:** Work events retained while account active, stats retained indefinitely (anonymous)
- ⚠️ **DPIA:** Data Protection Impact Assessment required (legal review)
- ⚠️ **Privacy policy:** Must document new data flows

### 7.2 Privacy Policy Updates

**Key additions:**
1. "We store your work events linked to your account."
2. "We aggregate data across many users before publishing statistics."
3. "Statistics are anonymized (k-anonymity + noise) and cannot be linked back to you."
4. "If you delete your account, we delete your work events. Aggregated statistics are retained."
5. "Data is hosted in Germany (GDPR jurisdiction)."

---

## 8. Open Questions

### Technical
- [ ] Should we batch submissions (e.g., weekly) or allow daily incremental submissions?
  - **Decision:** Allow both (single POST /work-events/daily or batch POST /work-events/batch)

- [ ] How to handle duplicate submissions (same user_id + date)?
  - **Decision:** UPSERT (update existing row if present)

- [ ] Should aggregation job be idempotent?
  - **Decision:** Yes, use UPSERT on stats tables (recompute each period)

### Privacy Parameters
- [ ] K_MIN value: 10 or 20?
  - **Recommendation:** Start with 10, increase to 20 if cells are too sparse

- [ ] Epsilon (ε) for noise: 1.0 or lower?
  - **Recommendation:** Start with 1.0 (matches current implementation), tune based on utility

- [ ] Sensitivity calculation: conservative global max or per-group empirical?
  - **Recommendation:** Global max (safer, simpler)

### Legal
- [ ] DPIA required?
  - **Action:** Consult with GDPR lawyer

- [ ] Privacy policy review?
  - **Action:** Draft updated policy, legal review before deployment

---

## 9. Success Criteria

### Backend
- [ ] All new endpoints implemented and tested
- [ ] Aggregation job runs successfully on synthetic data
- [ ] Stats tables populated with k-anonymous + noised data
- [ ] No raw work_events accessible via public API

### Mobile
- [ ] User registration flow works
- [ ] JWT authentication works
- [ ] Daily submissions succeed with auth
- [ ] No Laplace noise code remains in mobile app

### Analytics
- [ ] Dashboard queries stats_* tables only
- [ ] No cells with n_users < K_MIN visible
- [ ] Noise parameters documented in stats tables

### Compliance
- [ ] Right to erasure tested (DELETE user → cascades to work_events)
- [ ] Privacy policy updated and approved
- [ ] DPIA completed (if required)

---

## 10. Next Steps

1. **Review this plan** with team/stakeholders
2. **Get legal sign-off** on privacy approach
3. **Finalize open questions** (K_MIN, epsilon, etc.)
4. **Start Phase 1** (backend development)
   - Create new database schema
   - Implement auth endpoints
   - Implement work-events endpoints
   - Implement aggregation job
5. **Document in blueprint.md** once implemented

---

**Status:** Ready for review
**Owner:** Backend team
**Timeline:** 6-8 weeks total (backend + mobile + deployment)
