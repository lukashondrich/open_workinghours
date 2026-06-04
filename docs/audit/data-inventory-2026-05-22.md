# Data Inventory Audit — Open Working Hours
**Date:** 2026-05-22
**Scope:** Mobile App (React Native/Expo) + Backend (FastAPI/PostgreSQL)
**Methodology:** Code analysis only; legal docs excluded per audit protocol

---

## A. MOBILE APP DATA

### A.1 Local Persistence

#### A.1.1 SQLite Database

**Schema (expo-sqlite):** `calendar.db`
**File:** `mobile-app/src/modules/calendar/services/CalendarStorage.ts`

| Table | Columns | Type | Notes |
|-------|---------|------|-------|
| `shift_templates` | `id` (TEXT PK), `name` (TEXT), `start_time` (TEXT), `duration` (INT), `color` (TEXT), `break_minutes` (INT, v1+) | Template | User-created shift definitions (e.g., "Morning 6am-2pm"); stored locally only |
| `shift_instances` | `id` (TEXT PK), `template_id` (TEXT), `date` (TEXT), `start_time` (TEXT), `duration` (INT), `end_time` (TEXT), `color` (TEXT), `name` (TEXT) | Instance | Shift placements on calendar |
| `tracking_records` | `id` (TEXT PK), `date` (TEXT), `start_time` (TEXT), `duration` (INT), `break_minutes` (INT, v1+) | Geofence tracking | Auto-captured clock-in/out sessions from geofencing |
| `confirmed_days` | `date` (TEXT PK), `status` (TEXT), `confirmed_at` (TEXT), `locked_submission_id` (TEXT), `notes` (TEXT) | State | Week finalization status per day |
| `absence_templates` | `id`, `type` ('vacation'/'sick'), `name`, `color`, `start_time`, `end_time`, `is_full_day` (INT), `created_at`, `updated_at` | Absence | Vacation/sick day definitions |
| `absence_instances` | `id`, `absence_template_id`, `date`, `start_time`, `end_time`, `type`, `is_full_day`, `created_at` | Absence | Absence placements on calendar |
| `device_calendar_mappings` | `id`, `entity_type` ('shift'/'absence'), `entity_id`, `device_event_id`, `device_calendar_id`, `target_state`, `created_at`, `updated_at` | Sync | Maps local shifts/absences to device calendar events for export feature |
| `device_calendar_state` | `state_key` (TEXT PK), `mapping_id`, `last_sync_at`, `created_at`, `updated_at` | Sync | Tracks export state per calendar |
| `schema_version` | `version` (INT PK), `applied_at` (TEXT) | Migrations | Schema version tracking |

**Migrations (7 versions):**
- v1: Add `break_minutes` to shift_templates + tracking_records
- v2: Add absence_templates + absence_instances tables
- v3: Add device_calendar_mappings + device_calendar_state (calendar export feature)
- v4+: Extensions for sync tracking

**Data lifetime:** Persists for app life; user deletion removes only confirmed days. Shift/absence templates, tracking records remain until manual deletion or app uninstall.

#### A.1.2 AsyncStorage & SecureStore (expo-secure-store)

**File:** `mobile-app/src/lib/auth/AuthStorage.ts`

| Key | Data | Storage Type | Encrypted |
|-----|------|--------------|-----------|
| `auth_token` | JWT token (Bearer format) | SecureStore | Yes (hardware keychain on iOS/Android) |
| `auth_user` | JSON: `{ userId, email?, hospitalId, specialty, roleLevel, stateCode, createdAt, termsAcceptedVersion, privacyAcceptedVersion, consentAcceptedAt }` | SecureStore | Yes |
| `auth_expires` | ISO 8601 expiry timestamp | SecureStore | Yes |

**Fallback:** In-memory dictionary if SecureStore unavailable (unsigned simulator builds). Falls back on errors with `isSecureStoreUnavailableError()` check.

**Related storage (AsyncStorage, unencrypted):**
- Consent acceptance states (local timestamp) — `ConsentStorage.ts`
- Onboarding preferences (tooltip seen flags) — `OnboardingPreferences.ts`
- Permission warning dismissal timestamps (1-week re-show) — `StatusScreen.tsx`

**Data lifetime:** Token valid 30 days. Cleared on logout or account deletion.

#### A.1.3 File System (Expo FileSystem)

**Exports:**
- Calendar events exported to CSV via Share sheet (not persisted; immediate download)
- Bug reports include GPS telemetry — collected but not written to FS
- **No persistent file writes** to device storage

#### A.1.4 Device Calendar Integration

**Feature:** `CalendarExportManager.ts` (iOS/Android)
**Permissions:** `READ_CALENDAR`, `WRITE_CALENDAR`
**Data written to device calendar:**
- Shift instances (name, start/end time, color)
- Absence instances (name, start/end, color)
- **Not written:** Hospital affiliation, work hours totals, location coordinates

---

### A.2 Network Calls to Own Backend

**Backend URL:** `https://api.openworkinghours.org` (config from `app.json` extra)

#### A.2.1 Authentication Endpoints

| Endpoint | Method | Request Body | Response | Frequency | File |
|----------|--------|--------------|----------|-----------|------|
| `/verification/request` | POST | `{ email }` | `{ success, message }` | On-demand (registration/login) | `AuthService.ts:40` |
| `/verification/confirm` | POST | `{ email, code }` | `{ success, message, email }` | After user receives code | `AuthService.ts:79` |
| `/auth/register` | POST | `{ email, hospital_id, specialty, role_level, state_code, profession?, seniority?, department_group?, specialization_code?, hospital_ref_id?, terms_version, privacy_version }` | `{ access_token, expires_at, user_id }` | Once per registration | `AuthService.ts:138` |
| `/auth/login` | POST | `{ email, code }` | `{ access_token, expires_at, user_id }` | On user login (each session) | AuthService.ts:~200 |
| `/auth/apple` | POST | `{ identity_token }` | `{ status, access_token?, expires_at?, user_id?, social_registration_token? }` | Once per social sign-in | Social auth (iOS) |
| `/auth/google` | POST | `{ id_token, client_id }` | `{ status, access_token?, expires_at?, user_id?, social_registration_token? }` | Once per social sign-in | Social auth (Android) |
| `/auth/social/register` | POST | `{ social_registration_token, hospital_id, specialty, role_level, ..., terms_version, privacy_version }` | `{ access_token, expires_at, user_id }` | Once per first-time social user | Social registration |
| `/auth/me` | GET | (Auth header: Bearer token) | `{ userId, email, hospitalId, specialty, roleLevel, stateCode, createdAt, termsAcceptedVersion, privacyAcceptedVersion, consentAcceptedAt }` | On login + refresh | `AuthService.ts:~170` |
| `/auth/me/export` | GET | (Auth header) | `{ exported_at, profile, work_events[] }` | On-demand (GDPR Art. 20) | DataPrivacyScreen |
| `/auth/me/privacy-budget` | GET | (Auth header) | `{ user_annual_summary, worst_case, avg_spend, utilization% }` | On-demand (GDPR Art. 15) | DataPrivacyScreen |
| `DELETE /auth/me` | DELETE | (Auth header) | (204 No Content) | On-demand (account deletion) | DataPrivacyScreen |
| `/auth/consent` | POST | (Auth header), `{ terms_version, privacy_version }` | User object | When user updates consent | ConsentBottomSheet |

