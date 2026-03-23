# Claude Context: Open Working Hours

**Last Updated:** 2026-03-21
**Current Build:** #31 (TestFlight)

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
| **React Native Mobile App (iOS)** | Production (TestFlight) | `mobile-app/` |
| **React Native Mobile App (Android)** | Development (internal testing) | `mobile-app/` |
| **FastAPI Backend** | Production (Hetzner) | `backend/` |
| **Astro Website** | Live (openworkinghours.org) | `website/` |
| **Next.js Dashboard** | Deprecated | Root (unused) |

### Production URLs

- Website: https://openworkinghours.org
- Backend API: https://api.openworkinghours.org

---

## Current State

All core features complete. User test feedback (Clusters A-F) fully implemented. Build #31 on TestFlight. 3-4 active users.

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
2. **`docs/WORKFLOW_PATTERNS.md`** - **Read before starting any task** (how to structure work, use subagents)
3. **Then based on your task:**
   - Mobile work → `mobile-app/ARCHITECTURE.md`
   - Backend work → `backend/ARCHITECTURE.md`
   - Deployment → `docs/deployment.md`
   - Debugging issues → `docs/debugging.md`
   - **Testing (E2E, Visual)** → `docs/WORKFLOW_PATTERNS.md` → Testing section
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
| **`docs/WORKFLOW_PATTERNS.md`** | **How to do work: subagents, testing workflows** → `docs/testing/` |
| `archive/ISSUE_PLANNING_2026-02-05.md` | Archived: UX feedback issues (Groups A/B/C complete, D dropped) |

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
- **Use E2E-compatible UI patterns** (see below)

### Don'ts

- Don't commit secrets - use environment variables
- Don't edit web dashboard - it's deprecated
- Don't submit today or future dates - backend rejects them
- Don't use `react-native-reanimated` - crashes with Expo SDK 51
- Don't use `<Modal>` for new UI — invisible to XCUITest E2E tests on iOS (use inline animated Views instead)
- Don't use `accessibilityRole="menu"` or `accessibilityViewIsModal` on containers — causes XCUITest to aggregate children into one element

### E2E-Compatible UI Patterns

All new UI **must** be testable by Appium (XCUITest on iOS, UiAutomator2 on Android). Follow these rules:

**Overlays/Panels/Sheets — use inline `<Animated.View>`, never `<Modal>`:**
```tsx
// ✅ CORRECT — inline rendering, always in the native view tree
<View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
  <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
    {/* content */}
  </Animated.View>
</View>

// ❌ WRONG — Modal creates a separate UIWindow invisible to XCUITest
<Modal visible={isOpen}>
  {/* XCUITest cannot see this */}
</Modal>
```

**Accessibility props — break aggregation so each element is individually exposed:**
```tsx
// ✅ CORRECT — container is transparent, children are individually accessible
<View accessible={false} collapsable={false}>
  <TouchableOpacity testID="my-button" accessible={true} accessibilityRole="button">
    <Text>Tap me</Text>
  </TouchableOpacity>
</View>

// ❌ WRONG — container aggregates all children into one XCUITest element
<TouchableWithoutFeedback onPress={...}>  {/* inherently accessible={true} on iOS */}
  <View accessibilityLabel="Panel" accessibilityRole="menu">
    {/* children invisible to XCUITest */}
  </View>
</TouchableWithoutFeedback>
```

**Key rules:**
- `TouchableWithoutFeedback` wrappers: always add `accessible={false}`
- `ScrollView` containing interactive elements: add `accessible={false}`
- Container `View`s with multiple interactive children: add `accessible={false}` + `collapsable={false}`
- Never put `accessibilityLabel` on a container that has interactive children (causes aggregation)
- Each interactive element: `testID` + `accessible={true}` + `accessibilityRole="button"`
- Android `getValue()` doesn't work on text inputs — use `getText()` instead (or branch by platform)

---

## Key Constraints

### Technical

- **Geofencing**: Works on device only, 5-min exit hysteresis, GPS accuracy filtering (see `mobile-app/ARCHITECTURE.md`)
- **Zoom**: Ref-based (not reanimated) - "acceptable" but not 60fps
- **iOS 18**: Week arrows fixed with PREV_WEEK/NEXT_WEEK actions

### Privacy

