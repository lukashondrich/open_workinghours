# Claude Context: Open Working Hours

**Last Updated:** 2026-01-29
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
   - E2E testing → `mobile-app/ARCHITECTURE.md` → Testing section, or `mobile-app/e2e/README.md`
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
| `mobile-app/ARCHITECTURE.md` | Mobile app details, schemas, patterns, **E2E testing** |
| `backend/ARCHITECTURE.md` | Backend API, database, aggregation |
| `docs/deployment.md` | Docker, Hetzner, production deployment |
| `docs/debugging.md` | Mobile debugging, backend logs, known gotchas |
| `docs/E2E_TESTING_PLAN.md` | E2E testing reference (history, troubleshooting) |
| `docs/WORKFLOW_PATTERNS.md` | Multi-agent workflow, task structuring patterns |
| `mobile-app/e2e/README.md` | Appium test quick start |

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

- **K-anonymity**: Groups need ≥11 users to be published
- **Data residency**: EU only (Hetzner, Germany)
- **Right to erasure**: User deletion cascades to work_events

---

## Recent Updates (Last 7 Days)

### 2026-01-30: E2E Expansion — 51 Tests, Local Build Strategy

**Summary:** Expanded E2E from 32 → 51 tests. Added robustness helpers (`dismissSystemDialogs`, `waitForTestIdWithRetry`). Created 3 new test suites (absences, template arming, manual session). Added testIDs to MonthView, ManualSessionForm, TemplatePanel absence form. Documented local Xcode build strategy to replace EAS for iteration.

**Test Results:** 51/51 passing on iOS. See `docs/E2E_TESTING_PLAN.md` for full coverage table, known issues, and testID reference.

**Key additions:**
- `dismissSystemDialogs()` — comprehensive iOS/Android dialog dismissal (replaces `dismissPermissionDialogs`)
- `waitForTestIdWithRetry()` — generic retry helper for flaky elements
- `absences.test.js` (8 tests), `manual-session.test.js` (8 tests), shifts arming (+3 tests)
- MonthView day cell testIDs (`month-day-YYYY-MM-DD` + indicator testIDs)
- ManualSessionForm + TemplatePanel absence form testIDs
- **Local build strategy:** Xcode 26.2 + CocoaPods verified ready. Use `TEST_MODE=true npx expo run:ios` for simulator builds, EAS only for device/TestFlight. See `docs/E2E_TESTING_PLAN.md` → Build Strategy.

**Detailed reference:** `docs/E2E_TESTING_PLAN.md` (testID reference, build strategy, architecture decisions, session log)

### 2026-01-29: E2E Tests — Both Platforms 32/32, Zero Skips

**Summary:** Four sessions. Modal→inline rendering, CalendarFAB/TemplatePanel accessibility fixes. Both platforms 32/32 with zero skips.

**Detailed session log:** `docs/E2E_TESTING_PLAN.md` → Session Log → 2026-01-29

### 2026-01-28: Android E2E Stable (32/32)

Android fully passing. iOS accessibility issues fixed in 2026-01-29 sessions.

### 2026-01-27: Android E2E — All 24 Tests Passing

Android permission handling, auth state management, FAB accessibility. Framework: Appium 3.1.2 + WebdriverIO + Jest + Node 22.

**Detailed session log:** `docs/E2E_TESTING_PLAN.md` → Session Log → 2026-01-27

### 2026-01-26: E2E Testing - iOS Working, Tab Fix Applied
- **iOS:** 24/24 tests passing ✅
- **Framework:** Appium 3.1.2 + WebdriverIO + Jest + Node 22
- **Test location:** `mobile-app/e2e/`
- **Key fixes:**
  - Fixed EAS build (removed deprecated privacy/rating fields, fixed .gitignore for assets)
  - Bilingual selectors (tests work regardless of device locale)
  - Auto-detect simulators (no hardcoded UDIDs)
  - Infrastructure script handles Node 22 requirement
  - **Fixed Android tab bar testID** - changed `tabBarTestID` → `tabBarButtonTestID`
