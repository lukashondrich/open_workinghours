# Claude Context: Open Working Hours

This file provides context for AI assistants (Claude) working on this project.

---

## Project Overview

**Open Working Hours** is a privacy-first platform for healthcare workers to track and report working hours transparently.

### Architecture (3 Components)

1. **Next.js Web Dashboard** (current, deployed to Vercel)
   - Public analytics and reporting
   - Calendar planning interface (already built)
   - Email verification flow
   - Location: Root of this repo

2. **React Native Mobile App** (planned, not started)
   - Primary user interface
   - Geofencing-based automatic tracking
   - Local-first data storage (SQLite + encryption)
   - Differential privacy pipeline
   - Location: `mobile-app/` directory (to be created)

3. **FastAPI Backend** (exists, will be extended)
   - Currently serves web dashboard (email verification, daily reports, analytics)
   - Will be extended for mobile app (weekly noisy submissions)
   - PostgreSQL database
   - To be deployed: EU-hosted (Hetzner, Germany)
   - Location: `backend/` directory (see backend/README.md)

---

## Key Documents

| File | Purpose |
|------|---------|
| `blueprint.md` | Complete system architecture (38KB, extremely detailed) |
| `TODO.md` | Master TODO list (Module 1 first approach, single source of truth) |
| `MODULE_1_PLAN.md` | Detailed Module 1 implementation guide with code examples |
| `backend/README.md` | Backend architecture, endpoints (web + mobile), deployment guide |
| `claude.md` | This file - context for AI assistants |

---

## Current State

### What Exists (Production, on Vercel)

✅ **Next.js Web Dashboard**
- Calendar with shift planning (drag-and-drop, templates)
- Week view and month view components
- Review mode (compare planned vs tracked)
- Email verification UI
- Analytics dashboard with Recharts
- Multi-language support (English/German via next-intl)
- Dark mode support

✅ **Tech Stack**
- Next.js 16.0.0, React 19.2.0
- TypeScript (strict mode)
- Tailwind CSS 4.1.9
- Radix UI components
- Zustand-style state management
- pnpm for package management

✅ **Backend API (for Web Dashboard)**
- FastAPI backend in `/backend` directory
- Email verification (6-digit codes via email)
- Daily report submission (raw hours)
- Analytics aggregation (with suppression)
- PostgreSQL database (local dev, Hetzner deployment planned)
- See backend/README.md for details

### What Doesn't Exist

❌ **Mobile App** - Not started yet
❌ **Mobile Backend Endpoints** - Need to extend `/backend` with weekly submissions
❌ **Privacy Pipeline** - Designed in blueprint, not coded
❌ **Geofencing** - Core feature, not started
❌ **Local Database (Mobile)** - SQLite schema designed, not implemented

---

## Deployment Protection Strategy

### Problem
- Web app is deployed to Vercel (production, advertising to collaborators)
- Mobile app development is about to start
- Need to ensure mobile work doesn't break web deployment

### Solution Implemented

**File:** `.vercelignore`
```
mobile-app/
```

**How it works:**
1. Vercel ignores the entire `mobile-app/` directory
2. Web app only rebuilds when files in `app/`, `components/`, `lib/`, etc. change
3. Mobile development can proceed without triggering deployments

**Developer context:**
- Solo developer (user is only dev)
- Won't be working on web app during mobile development
- No need for complex branch strategies or monorepo tooling
- Simple `.vercelignore` is sufficient

---

## Development Workflow

### Current (Web App Frozen)

```bash
# User is NOT editing web app right now
# Focus is on mobile app development

# When mobile app work starts:
cd /Users/user01/open_workinghours
npx create-expo-app mobile-app --template blank-typescript
cd mobile-app
# ... develop mobile app

# Commits to repo won't trigger Vercel rebuilds
git add .
git commit -m "Add mobile geofencing"
git push  # ← Vercel ignores mobile-app/ changes
```

### Future (If Web App Needs Updates)

```bash
# Edit web app files
# app/, components/, lib/, styles/
git commit -m "Update dashboard"
git push  # ← Vercel WILL rebuild and deploy
```

---

## Mobile App Development Plan

### Modular Approach (Recommended)

Instead of following the linear 11-week TODO.md plan, use **Module 1 First** approach:

**Module 1: Geofencing & Basic Tracking** (2-3 weeks)
- Proves the highest-risk assumption early
- Fully test-driven (TDD)
- Validates battery usage and reliability
- See `MODULE_1_PLAN.md` for details

**Why Module 1 First:**
- ✅ De-risks geofencing (iOS/Android behavior is unpredictable)
- ✅ Provides decision point: does auto-tracking work?
- ✅ Enables early device testing (Day 3)
- ✅ Independent of backend, calendar, privacy features
- ✅ High test coverage from day 1 (90%+ goal)