- **K-anonymity**: Groups need ≥5 users (K_MIN=5) + dominance rule (≤30% single-user contribution)
- **Differential privacy**: Laplace noise on sums (ε split: 0.2 planned / 0.8 actual), SQL-level clipping (planned≤80h, actual≤120h)
- **Adaptive ε**: `min(config_ε, remaining_budget / remaining_periods)` — never overshoots annual cap
- **Temporal coarsening**: weekly (default) / biweekly / monthly aggregation periods
- **Confidence intervals**: 90% Laplace CIs published with each stat, `n_display` rounded to nearest 5
- **Publication policy**: 2-week activation streak, 2-week cooling-down grace, per-user ε ledger
- **Budget monitoring**: `/auth/me/privacy-budget` (GDPR Art. 15), `/stats/admin/privacy-budget-summary`
- **Data residency**: EU only (Hetzner, Germany)
- **Right to erasure**: User deletion cascades to work_events

---

## Recent Updates (Last 7 Days)

### 2026-03-21: DP Group Stats v2 — 4 Gaps Closed

**Summary:** Completed the remaining 4 gaps in the DP pipeline: temporal coarsening, adaptive ε schedule, confidence intervals, and per-user budget monitoring. All backward-compatible — default stays `weekly` with ε=1.0.

**Gap 3 — Temporal Coarsening:**
- `PeriodType = "weekly" | "biweekly" | "monthly"` in config
- `get_period_bounds()`, `period_before()`, `compute_period_index()` in `periods.py`
- Multi-week aggregation uses CTE: per-user AVG of clipped weekly values, then SUM across users
- Sensitivity unchanged (mean of bounded values is bounded)
- `period_type` column added to `stats_by_state_specialty` + `state_specialty_privacy_ledger`

**Gap 1 — Adaptive ε Schedule:**
- `compute_adaptive_epsilon()`: `min(config_ε, (cap − spent_ytd) / periods_remaining)`
- Integrated into aggregation loop — queries YTD spending, scales epsilon split proportionally
- Never exceeds config default, never overshoots annual cap
- Anomaly logging when adaptive_eps < 50% of expected per-period

**Gap 4 — Confidence Intervals:**
- `laplace_ci_half_width()`: 90% CIs from Laplace scale, `n_display = (n // 5) * 5` (floored at 5)
- 4 new columns: `planned_ci_half`, `actual_ci_half`, `overtime_ci_half`, `n_display`
- `overtime_ci = planned_ci + actual_ci` (conservative, triangle inequality)
- CI fields exposed in `/stats/by-state-specialty` only for published cells

**Gap 2 — Per-User Budget Monitoring:**
- `GET /auth/me/privacy-budget` — authenticated, GDPR Art. 15 transparency
- `GET /stats/admin/privacy-budget-summary` — admin overview (worst-case user, avg spend, utilization%)
- Query functions: `user_annual_summary()`, `worst_case_user_spend()`, `budget_monitoring_summary()`

**Migration:** Single Alembic migration `h8i9j0k1l2m3` (period_type + CI columns). `server_default="weekly"` and `nullable=True` — existing rows unaffected.

**Tests:** 64 tests in dp_group_stats + aggregation (all pass). 116 total backend tests pass.

| File | Changes |
|------|---------|
| `app/dp_group_stats/config.py` | PeriodType, periods_per_year(), period_type field |
| `app/periods.py` | get_period_bounds, period_before, compute_period_index |
| `app/aggregation.py` | Multi-week CTE, adaptive ε, CI computation, anomaly logging |
| `app/dp_group_stats/accounting.py` | compute_adaptive_epsilon, budget query functions |
| `app/dp_group_stats/mechanisms.py` | laplace_ci_half_width |
| `app/models.py` | period_type + CI columns |
| `app/schemas.py` | CI fields + PrivacyBudgetOut |
| `app/routers/stats.py` | CI in response, admin budget endpoint |
| `app/routers/auth.py` | GET /auth/me/privacy-budget |

---

### 2026-03-21: Security Hardening + DP Group Stats v1 — Deployed to Production

**Security hardening (deployed):**
- CORS restricted to explicit origins, security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- In-memory rate limiting on auth endpoints (5 req/60s login, 5 req/60s register, 3 req/60s feedback)
- Email enumeration fix: generic errors for register/login
- Verification confirm scoped by email (backwards-compatible: old apps use code-only fallback)
- Removed shell=True from admin subprocess, XSS protection in admin dashboard
- SMTP debug logging disabled (was leaking plaintext verification codes to container logs)
- Mobile app: sends email with verification confirm, removed "already exists" detection
- 12 security regression tests (10 pass, 2 xfail on SQLite)

