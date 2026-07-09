# Claude Context: Open Working Hours

**Last Updated:** 2026-07-08
**Current Build:** #65 / v2.1.0 — ✅ LIVE on the App Store (approved 2026-07-08)

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
| **React Native Mobile App (iOS)** | Live on the App Store (v2.1.0) | `mobile-app/` |
| **React Native Mobile App (Android)** | Development (internal testing) | `mobile-app/` |
| **FastAPI Backend** | Production (Hetzner) | `backend/` |
| **Astro Website** | Live (openworkinghours.org) | `website/` |
| **Next.js Dashboard** | Deprecated | Root (unused) |

### Production URLs

- Website: https://openworkinghours.org
- Backend API: https://api.openworkinghours.org

---

## Current State

All core features complete. User test feedback (Clusters A-F) fully implemented. v2.1.0 is public on the iOS App Store as of 2026-07-08.

**App Store: LIVE.** v2.1.0 build #65 approved and public on 2026-07-08 (tag `v2.1.0-build65`) — the first public iOS release. Cleared a Guideline 2.5.4 rejection by removing `UIBackgroundModes: location` and patching expo-location so geofencing still works (`patches/expo-location+19.0.8.patch`). Full history: `archive/app-store-guideline-2-5-4-2026-07.md`; the technical trap is captured in `mobile-app/ARCHITECTURE.md` (Geofencing) and `docs/debugging.md`. ⚠️ The patch is version-pinned to expo-location 19.0.8 — regenerate on upgrade. Non-blocking follow-up: lawyer's HWG/GDPR pass on the description copy (task #31), appliable as a live-version metadata update.

**What's working:**
- Geofencing with automatic clock-in/out
- Calendar with shift templates, overlap detection, absences
- 14-day dashboard with hours overview
- Authentication and daily submission to backend
- Photon geocoding for location search
- Social auth: Sign in with Apple (iOS) + Google (Android)
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
   - **E2E Testing** → `mobile-app/e2e/README.md` (runbook, Android pitfalls, TEST_MODE)
   - **Testing workflows** → `docs/WORKFLOW_PATTERNS.md` → Testing section
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
| `docs/debugging.md` | Mobile debugging (iOS + **Android**), backend logs, known gotchas |
| **`docs/WORKFLOW_PATTERNS.md`** | **How to do work: subagents, testing workflows** → `docs/testing/` |
| `mobile-app/store-assets/README.md` | App Store screenshot pipeline (see `app-store-metadata.md` next to it for submission payload) |
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

- **Never use planning mode** — discuss designs interactively with the user instead
- **Don't rely on the auto-memory system** (`~/.claude/projects/.../memory/`) — its contents may be out of date. Verify any recalled context against the current codebase, git history, or by asking the user. Do not cite memory as authoritative.
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

### 2026-07-09: Website consumer launch (openworkinghours.org)