**If geofencing works → Continue with blueprint**
**If geofencing unreliable → Pivot to manual-entry-first**

### Testing Strategy

**Test Pyramid:**
```
E2E Tests (Detox)      ~10 tests
Integration Tests      ~20 tests
Unit Tests            ~60 tests
```

**Coverage Goals:**
- Services: 90%
- Hooks: 75%
- Overall: 85%+

---

## Privacy Architecture (Critical Feature)

### Differential Privacy (ε=1.0)

**Where it's applied:** ON-DEVICE before any data transmission

**Pipeline:**
```
True hours: 42.0
    ↓
Step 1: Round to 0.5h → 42.0
    ↓
Step 2: Add Laplace noise (ε=1.0, sensitivity=168)
    scale = 168 / 1.0 = 168
    noise ~ Laplace(0, 168)
    → 43.7
    ↓
Noisy value: 43.7 (sent to backend)
```

**Key principle:** Backend NEVER sees true values

### Data Minimization

| Data | Storage Location | Encryption | Transmitted? |
|------|-----------------|------------|--------------|
| GPS coordinates | Device only | SQLCipher | ❌ Never |
| Daily shift times | Device only | SQLCipher | ❌ Never |
| Shift templates | Device only | SQLCipher | ❌ Never |
| Weekly hours (noisy) | Backend | TLS in transit | ✅ Yes (noisy) |
| Email | Backend | SHA256 hash | ✅ Yes (hashed) |

---

## Key Design Decisions

### 1. Local-First Architecture
- All raw data stays on device
- Only noisy aggregates transmitted
- Backend is "untrusted" by design

### 2. Geofencing Strategy
- Primary UI: Background automatic tracking
- Fallback: Manual clock-in/out buttons
- 5-minute exit hysteresis (prevents false clock-outs)

### 3. Weekly Aggregation
- Hides daily work patterns
- Aligns with payroll cycles
- Reduces privacy leakage

### 4. Backend Minimalism
- Only stores: email hash, noisy weekly totals
- No GPS, no daily data, no templates
- Reduces attack surface

### 5. GDPR Compliance
- Privacy by design (Article 25)
- Data minimization
- User control (explicit submission)
- Right to erasure
- EU hosting (Hetzner, Germany)

---

## Technical Concerns & Decisions Made

### 1. Geofencing Reliability (UNKNOWN)

**Concerns:**
- iOS increasingly restrictive on background location
- Android battery optimization kills background tasks
- Different behavior across device manufacturers

**Decision:** Build Module 1 first to validate

### 2. Privacy Parameter Tradeoffs

**Current spec:** ε=1.0, sensitivity=168

**Issue:** Huge variance (~56 hours std dev)
- 40-hour week could report as 0-120 hours
- Noise only cancels out with many users

**Potential adjustment:** Lower sensitivity or higher epsilon
**Decision:** Test with real data first, tune later

### 3. Battery Usage

**Goal:** <5% drain over 8 hours background

**Testing required:**
- Real device testing (not simulator)
- Different iOS/Android versions
- Different manufacturers

### 4. Schema Migrations

**Current:** Not addressed in blueprint

**Decision needed:** Use migration library from day 1
- Options: Kysely, expo-sqlite versioning
- Critical for app updates with existing user data

---

## Shared Code Between Web & Mobile

### Currently Shared

```typescript
// lib/types.ts
export interface ShiftTemplate { ... }
export interface ShiftInstance { ... }
// etc.
```

### Strategy

**Short-term:** Copy types to mobile app
**Long-term:** Consider:
- Shared `packages/types/` directory
- npm package (if open-sourced)
- Monorepo structure (overkill for solo dev)

---

## Git Repository Status

### Branches

**main**
- Production web app
- Auto-deploys to Vercel
- Protected (stable)

**No dev branches yet** (solo developer, not needed)

### Recent Commits

```
906cc88 multi lang support, UI improvement, runs
48ef2f1 finalize multiflow migration, improve dashboard UI
fb50e2f Merge remote-tracking branch 'v0-calendar/main'
314c083 add separate pages
```

### Modified Files (Uncommitted)

```
M blueprint.md
M text.txt
?? TODO.md
?? app/page.tsx
?? .vercelignore
?? MODULE_1_PLAN.md
?? claude.md
```

---

## Tech Stack Details

### Web App (Current)

```json
{
  "framework": "Next.js 16.0.0",
  "react": "19.2.0",
  "typescript": "5.x (strict)",
  "styling": "Tailwind CSS 4.1.9",
  "ui": "Radix UI",
  "charts": "Recharts 2.15.4",
  "i18n": "next-intl 4.5.3",
  "forms": "react-hook-form + zod",
  "packageManager": "pnpm 10.20.0"
}
```

### Mobile App (Planned)