**JWT Token:** Stored in SecureStore; 30-day expiry; includes `user_id` claim.

#### A.2.2 Work Events Endpoints

| Endpoint | Method | Request Body | Response | When | File |
|----------|--------|--------------|----------|------|------|
| `/work-events` | POST | `{ date (ISO), planned_hours (float), actual_hours (float), source ('geofence'/'manual'/'mixed') }` | `{ event_id, date, planned_hours, actual_hours, source, submitted_at }` | Daily after finalization | `WeekFinalizationService.ts` |
| `/work-events` | GET | Query: `?start_date=`, `?end_date=`, `?limit=` | Array of work events | Fetch user history | `CollectiveInsightsService.ts` |
| `/work-events/{id}` | PATCH | `{ planned_hours?, actual_hours? }` | Updated event | Manual correction (rare) | — |
| `/work-events/{id}` | DELETE | — | (204) | Delete event | — |

#### A.2.3 Finalized Weeks Endpoint

| Endpoint | Method | Request Body | Response | When | File |
|----------|--------|--------------|----------|------|------|
| `/finalized-weeks` | POST | `{ week_start (ISO date), planned_hours?, actual_hours? }` | `{ finalized_week_id, week_start, week_end, planned_hours, actual_hours, finalized_at, ... }` | Weekly (Sunday) after week complete | `WeekFinalizationService.ts` |
| `/finalized-weeks` | GET | Query: `?start_date=`, `?limit=` | Array of finalized weeks | Weekly review | `CollectiveInsightsService.ts` |

#### A.2.4 Stats Endpoints (Public, Unauthenticated)

| Endpoint | Method | Request | Response | When | File |
|----------|--------|---------|----------|------|------|
| `/stats/by-state-specialty` | GET | Query: `?period=` | K-anonymous aggregates with CI | Public dashboard / app (weekly) | Dashboard screens |
| `/stats/by-state-specialty/latest` | GET | — | Latest period per state/specialty | App load | CollectiveInsightsService.ts |
| `/stats/summary` | GET | — | Platform-wide summary | App onboarding | — |

#### A.2.5 Admin Endpoints (Requires Auth Token)

| Endpoint | Method | Notes | File |
|----------|--------|-------|------|
| `/admin` | GET | HTML dashboard (dev/test only) | — |
| `/admin/logs` | GET | Server logs (dev/test only) | — |

#### A.2.6 Public Dashboard Endpoints

| Endpoint | Method | Response | When |
|----------|--------|----------|------|
| `/dashboard/coverage` | GET | State coverage ("1-10", "11-50", etc. ranges) | Public website |
| `/dashboard/activity` | GET | 30-day activity stats | Public website |
| `POST /dashboard/contact` | POST | Institution inquiry (name, org, role, email, message) | Public form submission |

#### A.2.7 Taxonomy Endpoint

| Endpoint | Method | Response | When | File |
|----------|--------|----------|------|------|
| `/taxonomy/professions` | GET | List of profession options (v2 taxonomy) | On app load | TaxonomyService.ts |

#### A.2.8 Feedback Endpoint

| Endpoint | Method | Request Body | Response | When | File |
|----------|--------|--------------|----------|------|------|
| `/feedback` | POST | `{ user_id?, user_email?, hospital_id?, specialty?, role_level?, state_code?, locations_count, locations_details (list of {name, lat, lon}), work_events_total, work_events_pending, app_version, build_number, platform, device_model, os_version, gps_telemetry (object with recent_events, accuracy_stats), description? }` | `{ report_id, status }` | On-demand bug report submission | `reportIssue.ts:173` |

**GPS Telemetry in Feedback:**
- Last 100 geofence events with: timestamp, event_type (enter/exit), accuracy_meters, accuracy_source (event/active_fetch/null), ignored (bool), ignore_reason, location_name
- Accuracy stats: min/max/avg/count
- Ignored/signal degradation/debounced event counts

---

### A.3 Third-Party Network Calls

#### A.3.1 Photon Geocoding Service

**Provider:** Komoot (Germany-based, OSM-powered)
**File:** `GeocodingService.ts:105`
**Endpoint:** `https://photon.komoot.io/api/`
**Query Parameters:**
```
?q={encodeURIComponent(query)}
&limit=5
&lang=de (German default)
&lat={latitude}  (optional — proximity bias, 0.6 scale)
&lon={longitude}
```

**What's sent:**
- Search query (hospital name, address, city) — plain text
- Optional: User's current location (lat/lon) for proximity weighting
- No API key; request comes from app with standard User-Agent

**What's returned:**
- Array of GeocodingResult: `{ id, name, address, latitude, longitude, type? }`
- Results filtered to healthcare types (hospital, clinic, doctors, pharmacy, dentist, nursing_home)

**No headers sent to Photon:**
- No auth token
- No user ID
- No device identifier
- Standard HTTP User-Agent only

#### A.3.2 Apple Sign-In

**Platform:** iOS only
**Endpoints Called:**
- `https://appleid.apple.com/auth/keys` — JWKS endpoint (cached 1h)

**What's sent from app:**
- `identity_token` (JWT from ASAuthorizationAppleIDProvider) — encrypted by Apple, opaque to app
- **Not sent:** Email (Apple provides it during first sign-in, app discards it)

**Verified on backend:**
- Token signature via JWKS
- `aud` (audience) = bundle ID `com.openworkinghours.mobileapp`
- `iss` (issuer) = `https://appleid.apple.com`
- Extract opaque `sub` claim (stable user ID)

#### A.3.3 Google Sign-In

**Platform:** Android only
**Endpoints Called:**
- `https://www.googleapis.com/oauth2/v3/certs` — JWKS endpoint (cached 1h)

**What's sent from app:**
- `id_token` (JWT from Google Sign-In SDK) — opaque
- `client_id` (Web/Server OAuth client ID) — `819562297268-nr59r2trbu2h1k9joios9o3u3q3e0s7d.apps.googleusercontent.com` (from `app.json:82`)

