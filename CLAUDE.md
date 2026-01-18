# Claude Context: Open Working Hours

**Last Updated:** 2026-01-18
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
   - Known bugs → `docs/KNOWN_ISSUES.md`
   - Privacy (technical) → `privacy_architecture.md`
   - GDPR/Legal compliance → `docs/GDPR_COMPLIANCE.md`
   - Deep architecture → `blueprint.md`

**All docs connect back to this file** - if you're lost, return here.

---

## Documentation

See `docs/DOCUMENTATION_STRUCTURE.md` for full documentation guidelines.

### Quick Reference

| Document | Purpose |
|----------|---------|
| `blueprint.md` | System architecture, completed modules |
| `privacy_architecture.md` | Technical privacy design (k-anonymity, data flows) |
| `docs/GDPR_COMPLIANCE.md` | Legal compliance status, checklist, links to DPIA/RoPA |
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

- **Geofencing**: Works on device only, 5-min exit hysteresis, GPS accuracy filtering (see `mobile-app/ARCHITECTURE.md`)
- **Zoom**: Ref-based (not reanimated) - "acceptable" but not 60fps
- **iOS 18**: Week arrows fixed with PREV_WEEK/NEXT_WEEK actions

### Privacy

- **K-anonymity**: Groups need ≥11 users to be published (EMA/Health Canada standard)
- **Data residency**: EU only (Hetzner, Germany)
- **Right to erasure**: User deletion cascades to work_events

---

## Recent Updates (Last 7 Days)

### 2026-01-18: Public Dashboard + Interactive Map
- **Planning:** `docs/PUBLIC_DASHBOARD_PLAN.md`, `docs/INTERACTIVE_MAP_PLAN.md` (Phase 1 complete)
- **Backend endpoints:** `/dashboard/coverage`, `/dashboard/activity`, `/dashboard/contact`
- **Interactive D3.js map:** Replaced Datawrapper with self-hosted solution (no third-party dependencies)
  - 16 German states with choropleth coloring
  - 1,220 hospital dots with hover tooltips
  - Zoom/pan controls (buttons + mouse wheel + drag)
  - Bilingual support (EN/DE) via `locale` prop
- **Website pages:** `/dashboard` (EN), `/de/dashboard` (DE)
- **Navigation updates:**
  - Reordered nav: Product before Dashboard
  - Added "Live" badge to Dashboard
  - Homepage hero links to dashboard
  - Product page links to dashboard (replaced static screenshot)
- **Files:** `website/src/components/InteractiveMap/`, `backend/app/routers/dashboard.py`
- **Removed:** Datawrapper integration (service, endpoints, env vars) - D3.js approach is fully self-contained
- **Pending:** Contact form email notification, `contact@openworkinghours.org` setup
- See `docs/INTERACTIVE_MAP_PLAN.md` for map specification

### 2026-01-16: Session State Bug Fix
- **Bug**: StatusScreen showed "Clock In" but clicking gave "Already clocked in" error
- **Root cause**: `Database.updateSession()` set `clockOut` without updating `state` to `'completed'`
- **Fix**: `updateSession()` now sets `state` based on `clockOut` presence
- **Migration**: v4 repairs any sessions with inconsistent state
- **Files**: `mobile-app/src/modules/geofencing/services/Database.ts`

### 2026-01-16: Month View UX Improvements
- **Planning:** `archive/MONTH_VIEW_UX_PLAN.md` (completed)
- **Grid expansion**: Month grid fills screen with consistent 6-week (42 cell) layout
- **Monthly summary footer**: Shows tracked hours, planned hours, overtime (color-coded), vacation/sick day counts
- **Per-day overtime display**: Confirmed days show overtime (e.g., "+1h 30m") with ✓ icon; unconfirmed show ?
- **Confirmation nudge**: Footer shows "(X confirmed)" hint when some overtime is unconfirmed
- **GPS toggle hidden**: Removed from month view (overview-only, no editing)
- **FAB hidden**: Removed from month view (editing done in week view)
- **Swipe navigation**: Swipe left/right to navigate months (with slide animation)
- **Header title click**: Now navigates to current month (like week view)
- **Bug fixes**:
  - Full month tracking data now loads when switching to month view in review mode
  - Multi-day sessions correctly split across days (using overlap calculation)
  - Consistent footer height (reserved space for hints/absence row)
