# Backend Architecture

**Last Updated:** 2026-03-21
**Framework:** FastAPI + PostgreSQL
**Status:** Production (Hetzner, Germany)

---

## Overview

The backend provides authentication, work event storage, and privacy-preserving aggregation for the Open Working Hours platform.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | FastAPI |
| Database | PostgreSQL (prod) / SQLite (dev) |
| ORM | SQLAlchemy |
| Validation | Pydantic |
| Auth | JWT (30-day expiry) |
| Migrations | Alembic |
| Email | Brevo SMTP |
| Hosting | Hetzner Cloud (Germany) |
| Containerization | Docker + docker-compose |

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry
│   ├── config.py            # Settings from environment
│   ├── database.py          # SQLAlchemy setup
│   ├── models.py            # Database models
│   ├── schemas.py           # Pydantic schemas
│   ├── email.py             # Email sending (Brevo SMTP)
│   ├── aggregation.py       # Privacy-preserving aggregation (adaptive ε, CIs)
│   ├── periods.py           # Period boundary helpers (weekly/biweekly/monthly)
│   ├── rate_limit.py        # In-memory rate limiting
│   │
│   ├── routers/
│   │   ├── auth.py          # /auth/* endpoints
│   │   ├── verification.py  # /verification/* endpoints
│   │   ├── work_events.py   # /work-events/* endpoints
│   │   ├── finalized_weeks.py # /finalized-weeks/* endpoints
│   │   ├── stats.py         # /stats/* endpoints
│   │   ├── feedback.py      # /feedback endpoint
│   │   ├── dashboard.py     # /dashboard/* public endpoints
│   │   └── admin.py         # /admin/* endpoints
│   │
│   └── dp_group_stats/      # Differential privacy module
│       ├── config.py        # ContributionBounds, EpsilonSplit, PeriodType, ReleasePolicyConfig
│       ├── mechanisms.py    # Laplace noise + CI half-width
│       ├── policy.py        # Publication state machine
│       └── accounting.py    # ε ledger, adaptive ε, budget monitoring queries
│
├── tests/                   # pytest tests (116 passing)
├── alembic/                 # Database migrations (10 migrations)
├── docker-compose.yml       # Production deployment
├── Dockerfile               # Backend container
└── ARCHITECTURE.md          # This file
```

---

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/request-code` | Request 6-digit verification code |
| POST | `/auth/verify` | Verify code, get JWT token |
| POST | `/auth/register` | Complete registration with profile + consent |
| GET | `/auth/me` | Get current user info (includes consent status) |
| GET | `/auth/me/export` | Export all user data (GDPR Art. 20) |
| GET | `/auth/me/privacy-budget` | Per-user ε budget summary (GDPR Art. 15) |
| DELETE | `/auth/me` | Delete account and all data (GDPR Art. 17) |
| POST | `/auth/consent` | Update GDPR consent (for policy updates) |

**GDPR Consent:**
- Registration accepts `terms_version`, `privacy_version` fields
- `/auth/me` returns `terms_accepted_version`, `privacy_accepted_version`, `consent_accepted_at`
- `/auth/consent` allows existing users to re-consent after policy updates

**GDPR Data Rights:**
- `/auth/me/export` returns JSON with profile + all work events (Art. 20 - Data Portability)
- `DELETE /auth/me` deletes user, work_events (cascade), FeedbackReports, VerificationRequest (Art. 17 - Right to Erasure)
- Demo account is protected from deletion (returns 403)

### Work Events (`/work-events`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/work-events` | Submit confirmed day |
| GET | `/work-events` | Get user's work events |
| DELETE | `/work-events/{id}` | Delete work event |

**Validation:**
- Cannot submit today or future dates
- Only past days can be confirmed

### Stats (`/stats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats/by-state-specialty` | Aggregated hours by state/specialty (with CIs) |
| GET | `/stats/by-state-specialty/latest` | Latest period stats per state/specialty |
| GET | `/stats/summary` | Overall platform summary |
| GET | `/stats/admin/privacy-budget-summary` | Admin: worst-case/avg ε spend, cap utilization |

