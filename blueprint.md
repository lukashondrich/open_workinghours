w# Open Working Hours – System Blueprint v2.0

> **⚠️ ARCHITECTURE TRANSITION IN PROGRESS**
> **Date:** 2025-12-08
> **Status:** Sections 1-3 below describe the ORIGINAL design (client-side noise, local-first).
> **NEW architecture:** Server-side aggregation with k-anonymity (see Section 4 & 5 below + `privacy_architecture.md` + `BACKEND_REDESIGN_PLAN.md`)
> **Reason:** Better GDPR compliance (right to erasure), improved privacy (k-anonymity), flexible analytics.

---

## 1. Purpose & Scope

The Open Working Hours platform enables healthcare workers to track and report their working hours transparently while maintaining strong privacy guarantees. The system consists of three main components:

### 1.1 React Native Mobile App (iOS/Android) **[Primary Interface]**
Healthcare workers use this app to:
- Verify their hospital email affiliation
- Set up geofencing around their workplace(s)
- Plan shifts using a calendar with reusable templates
- Automatically track working hours via background geofencing
- Review tracked time against planned shifts and make corrections
- Submit weekly hours with built-in differential privacy protections (ε=1.0)

**Key characteristic**: **All raw data stays on the user's device.** GPS coordinates, daily shift times, and personal work patterns never leave the phone.

### 1.2 Next.js Web Dashboard **[Public Analytics]**
Public-facing dashboard that displays:
- Aggregated working hours by staff group (nurses, Fachärzte, Oberärzte)
- Trends over time (monthly averages)
- Reports per hospital (with N≥5 suppression for privacy)

**Accessible to**: Anyone who has submitted data via the mobile app.

### 1.3 FastAPI Backend **[Minimal Storage]**
Minimal API server that:
- Handles email verification (6-digit codes)
- Receives privacy-protected weekly submissions (already noisy!)
- Serves aggregated analytics for the dashboard
- Stores **only** anonymized, noisy data

**Does NOT store**: GPS coordinates, daily shift times, templates, individual clock-in/out events.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  React Native App   │  HTTPS  │  FastAPI Backend │  HTTP   │  Next.js Web │
│   (iOS/Android)     │◄───────►│   + PostgreSQL   │◄───────►│   Dashboard  │
│                     │  Noisy  │   (EU-hosted)    │         │   (Public)   │
│  • Planning         │  Data   │                  │         │              │
│  • Geofencing       │  Only   │  • Verification  │         │  • Charts    │
│  • Review           │         │  • Submissions   │         │  • Tables    │
│  • Privacy Pipeline │         │  • Analytics     │         │  • Filters   │
└─────────────────────┘         └──────────────────┘         └──────────────┘
         │                              │                            │
         │ All raw data                 │ Only stores:               │
         │ stored here:                 │ • User (email hash)        │
         │ • Templates                  │ • Noisy weekly reports     │
         │ • Instances                  │ • Aggregates               │
         │ • Tracked times              │                            │
         │ • GPS coordinates            │                            │
         │                              │                            │
         ▼                              ▼                            ▼
   ┌──────────┐                  ┌──────────┐                 ┌──────────┐
   │ Encrypted│                  │PostgreSQL│                 │ Recharts │
   │  SQLite  │                  │ (Hetzner)│                 │Analytics │
   │(on-device)│                 └──────────┘                 └──────────┘
   └──────────┘

            ◄─────────────────────────────────────►
                  Privacy Boundary:
                  Only noisy, aggregated data crosses
