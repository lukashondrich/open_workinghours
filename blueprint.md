# Open Working Hours - System Blueprint

**Last Updated:** 2026-02-09

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
| **Mobile App** | iOS + Android app for healthcare workers to track hours | Production (TestFlight) + Android internal testing | [`mobile-app/ARCHITECTURE.md`](mobile-app/ARCHITECTURE.md) |
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
- Exit verification: scheduled GPS checks at 1, 3, 5 min with confidence-based distance logic
- Active GPS fetch for accuracy data when geofence events lack it
- Event debouncing (10s cooldown) to prevent rapid oscillation
- Immediate clock-out for high-confidence exits (accuracy <50m)
- Sessions < 5 min filtered as noise

### Module 2: Authentication & Submission
Email-based passwordless auth with daily data submission.
- 6-digit verification codes via Brevo SMTP
- JWT tokens (30-day expiry)
- Daily submissions to backend (past dates only)
- Biometric unlock (Face ID/Touch ID) with Lock Screen (N26 pattern)
- WelcomeScreen with Log In / Create Account split (streamlined returning user flow)

### Calendar Module
Shift planning with reusable templates and unified picker UI.
- Pinch-to-zoom with focal point
- Unified InlinePicker (centered modal) for shifts, absences, and manual GPS hours
- Double-tap to place armed shifts/absences
- Overlap detection
- Absence tracking (vacation, sick days)
- Manual session creation for GPS failure fallback
- Month view with summary footer (tracked/planned hours, overtime, absence counts)
- Progressive disclosure at 4 zoom levels

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

### Database Backups
- Automated PostgreSQL backups to Hetzner Object Storage (daily, 4 AM UTC)
- 30-day immutable retention (COMPLIANCE mode Object Lock)
- Satisfies IT insurance requirements

---

## E2E Testing Infrastructure

Cross-platform E2E testing using Appium with XCUITest (iOS) and UiAutomator2 (Android).
- 48+ tests across auth, calendar, geofencing, shifts, absences, manual sessions
- TEST_MODE system: mock auth, mock geocoding, skip animations
- Local builds required (Xcode for iOS, EAS for Android)
- All overlays use `Animated.View` (not `Modal`) for accessibility tree visibility

**Full details:** [`mobile-app/e2e/README.md`](mobile-app/e2e/README.md), [`docs/E2E_TESTING_PLAN.md`](docs/E2E_TESTING_PLAN.md)

---

## Architectural Constraints

| Constraint | Reason |
|------------|--------|
| No `<Modal>` for overlays | Invisible to XCUITest/Appium — use inline `Animated.View` with `pointerEvents` |
| No `react-native-reanimated` | Crashes with Expo SDK 51 |
| No `accessibilityRole="menu"` on containers | Causes XCUITest to aggregate children |
| Platform-specific gesture handling | Android lacks iOS native gesture coordination for RNGH + ScrollView |

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
| [`docs/WORKFLOW_PATTERNS.md`](docs/WORKFLOW_PATTERNS.md) | How to structure work, use subagents |
| [`docs/E2E_TESTING_PLAN.md`](docs/E2E_TESTING_PLAN.md) | E2E testing history, known issues |