**What shipped:**
- Homepage reoriented to **dual-audience** (Option C): official App Store badge as the primary hero CTA, institutional pilot-partner path preserved. "Closed Beta"/"TestFlight" copy replaced with truthful launch status across `/`, `/download`, `/dashboard`, `/product`, `/team` (EN+DE).
- **Official** Apple + Google store badges (`website/public/badges/`) with the live canonical App Store link. Google Play stays "Coming soon" (Android internal). Badges must stay official — see `website/README.md` → "Store Badges".
- GPS privacy wording harmonized with the policy docs (precise location stays on-device; workplace search optional, approximate ~1 km to Komoot/Photon).
- **SEO basics + Apple Smart App Banner** (`app-id=6755491395`): sitemap, `robots.txt`, canonical URLs, global OG/Twitter tags, JSON-LD, stronger homepage titles. Deferred: hreflang, analytics.
- Deployed from `main` via Vercel. Source plan archived at `archive/share-app-2026-04.md`; workstream + open follow-ups in `project-mgmt/WORKSTREAMS.md` §8.
- ✅ **Canonical domain = apex `openworkinghours.org`** (shipped app links to apex, can't change). Vercel flipped so apex serves 200 and `www` 308→apex (verified). Remaining: submit `sitemap-index.xml` in Google Search Console (account action).

### 2026-07-08: First public App Store release (v2.1.0 build #65)

**What shipped:**
- v2.1.0 approved and live on the App Store (tag `v2.1.0-build65`) — first public iOS release, removing TestFlight-invite friction (unblocks doc-mums distribution).
- Cleared a Guideline 2.5.4 rejection: removed `UIBackgroundModes: location` (Apple read it as employee tracking) and added `patches/expo-location+19.0.8.patch` so region-monitoring geofencing works without the declaration. Verified on device (upgrade-install launch + killed-app clock-in/out walk test).
- Reusable knowledge extracted to permanent docs: `mobile-app/ARCHITECTURE.md` (Geofencing → iOS background mode) and `docs/debugging.md` (iOS geofencing & background mode). Full case history archived at `archive/app-store-guideline-2-5-4-2026-07.md`.
- ⚠️ Patch is version-pinned to expo-location 19.0.8 — regenerate on any SDK/expo-location upgrade (upstream guard still present on expo main/SDK 57).

### 2026-06-04: App Store screenshot pipeline + submission payload

**What shipped:**
- End-to-end screenshot pipeline at `mobile-app/store-assets/`: per-locale Appium capture (6 flows × 2 locales) + Sharp composition (headline + tinted bg). 12 PNGs at 1320×2868 ready to drop into App Store Connect.
- `TEST_SCREENSHOT_SEED` build flag: when true, `App.tsx` calls `seedDashboardTestData()` at startup, populating 14 days of varied shifts (Frühdienst/Spätdienst/Nachtdienst), one vacation/sick day, location "Klinikum München", and 2 future shifts. Used only for screenshot capture, never in TestFlight/Release.
- `mockApi.ts` mock user `createdAt` set to 30 days ago so the Status dashboard's 14-day chart shows historical data (the chart treats pre-account days as zeroed).
- `CollectiveInsightsService` returns canned k-anonymous insights in `isTestMode()` so flow 06 isn't gated on backend k-anonymity thresholds.
- iOS Privacy Manifest declared in `app.json` → `ios.privacyManifests` (5 collected data types + 4 API access reasons). `app.json` is the source of truth — `ios/mobileapp/PrivacyInfo.xcprivacy` is regenerated on every `expo prebuild`.
- Screenshot copy v2 (post-launch iteration): action-instructional DE/EN headlines for 01-04 + 06; 05 kept its noun-phrase form (privacy framing).

**Key artifacts to reference (not duplicated in CLAUDE.md):**
- Pipeline architecture + run instructions + build pitfalls: `mobile-app/store-assets/README.md`
- App Store metadata payload (subtitle, promo, description, keywords EN+DE; Nutrition Labels; reviewer notes; decisions log): `mobile-app/store-assets/app-store-metadata.md`
- Privacy Manifest rationale (per data type, deliberate exclusions): `privacy_architecture.md` § "iOS Privacy Manifest"

**Conventions established:**
- German shift names are intentional in **both** locale screenshot runs (audience signal). Don't "fix" them by translating.
- Apple App Review demo account = `demo@openworkinghours.org` + code `123456`, served by a backend bypass at `backend/app/routers/auth.py:163-186` (env vars `DEMO__EMAIL` + `DEMO__CODE`). No mailbox/forwarder needed — the bypass shortcuts verification entirely.
- When Xcode 26's `devicectl` misdetects a simulator as a physical device and `expo run:ios` fails on signing, fall back to direct `xcodebuild` with `CODE_SIGNING_ALLOWED=NO`. Recipe in `store-assets/README.md` → Build pitfalls.

**Outstanding (external):** lawyer's HWG sweep + GDPR jargon final call on description copy.

### 2026-05-22: Hours-Calculation Explainer Sheet

**What shipped:**
- Shared `HoursExplainerSheet` bottom-sheet (inline `Animated.View`, not `Modal`) explaining how Planned / Tracked / Overtime / Confirmed are computed.
- ⓘ icon button in the MonthView footer (next to "Überstunden") and in the `HoursSummaryWidget` header on Status.
- i18n: new `hoursExplainer.*` block (EN + DE); the "Confirmed" bullet calls out the confirmed-vs-total overtime distinction in MonthView so the dual numbers stop being mysterious.

**Deferred:** The "X of Y confirmed" completeness indicator (which would replace the dual confirmed-vs-total overtime display) — captured in `project-mgmt/ticket-overtime-completeness-indicator.md`.

**Key files:** `mobile-app/src/components/HoursExplainerSheet.tsx`, `MonthView.tsx`, `HoursSummaryWidget.tsx`, `StatusScreen.tsx`.

### 2026-05-13: Social Auth — Sign in with Apple + Google (Deployed)

**What shipped:**
- Sign in with Apple (iOS) and Google Sign-In (Android) alongside existing email-code auth
- Redesigned WelcomeScreen: social-first layout, app icon branding, custom Google button with official multi-color G SVG, full-width outlined email button, linked legal footer
- `ProfileForm` extracted from `RegisterScreen` — shared between email and social registration
- `SocialRegistrationScreen` for first-time social users (same required fields as email)
- Platform-conditional native imports (no cross-platform crash)
- `isAvailableAsync()` guard for Apple button (graceful fallback on simulator)
- i18n: "Continue with" / "Weiter mit" (EN + DE)

**Backend (3 new endpoints, deployed to production):**
- `POST /auth/apple` — Apple identity token verification via JWKS
- `POST /auth/google` — Google ID token verification via JWKS
- `POST /auth/social/register` — complete first-time social registration
- `social_auth.py` module: JWKS fetch with 1h TTL cache, social registration tokens (30-min expiry)
- Migration `j0k1l2m3n4o5`: `auth_provider`, `provider_sub` columns, `email_hash` nullable
- 19 tests in `test_social_auth.py`

**Key files:**

| File | Changes |
|------|---------|
| `mobile-app/src/modules/auth/screens/WelcomeScreen.tsx` | Complete redesign |
| `mobile-app/src/modules/auth/components/ProfileForm.tsx` | New — shared registration form |
| `mobile-app/src/modules/auth/screens/SocialRegistrationScreen.tsx` | New |
| `mobile-app/src/modules/auth/components/GoogleLogo.tsx` | New — official multi-color G SVG |
| `mobile-app/src/modules/auth/services/AuthService.ts` | `loginWithApple()`, `loginWithGoogle()`, `completeSocialRegistration()` |
| `mobile-app/src/navigation/AppNavigator.tsx` | `socialRegister` mode |
| `backend/app/social_auth.py` | New — provider verification module |
| `backend/app/routers/auth.py` | 3 social auth endpoints |

**Full design doc:** `docs/SOCIAL_AUTH_PLAN.md`

### 2026-04-22: Build #52 — Android Bugs + Reports Tab + Geofencing Reliability

**Branch:** `fix/android-bugs-2026-03-31` merged with `main` → TestFlight build #52.

**What shipped:**
- 5 Samsung Android bug fixes (map flicker, tap inside circle, tab bar gradient, search map update) — all verified on real Samsung Galaxy A14
- Geofencing reliability phase 1+2: foreground keepalive service, enter validation (reject phantom clock-ins), exit loosening (removed absolute GPS threshold)
- Reports tab (merged from `feature/reports-tab`): week state machine, auto-finalization, collective insights
- Pending-transition UI indicator on Status and Tracking screens
- Migration v7 with idempotent backfill for safe upgrade from any path

**Architecture changes documented in:** `mobile-app/ARCHITECTURE.md` (geofencing reliability, reports module, migration history, react-native-maps pattern)

### 2026-04-15: Consumer Landing Page — Ready on Branch

**Branch:** `feature/consumer-landing-page` — New consumer-focused landing page (DE+EN) with store badges, "So funktioniert's" steps, privacy trust section. Replaces institutional homepage; dossier page kept at `/dossier`. Merge to main when store links are live.

### 2026-04-04: Android Bugfixes — 4 of 5 Fixed on Samsung

**Branch:** `fix/android-bugs-2026-03-31` — **Full write-up:** `docs/ANDROID_BUGS_2026-03-31.md`

| Bug | Fix | File |
|-----|-----|------|
| Map tap inside geofence circle ignored | `tappable={false}` on Circle | SetupScreen, LocationsListScreen |
| Map flickers between locations | Uncontrolled `initialRegion` + `regionRef` (no controlled `region` prop on Android) | LocationsListScreen |
| Search result doesn't update map | Same pattern | SetupScreen |
| Tab bar grey gradient on Samsung | `borderTopWidth: 0` + `elevation: 0` (Android only) | AppNavigator |
| Saving location kills active session | **Not reproducible** on 2026-04-04 retest — monitor, re-verify on device before Play submission (`archive/ANDROID_BUGS_2026-03-31.md`) | GeofenceService, TrackingManager |

**Key lesson:** Never use controlled `region` prop with `animateToRegion` on Android `react-native-maps` — the `onRegionChangeComplete` feedback loop fights animations. Use `initialRegion` + ref + `animateToRegion` only. See `docs/debugging.md` → Android section.

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
