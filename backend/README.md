# Open Working Hours - Backend API

**Framework:** FastAPI (Python 3.11+)
**Database:** PostgreSQL
**Status:** Serves web dashboard, will be extended for mobile app
**Deployment:** Local dev → Hetzner (Germany) for production

---

## Architecture Overview

This is a **unified backend** serving **two clients** with different data models:

```
┌─────────────────────┐         ┌──────────────────┐
│  Next.js Web        │  HTTPS  │                  │
│  Dashboard          │◄───────►│                  │
│  (Vercel)           │         │   FastAPI        │
│                     │         │   Backend        │
│  - Daily reports    │         │   (PostgreSQL)   │
│  - Raw hours        │         │                  │
└─────────────────────┘         │                  │
                                │                  │
┌─────────────────────┐         │                  │
│  React Native       │  HTTPS  │                  │
│  Mobile App         │◄───────►│                  │
│                     │         │                  │
│  - Weekly reports   │         │                  │
│  - Noisy hours      │         │                  │
│  - Privacy (ε=1.0)  │         │                  │
└─────────────────────┘         └──────────────────┘
```

### Why Unified?

- ✅ **Single codebase** (simpler for solo developer)
- ✅ **Shared endpoints** (email verification, analytics)
- ✅ **Single deployment** (one server, one database)
- ✅ **Shared authentication** (JWT tokens)

---

## Current Endpoints (Web Dashboard)

### 1. Email Verification (`/verification`)

**POST /verification/request**
```python
Input:  { "email": "doctor@hospital-muenchen.de" }
Action: Sends 6-digit verification code via email
TTL:    15 minutes
```

**POST /verification/confirm**
```python
Input:  { "code": "123456" }
Output: { "affiliation_token": "eyJ...", "expires_at": "2025-02-18T..." }
Token:  JWT containing hospital_domain
```

**Used by:** ✅ Web dashboard, ✅ Mobile app (shared)

---

### 2. Daily Reports (`/reports`)