**DP group stats v1 (deployed):**
- Foundation: config, Laplace mechanism, publication state machine, accounting ledger
- 5 new DB tables: `finalized_user_weeks`, `state_specialty_release_cells`, `state_specialty_privacy_ledger`, `user_privacy_ledger`, plus `publication_status` column on stats tables
- SQL-level clipping in aggregation (CASE WHEN, portable SQLite/PG)
- Config: K_MIN=5, actual_weekly_max=120h, planned_weekly_max=80h, dominance_threshold=0.30
- Simulation module with 200+ validated scenarios
- Alembic migrations run on production PostgreSQL
- 47 backend tests passing

---

### 2026-02-09: Visual Polish — CalendarHeader + MonthView + Android Tab Bar

**Summary:** Fixed three visual issues: header title overflow, MonthView batch banner (Android), and tab bar overlap (Android edge-to-edge).

**Changes:**
| File | Fix | Status |
|------|-----|--------|
| `CalendarHeader.tsx` | Title: `flex: 1` + `adjustsFontSizeToFit` + same-month range shortening | ✅ Both platforms |
| `MonthView.tsx` | Batch banner moved inside `Animated.View` with fixed-height slot (no layout shift) | ✅ Both platforms |
| `AppNavigator.tsx` | Android tab bar: wrapper `View` with `paddingBottom` to clear system nav bar | ✅ Android (iOS unaffected) |

**Root causes found:**
- Android batch banner: Views rendered as siblings OUTSIDE `Animated.View` were invisible on Android (hot reload was also stale — debug build via `expo run:android` required)
- Android tab bar: Android 15+ enforces edge-to-edge regardless of `edgeToEdgeEnabled` setting; tab bar needs explicit bottom padding

---

### 2026-02-09: Group C Complete — Unified InlinePicker

**Summary:** Completed Group C (Issues 3, 6) — unified picker UI for calendar shifts/absences. Manually tested and working.

**Key changes:**
| Component | Changes |
|-----------|---------|
| `InlinePicker.tsx` | New component: centered modal with Shifts/Absences/GPS tabs |
| Edit UX | Edit button moved to LEFT of rows; inline edit form (no bottom sheet) with color picker + break duration |
| MonthView | Single tap → WeekView; long press → picker; double-tap → place armed shift; batch indicator |
| WeekView | Single tap blocked when armed; double-tap places shift; long press opens picker |
| Tab sync | Fixed: FAB → Absences now correctly opens Absences tab |
| testIDs | 28 testIDs added for E2E compatibility |

**Interaction summary:**
| View | Not Armed | Armed |
|------|-----------|-------|
| MonthView single tap | Navigate to WeekView | Delayed navigate (allows double-tap) |
| MonthView double tap | Navigate to WeekView | Place armed shift |
| MonthView long press | Open picker | Open picker |
| WeekView single tap | Open picker | Blocked |
| WeekView double tap | Open picker | Place armed shift |
| WeekView long press | Open picker | Open picker |

**E2E status:** Tests need updating for new UI flow (35/48 iOS, 30/48 Android)

**Full details:** `docs/ISSUE_PLANNING_2026-02-05.md` → Group C section

---

### 2026-02-05: Issue Planning — UX Expert Feedback (7 Issues)

**Summary:** Collected and analyzed 7 issues from UX expert feedback. Grouped by file dependencies into 4 implementation groups.

**Groups:**
| Group | Name | Issues | Status |
|-------|------|--------|--------|
| A | Geofencing Module Screens | 1, 2, 5 | ✅ Complete |
| B | Authentication - Lock Screen | 4 | Pending |
| C | Calendar - Picker Unification | 3, 6 | ✅ Complete |
| D | Calendar - Day View | 7 | Pending |

**Key issues:**
- Location list tap behavior (select vs navigate)
- Consent status color mismatch
- Lock Screen with Face ID + Passcode options (Pattern A, like N26)
- Dismissable permission warning with 1-week re-show
- Unify duplicate picker UIs + add GPS/Log Hours tab
- New Day View for calendar

**Full details:** `docs/ISSUE_PLANNING_2026-02-05.md`

### 2026-02-03: Visual Testing — UX Advisor Fixes (4/5 Complete)

**Summary:** Implemented fixes for UX advisor feedback on Calendar screens. 4 of 5 issues resolved, 1 deferred.