- **Code cleanup**: Deduplicated `getDayBounds()` and `computeOverlapMinutes()` into calendar-utils.ts

### 2026-01-16: Calendar Instant Refresh Fix
- **Bug fixed**: Calendar now instantly reflects clock-in/clock-out (was 60s delay)
- **Solution**: Cross-module EventEmitter (`src/lib/events/trackingEvents.ts`)
- **Pattern**: TrackingManager emits → CalendarProvider subscribes → refreshes in review mode
- See `mobile-app/ARCHITECTURE.md` → "Cross-Module Events" for details

### 2026-01-15: Calendar UX Improvements
- **Planning:** `archive/CALENDAR_UX_PLAN.md` (completed)
- **Header redesign**: Removed green bar and "Dienste" button, GPS toggle now uses eye icon with red theme
- **FAB (Floating Action Button)**: New "+" button in bottom-right corner for adding shifts/absences
- **Template selection**: Compact radio list design (edit pencil left, radio selector right)
- **Mutual exclusivity**: Shift/absence selection now mutually exclusive
- **Absence templates**: Full CRUD support with edit form (name, type, full-day toggle, times)
- **Double-tap on empty space**: Opens template picker (same as long-press)
- **Progressive disclosure**: Adjusted thresholds (32px/56px) for better text fitting at zoom levels
- **Bug fixes**: Absence template persistence (FK constraint), FAB hides during overlays

### 2026-01-15: Geofence Robustness Improvements
- **Documentation:** `archive/GEOFENCE_HYSTERESIS_PLAN.md` (completed)
- Exit hysteresis (5-min pending state before clock-out)
- GPS accuracy filtering (ignore exits >100m accuracy)
- Signal degradation detection (ignore if accuracy 3x worse than check-in)
- GPS telemetry logging for parameter tuning via Report Issue
- Short sessions kept (not deleted) with visual indicator in calendar (faded + clock icon)

### 2026-01-14: Status Page UX Improvements
- **HoursSummaryWidget redesign**: Side-by-side bars (green=planned, rose=tracked), dynamic Y-axis scaling (12h/16h/24h), day labels, absence icons
- **Unconfirmed days nudge**: Faded bars + "X to confirm" count to encourage daily confirmation
- **Clocked-in state redesign**: Prominent card with green border/tint, time badge pill, subtle "End" button
- **Bug fixes**: Color palette fallback for unknown colors, removed cryptic "Tap to manage" hint
- **i18n**: Updated clock-in button text ("Clock In"/"Einstempeln"), added "End"/"Beenden"

### 2026-01-13: DPAs Signed & Privacy Improvements
- Signed Hetzner DPA (stored in private Google Drive)
- Brevo DPA confirmed (part of ToS, PDF exported)
- Removed plaintext email storage from FeedbackReport (privacy-by-design)
- Updated GDPR_COMPLIANCE.md with current status

### 2026-01-12: Consent Withdrawal & Data Export
- Implemented `DELETE /auth/me` endpoint (GDPR Art. 17 - Right to Erasure)
- Added `GET /auth/me/export` endpoint (GDPR Art. 20 - Data Portability)
- Mobile: Consent status display + withdrawal flow in DataPrivacyScreen
- Mobile: Export data button with Share sheet
- Mobile: Policy links (Terms, Privacy) in Settings screen
- Cleanup includes FeedbackReports, VerificationRequests (no orphaned data)
- See `archive/CONSENT_WITHDRAWAL_PLAN.md` for implementation details

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