- **Android tab fix details:**
  - **Root cause:** Wrong property name - `tabBarTestID` doesn't exist in React Navigation v7
  - **Solution:** Use `tabBarButtonTestID` (passes testID to PlatformPressable)
- **Docs:** `mobile-app/e2e/README.md` has full setup instructions

### 2026-01-25: Accessibility Fixes + Maestro-iOS Investigation
- **Status:** Phase 1-2 accessibility fixes implemented, Maestro testID detection fixed
- **Root cause found:** Nested accessible elements on iOS prevent Maestro from finding child elements by testID
- **Fix:** Added `accessible={false}` to container Views in CalendarFAB, CalendarHeader
- **Now working:** `tapOn: id: "calendar-fab"`, `calendar-prev`, `calendar-next`, `template-add`
- **Planning:** `docs/ACCESSIBILITY_PLAN.md` (added "Maestro-iOS Compatibility" section)
- **Files:** `CalendarFAB.tsx`, `CalendarHeader.tsx`, `TemplatePanel.tsx`, `HoursSummaryWidget.tsx`, `StatusScreen.tsx`

### 2026-01-24: E2E Testing + MCP Integration
- **Status:** Auth + location flows validated, MCP servers configured
- **Planning:** `docs/E2E_TESTING_PLAN.md` (comprehensive status doc)
- **Validated flows:**
  - `auth/registration.yaml` ✅ - Full registration with consent
  - `location/setup.yaml` ✅ - 3-step wizard (search → radius → name)
  - `calendar/shift-management.yaml` ⏳ - Pending
- **MCP servers configured** (`.mcp.json`):
  - `maestro` - Native Maestro MCP for AI-assisted test writing/debugging
  - `mobile-mcp` - Direct simulator control via accessibility tree
- **To use MCP:** Restart Claude Code session (servers load at startup)
- **Next:** Validate calendar flow, explore CI/CD options (Maestro Cloud vs GitHub Actions)
- **Files:** `.mcp.json`, `mobile-app/.maestro/*`, `docs/E2E_TESTING_PLAN.md`

### 2026-01-21: Dashboard Contact Form Email Notifications
- **Feature:** Contact form submissions now send email notifications
- **Email setup:** Created `contact@openworkinghours.org` mailbox (IONOS Mail Basic)
- **Gmail integration:** Configured Gmail to fetch via POP3 + send as contact@
- **Backend changes:**
  - Added `EMAIL__NOTIFICATION_EMAIL` config option
  - Wired `send_inquiry_notification()` to contact form endpoint
  - Updated `docker-compose.yml` to pass new env var
- **Security fix:** Moved Google Maps API key to EAS secrets (was accidentally committed)
  - Created `app.config.js` to reference `process.env.GOOGLE_MAPS_API_KEY`
  - Restricted API key in Google Cloud Console (package name + SHA-1)
- **Files:** `backend/app/config.py`, `backend/app/email.py`, `backend/app/routers/dashboard.py`, `backend/docker-compose.yml`, `mobile-app/app.config.js`

### 2026-01-20: Android Calendar Gesture Fix
- **Problem:** WeekView calendar gestures (scroll, pinch zoom, week navigation) broken on Android
- **Root cause:** RNGH GestureDetector + ScrollView don't coordinate well on Android (works fine on iOS)
- **Solution:** Platform-specific gesture systems - complete separation, not conditional logic
- **iOS (unchanged):** RNGH GestureDetector wrapper with pinch + edge swipe gestures
- **Android (new):**
  - No GestureDetector wrapper (removed to avoid conflicts)
  - Custom PanResponder for pinch zoom (two-finger detection)
  - Velocity-based edge flick for week navigation
  - Separate scroll end handlers per platform
- **What didn't work:** Adjusting thresholds, manual activation, RNGH ScrollView, various combinations
- **Documentation:**
  - `docs/ANDROID_GESTURE_FIX_PLAN.md` - Full exploration history
  - `docs/ANDROID_BUILD_PLAN.md` - Detailed "what worked/didn't work" notes
  - `mobile-app/ARCHITECTURE.md` - "Android Gesture System" section