**Privacy:**
- K-anonymity: Groups need ≥5 users (K_MIN=5) + dominance rule (≤30%)
- Differential privacy: Laplace noise (ε=1.0 total: 0.2 planned + 0.8 actual, annual cap=150)
- Adaptive ε: `min(config_ε, (cap − spent_ytd) / remaining_periods)` per period
- SQL-level clipping: planned≤80h, actual≤120h per user
- Temporal coarsening: weekly (default) / biweekly / monthly aggregation periods
- 90% confidence intervals: `planned_ci_half`, `actual_ci_half`, `overtime_ci_half`, `n_display`
- Publication policy: warming_up → published → cooling_down → suppressed

### Admin (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin` | Admin dashboard (HTML) |
| GET | `/admin/logs` | View server logs |

Requires `ADMIN_PASSWORD` authentication (HTTP Basic Auth).

**Dashboard Features:**
- Total users, work events, last 24h activity
- K-anonymous aggregated groups count
- Recent 10 work event submissions
- Auto-refresh every 30 seconds
- Mobile-friendly

**Access:** `https://api.openworkinghours.org/admin`

### Public Dashboard (`/dashboard`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/coverage` | Per-state contributor counts (public) |
| GET | `/dashboard/activity` | 30-day rolling activity stats (public) |
| POST | `/dashboard/contact` | Institution contact form (public) |

**Privacy Protections:**
- Contributor counts shown as ranges ("1-10", "11-50") not exact numbers
- Update timestamps at weekly precision (prevents timing attacks)
- Threshold: 11+ contributors before showing as "available"

**Frontend Map:**
The public dashboard uses a D3.js interactive map (self-hosted, no third-party dependencies).
See `website/src/components/InteractiveMap/` and `docs/INTERACTIVE_MAP_PLAN.md`.

**Files:**
- `app/routers/dashboard.py` - Endpoints
- `app/models.py` - `InstitutionInquiry` model

---

## Database Schema

### PostgreSQL Tables

**Operational tables:**
- `users` — pseudonymous (email hashed), GDPR consent tracking
- `work_events` — daily submissions, cascading delete with user
- `verification_requests` — email verification codes (hashed)
- `finalized_user_weeks` — materialized weekly summaries for aggregation (UNIQUE user_id + week_start)
- `feedback_reports` — user feedback
- `institution_inquiries` — public dashboard contact form

**Analytics tables:**
- `stats_by_state_specialty` — aggregated stats with DP noise, publication_status column
- `stats_by_hospital` — aggregated stats by hospital (with publication_status)
- `state_specialty_release_cells` — configured cells eligible for publication

**Privacy accounting tables:**
- `state_specialty_privacy_ledger` — per-cell ε spend per period (planned_sum_epsilon, actual_sum_epsilon)
- `user_privacy_ledger` — per-user cumulative ε exposure

**Alembic migrations:** 10 migrations from `6d8399490741` to `h8i9j0k1l2m3` (latest: period_type + CI columns).

---

## Privacy Architecture

### Two-Layer Design

1. **Operational Layer** (`users`, `work_events`, `finalized_user_weeks`)
   - Pseudonymous data (email hashed)
   - GDPR applies (right to erasure)
   - Cascading delete: user deletion removes all work_events

2. **Analytics Layer** (`stats_*` tables, `state_specialty_release_cells`)
   - K-anonymous (K_MIN=5) + dominance rule (≤30% single-user contribution)
   - Differential privacy: Laplace noise on sums, SQL-level clipping
   - Publication state machine: warming_up → published → cooling_down → suppressed
   - Treated as anonymous data, retained after user deletion

3. **Privacy Accounting** (`state_specialty_privacy_ledger`, `user_privacy_ledger`)
   - Per-cell ε tracking (planned_sum + actual_sum breakdown)
   - Per-user cumulative ε exposure
   - Enables GDPR Art. 15 transparency: "how much privacy budget was spent on your data"

### DP Group Stats Configuration

```python
# dp_group_stats/config.py defaults
ContributionBounds(planned_weekly_max=80.0, actual_weekly_max=120.0)
EpsilonSplit(planned_sum=0.2, actual_sum=0.8)  # total ε=1.0/period, annual cap=150
ReleasePolicyConfig(k_min=5, activation_weeks=2, deactivation_grace_weeks=2, dominance_threshold=0.30)
DPGroupStatsV1Config(period_type="weekly")  # also: "biweekly", "monthly"
```

### Aggregation Job