```json
{
  "framework": "React Native 0.74",
  "runtime": "Expo ~51.0",
  "typescript": "5.x",
  "navigation": "React Navigation 6",
  "state": "Zustand or Redux Toolkit",
  "storage": "expo-sqlite (SQLCipher)",
  "location": "expo-location + expo-task-manager",
  "maps": "react-native-maps",
  "testing": {
    "unit": "Jest",
    "component": "@testing-library/react-native",
    "e2e": "Detox"
  }
}
```

### Backend (Planned)

```python
{
  "framework": "FastAPI",
  "database": "PostgreSQL 15+",
  "orm": "SQLAlchemy",
  "validation": "Pydantic",
  "auth": "JWT",
  "hosting": "Hetzner (Germany)"
}
```

---

## Important Constraints

### Legal/Compliance

1. **GDPR compliant** (German healthcare context)
2. **Data residency:** EU only (Hetzner, Germany)
3. **Privacy by design:** Required by law (Article 25)
4. **Data minimization:** Required
5. **Right to erasure:** Must implement

### Technical

1. **iOS background limitations:** May restrict geofencing
2. **Android battery optimization:** May kill background tasks
3. **SQLite performance:** Limited to on-device data
4. **Differential privacy noise:** May require parameter tuning

### User Experience

1. **Healthcare workers:** Busy, low tolerance for bugs
2. **Hospital environments:** May block personal phones
3. **Shift work:** Irregular hours, overnight shifts
4. **Legal requirement:** Working hour tracking (Arbeitszeitgesetz)

---

## When Working on This Project

### Do's

✅ **Read blueprint.md first** - It's extremely detailed
✅ **Follow test-driven development** - Tests before implementation
✅ **Test on real devices early** - Simulators lie about geofencing
✅ **Consider privacy implications** - Every feature decision
✅ **Keep web app stable** - It's in production

### Don'ts

❌ **Don't edit web app accidentally** - Check your working directory
❌ **Don't skip testing** - Privacy/geofencing are too critical
❌ **Don't assume geofencing works** - Validate early
❌ **Don't hardcode secrets** - Use environment variables
❌ **Don't commit node_modules** - Already in .gitignore

### Questions to Always Ask

1. **Privacy:** Does this leak user data?
2. **Battery:** Will this drain battery?
3. **Reliability:** Does this work when app is killed?
4. **Testing:** How do I test this automatically?
5. **Compliance:** Does this violate GDPR?

---

## Communication Style

### User Preferences

- Solo developer
- Wants modular, testable code
- Values privacy and compliance
- Prefers planning before execution
- Asks clarifying questions
- Appreciates detailed technical analysis

### Response Guidelines

- Provide options with pros/cons
- Explain tradeoffs clearly
- Highlight risks early
- Test-driven approach
- Don't over-engineer for solo dev
- Practical > theoretical

---

## Next Steps (Pending User Decision)

### Immediate Actions Available

1. **Start Module 1** - Initialize mobile app, build geofencing
2. **Create Module 2 Plan** - Privacy pipeline implementation
3. **Review blueprint concerns** - Address privacy parameter issues
4. **Set up testing infrastructure** - Jest, Detox configuration
5. **Prototype privacy noise** - Validate ε=1.0 assumption

### Decision Points

- [ ] Confirm Module 1 approach vs linear TODO.md
- [ ] Choose state management (Zustand vs Redux)
- [ ] Decide on backend hosting provider
- [ ] Confirm privacy parameters (ε, sensitivity)
- [ ] Plan for legal/compliance review

---

## Documentation Structure

### Core Documentation (Read in This Order)

**For New Developers:**
1. **README.md** - Project overview, quick start (web app focus)
2. **claude.md** - This file, current state and context
3. **blueprint.md** - Complete system architecture (38KB, comprehensive)
4. **TODO.md** - Master TODO list (Module 1 first approach, single source of truth)

**For Mobile Development:**
1. **TODO.md** - Start here (Module 1 → 8 implementation plan)
2. **MODULE_1_PLAN.md** - Detailed Module 1 guide with code examples
3. **blueprint.md** - Full architecture reference

**For Backend Development:**
1. **backend/README.md** - Comprehensive backend guide (endpoints, deployment, architecture)
2. **TODO.md Module 4** - When to implement mobile endpoints
3. **blueprint.md section 6** - Original backend design

### All Documentation Files