**Verified on backend:**
- Token signature via JWKS
- `aud` must match `client_id`
- `iss` in {`accounts.google.com`, `https://accounts.google.com`}
- Extract opaque `sub` claim

**Email handling:** Google provides email in token; backend discards it intentionally (social users have `email_hash = NULL`)

---

### A.4 Device Permissions & Sensors

**File:** `app.json` (lines 23-76)

| Permission | iOS String | Android Permission | Use | Requested When |
|------------|------------|-------------------|-----|-----------------|
| **Foreground Location** | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` | Geocoding + manual location verification | Setup screen (map search) |
| **Background Location** | `NSLocationAlwaysAndWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` (with foreground service flag) | Geofencing clock-in/out | After foreground permission + at least one location saved |
| **Face ID / Biometric** | `NSFaceIDUsageDescription` | — | Lock screen biometric unlock | After registration if device supports |
| **Calendar Read/Write** | (implicit iOS permissions) | `READ_CALENDAR` + `WRITE_CALENDAR` | Calendar export feature | When user exports shifts/absences to device calendar |
| **Notifications (POST)** | (implicit) | `POST_NOTIFICATIONS` | Exit verification notifications + week finalization | After user enables tracking |
| **Vibration** | (implicit) | `VIBRATE` | Haptic feedback on interactions | Built-in (no explicit request) |

**Background Location Mode (iOS):**
```
UIBackgroundModes: ["location"]
```
Enables `startLocationUpdatesAsync()` foreground service (Android).

**Device Identifiers Collected:**
- `Device.modelName` — only in bug reports (optional user-initiated)
- `Device.osName` — platform string ("iOS" / "Android")
- `Device.osVersion` — OS version string
- **NOT collected:** IDFA, advertising ID, device fingerprint, MAC address

---

### A.5 Logging in Production

**Console.log Statements:** 295 total across mobile codebase

**Production logs captured:**
1. **Debug prefix:** `[AuthService]`, `[GeocodingService]`, `[GeofenceService]`, etc. — printed to stdout during development
2. **TEST_MODE logs:** `console.log` calls for test mode detection (never in production)
3. **Errors:** `console.error` for auth failures, network errors, biometric failures

**Sensitive data logged:**
- ❌ Email addresses: NO (only logged as "email" string in auth errors)
- ❌ Tokens: NO (logged as `[token redacted]` in comments)
- ❌ Password codes: NO (only validated, never logged)
- ❌ Location coordinates: YES — logged in geofence events with accuracy: `[GeofenceService] Active GPS fetch: accuracy=XX.Xm` (line 189)
- ❌ User IDs: NO in production code

**Device console output:** Logs go to standard React Native logger (XCode console on iOS, ADB logcat on Android), not to backend.

---

## B. BACKEND DATA

### B.1 Database Schema

**Database:** PostgreSQL (production, Hetzner/Germany)
**Connection:** `postgresql://user:pass@host/owh_prod`

#### B.1.1 User Tables (Operational Layer — GDPR applies)