**Issues resolved:**
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | Summary divider not full width | Extended divider edge-to-edge | `MonthView.tsx` |
| 2 | Summary background white (should be gray) | Changed to `background.default` | `MonthView.tsx` |
| 3 | Tab bar vertical padding unequal | Added `paddingTop: 8` to tabBarStyle | `AppNavigator.tsx` |
| 5 | FAB margins unequal | Used `useSafeAreaInsets()` for dynamic bottom offset | `CalendarFAB.tsx` |

**Deferred:** Issue #4 (panel should dim tab bar) — requires architectural refactor; tab bar rendered by React Navigation outside screen component tree.

**Workflow documented:** Updated `docs/visual-testing/FIX_WORKFLOW.md` with manager validation loop and iteration pattern.

**Screenshots:** `mobile-app/visual-testing/screenshots/2026-02-03/` contains BEFORE/AFTER pairs for verified fixes.

### 2026-02-03: Immutable Database Backups (Object Storage)

**Summary:** Set up automated PostgreSQL backups to Hetzner Object Storage with 30-day immutable retention (COMPLIANCE mode Object Lock). Satisfies IT insurance requirements.

**What's configured:**
- Daily backups at 4 AM UTC via cron (`~/backup-postgres-s3.sh`)
- Hetzner Object Storage bucket: `owh-backups-prod`
- COMPLIANCE mode Object Lock: objects cannot be deleted for 30 days, even with credentials
- 2FA enabled on Hetzner Console for management access

**Insurance compliance:** ✓ Weekly backup, ✓ 30-day retention, ✓ Immutable, ✓ Separate access control

**Docs updated:** `docs/deployment.md` (new Database Backups section), `docs/data-retention-policy.md` (updated backup architecture)

### 2026-02-03: E2E Validation — iOS 48/48, Android 45/48

**Summary:** Full E2E validation after iOS rebuild to include testID changes. Both platforms verified.

**Platform comparison:**
| Platform | Tests | Time | Stability | Notes |
|----------|-------|------|-----------|-------|
| iOS | 48/48 | ~203s | 100% | Required rebuild for MonthView testIDs |
| Android | 45/48 | ~176s | 93.75% | 3 failures in shifts (known flakiness) |

**iOS rebuild was required** because uncommitted changes to `MonthView.tsx` added testIDs for vacation/sick icons (`month-day-${dateKey}-vacation`, `month-day-${dateKey}-sick`). Without rebuild, absences tests failed looking for these testIDs.

**Android known flakiness:** Shifts test fails ~25% of runs after absences suite — template panel doesn't consistently dismiss after double-tap shift placement, blocking Month toggle.

**Docs:** `e2e/README.md` has Runbook pattern. Deep reference in `docs/E2E_TESTING_PLAN.md`.

### 2026-02-03 (earlier): TEST_MODE Expansion for E2E Stability

**Summary:** Expanded TEST_MODE to skip animations and mock geocoding, reducing test flakiness and improving speed.

**Results:** 48/48 iOS tests pass in ~200s (down from ~280s baseline). 3 consecutive runs with <4% variance.

**What TEST_MODE now controls:**
- **Mock auth** — code `123456` works (existing)
- **Mock geocoding** — returns "Charité Berlin" instantly, no network
- **Skip panel animations** — TemplatePanel/ManualSessionForm open instantly
- **Skip pulse animations** — tracking badges have stable opacity

**Key friction point:** Tests may skip flows if app state persists from previous runs. Solution: uninstall app before rebuild for clean state.

**Files changed:** `mockApi.ts` (isTestMode helper), `GeocodingService.ts`, `TemplatePanel.tsx`, `ManualSessionForm.tsx`, `WeekView.tsx`, `HoursSummaryWidget.tsx`

**Docs updated:** `mobile-app/e2e/README.md` (pre-flight checklist, TEST_MODE features), `docs/E2E_TESTING_PLAN.md` (session log)

### 2026-01-31: Android Re-verification — 48/48 Both Platforms

**Summary:** Re-verified Android after iOS-only expansion. Fixed platform-specific issues (activateApp, acceptAlert no-ops, permission dialogs). Both platforms 48/48.

**Detailed reference:** `docs/E2E_TESTING_PLAN.md` → Session Log → 2026-01-31

### 2026-01-30: E2E — 52 Tests, Local Builds, Robustness Fixes

**Summary:** Expanded E2E from 32 → 52 tests. Verified local Xcode builds, fixed shift arming, manual session, absence arming.

**Detailed reference:** `docs/E2E_TESTING_PLAN.md` (session log has full friction-point table)

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
