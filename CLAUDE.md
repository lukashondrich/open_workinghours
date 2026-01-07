# Claude Context: Open Working Hours

**Last Updated:** 2026-01-07
**Current Build:** #30 (ready for TestFlight upload)

---

## Project Overview

**Open Working Hours** is a privacy-first platform for healthcare workers to track and report working hours transparently while complying with GDPR.

### Architecture

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

### Components

| Component | Status | Location |
|-----------|--------|----------|
| **React Native Mobile App** | Production (TestFlight) | `mobile-app/` |
| **FastAPI Backend** | Production (Hetzner) | `backend/` |
| **Astro Website** | Live (openworkinghours.org) | `website/` |
| **Next.js Dashboard** | Deprecated | Root (unused) |

### Production URLs

- Website: https://openworkinghours.org
- Backend API: https://api.openworkinghours.org

---

## Current State

All core features complete. User test feedback (Clusters A-F) fully implemented. Ready for build #30.

**What's working:**
- Geofencing with automatic clock-in/out
- Calendar with shift templates, overlap detection, absences
- 14-day dashboard with hours overview
- Authentication and daily submission to backend
- Photon geocoding for location search
- Full German translation (i18n)

---

## New Here? Start Here

**Reading order for new contributors:**

1. **This file** (CLAUDE.md) - Current state, quick overview
2. **`docs/DOCUMENTATION_STRUCTURE.md`** - How docs are organized
3. **Then based on your task:**
   - Mobile work → `mobile-app/ARCHITECTURE.md`
   - Backend work → `backend/ARCHITECTURE.md`
   - Deployment → `docs/deployment.md`
   - Debugging issues → `docs/debugging.md`
   - Privacy questions → `privacy_architecture.md`
   - Deep architecture → `blueprint.md`

**All docs connect back to this file** - if you're lost, return here.

---

## Documentation

See `docs/DOCUMENTATION_STRUCTURE.md` for full documentation guidelines.

### Quick Reference

| Document | Purpose |
|----------|---------|
| `blueprint.md` | System architecture, completed modules |
| `privacy_architecture.md` | Privacy/GDPR design |
| `mobile-app/ARCHITECTURE.md` | Mobile app details, schemas, patterns |
| `backend/ARCHITECTURE.md` | Backend API, database, aggregation |
| `docs/deployment.md` | Docker, Hetzner, production deployment |
| `docs/debugging.md` | Mobile debugging, backend logs, known gotchas |

### Document Lifecycle

```
Start feature → Create *_PLAN.md → Complete → Extract to ARCHITECTURE.md → Archive
```

---

## Do's and Don'ts

### Do's

- Read `privacy_architecture.md` first - defines the privacy approach
- Test geofencing on real devices - simulators don't work
- Check `mobile-app/ARCHITECTURE.md` for mobile patterns
- Check `docs/deployment.md` for deployment process
- Increment `buildNumber` in `app.json` for each TestFlight upload

### Don'ts

- Don't commit secrets - use environment variables
- Don't edit web dashboard - it's deprecated
- Don't submit today or future dates - backend rejects them
- Don't use `react-native-reanimated` - crashes with Expo SDK 51

---

## Key Constraints

### Technical

- **Geofencing**: Works on device only, 5-min exit hysteresis
- **Zoom**: Ref-based (not reanimated) - "acceptable" but not 60fps
- **iOS 18**: Week arrows fixed with PREV_WEEK/NEXT_WEEK actions

### Privacy

- **K-anonymity**: Groups need ≥10 users to be published
- **Data residency**: EU only (Hetzner, Germany)
- **Right to erasure**: User deletion cascades to work_events

---

## Recent Updates (Last 7 Days)

### 2026-01-07: Cluster F Complete
- Photon geocoding replaces Mapbox (free, GDPR-friendly)
- Healthcare results prioritized in location search
- Double-tap to place shifts (single tap clears selection)
- Absence overlay 50% transparent
- Step indicator: "Step 1 of 3 - Find Your Workplace"
- Work Locations: inverted layout (small map, big list)

### 2026-01-06: Clusters A, C, E Refinements
- Zoom snapback fix (ref-based gesture handling)
- Week navigation arrows fix
- Sessions < 5 min filtered at recording
- Pre-account days show "—" in 14-day overview
- Absence drag handles added
- TreePalm/Thermometer icons for vacation/sick

---

## Quick Commands

```bash
# Mobile app
cd mobile-app
npm start                    # Start Expo
eas build --platform ios     # Build for TestFlight

# Backend
cd backend
source .venv/bin/activate
pytest -v                    # Run tests
uvicorn app.main:app --reload  # Local dev

# Deploy backend
ssh deploy@owh-backend-prod
cd ~/open_workinghours/backend
docker compose down && docker compose build --no-cache backend && docker compose up -d
```

---

## Communication Style

- Solo developer project
- Handles git commands personally - prepare changes, inform user to commit
- Prefers planning before execution
- Values privacy and GDPR compliance
- Practical over theoretical