```

### Key Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| **Data Architecture** | Local-first | GDPR compliance, user control, minimal backend trust |
| **Privacy Method** | Local Differential Privacy (ε=1.0) | Mathematical guarantee, applied on-device before transmission |
| **Aggregation** | Weekly totals | Hides daily patterns, aligns with payroll cycles |
| **Backend Role** | Minimal (auth + storage only) | Reduces attack surface, minimizes PII |
| **Mobile Platform** | React Native/Expo | iOS + Android support, TypeScript reuse, TestFlight compatibility |
| **Database** | PostgreSQL (Hetzner, Germany) | EU data residency, GDPR compliance |
| **Geofencing** | expo-location + OS geofences | Hardware-accelerated, low battery impact, mature library |
| **Encryption** | SQLCipher + Expo SecureStore | Industry standard, keychain/keystore integration |

---

## 3. Mobile App Architecture

### 3.1 Technology Stack

```json
{
  "core": ["React Native 0.74", "Expo ~51.0", "TypeScript"],
  "navigation": "React Navigation 6",
  "state": "Zustand (or Redux Toolkit)",
  "storage": ["expo-sqlite (SQLCipher)", "expo-secure-store", "AsyncStorage"],
  "location": ["expo-location", "expo-task-manager"],
  "ui": ["react-native-gesture-handler", "react-native-reanimated", "react-native-maps"],
  "utils": ["date-fns", "axios"]
}
```

### 3.2 Project Structure

```
mobile-app/
├── src/
│   ├── api/                              # Backend communication
│   │   ├── client.ts                     # HTTP client (auth headers)
│   │   ├── verification.ts               # Email verification
│   │   ├── submissions.ts                # Submit weekly reports
│   │   └── analytics.ts                  # Fetch dashboard data
│   │
│   ├── services/                         # Core business logic
│   │   ├── geofencing/
│   │   │   ├── GeofenceService.ts       # Wrapper for expo-location
│   │   │   ├── TrackingManager.ts       # Auto clock-in/out logic
│   │   │   └── LocationPicker.tsx       # UI for setting up geofences
│   │   │
│   │   ├── privacy/                      # ✅ Essential privacy features
│   │   │   ├── DifferentialPrivacy.ts   # Laplace noise (ε=1.0)
│   │   │   ├── Aggregation.ts           # Weekly totals
│   │   │   ├── Rounding.ts              # 0.5h bins
│   │   │   └── SubmissionQueue.ts       # Queue + retry with exponential backoff
│   │   │
│   │   └── storage/
│   │       ├── Database.ts              # SQLite + SQLCipher
│   │       ├── SecureStore.ts           # Keychain/Keystore wrapper
│   │       └── BackupExport.ts          # User data export (GDPR)
│   │
│   ├── screens/                          # UI screens
│   │   ├── onboarding/
│   │   │   ├── VerificationScreen.tsx   # Email verification
│   │   │   └── LocationSetupScreen.tsx  # Geofence setup
│   │   │
│   │   ├── calendar/
│   │   │   ├── CalendarScreen.tsx       # Main planning view
│   │   │   ├── WeekView.tsx             # Ported from Next.js
│   │   │   ├── MonthView.tsx            # Optional
│   │   │   └── ReviewMode.tsx           # Compare planned vs tracked
│   │   │
│   │   ├── tracking/
│   │   │   ├── TrackingStatusScreen.tsx # Current status + manual controls
│   │   │   └── TrackingHistoryScreen.tsx
│   │   │
│   │   ├── submission/
│   │   │   ├── SubmissionScreen.tsx     # Select weeks to submit
│   │   │   ├── SummaryScreen.tsx        # Review before submit
│   │   │   └── HistoryScreen.tsx        # Past submissions
│   │   │
│   │   └── settings/
│   │       ├── SettingsScreen.tsx
│   │       ├── LocationsManager.tsx     # Edit geofences
│   │       ├── PrivacySettings.tsx      # Explain privacy features
│   │       └── DataExport.tsx           # GDPR data export
│   │
│   ├── components/                       # Reusable UI
│   │   ├── calendar/
│   │   │   ├── ShiftTemplatePanel.tsx   # Ported from Next.js
│   │   │   ├── ShiftInstance.tsx
│   │   │   └── TimeGrid.tsx
│   │   │
│   │   ├── tracking/
│   │   │   ├── TrackingStatusBar.tsx    # 🟢 Currently tracking indicator
│   │   │   ├── GeofenceMap.tsx          # Map with radius overlay
│   │   │   └── ClockInOutButton.tsx
│   │   │
│   │   └── ui/                           # Design system
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── ...
│   │
│   ├── store/                            # State management
│   │   ├── authSlice.ts                 # User session, token
│   │   ├── calendarSlice.ts             # Templates, instances (synced with SQLite)
│   │   ├── trackingSlice.ts             # Tracked times (synced with SQLite)
│   │   ├── submissionSlice.ts           # Pending queue, history
│   │   └── settingsSlice.ts             # App settings, geofence preferences
│   │
│   ├── lib/
│   │   ├── types.ts                     # TypeScript types (shared with Next.js)
│   │   ├── constants.ts                 # Privacy params: ε=1.0, sensitivity=168
│   │   └── utils.ts                     # Helpers
│   │
│   └── App.tsx                          # Root component
│
├── app.json                             # Expo configuration
├── eas.json                             # EAS Build configuration
├── package.json
└── tsconfig.json
```

### 3.3 Local Database Schema (SQLite + SQLCipher)

**All tables stored on-device, encrypted at rest:**

```sql
-- Shift templates (reusable patterns)
CREATE TABLE shift_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,          -- HH:mm format
  duration_minutes INTEGER NOT NULL,
  color TEXT NOT NULL,               -- "blue", "green", "amber", etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shift instances (planned shifts)
CREATE TABLE shift_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  end_time TEXT NOT NULL,            -- Computed
  color TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES shift_templates(id)
);

-- Tracked times (geofence or manual)
CREATE TABLE tracked_times (
  id TEXT PRIMARY KEY,
  instance_id TEXT,
  date TEXT NOT NULL,
  clock_in DATETIME NOT NULL,
  clock_out DATETIME,
  duration_minutes INTEGER,
  location_id TEXT NOT NULL,
  tracking_method TEXT NOT NULL,     -- "geofence_auto" | "manual_entry"
  is_reviewed BOOLEAN DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES shift_instances(id)
);