- **Files:** `mobile-app/src/modules/calendar/components/WeekView.tsx`

### 2026-01-19: Android Build Setup
- **Planning:** `docs/ANDROID_BUILD_PLAN.md` (in progress)
- **Configuration complete:**
  - `app.json`: Android package, versionCode, permissions, Google Maps API key
  - `eas.json`: Android build profiles (development, preview, production)
  - `expo-location` plugin: Background location enabled for Android
- **Google Maps:** API key configured for `react-native-maps` (required on Android, iOS uses MapKit)
- **Android-specific fixes:**
  - Map animation: Fixed search result not moving map (removed conflicting `setRegion` call)
  - Button styling: Changed `variant="outline"` to `variant="secondary"` across all screens (gray border issue on Android)
  - Week swipe navigation: Added RNGH Pan gesture for edge detection (Android lacks iOS bounce behavior)
- **Development setup:**
  - Installed `expo-dev-client` for hot reload
  - Android emulator (Pixel 7a) configured with adb
  - Development + preview builds created on EAS
- **Known issues for next session:** Calendar view UI issues, week swipe needs testing, app icon placeholder
- **Files:** `mobile-app/app.json`, `mobile-app/eas.json`, `SetupScreen.tsx`, `WeekView.tsx`, multiple screens for button styling

### 2026-01-19: German Website Copy Overhaul + Micro-Polish
- **Complete DE copy revision:** All German pages updated with professional, consistent copy
- **New German legal pages:** `/de/impressum` and `/de/datenschutzerklaerung` with proper `LayoutDE`
- **EN legal pages cleaned up:** `/imprint` and `/privacy-policy` now fully English with DE links section
- **Terminology standardization:**
  - "Schichten" (not "Dienste") for shifts throughout
  - "Freigeschaltet" (not "Verfügbar") in dashboard legend
  - "Arbeitgeberzugriff" standardized across all DE pages (including app-privacy-policy)
  - "Verschlüsselung bei der Übertragung" (translated from "Encryption in Transit")
  - "Schutzschwelle (k=11)" consistent throughout DE dashboard
- **i18n improvements:**
  - Added `hreflang` alternates and `canonical` URLs to all legal pages
  - LayoutDE footer now links to German legal pages
  - Added `<slot name="head" />` to both layouts for custom head content
- **Copy polish:**
  - Neutral-institutional form options: "Gewerkschaft/Berufsverband", "Wissenschaft/Forschung"
  - "Privacy by Design" capitalization consistent
  - En-dash (–) standardized in ranges (1–10)
  - Removed absolute "no personal data" claims; server logs acknowledged
- **Bullet formatting fixes:** Converted problematic `ul/li` + manual bullets to `div` throughout
- **Dashboard micro-polish (same day):**
  - EN/DE KPI label: "States Nearing Threshold" / "Bundesländer nahe an der Schwelle"
  - K-anonymity bullet: Added EMA/Health Canada public-disclosure guidance reference
  - DE dossier: Solution block converted to proper `<ul>` bullet list
  - Map legend: Removed duplicate static legend (InteractiveMap component has complete legend)
  - "Krankenhäuser" (plural) in map legend
  - DE dashboard: TestFlight changed from button to text line (matches EN)
- **Files:** All pages under `website/src/pages/de/`, `website/src/pages/dashboard.astro`, `website/src/pages/team.astro`, `website/src/pages/imprint.astro`, `website/src/pages/privacy-policy.astro`, `website/src/layouts/Layout.astro`, `website/src/layouts/LayoutDE.astro`, `website/src/components/InteractiveMap/InteractiveMap.tsx`

### 2026-01-18: Public Dashboard + Interactive Map
- **Planning:** `docs/PUBLIC_DASHBOARD_PLAN.md`, `docs/INTERACTIVE_MAP_PLAN.md` (Phase 1 complete)
- **Interactive D3.js map:** 16 German states, 1,220 hospital dots, bilingual (EN/DE)
- **Website pages:** `/dashboard` (EN), `/de/dashboard` (DE)
- **Files:** `website/src/components/InteractiveMap/`, `backend/app/routers/dashboard.py`

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