**POST /reports/**
```python
Input: {
  "shift_date": "2025-01-18",
  "actual_hours_worked": 8.5,
  "overtime_hours": 0.5,
  "staff_group": "group_a",
  "notes": "Busy ER shift"
}
Headers: { "Authorization": "Bearer <affiliation_token>" }
```

**Schema:**
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  hospital_domain VARCHAR(255) NOT NULL,    -- from JWT
  staff_group VARCHAR(32) NOT NULL,         -- group_a, group_b, group_c
  shift_date DATE NOT NULL,                 -- DAILY (not weekly)
  actual_hours_worked NUMERIC(5,2) NOT NULL, -- TRUE value (no privacy)
  overtime_hours NUMERIC(5,2) NOT NULL,
  notes TEXT,                                -- PII-scrubbed
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Used by:** ✅ Web dashboard only
**Privacy:** ❌ None (raw hours stored)

---

### 3. Analytics (`/analytics`)

**GET /analytics**
```python
Query params:
  - months: int (default 6, max 36)
  - staff_group: enum (group_a, group_b, group_c) [optional]

Output: {
  "hospital_monthly": [...],
  "staff_group_monthly": [...]
}
```

**Features:**
- N < 5 suppression (privacy protection)
- Bootstrap confidence intervals
- Laplace noise (scale=0.05h)

**Used by:** ✅ Web dashboard, ✅ Mobile app (shared)

---

## Mobile Endpoints (Module 2)

### 1. Weekly Submissions (`/submissions/weekly`)

**POST /submissions/weekly**
```python
Input: {
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "planned_hours": 42.5,   # noisy value produced on-device
  "actual_hours": 40.1,    # noisy value produced on-device
  "client_version": "1.0.0"
}
Output: { "id": "uuid", "received_at": "2025-01-20T18:21:00Z" }
```

**Schema:**
```sql
CREATE TABLE weekly_submissions (
  id UUID PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  planned_hours NUMERIC(6,2) NOT NULL,
  actual_hours NUMERIC(6,2) NOT NULL,
  client_version VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**GET /submissions/weekly?limit=10**

Returns the latest submissions for local verification—handy when testing the Expo queue locally.

---

## Data Models Comparison

| Aspect | Web Dashboard | Mobile App |
|--------|--------------|------------|
| **Table** | `reports` | `weekly_submissions` |
| **Granularity** | Daily shifts | Weekly totals |
| **Privacy** | None (raw hours) | Differential privacy (ε=1.0) |
| **Data Type** | True values | Noisy values (Laplace noise) |
| **User Model** | Implicit (token only) | No auth (MVP), future `users` table |
| **Notes** | Accepts notes (PII-scrubbed) | No notes (privacy) |
| **Validation** | Any date | Week start/end pair |

**Both tables coexist** in the same PostgreSQL database.

---

## Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- pip or poetry

### Installation

```bash
cd backend

# Install dependencies
pip install -r requirements.txt
# or
poetry install

# Set up environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Run database migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### Environment Variables

```bash
# .env
# Defaults to local SQLite (dev.db) if not set:
DATABASE__URL=sqlite:///./dev.db
# To use PostgreSQL instead:
# DATABASE__URL=postgresql://user:password@localhost:5432/workinghours_db
JWT_SECRET_KEY=your-secret-key-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## API Documentation

**OpenAPI/Swagger docs:** http://localhost:8000/docs
**ReDoc:** http://localhost:8000/redoc

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, CORS, routers
│   ├── config.py               # Environment variables
│   ├── database.py             # SQLAlchemy setup
│   ├── security.py             # JWT, hashing
│   ├── dependencies.py         # Auth dependencies
│   ├── models.py               # SQLAlchemy models
│   │   ├── VerificationRequest  # ✅ Exists
│   │   ├── Report               # ✅ Exists (web)
│   │   ├── User                 # ❌ TODO (mobile)
│   │   └── SubmittedReport      # ❌ TODO (mobile)
│   ├── schemas.py              # Pydantic schemas
│   ├── routers/
│   │   ├── verification.py      # ✅ Shared (web + mobile)
│   │   ├── reports.py           # ✅ Web only (daily)
│   │   ├── submissions.py       # ❌ TODO (mobile weekly)
│   │   └── analytics.py         # ✅ Shared (web + mobile)
│   ├── email.py                # Email sending
│   ├── pii.py                  # PII scrubbing
│   └── utils.py                # Helpers
├── alembic/                    # Database migrations
│   ├── versions/
│   └── env.py
├── pyproject.toml              # Dependencies
├── .env.example                # Environment template
└── README.md                   # This file
```

---

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_verification.py
```

---

## Deployment (Hetzner, Germany)

**Target:** EU-hosted for GDPR compliance

### Setup

1. **Provision server** (Hetzner Cloud, Nuremberg/Falkenstein)
   - Ubuntu 22.04 LTS
   - 2 vCPU, 4GB RAM

2. **Install dependencies**
   ```bash
   apt update && apt upgrade -y
   apt install python3.11 python3-pip postgresql-15 nginx certbot -y
   ```

3. **Configure PostgreSQL**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE workinghours_db;
   CREATE USER workinghours_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE workinghours_db TO workinghours_user;
   ```

4. **Deploy backend**
   ```bash
   cd /opt
   git clone https://github.com/yourusername/open_workinghours.git
   cd open_workinghours/backend
   pip install -r requirements.txt

   # Run with systemd
   systemctl enable workinghours-backend
   systemctl start workinghours-backend
   ```

5. **Nginx reverse proxy**
   ```nginx
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

---

## Migration Plan (Module 4)

**When:** ~8-10 weeks from now (after Module 1-3 complete)

### Steps

1. **Create `users` table**
   ```bash
   alembic revision -m "Add users table for mobile"
   # Edit migration file
   alembic upgrade head
   ```

2. **Create `submitted_reports` table**
   ```bash
   alembic revision -m "Add submitted_reports table for mobile"
   # Edit migration file
   alembic upgrade head
   ```

3. **Create `submissions.py` router**
   ```python
   # app/routers/submissions.py
   @router.post("/weekly")
   async def submit_weekly_report(...):
       # Validate noisy data
       # Store in submitted_reports
       pass
   ```

4. **Update `main.py`**
   ```python
   from .routers import verification, reports, submissions, analytics

   app.include_router(verification.router)
   app.include_router(reports.router)
   app.include_router(submissions.router)  # NEW
   app.include_router(analytics.router)
   ```

5. **Test both endpoints coexist**
   - Web: `POST /reports/` (daily, raw)
   - Mobile: `POST /submissions/weekly` (weekly, noisy)

---

## Security

- ✅ JWT authentication (30-day expiry)
- ✅ Email hashing (SHA256)
- ✅ Code hashing (SHA256)
- ✅ PII scrubbing in notes
- ✅ HTTPS only (production)
- ✅ Rate limiting (3 req/min verification requests)
- ✅ CORS (restricted origins)

---

## GDPR Compliance

- ✅ **Data minimization:** Only store necessary data
- ✅ **EU hosting:** Hetzner (Germany)
- ✅ **Privacy by design:** Differential privacy on mobile
- ✅ **Right to erasure:** User deletion cascades to reports
- ✅ **Data portability:** Export endpoints planned
- ✅ **Encryption:** HTTPS in transit, PostgreSQL at rest

---

## References

- **TODO.md** - Implementation plan (Module 4 for mobile endpoints)
- **blueprint.md** - System architecture
- **claude.md** - Development context

---

**Last Updated:** 2025-01-18
**Status:** Production (web), development (mobile endpoints)
**Next:** Module 4 (~8-10 weeks) - Add mobile endpoints