**`users` Table:**
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email_hash VARCHAR(64) UNIQUE NULLABLE,  -- SHA256; NULL for social-auth users
  hospital_id VARCHAR(255) NOT NULL INDEX,
  specialty VARCHAR(100) NOT NULL INDEX,
  role_level VARCHAR(50) NOT NULL,
  state_code VARCHAR(10) INDEX NULLABLE,
  country_code VARCHAR(3) DEFAULT 'DEU',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_submission_at TIMESTAMP NULLABLE,
  -- v2 Taxonomy (nullable — NULL for legacy users)
  profession VARCHAR(20) NULLABLE INDEX,
  seniority VARCHAR(30) NULLABLE INDEX,
  department_group VARCHAR(50) NULLABLE INDEX,
  specialization_code VARCHAR(10) NULLABLE INDEX,
  hospital_ref_id INTEGER NULLABLE INDEX,
  -- Social auth (NULL for email users)
  auth_provider VARCHAR(20) NULLABLE,  -- 'apple' | 'google' | NULL
  provider_sub VARCHAR(255) NULLABLE INDEX,
  -- GDPR Consent
  terms_accepted_version VARCHAR(20) NULLABLE,
  privacy_accepted_version VARCHAR(20) NULLABLE,
  consent_accepted_at TIMESTAMP NULLABLE,
  -- Foreign key relationships
  CONSTRAINT uq_user_auth_provider_sub UNIQUE (auth_provider, provider_sub)
);
```

**`work_events` Table:**
```sql
CREATE TABLE work_events (
  event_id UUID PRIMARY KEY,
  user_id UUID NOT NULL FOREIGN KEY (CASCADE DELETE),
  date DATE NOT NULL INDEX,
  planned_hours NUMERIC(5,2) NOT NULL,
  actual_hours NUMERIC(5,2) NOT NULL,
  source VARCHAR(20) NOT NULL,  -- 'geofence' | 'manual' | 'mixed'
  submitted_at TIMESTAMP NOT NULL INDEX,
  CONSTRAINT uq_work_event_user_date UNIQUE (user_id, date)
);
```
Stores daily confirmed work hours. Deleted when user account deleted (cascade).

**`finalized_user_weeks` Table:**
```sql
CREATE TABLE finalized_user_weeks (
  finalized_week_id UUID PRIMARY KEY,
  user_id UUID NOT NULL FOREIGN KEY (CASCADE DELETE) INDEX,
  week_start DATE NOT NULL INDEX,
  week_end DATE NOT NULL,
  planned_hours NUMERIC(6,2) NOT NULL,
  actual_hours NUMERIC(6,2) NOT NULL,
  hospital_id VARCHAR(255) NOT NULL INDEX,
  specialty VARCHAR(100) NOT NULL INDEX,
  role_level VARCHAR(50) NOT NULL,
  state_code VARCHAR(10) NULLABLE INDEX,
  country_code VARCHAR(3) DEFAULT 'DEU',
  -- v2 Taxonomy snapshot (nullable)
  profession VARCHAR(20) NULLABLE,
  seniority VARCHAR(30) NULLABLE,
  department_group VARCHAR(50) NULLABLE,
  specialization_code VARCHAR(10) NULLABLE,
  hospital_ref_id INTEGER NULLABLE,
  finalized_at TIMESTAMP NOT NULL INDEX,
  CONSTRAINT uq_finalized_user_week_user_start UNIQUE (user_id, week_start)
);
```
Immutable snapshot for aggregation. Deleted when user deleted (cascade).

**`verification_requests` Table:**
```sql
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY,
  email_hash VARCHAR(128) NOT NULL INDEX UNIQUE,
  email_domain VARCHAR(255) NOT NULL INDEX,
  code_hash VARCHAR(128) NOT NULL,  -- SHA256
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP NULLABLE,
  status VARCHAR(32) DEFAULT 'pending',  -- pending | confirmed | expired
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL
);
```
Stores email verification codes (hashed). Deleted on user deletion or expiry (15 min default).

#### B.1.2 Analytics Tables (K-Anonymous Layer — GDPR does NOT apply)

**`stats_by_state_specialty` Table:**
```sql
CREATE TABLE stats_by_state_specialty (
  stat_id UUID PRIMARY KEY,
  country_code VARCHAR(3) DEFAULT 'DEU',
  state_code VARCHAR(10) NOT NULL INDEX,
  specialty VARCHAR(100) NOT NULL INDEX,
  period_start DATE NOT NULL INDEX,
  period_type VARCHAR(10) NOT NULL DEFAULT 'weekly',  -- weekly | biweekly | monthly
  mechanism VARCHAR(50) DEFAULT 'laplace',
  publication_status VARCHAR(20) NOT NULL DEFAULT 'published',  -- warming_up | published | cooling_down | suppressed
  planned_sum NUMERIC(8,2) NOT NULL,
  actual_sum NUMERIC(8,2) NOT NULL,
  overtime NUMERIC(8,2) NOT NULL,
  -- Differential Privacy
  planned_sum_noisy NUMERIC(8,2) NULLABLE,
  actual_sum_noisy NUMERIC(8,2) NULLABLE,
  overtime_noisy NUMERIC(8,2) NULLABLE,
  -- Confidence Intervals (90%)
  planned_ci_half NUMERIC(6,3) NULLABLE,
  actual_ci_half NUMERIC(6,3) NULLABLE,
  overtime_ci_half NUMERIC(6,3) NULLABLE,
  n_users INTEGER NOT NULL,
  n_display INTEGER NOT NULL,  -- rounded to nearest 5
  published_at TIMESTAMP NULLABLE,
  CONSTRAINT uq_stats_by_state_specialty UNIQUE (country_code, state_code, specialty, period_start, period_type)
);
```
Published K-anonymous aggregate statistics. **Retained after user deletion.** Not subject to GDPR erasure.

**`state_specialty_privacy_ledger` Table:**
```sql
CREATE TABLE state_specialty_privacy_ledger (
  entry_id UUID PRIMARY KEY,
  country_code VARCHAR(3) DEFAULT 'DEU',
  state_code VARCHAR(10) NOT NULL INDEX,
  specialty VARCHAR(100) NOT NULL INDEX,
  period_start DATE NOT NULL INDEX,
  period_type VARCHAR(10) NOT NULL DEFAULT 'weekly',
  mechanism VARCHAR(50) DEFAULT 'laplace',
  publication_status VARCHAR(20) NOT NULL,
  planned_sum_epsilon NUMERIC(6,3) NOT NULL,
  actual_sum_epsilon NUMERIC(6,3) NOT NULL,
  total_epsilon NUMERIC(6,3) NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  CONSTRAINT uq_state_specialty_privacy_ledger UNIQUE (country_code, state_code, specialty, period_start)
);
```
Per-cell ε spend accounting. Audit trail for privacy budget tracking (Art. 15).

**`user_privacy_ledger` Table:**
```sql
CREATE TABLE user_privacy_ledger (
  entry_id UUID PRIMARY KEY,
  user_id UUID NOT NULL INDEX,
  state_code VARCHAR(10) NOT NULL INDEX,
  specialty VARCHAR(100) NOT NULL INDEX,
  period_start DATE NOT NULL INDEX,
  period_type VARCHAR(10) NOT NULL DEFAULT 'weekly',
  contributed_epsilon NUMERIC(6,3) NOT NULL,
  recorded_at TIMESTAMP NOT NULL
);
```
Per-user cumulative ε exposure across all contributions. Audit trail.

#### B.1.3 Feedback & Inquiry Tables

**`feedback_reports` Table:**
```sql
CREATE TABLE feedback_reports (
  report_id UUID PRIMARY KEY,
  -- User context (optional — may be anonymous)
  user_id VARCHAR(255) NULLABLE,
  user_email VARCHAR(255) NULLABLE,
  hospital_id VARCHAR(255) NULLABLE,
  specialty VARCHAR(100) NULLABLE,
  role_level VARCHAR(50) NULLABLE,
  state_code VARCHAR(10) NULLABLE,
  -- Description
  description TEXT NULLABLE,
  -- App state (JSON)
  app_state JSON NOT NULL,
  -- Metadata
  created_at TIMESTAMP NOT NULL INDEX,
  resolved VARCHAR(20) DEFAULT 'pending'  -- pending | resolved | dismissed
);
```
User-submitted bug reports with optional user context and full app state snapshot (JSON). **Not deleted when user deleted** (manual cleanup, no FK).

**App state JSON schema:**
```json
{
  "user": { user object or null },
  "locations": { "total": N, "details": [{ "name", "latitude", "longitude" }] },
  "workEvents": { "total": N, "lastSubmission": timestamp, "pending": N },
  "appInfo": { "version", "buildNumber", "platform", "deviceModel", "osVersion" },
  "gps_telemetry": {
    "recent_events": [{ "timestamp", "event_type", "accuracy_meters", "accuracy_source", "ignored", "ignore_reason", "location_name" }],
    "accuracy_stats": { "min", "max", "avg", "count" },
    "ignored_events_count": N,
    "signal_degradation_count": N,
    "debounced_events_count": N
  }
}
```

**`institution_inquiries` Table:**
```sql
CREATE TABLE institution_inquiries (
  inquiry_id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,  -- 'union' | 'researcher' | 'press' | 'other'
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL INDEX,
  responded_at TIMESTAMP NULLABLE,
  status VARCHAR(20) DEFAULT 'pending',  -- pending | responded | archived
  notes TEXT NULLABLE
);
```
Public dashboard contact form submissions. **Not deleted when user deleted.** Separate data processing stream.

#### B.1.4 Legacy Tables (Deprecated)

- `reports` — old v0 schema
- `weekly_submissions` — old v0 schema

---

### B.2 API Endpoints

**Base URL:** `https://api.openworkinghours.org`

#### B.2.1 Authentication Routers (`/auth`, `/verification`)

