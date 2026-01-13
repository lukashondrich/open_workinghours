# Open Working Hours - System Blueprint

**Last Updated:** 2026-01-07

---

## Purpose

This document provides a high-level architectural overview of the Open Working Hours platform. For detailed implementation information, see the module-specific documentation linked below.

---

## System Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Mobile App    │ HTTPS │    Backend      │       │    Website      │
│   (Expo/RN)     │──────▶│   (FastAPI)     │       │    (Astro)      │
│                 │       │                 │       │                 │
│ • Geofencing    │       │ • Auth (JWT)    │       │ • Project info  │
│ • Calendar      │       │ • Work events   │       │ • Privacy docs  │
│ • Submissions   │       │ • K-anonymity   │       │ • Bilingual     │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
     SQLite                   PostgreSQL                  Static
    (on-device)               (Hetzner/DE)               (Vercel)
```

---

## Components

| Component | Purpose | Status | Documentation |
|-----------|---------|--------|---------------|
| **Mobile App** | iOS app for healthcare workers to track hours | Production (TestFlight) | [`mobile-app/ARCHITECTURE.md`](mobile-app/ARCHITECTURE.md) |
| **Backend** | FastAPI server with auth, storage, aggregation | Production (Hetzner) | [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) |
| **Website** | Astro dossier site for outreach | Live | [`website/README.md`](website/README.md) |
| **Next.js Dashboard** | Web analytics dashboard | Deprecated | — |

---

## Mobile App Modules

The mobile app is organized into feature modules:

### Module 1: Geofencing & Tracking
Automatic clock-in/out via GPS geofencing with manual fallback.
- Background location tracking with `expo-location`
- 5-minute exit hysteresis to prevent false clock-outs
- Sessions < 5 min filtered as noise

### Module 2: Authentication & Submission
Email-based passwordless auth with daily data submission.
- 6-digit verification codes via Brevo SMTP
- JWT tokens (30-day expiry)
- Daily submissions to backend (past dates only)

### Calendar Module
Shift planning with reusable templates.
- Pinch-to-zoom with focal point
- Double-tap to place shifts
- Overlap detection
- Absence tracking (vacation, sick days)

### Status Dashboard
14-day rolling overview of hours worked vs planned.

**Full details:** [`mobile-app/ARCHITECTURE.md`](mobile-app/ARCHITECTURE.md)

---

## Backend Architecture

### Two-Layer Privacy Design

1. **Operational Layer** (pseudonymous)
   - `users` table with hashed email
   - `work_events` table with daily submissions
   - GDPR applies (right to erasure)

2. **Analytics Layer** (anonymous)
   - `stats_*` tables with k-anonymous aggregates
   - Laplace noise applied (ε=1.0)
   - Retained after user deletion

### Key Endpoints
- `POST /auth/request-code` - Email verification
- `POST /auth/verify` - Get JWT token
- `POST /work-events` - Submit daily work event
- `GET /stats/by-state-specialty` - K-anonymous stats
- `GET /admin` - Admin dashboard

**Full details:** [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md)

---

## Website

Static Astro site for outreach to unions and professional associations.

### Pages
| Route | Purpose |
|-------|---------|
| `/` | Project Dossier |
| `/product` | App demo & screenshots |
| `/privacy` | Privacy principles |
| `/team` | Founder & advisors |
| `/de/*` | German translations |

**Full details:** [`website/README.md`](website/README.md)

---

## Privacy Architecture

See [`privacy_architecture.md`](privacy_architecture.md) for full privacy design.

**Key principles:**
- Local-first: GPS coordinates never leave device
- K-anonymity: Groups need ≥11 users to publish (EMA/Health Canada standard)
- Differential privacy: Laplace noise (ε=1.0) on aggregates
- Data residency: EU only (Hetzner, Germany)
- Right to erasure: User deletion cascades to work_events

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`CLAUDE.md`](CLAUDE.md) | Entry point for AI assistants |
| [`privacy_architecture.md`](privacy_architecture.md) | GDPR compliance design |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment |
| [`docs/debugging.md`](docs/debugging.md) | Debugging guide |
| [`docs/DOCUMENTATION_STRUCTURE.md`](docs/DOCUMENTATION_STRUCTURE.md) | Doc organization |