```
/Users/user01/open_workinghours/
│
├── 📚 Documentation
│   ├── README.md              # Project overview (web app focus)
│   ├── blueprint.md           # System architecture (38KB, comprehensive)
│   ├── TODO.md                # Master TODO (Module 1 first, single source of truth)
│   ├── MODULE_1_PLAN.md       # Module 1 detailed implementation guide
│   ├── claude.md              # This file - AI assistant context
│   └── LICENSE                # MIT License
│
├── 🌐 Web Dashboard (Next.js - Production on Vercel)
│   ├── app/                   # Next.js App Router pages
│   │   ├── [locale]/          # Internationalized routes
│   │   ├── api/analytics/     # Temporary mock API
│   │   └── fonts.ts
│   ├── components/            # React components
│   │   ├── ui/                # Radix UI components
│   │   ├── calendar-*.tsx     # Calendar components
│   │   ├── verification-form.tsx
│   │   └── report-form.tsx
│   ├── lib/                   # Shared utilities
│   │   ├── types.ts           # TypeScript types
│   │   ├── calendar-utils.ts
│   │   ├── backend-api.ts
│   │   └── utils.ts
│   ├── messages/              # i18n translations (en, de, pt-BR)
│   ├── public/                # Static assets
│   ├── styles/                # Global CSS
│   ├── package.json
│   ├── next.config.mjs
│   └── tsconfig.json
│
├── 🔧 Backend (FastAPI - Serves Web + Mobile)
│   ├── README.md              # ✨ Comprehensive backend guide
│   ├── app/
│   │   ├── main.py            # FastAPI app, routers, CORS
│   │   ├── config.py          # Environment variables
│   │   ├── database.py        # SQLAlchemy setup
│   │   ├── models.py          # Database models
│   │   │   ├── VerificationRequest  # ✅ Exists
│   │   │   ├── Report               # ✅ Exists (web: daily)
│   │   │   ├── User                 # ❌ TODO (mobile)
│   │   │   └── SubmittedReport      # ❌ TODO (mobile: weekly noisy)
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── verification.py      # ✅ Shared (web + mobile)
│   │   │   ├── reports.py           # ✅ Web only (daily, raw)
│   │   │   ├── submissions.py       # ❌ TODO (mobile: weekly noisy)
│   │   │   └── analytics.py         # ✅ Shared (web + mobile)
│   │   ├── security.py        # JWT, hashing
│   │   ├── dependencies.py    # Auth dependencies
│   │   ├── email.py           # Email sending
│   │   ├── pii.py             # PII scrubbing
│   │   └── utils.py
│   ├── alembic/               # Database migrations
│   ├── .env.example
│   └── pyproject.toml
│
├── 📱 Mobile App (React Native - NOT CREATED YET)
│   └── mobile-app/            # Will be created in Module 1
│       ├── README.md          # Setup and testing guide
│       ├── src/
│       │   ├── modules/
│       │   │   └── geofencing/  # Module 1
│       │   ├── lib/
│       │   └── App.tsx
│       ├── app.json
│       ├── eas.json
│       └── package.json
│
├── 🗂️ Configuration
│   ├── .vercelignore          # Protects web deployment
│   ├── .gitignore
│   ├── .eslintrc.json
│   ├── postcss.config.mjs
│   └── tailwind.config.ts
│
└── 📊 Data
    ├── datasets/              # Hospital data (German)
    └── data/
```

### Documentation Updates

**Last Updated:** 2025-01-18

**Recent Changes:**
- Created `backend/README.md` - Comprehensive backend documentation
- Updated TODO.md to Module 1 first approach
- Consolidated BACKEND_ANALYSIS.md into backend/README.md
- Removed temporary analysis files

---

## Resources

### Documentation Links

- Blueprint: `blueprint.md`
- Todo list: `TODO.md`
- Module 1: `MODULE_1_PLAN.md`

### External References

- Differential Privacy: https://en.wikipedia.org/wiki/Differential_privacy
- GDPR Article 25: https://gdpr-info.eu/art-25-gdpr/
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- React Native Geofencing: https://github.com/transistorsoft/react-native-background-geolocation

### Potential Issues

- iOS background location: https://developer.apple.com/documentation/corelocation/getting_the_user_s_location/handling_location_events_in_the_background
- Android battery optimization: https://dontkillmyapp.com/

---

**Last Updated:** 2025-11-19
**Status:** Web app in production, mobile Phase 1.5 complete (UI built)
**Current Focus:** Module 1 Phase 1.6 - Device testing (geofencing validation)

---

## Mobile App Debugging (Added 2025-11-19)

**Tools:**
- Xcode Console: Connect iPhone → Xcode → Devices → Open Console
- Simulator first, device second (geofencing needs device)
- Screenshots of errors are diagnostic gold

**Common Issues:**
1. Browser APIs don't work in RN → Use Expo equivalents (`expo-crypto` not `uuid`)
2. Google Maps needs API key → Use native maps instead
3. Increment `buildNumber` in app.json for each TestFlight upload
4. TestFlight updates are manual (tap "Update")

**Deployment:**
- EAS Build ($29/month) bypasses Xcode version issues
- Simulator ≠ Device (especially location/background tasks)
- Test with humans for real-world scenarios (walking, battery drain)

**Status:** Mobile Phase 1.5 done, Phase 1.6 (device testing) in progress