| Endpoint | Method | Auth | Request | Response | PII Sent | File:Line |
|----------|--------|------|---------|----------|----------|-----------|
| `/verification/request` | POST | ❌ | `{ email }` | `{ success, message }` | Email (hashed on backend) | `verification.py` |
| `/verification/confirm` | POST | ❌ | `{ email, code }` | `{ success, message }` | Email (hashed) | `verification.py` |
| `/auth/register` | POST | ❌ | `{ email, hospital_id, specialty, role_level, state_code, profession?, seniority?, department_group?, specialization_code?, hospital_ref_id?, terms_version, privacy_version }` | `{ access_token, expires_at, user_id }` | Email, occupation, state | `auth.py:54` |
| `/auth/login` | POST | ❌ | `{ email, code }` | `{ access_token, expires_at, user_id }` | Email | `auth.py:137` |
| `/auth/apple` | POST | ❌ | `{ identity_token }` | `{ status, access_token?, expires_at?, user_id?, social_registration_token? }` | Opaque Apple `sub` | `auth.py` |
| `/auth/google` | POST | ❌ | `{ id_token, client_id }` | `{ status, access_token?, expires_at?, user_id?, social_registration_token? }` | Opaque Google `sub` | `auth.py` |
| `/auth/social/register` | POST | ❌ | `{ social_registration_token, hospital_id, specialty, ..., terms_version, privacy_version }` | `{ access_token, expires_at, user_id }` | Occupation, state | `auth.py` |
| `/auth/me` | GET | ✅ Bearer | — | User object + consent fields | user_id, hospital_id, specialty, role_level, state_code, consent versions | `auth.py` |
| `/auth/me/export` | GET | ✅ Bearer | — | `{ exported_at, profile, work_events[] }` | Full profile + all work_events | `auth.py` |
| `/auth/me/privacy-budget` | GET | ✅ Bearer | — | `{ user_annual_summary, worst_case_user, avg_spend, utilization% }` | Aggregate ε spend (obfuscated per user) | `auth.py` |
| `DELETE /auth/me` | DELETE | ✅ Bearer | — | (204 No Content) | — | `auth.py:437` |
| `/auth/consent` | POST | ✅ Bearer | `{ terms_version, privacy_version }` | User object | consent versions | `auth.py` |

**Rate limiting:** 5 req/60s on `/request`, `/verify`, `/register`, `/login`, `/apple`, `/google`

#### B.2.2 Work Events Router (`/work-events`)

| Endpoint | Method | Auth | Request | Response | File:Line |
|----------|--------|------|---------|----------|-----------|
| `POST /work-events` | POST | ✅ Bearer | `{ date, planned_hours, actual_hours, source }` | `{ event_id, date, planned_hours, actual_hours, source, submitted_at }` | `work_events.py:38` |
| `GET /work-events` | GET | ✅ Bearer | Query: `?start_date=`, `?end_date=`, `?limit=` | `[{ event_id, ... }]` | `work_events.py:96` |
| `PATCH /work-events/{id}` | PATCH | ✅ Bearer | `{ planned_hours?, actual_hours? }` | Updated event | `work_events.py:134` |
| `DELETE /work-events/{id}` | DELETE | ✅ Bearer | — | (204) | `work_events.py` |

#### B.2.3 Finalized Weeks Router (`/finalized-weeks`)

| Endpoint | Method | Auth | Request | Response | File:Line |
|----------|--------|------|---------|----------|-----------|
| `POST /finalized-weeks` | POST | ✅ Bearer | `{ week_start, planned_hours?, actual_hours? }` | FinalizedUserWeek object | `finalized_weeks.py:22` |
| `GET /finalized-weeks` | GET | ✅ Bearer | Query: `?start_date=`, `?limit=` | `[FinalizedUserWeek]` | `finalized_weeks.py:112` |

#### B.2.4 Stats Router (`/stats`) — Public

| Endpoint | Method | Auth | Response | File |
|----------|--------|------|----------|------|
| `GET /stats/by-state-specialty` | GET | ❌ | K-anonymous stats by state/specialty (with CIs) | `stats.py` |
| `GET /stats/by-state-specialty/latest` | GET | ❌ | Latest period per state/specialty | `stats.py` |
| `GET /stats/summary` | GET | ❌ | Platform summary (total users, K-anonymous groups, avg hours) | `stats.py` |
| `GET /stats/admin/privacy-budget-summary` | GET | ❌ | Aggregate ε utilization stats (worst-case user, avg, cap%) | `stats.py` |

#### B.2.5 Dashboard Router (`/dashboard`) — Public

| Endpoint | Method | Response | File |
|----------|--------|----------|------|
| `GET /dashboard/coverage` | GET | State contributor counts as ranges ("1-10", "11-50", "51-200", "201+") | `dashboard.py` |
| `GET /dashboard/activity` | GET | 30-day rolling activity window | `dashboard.py` |
| `POST /dashboard/contact` | POST | Saves institution inquiry; sends email notification to admin | `dashboard.py` |

#### B.2.6 Admin Router (`/admin`) — Requires HTTP Basic Auth

| Endpoint | Method | Auth | Response | File |
|----------|--------|------|----------|------|
| `GET /admin` | GET | Basic (ADMIN_PASSWORD) | HTML dashboard: user count, work events, activity, recent submissions | `admin.py` |
| `GET /admin/logs` | GET | Basic | Server logs (stdout) | `admin.py` |

#### B.2.7 Feedback Router (`/feedback`) — Public

| Endpoint | Method | Auth | Request | Response | File |
|----------|--------|------|---------|----------|------|
| `POST /feedback` | POST | ❌ | `{ user_id?, user_email?, hospital_id?, specialty?, role_level?, state_code?, locations_count, locations_details, work_events_total, work_events_pending, app_version, build_number, platform, device_model, os_version, gps_telemetry, description? }` | `{ report_id, status }` | `feedback.py` |

**Rate limiting:** 3 req/60s

---

### B.3 Outgoing Calls to Third Parties

#### B.3.1 JWKS Endpoints (Public Key Fetching)

| Provider | Endpoint | When | Cache | File |
|----------|----------|------|-------|------|
| Apple | `https://appleid.apple.com/auth/keys` | Social auth verification | 1h in-memory | `social_auth.py:54` |
| Google | `https://www.googleapis.com/oauth2/v3/certs` | Social auth verification | 1h in-memory | `social_auth.py:54` |

**What's sent:** HTTP GET only (no body, no auth, standard User-Agent)

#### B.3.2 Email Service (Brevo SMTP)

**File:** `app/email.py`

| Function | Recipient | Subject | Body Content | When |
|----------|-----------|---------|--------------|------|
| `send_verification_email()` | User email | "Verify your hospital affiliation" | 6-digit code + bilingual instructions | Registration/login code request |
| `send_inquiry_notification()` | `NOTIFICATION_EMAIL` (admin) | `[OWH] New Institution Inquiry from {org}` | inquiry_id, name, org, role, email, message | Public form submission |

**Configuration (from `.env`):**
```
SMTP_HOST = smtp.brevo.com (or custom)
SMTP_PORT = 587 (TLS)
SMTP_USERNAME = user
SMTP_PASSWORD = password
FROM_ADDRESS = noreply@openworkinghours.org
NOTIFICATION_EMAIL = admin@openworkinghours.org (optional)
```

