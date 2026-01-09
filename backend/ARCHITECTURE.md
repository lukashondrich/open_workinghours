# Backend Architecture

**Last Updated:** 2026-01-07
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
│   │
│   ├── routers/
│   │   ├── auth.py          # /auth/* endpoints
│   │   ├── work_events.py   # /work-events/* endpoints
│   │   ├── stats.py         # /stats/* endpoints
│   │   ├── feedback.py      # /feedback endpoint
│   │   └── admin.py         # /admin/* endpoints
│   │
│   └── services/
│       ├── email.py         # Email sending
│       ├── aggregation.py   # K-anonymity aggregation
│       └── privacy.py       # Laplace noise
│
├── tests/                   # pytest tests
├── alembic/                 # Database migrations
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
| POST | `/auth/consent` | Update GDPR consent (for policy updates) |

**GDPR Consent:**
- Registration accepts `terms_version`, `privacy_version` fields
- `/auth/me` returns `terms_accepted_version`, `privacy_accepted_version`, `consent_accepted_at`
- `/auth/consent` allows existing users to re-consent after policy updates

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
| GET | `/stats/by-state-specialty` | Aggregated hours by state/specialty |
| GET | `/stats/summary` | Overall platform summary |

**Privacy:**
- K-anonymity: Only groups with ≥10 users published
- Laplace noise (ε=1.0) added to aggregates

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

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users (pseudonymous)
users (
  id UUID PRIMARY KEY,
  email_hash TEXT UNIQUE,      -- SHA-256 of email
  hospital_id TEXT,
  specialty TEXT,
  role_level TEXT,             -- "Assistenzarzt", "Facharzt", etc.
  state_code TEXT,             -- German state code
  created_at TIMESTAMP,
  -- GDPR consent tracking
  terms_accepted_version TEXT,    -- e.g., "2026-01"
  privacy_accepted_version TEXT,  -- e.g., "2026-01"
  consent_accepted_at TIMESTAMP
)

-- Work events (daily submissions)
work_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE,
  planned_minutes INTEGER,
  actual_minutes INTEGER,
  created_at TIMESTAMP,
  UNIQUE (user_id, date)
)

-- Verification codes (temporary)
verification_codes (
  id UUID PRIMARY KEY,
  email_hash TEXT,
  code TEXT,                   -- 6-digit code
  expires_at TIMESTAMP,
  used BOOLEAN DEFAULT FALSE
)

-- Aggregated stats (k-anonymous)
stats_by_state_specialty (
  id UUID PRIMARY KEY,
  period TEXT,                 -- "2026-01"
  state_code TEXT,
  specialty TEXT,
  n_users INTEGER,
  avg_weekly_hours FLOAT,      -- With Laplace noise
  created_at TIMESTAMP
)
```

---

## Privacy Architecture

### Two-Layer Design

1. **Operational Layer** (`users`, `work_events`)
   - Pseudonymous data (email hashed)
   - GDPR applies (right to erasure)
   - Cascading delete: user deletion removes all work_events

2. **Analytics Layer** (`stats_*` tables)
   - K-anonymous (n_users ≥ 10)
   - Laplace noise applied (ε=1.0)
   - Treated as anonymous data
   - Retained even after user deletion

### Aggregation Job

Runs daily at 3 AM UTC via cron:

```bash
# /home/deploy/run_aggregation.sh
cd /home/deploy/open_workinghours/backend
docker exec owh-backend python -m app.services.aggregation
```

**Process:**
1. Group work_events by state, specialty, period
2. Filter groups with < K_MIN (10) users
3. Calculate averages
4. Add Laplace noise (ε=1.0)
5. Store in stats tables

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

- **Unit tests** (10): Services, utilities
- **Integration tests** (29): API endpoints with test database
- **Total**: 39 tests passing

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

### Configuration Files

- `app/config.py` - Pydantic settings
- `docker-compose.yml` - Container configuration
- `alembic.ini` - Migration settings