-- User locations (geofences)
CREATE TABLE user_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                -- e.g., "UCSF Medical Center"
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL,    -- Default 200m
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Submission history (for user's reference)
CREATE TABLE submission_history (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,          -- Monday of week (YYYY-MM-DD)
  submitted_hours REAL NOT NULL,     -- Noisy value that was sent
  submitted_overtime REAL NOT NULL,  -- Noisy value that was sent
  privacy_epsilon REAL NOT NULL,     -- ε used (e.g., 1.0)
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  backend_response TEXT              -- JSON response from server
);
```

---

## 4. Mobile App Implementation Status

### 4.1 Module 1: Geofencing & Tracking ✅ Complete

**Purpose:** Automatic work-time tracking via GPS geofencing with manual fallback.

**Status:** Implemented, tested on iOS devices (TestFlight Build #8).

**Architecture:**

```
mobile-app/src/modules/geofencing/
├── services/
│   ├── Database.ts           # SQLite wrapper (workinghours.db)
│   ├── GeofenceService.ts    # expo-location wrapper
│   └── TrackingManager.ts    # Business logic (clock in/out)
├── screens/
│   ├── LocationsScreen.tsx   # Manage geofences
│   ├── TrackingScreen.tsx    # Live status
│   └── DataPrivacyScreen.tsx # Queue viewer
├── components/
│   └── ...
└── __tests__/               # Unit tests
    ├── Database.test.ts
    ├── GeofenceService.test.ts
    └── TrackingManager.test.ts
```

**Database Schema (workinghours.db):**

```sql
user_locations        # Geofence definitions
tracking_sessions     # Clock in/out events
geofence_events       # Debug log
daily_actuals         # Confirmed day summaries (Module 2)
weekly_submission_queue  # Submission queue (Module 2)
```

**Key Features:**
- Background geofencing with `expo-location` + `expo-task-manager`
- Automatic clock-in on geofence enter, clock-out on exit
- 5-minute exit hysteresis (prevents false clock-outs)
- Manual clock-in/out fallback
- Persistent local storage (SQLite with encryption)

**Known Limitations:**
- iOS background location restrictions (may fail in some scenarios)
- Battery impact not yet measured (target: <5% over 8 hours)
- Android battery optimization may kill background tasks

**Files:** `mobile-app/src/modules/geofencing/`

**Tests:** Unit tests exist (Database, GeofenceService, TrackingManager)

**Documentation:** See archived `MODULE_1_PLAN.md` for full implementation details.

---

### 4.2 Module 2: Privacy & Submission 🔄 Architecture Redesign

**Status:** Old implementation exists but is OBSOLETE. New architecture in planning.

**Old Implementation (Deprecated):**
- Client-side Laplace noise added to weekly totals
- Anonymous POST to `/submissions/weekly`
- No user accounts, no authentication
- Files: `mobile-app/src/lib/privacy/LaplaceNoise.ts`, `mobile-app/src/modules/calendar/services/WeeklySubmissionService.ts`

**Problems with Old Approach:**
- Cannot support GDPR right to erasure (no user_id)
- Cannot link submissions to hospitals/specialties for analytics
- Noise applied per-user reduces accuracy vs per-group
- Backend queries raw submissions (not pre-aggregated stats)

**New Architecture (Planned):**
- See `privacy_architecture.md` + `BACKEND_REDESIGN_PLAN.md`
- User authentication (JWT tokens)
- Mobile submits RAW confirmed daily data (no noise)
- Server-side aggregation with k-anonymity + noise
- Right to erasure supported (DELETE user → cascades)
- Timeline: 6-8 weeks (backend + mobile + deployment)

**Transition Plan:**
- Phase 1: Implement new backend (users, work_events, stats_*)
- Phase 2: Update mobile app (add auth, remove client-side noise)
- Phase 3: Hard cutover deployment (breaking change)

**Blocked On:** Backend implementation (Phase 1 not started)

---

## 5. Backend Implementation Status

### 5.1 Current State (MVP - Anonymous Submissions)

**Status:** Deployed locally for dev/testing (SQLite fallback).

**Schema:**

```sql
verification_requests  # Email verification codes (6-digit)
reports               # Old daily reports (deprecated)
weekly_submissions    # Anonymous weekly totals (to be replaced)
├── id (UUID)
├── week_start, week_end
├── planned_hours (noisy, from client)
├── actual_hours (noisy, from client)
├── client_version
└── created_at
```

**Endpoints:**
- `POST /verification/request` - Send email with code
- `POST /verification/confirm` - Verify code, return token (currently unused)
- `POST /submissions/weekly` - Accept anonymous noisy data
- `GET /submissions/weekly?limit=N` - Dev helper (list submissions)
- `GET /analytics` - Query `weekly_submissions` directly (no aggregation)

**Limitations:**
- No user accounts or authentication enforcement
- No hospital/specialty tracking
- No right to erasure (no user_id)
- Dashboard queries raw submissions (privacy issues)

**Database:** SQLite (`dev.db`) - for local dev only

**Files:** `backend/app/routers/submissions.py`, `backend/app/models.py`

---

### 5.2 Current State (Production - Privacy Architecture)

**Status:** ✅ Deployed to production (https://api.openworkinghours.org). See `BACKEND_REDESIGN_PLAN.md` for design details.

**Two-Layer Architecture:**

1. **Operational Layer** (pseudonymous personal data):
   - `users` table (user_id, hospital_id, specialty, role_level, state_code)
   - `work_events` table (user_id, date, planned_hours, actual_hours, source)
   - GDPR applies: user can request deletion

2. **Analytics Layer** (anonymous aggregated statistics):
   - `stats_by_state_specialty` table (state, specialty, role, period, n_users, avg_overtime_noised)
   - `stats_by_hospital_role` table (hospital, role_group, period, n_users, avg_overtime_noised)
   - Treated as anonymous: k-anonymity + noise applied

**Key Features:**
- User authentication required (JWT with 30-day expiry)
- Mobile submits raw daily events (not noisy)
- Aggregation job runs daily at 3 AM UTC:
  1. Group by dimensions (state × specialty × role × quarter)
  2. Apply k-anonymity (only publish if n_users ≥ 10)
  3. Add Laplace noise to aggregates (ε=1.0)
  4. Write to `stats_*` tables
- Dashboard queries `stats_*` only (no raw data access)
- Right to erasure: `DELETE user → CASCADE to work_events` (stats retained as anonymous)

**Validation Rules:**
- **Date validation (2025-12-24):** Work events can only be submitted for past dates
  - Mobile UI: Confirm button disabled for today and future dates
  - Client validation: Alert shown if bypassed
  - Backend validation: HTTP 400 with error: "Cannot submit work events for today or future dates. Only past days can be confirmed."
  - Files: `mobile-app/src/modules/calendar/components/WeekView.tsx:363-374`, `backend/app/routers/work_events.py:42-48`
- Hours validation: `0 ≤ hours ≤ 24` for both planned and actual hours
- Source validation: Must be one of `geofence`, `manual`, or `mixed`
- Duplicate prevention: One work event per user per day (unique constraint)

**Endpoints:**
- `POST /auth/register` - Create user account (requires verified email)
- `POST /auth/login` - Login with email + verification code
- `POST /work-events` - Submit daily work event (authenticated, past dates only)
- `GET /work-events` - Retrieve user's work events (with date filters)
- `PATCH /work-events/{id}` - Update work event
- `DELETE /work-events/{id}` - Delete work event (right to erasure)
- `GET /stats/by-state-specialty` - K-anonymous aggregated statistics
- `GET /admin` - Admin dashboard (password-protected)

**Database:** PostgreSQL on Hetzner (Germany) for GDPR compliance

**Files:** `backend/app/routers/work_events.py`, `backend/app/routers/auth.py`, `backend/app/models.py`

**Tests:** 37 tests passing (10 unit + 27 integration) - see `backend/tests/`

---

## 6. Privacy Architecture (Original Design - Deprecated)

> **Note:** This section describes the ORIGINAL client-side privacy approach.
> **New approach:** See `privacy_architecture.md` and Section 5.2 above.

---

## 7. Data Flows (Original Design - Deprecated)

> **Note:** This section describes the ORIGINAL data flows.
> **New flows:** See `BACKEND_REDESIGN_PLAN.md` Section 4.

---

## 8. Backend Architecture (Original Design - Deprecated)

### 4.1 Privacy Pipeline

**All privacy protections applied ON-DEVICE before data leaves:**

```typescript
// src/services/privacy/DifferentialPrivacy.ts

export const PRIVACY_CONFIG = {
  epsilon: 1.0,              // Privacy budget per submission
  sensitivity: 168,          // Max hours per week (7 days × 24 hours)
  roundingGranularity: 0.5   // Round to nearest 0.5h
} as const;

/**
 * Complete privacy pipeline
 * Applied to weekly hours before submission
 */
export function applyPrivacyProtections(weeklyHours: number): number {
  // Step 1: Round to 0.5h bins (k-anonymity)
  const rounded = Math.round(weeklyHours * 2) / 2;

  // Step 2: Add Laplace noise (ε-differential privacy)
  const scale = PRIVACY_CONFIG.sensitivity / PRIVACY_CONFIG.epsilon;
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  const noisy = rounded + noise;

  // Step 3: Clamp to valid range
  return Math.max(0, Math.min(168, noisy));
}

// Usage: Backend NEVER sees true value!
const trueHours = 42.0;
const noisyHours = applyPrivacyProtections(trueHours);  // e.g., 43.7
await api.post('/submissions/weekly', { total_hours: noisyHours });
```

### 4.2 Privacy Guarantees

**Mathematical:**
- ✅ (ε=1.0)-differential privacy per submission
- ✅ K-anonymity via 0.5h rounding (multiple users share identical rounded values)
- ✅ Temporal aggregation (weekly totals hide daily patterns)

**Practical:**
- ✅ Backend never sees true values (receives noisy data only)
- ✅ GPS coordinates never transmitted (geofence detection is on-device)
- ✅ Daily work patterns not revealed (only weekly totals)
- ✅ Email stored as SHA256 hash only

**Legal/Compliance:**
- ✅ GDPR Article 25 (Privacy by Design and by Default)
- ✅ GDPR Article 32 (Security of Processing)
- ✅ German BDSG § 22 (Technical and Organizational Measures)
- ✅ Data minimization (backend stores minimal PII)

### 4.3 Planned Privacy Enhancements (Post-MVP)

**Tier 2 features documented in `TODO.md` (tasks 337-345):**
- Submission time jittering (0-24h random delay)
- Hospital generalization for small facilities (< 10 users)
- Randomized response for rare staff groups
- User-controlled epsilon setting
- Privacy budget dashboard

---

## 5. Data Flows

### 5.1 Complete User Journey

```
┌────────────────────────────────────────────────────────────────┐
│                    USER JOURNEY FLOW                            │
└────────────────────────────────────────────────────────────────┘

1. ONBOARDING (Tasks 99-118 in TODO.md)
   ┌──────────────┐
   │ Install app  │ → From TestFlight (iOS) or Google Play (Android)
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Enter email  │ → hospital-worker@klinikum-muenchen.de
   │ (hospital)   │
   └──────┬───────┘
          │ POST /verification/request
          ▼
   ┌──────────────┐
   │ Receive code │ → 6-digit code via email
   │ (123456)     │
   └──────┬───────┘
          │ POST /verification/confirm
          ▼
   ┌──────────────┐
   │ Get token    │ → JWT stored in SecureStore (never sent again)
   │ Extract      │ → hospital_domain = "klinikum-muenchen.de"
   │ domain       │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Setup        │ → Drop pin on map, set radius (200m default)
   │ geofence(s)  │ → Save to local DB (encrypted)
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Grant        │ → "Always Allow" for background (or "When In Use")
   │ permissions  │
   └──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PLANNING SHIFTS (Tasks 119-141 in TODO.md)
   ┌──────────────┐                    ┌──────────────────────┐
   │ Create       │ ──────────────────►│ Local DB:            │
   │ templates    │  "Day Shift 7-3pm" │ shift_templates      │
   └──────┬───────┘                    └──────────────────────┘
          │
   ┌──────▼───────┐                    ┌──────────────────────┐
   │ Place on     │ ──────────────────►│ Local DB:            │
   │ calendar     │  Mon Jan 15, 7:00  │ shift_instances      │
   └──────────────┘                    └──────────────────────┘

   All data stays on device!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. TRACKING (Tasks 151-193 in TODO.md)

   [Option A: Automatic Geofencing]
   ┌──────────────┐
   │ User enters  │ → expo-location detects geofence
   │ hospital     │
   └──────┬───────┘
          │
   ┌──────▼───────┐                    ┌──────────────────────┐
   │ Auto clock-in│ ──────────────────►│ Local DB:            │
   │ 07:03        │  ON-DEVICE ONLY!   │ tracked_times        │
   │              │  method="geofence" │ { clock_in, ... }    │
   └──────┬───────┘                    └──────────────────────┘
          │
          │ Notification: "🟢 Clocked in at Hospital"
          │
          │ ... user works shift ...
          │
   ┌──────▼───────┐
   │ User exits   │ → expo-location detects exit
   │ hospital     │
   └──────┬───────┘
          │
   ┌──────▼───────┐                    ┌──────────────────────┐
   │ Auto clock-  │ ──────────────────►│ Local DB:            │
   │ out 15:12    │  Update record     │ tracked_times        │
   │              │  { clock_out, ... }│ { clock_in, out }    │
   └──────────────┘                    └──────────────────────┘

   [Option B: Manual Fallback]
   ┌──────────────┐                    ┌──────────────────────┐
   │ Tap "Clock   │ ──────────────────►│ Local DB:            │
   │ In" button   │  method="manual"   │ tracked_times        │
   └──────┬───────┘                    └──────────────────────┘
          │
   ┌──────▼───────┐
   │ Tap "Clock   │ → Update record
   │ Out" button  │
   └──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. REVIEW (Tasks 142-150 in TODO.md)
   ┌──────────────┐
   │ Open review  │ → Query local DB for week
   │ mode         │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Compare:     │   Planned: 7:00-15:00 (8h)
   │ planned vs   │   Tracked: 7:03-15:12 (8.15h)
   │ tracked      │
   └──────┬───────┘
          │
   ┌──────▼───────┐                    ┌──────────────────────┐
   │ Adjust if    │ ──────────────────►│ Local DB:            │
   │ needed       │  Correct to 7:00   │ tracked_times        │
   │              │  Add notes         │ { ..., notes }       │
   └──────┬───────┘                    └──────────────────────┘
          │
   ┌──────▼───────┐
   │ Mark as      │ → is_reviewed = true
   │ "reviewed"   │
   └──────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. SUBMISSION (Tasks 194-222 in TODO.md) **← PRIVACY APPLIED HERE**
   ┌──────────────┐
   │ Select week  │ → Query reviewed tracked_times for week
   │ to submit    │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Aggregate    │   Mon: 8h, Tue: 9h, Wed: 7.5h, ...
   │ Mon-Sun      │   Total: 42.0 hours
   └──────┬───────┘
          │
          ▼
   ┌────────────────────────────────────────────────┐
   │           PRIVACY PIPELINE (ON-DEVICE)          │
   ├────────────────────────────────────────────────┤
   │  True value: 42.0 hours                        │
   │       ↓                                         │
   │  Step 1: Round to 0.5h → 42.0                  │
   │       ↓                                         │
   │  Step 2: Add Laplace noise (ε=1.0) → 43.7      │
   │       ↓                                         │
   │  Noisy value: 43.7 hours                       │
   │  ✅ Backend NEVER sees 42.0!                    │
   └────────────────────────────────────────────────┘
          │
   ┌──────▼───────┐
   │ Queue for    │ → Add to AsyncStorage queue
   │ submission   │   (with retry logic)
   └──────┬───────┘
          │
          │ HTTPS POST /submissions/weekly
          │ { week_start: "2025-01-13",
          │   total_hours: 43.7,  ← NOISY!
          │   staff_group: "nurses",
          │   hospital_domain: "klinikum-muenchen.de",
          │   privacy_epsilon: 1.0 }
          ▼
   ┌────────────────────────────────────────────────┐
   │              BACKEND (UNTRUSTED)                │
   ├────────────────────────────────────────────────┤
   │  Receives: 43.7 hours (already noisy)          │
   │  Stores: 43.7 hours in database                │
   │  ✅ True value (42.0) never transmitted         │
   └────────────────────────────────────────────────┘
          │
   ┌──────▼───────┐                    ┌──────────────────────┐
   │ Save to      │ ──────────────────►│ Local DB:            │
   │ history      │  Record submitted  │ submission_history   │
   └──────────────┘  noisy value       └──────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. DASHBOARD (Existing Next.js app, minimal changes)
   ┌──────────────┐
   │ User opens   │ → GET /analytics?months=6&staff_group=nurses
   │ dashboard    │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Backend      │   avg(43.7, 38.2, 45.1, 39.8, ...)
   │ aggregates   │   ≈ 42.0 hours (noise cancels out!)
   │ noisy data   │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Apply        │ → If N < 5: suppressed = true
   │ suppression  │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Display      │ → Charts: avg hours by month, staff group
   │ charts/tables│   Tables: reports per hospital (if N ≥ 5)
   └──────────────┘
```

---

## 6. Backend Architecture (Minimal)

### 6.1 Database Schema (PostgreSQL on Hetzner)

**Only two tables needed:**

```sql
-- Users (minimal record for auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash VARCHAR(64) UNIQUE NOT NULL,    -- SHA256(email)
  affiliation_token TEXT NOT NULL,           -- JWT
  hospital_domain VARCHAR(255) NOT NULL,     -- e.g., "klinikum-muenchen.de"
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email_hash ON users(email_hash);
CREATE INDEX idx_users_domain ON users(hospital_domain);

-- Submitted reports (weekly, already noisy)
CREATE TABLE submitted_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  week_start DATE NOT NULL,                  -- Monday of week
  total_hours_worked FLOAT NOT NULL,         -- ← Noisy value (user added noise)
  total_overtime_hours FLOAT NOT NULL,       -- ← Noisy value

  staff_group VARCHAR(50) NOT NULL,          -- "nurses" | "facharzte" | "oberarzte"
  hospital_domain VARCHAR(255) NOT NULL,

  privacy_epsilon FLOAT DEFAULT 1.0,         -- ε used by client

  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_user ON submitted_reports(user_id);
CREATE INDEX idx_reports_week_group ON submitted_reports(week_start, staff_group);
CREATE INDEX idx_reports_hospital_week ON submitted_reports(hospital_domain, week_start);

-- Constraints
ALTER TABLE submitted_reports ADD CONSTRAINT chk_hours
  CHECK (total_hours_worked >= 0 AND total_hours_worked <= 168);
ALTER TABLE submitted_reports ADD CONSTRAINT chk_overtime
  CHECK (total_overtime_hours >= 0 AND total_overtime_hours <= 168);
```

### 6.2 API Endpoints

```python
# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Open Working Hours API")

# CORS for mobile app and dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Dashboard
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Routers
app.include_router(verification_router)    # Existing
app.include_router(submissions_router)     # NEW
app.include_router(analytics_router)       # Existing (minor updates)

# Key endpoints:
# POST   /verification/request     # Email → send code
# POST   /verification/confirm     # Code → JWT token

# POST   /submissions/weekly       # Submit noisy weekly data
# GET    /submissions/history      # User's own past submissions

# GET    /analytics                # Aggregated dashboard data
```

**New submission endpoint:**

```python
# backend/app/routers/submissions.py

from pydantic import BaseModel, validator
from datetime import date

class WeeklySubmissionCreate(BaseModel):
    week_start: date
    total_hours: float           # Already noisy!
    total_overtime: float        # Already noisy!
    staff_group: str
    hospital_domain: str
    privacy_epsilon: float = 1.0

    @validator('week_start')
    def validate_week_start(cls, v):
        if v.weekday() != 0:  # Must be Monday
            raise ValueError('week_start must be Monday')
        if v > date.today():
            raise ValueError('Cannot submit future dates')
        return v

@router.post("/weekly")
async def submit_weekly_report(
    submission: WeeklySubmissionCreate,
    current_user: User = Depends(get_current_user)  # JWT auth
):
    """
    Receives ALREADY NOISY data from mobile app.
    Backend just stores it - no further processing.
    """

    # Check duplicate
    existing = db.query(SubmittedReport).filter(
        SubmittedReport.user_id == current_user.id,
        SubmittedReport.week_start == submission.week_start
    ).first()

    if existing:
        raise HTTPException(409, "Week already submitted")

    # Store noisy data as-is
    report = SubmittedReport(
        user_id=current_user.id,
        week_start=submission.week_start,
        total_hours_worked=submission.total_hours,      # Noisy!
        total_overtime_hours=submission.total_overtime,  # Noisy!
        staff_group=submission.staff_group,
        hospital_domain=submission.hospital_domain,
        privacy_epsilon=submission.privacy_epsilon
    )

    db.add(report)
    db.commit()

    return {
        "message": "Submitted successfully",
        "id": str(report.id),
        "privacy_applied": f"ε={submission.privacy_epsilon}"
    }
```

---

## 7. Deployment & Hosting

### 7.1 Backend (Hetzner, Germany)

**Server setup:**
```bash
# Hetzner Cloud Server (EU region - Falkenstein or Nuremberg)
# Ubuntu 22.04 LTS
# 2 vCPU, 4GB RAM (sufficient for MVP)

# Install dependencies
apt update && apt upgrade -y
apt install python3.11 python3-pip postgresql-15 nginx certbot -y

# PostgreSQL setup
sudo -u postgres psql
CREATE DATABASE workinghours_db;
CREATE USER workinghours_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE workinghours_db TO workinghours_user;

# Backend deployment
cd /opt
git clone https://github.com/yourusername/open_workinghours.git
cd open_workinghours/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Nginx reverse proxy
# /etc/nginx/sites-available/workinghours
server {
    listen 443 ssl;
    server_name api.workinghours.example.com;

    ssl_certificate /etc/letsencrypt/live/api.workinghours.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.workinghours.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.2 Mobile App (TestFlight + Google Play)

**iOS (TestFlight):**
```bash
# Prerequisites: Apple Developer Account ($99/year)

# Build with EAS
eas login
eas build:configure
eas build --platform ios --profile production

# Upload to TestFlight via EAS Submit
eas submit --platform ios
```

**Android (Google Play Internal Testing):**
```bash
# Prerequisites: Google Play Developer Account ($25 one-time)

# Build with EAS
eas build --platform android --profile production

# Upload to Google Play Console
eas submit --platform android
```

### 7.3 Dashboard (Existing Next.js)

**No significant changes needed:**
- Update analytics query to handle weekly data (divide by 7 for daily avg)
- Existing suppression logic (N < 5) remains the same
- Deploy as usual (Vercel, Netlify, or self-hosted)

### 7.4 Monitoring & Observability

**Admin Dashboard:** `https://api.openworkinghours.org/admin` - Real-time metrics, recent events, auto-refreshes (see `backend/ADMIN_DASHBOARD.md`)

**SQL Queries:** `backend/monitoring.sql` - 14 queries for user activity, work events, aggregation status, health checks

**Quick Status:** `backend/check_status.sh` - Run on Hetzner for instant system overview

**Aggregation Cron:** Daily at 3 AM UTC (configured via `backend/setup_monitoring.sh`)

**Schema Validation:** Verification codes require min_length=6 (6-digit numeric codes)

**Bug Reports:** POST `/feedback` - Mobile app sends bug reports with app state (user, locations, sessions, device info) → emails admin

**Log Viewer:** GET `/admin/logs` - View container logs (backend, aggregation, nginx) with filtering (search, level, lines)

---

## 8. Developer Workflow

### 8.1 Getting Started

```bash
# 1. Backend setup
cd backend
pip install -r requirements.txt
# Set up .env with database credentials
uvicorn main:app --reload
# Backend runs on http://localhost:8000

# 2. Mobile app setup
cd mobile-app
npm install
expo start
# Scan QR code with Expo Go app

# 3. Dashboard (existing)
cd ../
pnpm install
pnpm dev
# Dashboard runs on http://localhost:3000
```

### 8.2 Testing Geofencing

```bash
# iOS Simulator: Feature → Location → Custom Location
# Set coordinates near your test geofence

# Android Emulator: ... (Extended Controls) → Location
# Set custom GPS coordinates

# Real device testing: Walk in/out of actual geofence radius
```

### 8.3 Testing Privacy Pipeline

```typescript
// Test in mobile app console or Jest tests
import { applyPrivacyProtections } from '@/services/privacy/DifferentialPrivacy';

const trueValue = 40.0;
const noisy1 = applyPrivacyProtections(trueValue);
const noisy2 = applyPrivacyProtections(trueValue);
const noisy3 = applyPrivacyProtections(trueValue);

console.log({ trueValue, noisy1, noisy2, noisy3 });
// Output: { trueValue: 40, noisy1: 38.7, noisy2: 42.3, noisy3: 39.1 }
// ✅ Each call produces different noisy value
// ✅ Average converges to true value with enough samples
```

---

## 9. References & Documentation

### Key Files

**Mobile app:**
- Privacy pipeline: `mobile-app/src/services/privacy/DifferentialPrivacy.ts`
- Geofencing: `mobile-app/src/services/geofencing/GeofenceService.ts`
- Local DB: `mobile-app/src/services/storage/Database.ts`
- Calendar: `mobile-app/src/screens/calendar/CalendarScreen.tsx`

**Backend:**
- Submissions: `backend/app/routers/submissions.py`
- Auth: `backend/app/routers/verification.py`
- Models: `backend/app/models.py`

**Dashboard:**
- Analytics: `app/[locale]/public-dashboard/page.tsx`
- API client: `lib/backend-api.ts`

### Additional Documentation

- **Master todo list**: `TODO.md` (360 tasks, 11-week roadmap)
- **Privacy policy**: `docs/privacy-policy.md` (TODO: write)
- **API documentation**: Backend OpenAPI docs at `/docs`
- **Architecture diagrams**: `docs/architecture/` (TODO: create)

---

## 10. Planned Features (Post-MVP)

See `TODO.md` tasks 337-360 for detailed list. Key enhancements:

### Tier 2 Privacy (High Priority)
- [ ] Submission time jittering (0-24h random delay)
- [ ] Hospital generalization for small facilities
- [ ] Randomized response for staff groups

### User Features
- [ ] Multi-hospital support (switch between workplaces)
- [ ] Shift templates sharing
- [ ] Calendar sync (Google/Apple Calendar)
- [ ] Push reminders

### Technical Improvements
- [ ] Improve geofence accuracy (WiFi SSID as secondary signal)
- [ ] Battery optimization
- [ ] Offline mode improvements
- [ ] Biometric authentication

---

## 11. Privacy & Compliance Summary

### What's Protected

| Data Type | Location | Privacy Measure | Who Can Access? |
|-----------|----------|-----------------|-----------------|
| GPS coordinates | Device only | Never transmitted | User only |
| Daily shift times | Device only | Never transmitted | User only |
| Weekly hours | Backend (noisy) | Laplace noise (ε=1.0) | Backend (noisy only) |
| Email | Backend (hashed) | SHA256 | Backend (hash only) |
| Staff group | Backend | None (Tier 1) | Backend (aggregated) |
| Templates | Device only | Never transmitted | User only |
| Planned shifts | Device only | Never transmitted | User only |

### Compliance Checklist

- [x] GDPR Article 25 (Privacy by Design)
- [x] GDPR Article 32 (Security of Processing)
- [x] German BDSG § 22 (Technical Measures)
- [x] Data minimization (backend stores minimal PII)
- [x] User control (explicit submission, no auto-sync)
- [x] Right to erasure (delete user → cascade to reports)
- [x] Data portability (export feature in settings)
- [x] Encryption at rest (SQLCipher on device)
- [x] Encryption in transit (HTTPS)

---

## 12. Getting Help

### Common Issues

**Geofencing not working:**
- Check location permissions (Settings → App → Location → Always Allow)
- Verify geofence radius is reasonable (100-500m)
- Check battery optimization settings (Android)

**Submission failing:**
- Check internet connection
- Check backend is running (`curl https://api.workinghours.example.com/health`)
- Check submission queue: Settings → Data Export → View pending submissions

**Privacy concerns:**
- Review Settings → Privacy Settings for explanation of protections
- Export your data to see what's stored locally vs remotely
- Read privacy policy at https://workinghours.example.com/privacy

### Support

- **GitHub Issues**: https://github.com/yourusername/open_workinghours/issues
- **Documentation**: https://docs.workinghours.example.com
- **Email**: support@workinghours.example.com

---

**Last updated**: 2025-01-15
**Version**: 2.0 (Mobile app architecture)
**Next review**: After MVP completion (Week 11)