**Error handling:** Exceptions logged but don't fail requests (inquiry already saved).

---

### B.4 Logging Configuration

**Logger names:**
- `app.routers.auth` — auth endpoint logs
- `app.email` — email sending logs
- `app.social_auth` — social auth provider calls
- `app.aggregation` — daily DP aggregation job

**What's logged:**
- Info: User registrations (pseudonymized as UUID), email sends, JWKS refreshes
- Warnings: Failed JWKS refresh (with fallback cache), stale cache usage
- Errors: SMTP failures, JWT decode failures, DB errors

**Sensitive data in logs:**
- ❌ Email addresses: NO (hashed on backend)
- ❌ Verification codes: NO (hashed immediately)
- ❌ JWT tokens: NO
- ❌ Plain passwords: NO (not stored)
- ⚠️ User IDs: YES (logged as UUID) — see `auth.py:181`
- ⚠️ Hospital/specialty: YES (logged for aggregation anomalies) — see `aggregation.py`

**Log output:** Stdout (docker compose captures to syslog or file)

**Retention:** Hetzner logs rotated per Docker policy (typically 7-14 days)

---

### B.5 Database Backups

**Backup Method:** Daily PostgreSQL dump to Hetzner Object Storage
**Schedule:** 4 AM UTC daily (cron job on backend server)
**Location:** Bucket `owh-backups-prod` (Germany)
**Retention:** 30 days with COMPLIANCE Object Lock (immutable)
**Command:** `pg_dump postgresql://...` → S3-compatible upload

**What's backed up:** Full PostgreSQL database including:
- Users (email_hash, profile fields)
- WorkEvents
- FinalizedUserWeeks
- VerificationRequests
- Stats tables
- Feedback reports
- Ledgers

**Deletion propagation:** User deletion + 30-day backup retention window

---

## C. END-TO-END DATA FLOWS

### C.1 Email Address

**Registration (Email-based Auth):**
1. Mobile: User enters email on WelcomeScreen
2. Mobile: `POST /verification/request { email }`
3. Backend: Hash email (SHA256), store in verification_requests table
4. Backend: `POST /brevo/smtp` — send 6-digit code to email
5. Mobile: User receives code, enters on EmailVerificationScreen
6. Mobile: `POST /verification/confirm { email, code }`
7. Backend: Validate hashed code, update verification_requests.status='confirmed'
8. Mobile: `POST /auth/register { email, hospital_id, ... }`
9. Backend: Create User row with email_hash (not plaintext email), generate JWT
10. Backend: (Async) `POST /auth/me` — frontend fetches profile including consent
11. Storage: Email_hash lives in `users.email_hash` (indexed for lookups)

**Social Auth (Apple/Google):**
1. Mobile: User taps "Continue with Apple/Google"
2. Mobile: Apple/Google SDK returns identity_token (JWT)
3. Mobile: `POST /auth/apple { identity_token }`
4. Backend: Verify token signature via JWKS, extract opaque `sub`
5. Backend: Check if (auth_provider='apple', provider_sub=sub) exists
   - Existing: Return JWT, user logs in
   - New: Return `social_registration_token` (30-min expiry, HS256)
6. Mobile: `POST /auth/social/register { social_registration_token, hospital_id, ... }`
7. Backend: Verify registration token, create User with `email_hash=NULL` (no email stored)

**Data portability (GDPR Art. 20):**
1. Mobile: Authenticated user taps "Export My Data"
2. Mobile: `GET /auth/me/export`
3. Backend: Return `{ exported_at, profile: { user_id, hospital_id, specialty, role_level, state_code, created_at, consent_versions }, work_events: [...] }`
4. Mobile: User shares JSON via Share sheet (not persisted locally)

**Data deletion (GDPR Art. 17):**
1. Mobile: Authenticated user taps "Delete Account"
2. Mobile: `DELETE /auth/me`
3. Backend:
   - Query User by user_id
   - Delete FeedbackReports where user_id
   - Delete VerificationRequests where email_hash (if present)
   - Delete User (cascades: WorkEvents, FinalizedUserWeeks)
4. Database: User deleted; email_hash gone; work_events cascade deleted
5. Backups: Data removed within 30-day backup rotation

---

### C.2 Location Data (Work Location Coordinates)

**Mobile Capture:**
1. User enters location name on SetupScreen (e.g., "Charité Berlin")
2. GeocodingService calls `https://photon.komoot.io/api/?q=Charité Berlin&lang=de&lat=52.52&lon=13.40`
3. Photon returns array of results with lat/lon
4. User selects result; lat/lon stored in SQLite `tracking_records`

**Storage (Mobile):**
- SQLite `tracking_records`: `latitude`, `longitude` (GPS reading at clock-out validation)
- Not sent to backend unless clock-in/out confirmed
- Deleted on app uninstall (SQLite ephemeral)

**Transmission to Backend:**
- Clock-in/out events do **NOT** include coordinates
- Backend receives only: `date`, `planned_hours`, `actual_hours`, `source` (geofence/manual/mixed)
- Coordinates never leave mobile device

**Geofencing Background:**
- Geofence region (lat, lon, radius) stored locally in `GeofenceService.registeredGeofences` (memory)
- Coordinates compared against user's GPS reading (accuracy checked)
- If outside geofence radius, clock-in silently ignored (prevent phantom)

**Aggregation:**
- Backend aggregates work_events by `state_code`, `specialty` (from finalized_user_weeks)
- Individual user location never exposed in stats
- K-anonymity rule: ≥5 users + dominance ≤30% per state/specialty cell

**Bug Reports:**
- User can tap "Report Issue" → collects last 100 geofence events including location names
- `locations_details: [{ name, latitude, longitude }]` in feedback payload
- Sent to backend for debugging (optional)

---

### C.3 Hospital Affiliation

**Captured At:**
1. Registration: User selects hospital from dropdown (taxonomy lookup via `/taxonomy/professions`)
2. Stored in `users.hospital_id` (VARCHAR 255) — opaque identifier
3. Also stored: `specialty`, `role_level`, `profession`, `seniority`, `department_group`, `specialization_code`, `hospital_ref_id`

**Transmission:**
- Sent on `/auth/register { hospital_id, specialty, ... }`
- Sent on `/work-events` POST (only date, hours, source — not hospital)
- Sent on `/finalized-weeks` POST (only week dates, hours — hospital snapshot stored on finalization)

**Storage:**
- `users.hospital_id` — indexed, used for queries
- `finalized_user_weeks.hospital_id` — snapshot at finalization time
- `feedback_reports.hospital_id` — optional in bug reports