Runs daily at 3 AM UTC via cron:

```bash
# /home/deploy/run_aggregation.sh
cd /home/deploy/open_workinghours/backend
docker exec owh-backend python -m app.aggregation
```

**Process:**
1. Query finalized_user_weeks by state × specialty × period (weekly/biweekly/monthly)
   - Weekly: single week query (existing)
   - Multi-week: CTE with per-user AVG of clipped weekly values, then SUM across users
2. SQL-level clipping: each user's hours capped at contribution bounds
3. Check eligibility: K_MIN ≥ 5, dominance rule ≤ 30%
4. Apply publication state machine (activation/deactivation streaks)
5. Compute adaptive ε: `min(config_ε, (annual_cap − spent_ytd) / remaining_periods)`
6. Add Laplace noise to clipped sums (only for published/cooling_down cells)
7. Compute 90% confidence intervals: `laplace_ci_half_width(ε, sensitivity, n_users)`
8. Record ε spend in state_specialty_privacy_ledger + user_privacy_ledger
9. Store results + CIs in stats_by_state_specialty

---

## Authentication Flow

```
1. User requests code
   POST /auth/request-code { email }
   → Generate 6-digit code
   → Send via Brevo SMTP
   → Store hashed in verification_codes

2. User verifies code
   POST /auth/verify { email, code }
   → Validate code
   → Create user if new
   → Return JWT token

3. User completes registration
   POST /auth/register { hospital_id, specialty, role_level, state_code }
   → Update user profile
   → Return updated user

4. Authenticated requests
   Authorization: Bearer <jwt_token>
   → Validate token
   → Extract user_id
```

### Demo Account

For Apple App Review, a demo account bypasses email verification:
- Email: Configured in `DEMO__EMAIL`
- Code: Configured in `DEMO__CODE`

---

## Testing

### Running Tests

```bash
cd backend
source .venv/bin/activate

# Run all tests
pytest -v

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_work_events.py -v
```

### Test Structure

- **Unit tests**: DP config, Laplace noise, CI calculation, publication policy, adaptive ε, period helpers
- **Integration tests**: Auth, work events, finalized weeks, aggregation pipeline (weekly + monthly), stats API, budget endpoints, security hardening
- **Total**: 116 tests passing (SQLite), 2 xfail (PG-specific: case-insensitive email, tz-aware datetimes)

---

## Deployment

See `docs/deployment.md` for full deployment guide.

### Quick Reference

```bash
# SSH to server
ssh deploy@owh-backend-prod

# Deploy update
cd ~/open_workinghours/backend
git pull origin main
docker compose down
docker compose build --no-cache backend
docker compose up -d

# Check status
docker ps
docker logs owh-backend --tail 30
```

---

## Security (deployed 2026-03-21)

- **CORS**: Restricted to explicit origins (`CORS_ORIGINS` env var, default: `["https://openworkinghours.org"]`)
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Rate limiting**: In-memory, per-IP (login: 5/60s, register: 5/60s, feedback: 3/60s, verification: 5/60s + 10/60s)
- **Email enumeration**: Generic error messages for register/login (no "user exists" vs "bad code" distinction)
- **Verification scoping**: Confirm requires email+code pair (backwards-compatible: old apps use code-only fallback)
- **Docker**: Port bound to `127.0.0.1:8000` (not exposed to public network, Nginx reverse proxies)
- **Admin**: No shell=True in subprocess calls, XSS escaping in dashboard HTML
- **API docs**: Disabled in production (`DOCS_ENABLED=false`)

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (64 chars) |
| `EMAIL_HASH_SECRET` | Email hashing salt (64 chars) |
| `DATABASE_URL` | PostgreSQL connection string |
| `EMAIL__SMTP_USERNAME` | Brevo SMTP username |
| `EMAIL__SMTP_PASSWORD` | Brevo SMTP password |
| `ADMIN_PASSWORD` | Admin dashboard password |
| `DEMO__EMAIL` | Demo account email |
| `DEMO__CODE` | Demo account code |
| `CORS_ORIGINS` | JSON list of allowed origins |
| `DOCS_ENABLED` | Enable /docs endpoint (default: false) |

### Configuration Files

- `app/config.py` - Pydantic settings
- `docker-compose.yml` - Container configuration
- `alembic.ini` - Migration settings