**Aggregation:**
- Grouped by `state_code` + `specialty` (not hospital)
- Hospital details used for onboarding UX only
- Not exposed in public stats

**Deletion:**
- User deletion cascades to `work_events`, `finalized_user_weeks`
- Hospital affiliation removed with user record
- Aggregates (stats_by_state_specialty) retain anonymized data

---

### C.4 Work Events (Tracked Sessions)

**Capture (Mobile):**
1. Geofence enter → app calls `Location.startGeofencingAsync()`
2. Geofence event fires (background task)
3. App fetches GPS reading for validation
4. Distance check: `|GPS location - geofence center| > radius` → reject (false alarm)
5. If valid: create TrackingRecord in SQLite with `{ date, start_time, duration=0, state='active' }`
6. UI shows "clocked in" badge
7. User at work; app tracks time
8. Geofence exit detected
9. App enters "pending exit" state (5-min hysteresis)
10. After 5 min: update TrackingRecord with `{ state='completed', clockOut, duration=(clockOut-clockIn) }`

**Submission (Mobile):**
1. End of week: user reviews shifts/absences on Calendar
2. User taps "Finalize Week" button
3. App sums planned + actual hours for all 7 days
4. App calls `POST /finalized-weeks { week_start, planned_hours, actual_hours }`
5. Backend creates FinalizedUserWeek record (immutable snapshot)
6. Backend aggregation job runs nightly: groups by state/specialty, applies DP noise

**Storage (Backend):**
- `work_events`: one row per confirmed day per user (date, planned_hours, actual_hours, source)
- `finalized_user_weeks`: one row per week per user (week_start, planned_hours, actual_hours + profile snapshot)
- Indexed by `user_id`, `date`

**Privacy Protection:**
- SQL-level clipping: `planned_hours <= 80`, `actual_hours <= 120` per week
- Laplace noise added only at aggregation time (not stored raw)
- K-anonymity: ≥5 users per state/specialty + dominance ≤30%
- Publication policy: warming_up (2 weeks) → published → cooling_down (2 weeks) → suppressed
- Confidence intervals (90%): `planned_ci_half`, `actual_ci_half` published with stats

**Data Rights:**
- User can export via `GET /auth/me/export` → returns all work_events as JSON
- User can modify via `PATCH /work-events/{id} { planned_hours, actual_hours }`
- User can delete via `DELETE /work-events/{id}`
- Week finalization is immutable (cannot edit finalized_user_weeks directly)
- User deletion cascades to all work_events + finalized_user_weeks (but not stats tables)

---

### C.5 Identifiers

| Identifier | Format | Where It Lives | Exposed | Notes |
|------------|--------|-----------------|---------|-------|
| **user_id** | UUID | users.user_id, JWT `sub` claim, logs | ✅ Backend logs, JWT | Pseudonymous; not linked to plaintext email |
| **email_hash** | SHA256 (hex) | users.email_hash, verification_requests | ✅ Backend DB index | Salted or not? (check code) |
| **provider_sub** | Opaque string | users.provider_sub (for Apple/Google) | ❌ Stored, not exposed | Apple/Google ID unique per user per app |
| **event_id** | UUID | work_events.event_id | ❌ Not public | Work event primary key |
| **finalized_week_id** | UUID | finalized_user_weeks | ❌ Not public | Week snapshot ID |
| **report_id** | UUID | feedback_reports.report_id | ❌ Not public | Bug report ID |
| **IP Address** | Dotted quad | Hetzner access logs (not app DB) | ❌ Backend infrastructure logs | Not collected by app code |
| **Device ID / IDFA** | — | Not collected | ❌ | Deliberately excluded |
| **Advertising ID** | — | Not collected | ❌ | Deliberately excluded |

**JWT Claims:**
```json
{
  "sub": "user_id (UUID)",
  "iat": "issued_at (unix timestamp)",
  "exp": "expires_at (unix timestamp)"
}
```
30-day expiry. Bearer token sent in Authorization header for authenticated requests.

---

## D. SURPRISES & RED FLAGS

### D.1 Location Data Sent to Geocoding Service

**Finding:** Photon API calls include optional proximity bias.
**File:** `mobile-app/src/modules/geofencing/services/GeocodingService.ts:113`
**Code:**
```typescript
if (options?.proximity) {
  url += `&lat=${options.proximity.latitude}&lon=${options.proximity.longitude}`;
  url += `&location_bias_scale=0.6`;
}
```
**Impact:** User's current GPS location may be sent to Photon (Komoot) during location search on SetupScreen. Photon is Germany-based and OSM-powered (privacy-friendly), but sending coordinates to third-party geocoding service is a data flow that should be disclosed.
**Mitigation:** Proximity is optional (only if user allows); moderate bias scale (0.6); no user ID attached.

---

### D.2 Device Model Name in Bug Reports

**Finding:** Device hardware model exposed in feedback reports.
**File:** `mobile-app/src/lib/utils/reportIssue.ts:129`
**Code:**
```typescript
deviceModel: Device.modelName,  // e.g. "iPhone 15 Pro", "Samsung Galaxy A14"
```
**Impact:** Device fingerprinting data sent to backend in optional bug reports. Combined with app version + OS version, could re-identify user. However, reports are user-initiated (not automatic telemetry), and data is stored for debugging only.

---

### D.3 Feedback Reports Not Deleted on User Deletion

**Finding:** FeedbackReports have no foreign key to users; manual DELETE in code.
**File:** `backend/app/routers/auth.py:466`
**Code:**
```python
db.query(FeedbackReport).filter(
    FeedbackReport.user_id == user_id_str
).delete(synchronize_session=False)
```
**Impact:** If the manual DELETE fails (e.g., DB error not caught), feedback reports with user context (email, hospital_id, specialty) could persist after user deletion, violating Art. 17. Mitigation: delete is synchronous; errors bubble up (transaction fails). But no foreign key constraint prevents race conditions if same report ID is queried later.

---

### D.4 GPS Accuracy Information Persisted in Feedback

**Finding:** Mobile app logs GPS accuracy metrics (min/max/avg/count) and sends them in bug reports.
**File:** `mobile-app/src/lib/utils/reportIssue.ts:69-76`
**Code:**
```typescript
const accuracyStats = {
  min: accuracyValues.length > 0 ? Math.min(...accuracyValues) : 0,
  max: accuracyValues.length > 0 ? Math.max(...accuracyValues) : 0,
  avg: accuracyValues.length > 0 ? ... / accuracyValues.length : 0,
  count: accuracyValues.length,
};
```
**Impact:** Accuracy statistics (in meters) + location names + event types (enter/exit) in recent_events array sent to backend. Last 100 geofence events stored in feedback. If user reports a bug while at a specific location, exact timing + accuracy of presence may be inferred.
**Mitigation:** Bug reports are user-initiated; not automatic telemetry. Data labeled as "parameter tuning" (legitimate DP research purpose).

---

### D.5 Email Hash Hashing Strategy Unclear

**Finding:** Code references `hash_email()` but salt/algorithm not visible in read scope.
**File:** `backend/app/security.py` (not fully read)
**Impact:** Without salt, email hashes are precomputable via rainbow tables (all gmail.com addresses hashable offline). SHA256 unsalted is insufficient for PII.
**Evidence:** Code references `hash_email(email)` in `auth.py:72`, `auth.py:160`, `finalized_weeks.py`, but implementation not exposed.

---

### D.6 Social Auth Discards Email Intentionally (Good, But Confirms Privacy Design)

**Finding:** Google/Apple provide email in token; backend explicitly discards it.
**File:** `backend/app/routers/auth.py` (social auth section)
**Code:**
```python
# Provider email is intentionally discarded (privacy consistency)
# email_hash is nullable for social users
```
**Impact:** Social users have `email_hash = NULL`. Email is not stored. This is privacy-preserving but means social users cannot use email-based password recovery (they must re-authenticate via Apple/Google). Documented in code; intentional design choice.

---

### D.7 Rate Limiting on Auth Endpoints Is In-Memory

**Finding:** Rate limiter uses in-memory store; does not persist across server restarts.
**File:** `backend/app/rate_limit.py`
**Code:** Likely uses a dict or similar in-process structure.
**Impact:** Brute-force protection resets if backend container restarts. In Kubernetes/Docker Compose with auto-restart, vulnerable during rollouts. Mitigated by: (1) code hash (not plaintext), (2) 5 req/60s threshold is tight, (3) Hetzner WAF likely has additional DDoS protection.

---

### D.8 VerificationRequests Email Domain Index (De-anonymization Risk)

**Finding:** `verification_requests.email_domain` is indexed separately from email_hash.
**File:** `backend/app/models.py:27`
**Code:**
```python
email_domain = Column(String(255), index=True, nullable=False)
```
**Impact:** Backend can query by domain (e.g., "example.com" users). Combined with other metadata (specialty, state), could enable domain-based re-identification or attack targeting specific organizations. Email domain is technically not PII (publicly known), but indexed separately it enables privacy leaks.
**Mitigation:** Domain index is operational (probably for allowed domain checks); removing it would break features. Risk is low if admin access is controlled.

---

### D.9 Aggregation Job Anomaly Logging May Expose Privacy Spend Patterns

**Finding:** `aggregation.py` logs anomalies when adaptive epsilon is < 50% of expected.
**File:** `backend/app/aggregation.py` (referenced in CLAUDE.md line 279)
**Code:** Inferred: `logger.warning("Anomaly: epsilon spend for state=X specialty=Y low")`
**Impact:** Logs may leak that certain state/specialty cells have low contributing users or high privacy budget burn. Over time, pattern analysis of logs could infer which groups have few contributors.
**Mitigation:** Logs are server-side only; not exposed publicly. Admin access required. Anomalies are aggregate-level (not per-user).

---

### D.10 Feedback Reports Queryable by User ID (String, Not UUID)

**Finding:** `feedback_reports.user_id` stored as VARCHAR(255) (string), not UUID FK.
**File:** `backend/app/models.py` (FeedbackReport schema)
**Impact:** User ID in feedback is a string copy, not a foreign key reference. If user ID format changes or is ambiguous, feedback may be orphaned or misattributed. Also enables direct SQL queries matching user_id strings (user_id stored as string in feedback, and as UUID in User table; conversion needed).

---

## E. SUMMARY

### E.1 Data Layers

1. **Mobile Local (SQLite + SecureStore):** Shifts, absences, tracking records, JWT token — encrypted or app-local
2. **Mobile Network:** Coordinates sent to Photon (geocoding); everything else to own backend
3. **Backend Operational (PostgreSQL):** Users (email_hash), work_events, finalized_weeks — GDPR applies
4. **Backend Analytics:** K-anonymous stats tables — aggregates with DP noise — retained after user deletion
5. **Backups:** 30-day immutable rotation; user deletion propagates within window

### E.2 Key Privacy Features

- **K-anonymity:** ≥5 users + dominance ≤30% per state/specialty cell
- **Differential Privacy:** Laplace noise (ε=1.0/week, annual cap=150), SQL-level clipping, 90% CIs
- **Pseudonymization:** User IDs are UUIDs; email hashed; social auth discards email entirely
- **Data Residency:** Hetzner, Germany only
- **Cascading Deletion:** User deletion removes work_events, finalized_weeks; feedback requires manual cleanup
- **GDPR Rights:** `/auth/me/export` (Art. 20), `/auth/me/privacy-budget` (Art. 15), `DELETE /auth/me` (Art. 17)

### E.3 Identified Gaps vs. Best Practice

1. Email hash salting strategy not visible (risk: rainbow tables)
2. Feedback reports not FK-constrained to users (risk: orphans after deletion)
3. Rate limiting in-memory only (risk: reset on deploy)
4. Email domain indexed separately (low risk, but queryable by domain)
5. GPS accuracy stats + location names in feedback (user-initiated; acceptable for debugging)

---

## Appendix: File References

**Mobile App Key Files:**
- `mobile-app/app.json` — Config, permissions, social auth IDs
- `mobile-app/src/lib/auth/AuthStorage.ts` — SecureStore (JWT, user)
- `mobile-app/src/modules/calendar/services/CalendarStorage.ts` — SQLite schema
- `mobile-app/src/modules/geofencing/services/GeocodingService.ts` — Photon API
- `mobile-app/src/modules/geofencing/services/GeofenceService.ts` — Geofencing logic
- `mobile-app/src/modules/auth/services/AuthService.ts` — Auth endpoints
- `mobile-app/src/lib/utils/reportIssue.ts` — Feedback collection

**Backend Key Files:**
- `backend/app/models.py` — Database schema (tables, columns, constraints)
- `backend/app/routers/auth.py` — Auth endpoints, user deletion
- `backend/app/routers/work_events.py` — Work event CRUD
- `backend/app/routers/finalized_weeks.py` — Week finalization
- `backend/app/routers/stats.py` — Public aggregates
- `backend/app/email.py` — Email sending (Brevo SMTP)
- `backend/app/social_auth.py` — Apple/Google JWKS verification
- `backend/app/aggregation.py` — DP aggregation job
- `backend/alembic/versions/` — Database migrations

**Deployment:**
- `backend/docker-compose.yml` — Production setup (Hetzner)
- `docs/deployment.md` — Deployment procedures, backups (30-day window)
