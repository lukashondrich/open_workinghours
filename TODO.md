# Open Working Hours - Development TODO

**Last Updated:** 2025-01-18
**Current Focus:** Module 1 - Geofencing & Basic Tracking

---

## 📍 Development Strategy

This project uses a **modular development approach** starting with the highest-risk component first:

1. **Build Module 1 FIRST** (2-3 weeks) - Validate geofencing works reliably
2. **Decision Point** - If geofencing works → continue with full blueprint; If not → pivot to manual-entry-first
3. **Then build remaining modules** (Calendar, Privacy, Submission, Polish)

### Why Geofencing First?

- ✅ **De-risks early**: Geofencing is the highest-risk assumption (iOS/Android background behavior is unpredictable)
- ✅ **Fast feedback**: Test on real devices by Day 3
- ✅ **Testable**: Small surface area, comprehensive tests
- ✅ **Motivating**: See location tracking working immediately

---

## 🎯 Current Phase: Module 1 - Geofencing & Basic Tracking

**Timeline:** 2-3 weeks
**Goal:** Minimal working app that proves background geofencing works
**Success Criteria:**
- [ ] Background geofencing works on iOS and Android
- [ ] Battery usage < 5% over 8 hours
- [ ] Data persists in local SQLite database
- [ ] 85%+ test coverage

**What's Included:**
- ✅ Expo React Native app
- ✅ Location permissions flow
- ✅ Geofence setup (map + radius selection)
- ✅ Background location tracking
- ✅ Auto clock-in/out via geofencing
- ✅ Manual clock-in/out fallback
- ✅ Local SQLite storage
- ✅ Simple tracking history view
- ✅ Comprehensive testing

**What's Excluded (For Now):**
- ❌ Email verification (use hardcoded user for testing)
- ❌ Calendar/planning features
- ❌ Differential privacy
- ❌ Backend submission
- ❌ UI polish

---

## Module 1 Task Breakdown

### Phase 1.1: Project Setup (Day 1)
**Goal:** Working Expo app that runs on your device

- [x] 1. Install Node.js 18+ and pnpm *(already installed)*
- [ ] 2. Install Expo CLI: `npm install -g expo-cli`
- [ ] 3. Install EAS CLI: `npm install -g eas-cli`
- [ ] 4. Create Expo account (for builds later)
- [ ] 5. Set up iOS simulator / Android emulator
- [ ] 6. Initialize mobile app directory
  ```bash
  cd /Users/user01/open_workinghours
  npx create-expo-app mobile-app --template blank-typescript
  cd mobile-app
  ```
- [ ] 7. Install core dependencies:
  ```bash
  npx expo install expo-location expo-task-manager expo-sqlite expo-notifications
  npx expo install react-native-maps
  npm install uuid date-fns
  npm install -D jest @testing-library/react-native @testing-library/jest-native
  ```
- [ ] 8. Configure TypeScript (strict mode, path aliases)
- [ ] 9. Set up Jest for testing
- [ ] 10. Create folder structure:
  ```
  src/modules/geofencing/{__tests__,components,services,screens,hooks}
  src/lib
  e2e
  scripts
  ```
- [ ] 11. Create test utilities and mocks
- [ ] 12. Run `expo start` and test on device (blank screen is fine)

**Deliverable:** ✅ Expo app runs on your phone (scan QR code in Expo Go app)

---

### Phase 1.2: Database Layer (Days 2-3)
**Goal:** Local SQLite storage working and tested

#### Schema v1.0 (Minimal)
```sql
-- User locations (geofences)
CREATE TABLE user_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tracking sessions (clock in/out events)
CREATE TABLE tracking_sessions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  duration_minutes INTEGER,
  tracking_method TEXT NOT NULL,  -- "geofence_auto" | "manual"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (location_id) REFERENCES user_locations(id)
);

-- Geofence events log (debugging)
CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- "enter" | "exit"
  timestamp TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  FOREIGN KEY (location_id) REFERENCES user_locations(id)
);

-- Schema version
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

#### Tasks
- [ ] 13. Create `src/modules/geofencing/types.ts` (TypeScript interfaces)
- [ ] 14. Create `src/modules/geofencing/constants.ts` (config values)
- [ ] 15. Create `src/modules/geofencing/services/Database.ts`
- [ ] 16. Implement database initialization with schema
- [ ] 17. Implement CRUD methods for `user_locations`
- [ ] 18. Implement CRUD methods for `tracking_sessions`
- [ ] 19. Implement methods for `geofence_events`
- [ ] 20. Write comprehensive unit tests (Database.test.ts)
  - Schema creation
  - Insert/update/delete locations
  - Clock in/out sessions
  - Query active sessions
  - Session history
  - Foreign key constraints
  - Error handling
- [ ] 21. Run tests: `npm test -- Database.test.ts`
- [ ] 22. Achieve 90%+ coverage on Database.ts

**Deliverable:** ✅ Fully tested database layer with 90%+ coverage

---

### Phase 1.3: Geofence Service (Days 4-5)
**Goal:** Wrapper around expo-location with testable service layer

- [ ] 23. Create `src/modules/geofencing/services/GeofenceService.ts`
- [ ] 24. Implement permission methods:
  - `requestForegroundPermissions()`
  - `requestBackgroundPermissions()`
  - `hasForegroundPermissions()`
  - `hasBackgroundPermissions()`
- [ ] 25. Implement geofence registration:
  - `registerGeofence(location)`
  - `unregisterGeofence(locationId)`
  - `stopAll()`
  - `isGeofencingActive()`
  - `getRegisteredGeofences()`
- [ ] 26. Implement background task definition:
  - `defineBackgroundTask(callback)`
- [ ] 27. Write comprehensive unit tests (GeofenceService.test.ts)
  - Mock expo-location
  - Test permission requests
  - Test geofence registration/unregistration
  - Test background task callback
- [ ] 28. Run tests: `npm test -- GeofenceService.test.ts`
- [ ] 29. Achieve 85%+ coverage on GeofenceService.ts

**Deliverable:** ✅ Fully tested GeofenceService with mocked expo-location

---

### Phase 1.4: Tracking Manager (Day 6)
**Goal:** Business logic connecting geofence events to database

- [ ] 30. Create `src/modules/geofencing/services/TrackingManager.ts`
- [ ] 31. Implement geofence event handlers:
  - `handleGeofenceEnter(event)` → auto clock-in
  - `handleGeofenceExit(event)` → auto clock-out
- [ ] 32. Implement manual controls:
  - `clockIn(locationId)` → manual clock-in
  - `clockOut(locationId)` → manual clock-out
- [ ] 33. Implement queries:
  - `getActiveSession(locationId)`
  - `getHistory(locationId, limit)`
- [ ] 34. Add notifications (expo-notifications):
  - Clock-in notification: "🟢 Clocked in at [Hospital]"
  - Clock-out notification: "Clocked out. Worked X hours"
- [ ] 35. Write comprehensive unit tests (TrackingManager.test.ts)
  - Clock in on enter event
  - Ignore enter if already clocked in
  - Clock out on exit event
  - Ignore exit if not clocked in
  - Calculate duration correctly
  - Send notifications (mocked)
  - Manual clock-in/out
  - Error handling
- [ ] 36. Run tests: `npm test -- TrackingManager.test.ts`
- [ ] 37. Achieve 85%+ coverage on TrackingManager.ts

**Deliverable:** ✅ TrackingManager with full test coverage

---

### Phase 1.5: UI Components (Days 7-10)
**Goal:** Build screens and connect to services

#### React Hooks (Service → UI Bridge)
- [ ] 38. Create `src/modules/geofencing/hooks/useGeofence.ts`
  - Load locations from DB
  - Create/update/delete locations
  - Request permissions
- [ ] 39. Create `src/modules/geofencing/hooks/useTracking.ts`
  - Get active session
  - Manual clock in/out
  - Real-time duration timer
- [ ] 40. Create `src/modules/geofencing/hooks/useTrackingLog.ts`
  - Load session history
  - Filter by date range

#### Screens
- [ ] 41. Create `src/modules/geofencing/screens/SetupScreen.tsx`
  - Map view (react-native-maps)
  - Drop pin to set hospital location
  - Radius slider (100-1000m, default 200m)
  - Location name input
  - Save button → create geofence
  - Permission requests
- [ ] 42. Create `src/modules/geofencing/screens/TrackingScreen.tsx`
  - Current status indicator (active/inactive)
  - Location name
  - Clock-in time (if active)
  - Duration timer (if active)
  - Manual clock-in/out buttons
  - Hint text (explain geofencing)
- [ ] 43. Create `src/modules/geofencing/screens/LogScreen.tsx`
  - List of past sessions
  - Date, time range, duration
  - Method indicator (auto vs manual)
  - Empty state

#### Components
- [ ] 44. Create `src/modules/geofencing/components/GeofenceMap.tsx`
  - Map with marker
  - Circle overlay showing radius
  - Draggable marker
- [ ] 45. Create `src/modules/geofencing/components/TrackingStatusBar.tsx`
  - Visual indicator (green = active, gray = inactive)
  - Clock-in time
  - Duration
- [ ] 46. Create basic UI components (Button, Card, Input, etc.)

#### Navigation
- [ ] 47. Install React Navigation: `npm install @react-navigation/native @react-navigation/native-stack`
- [ ] 48. Create navigation structure:
  - Stack navigator: Setup → Tracking → Log
  - Tab navigator (for later)
- [ ] 49. Wire up screens to navigator

#### App Initialization
- [ ] 50. Update `App.tsx`:
  - Initialize database on startup
  - Initialize GeofenceService
  - Define background task
  - Re-register existing geofences
  - Set up notification handler
  - Render navigator

**Deliverable:** ✅ Working UI with all screens functional

---

### Phase 1.6: Integration & Device Testing (Days 11-14)
**Goal:** Test on real devices, validate battery usage, fix bugs

#### Integration Testing
- [ ] 51. Test complete flow on iOS simulator:
  - Set up geofence
  - Simulate location (Feature → Location → Custom)
  - Trigger enter event
  - Verify clock-in
  - Trigger exit event
  - Verify clock-out
- [ ] 52. Test complete flow on Android emulator:
  - Same as iOS
  - Test with different Android versions
- [ ] 53. Test manual clock-in/out works without geofencing
- [ ] 54. Test data persists after app restart
- [ ] 55. Test with multiple locations

#### Real Device Testing (iOS)
- [ ] 56. Build development client: `npx expo run:ios`
- [ ] 57. Install on iPhone
- [ ] 58. Grant location permissions (When In Use)
- [ ] 59. Set up geofence near real location
- [ ] 60. Walk outside geofence radius
- [ ] 61. Verify clock-out notification
- [ ] 62. Walk back inside
- [ ] 63. Verify clock-in notification
- [ ] 64. **Test background mode:**
  - Set up geofence
  - Clock in
  - Lock phone
  - Walk outside radius
  - Unlock → verify clocked out
- [ ] 65. **Test app killed:**
  - Set up geofence
  - Force quit app
  - Walk into geofence
  - Open app → verify session exists
- [ ] 66. **Battery test:**
  - Charge to 100%
  - Set up geofence
  - Clock in
  - Lock phone for 8 hours
  - Check battery usage in Settings
  - **Target: < 5% drain**

#### Real Device Testing (Android)
- [ ] 67. Build development client: `npx expo run:android`
- [ ] 68. Install on Android phone
- [ ] 69. Repeat iOS tests 58-66
- [ ] 70. Test with battery optimization ON
- [ ] 71. Test with battery optimization OFF
- [ ] 72. Verify persistent notification (Android requirement)

#### Bug Fixes
- [ ] 73. Document all bugs in GitHub issues
- [ ] 74. Fix critical bugs (crashes, data loss)
- [ ] 75. Fix high-priority UX issues
- [ ] 76. Optimize battery usage if needed
- [ ] 77. Add error handling for edge cases

#### Documentation
- [ ] 78. Create `mobile-app/README.md`:
  - Setup instructions
  - How to run on device
  - How to test geofencing
  - Known limitations
- [ ] 79. Document testing protocol
- [ ] 80. Document battery optimization settings per manufacturer

**Deliverable:** ✅ Module 1 complete, validated on real devices

---

## 📊 Module 1 Success Criteria

Before moving to Module 2, ensure:

- [ ] **All unit tests pass** (Database, GeofenceService, TrackingManager)
- [ ] **Test coverage ≥ 85%** overall
- [ ] **Tested on ≥ 2 iOS devices** (different iOS versions)
- [ ] **Tested on ≥ 2 Android devices** (different manufacturers)
- [ ] **Background geofencing works** (app closed, still tracks)
- [ ] **Battery usage < 5%** over 8 hours background
- [ ] **Data persists** across app restarts
- [ ] **Manual fallback works** (if geofencing unavailable)
- [ ] **README documentation complete**

---

## 🔍 Decision Point: After Module 1

### If Geofencing Works Reliably ✅
→ **Proceed to Module 2**: Privacy Pipeline
→ **Then Module 3**: Calendar & Planning
→ **Then Module 4**: Submission & Backend
→ **Then Module 5**: Polish & TestFlight

### If Geofencing Unreliable ❌
→ **Pivot**: Manual-entry-first approach
→ Build calendar first, geofencing as optional enhancement
→ Lower expectations for automatic tracking

---

## 🚀 Future Modules (After Module 1)

### Module 2: Privacy Pipeline (1-2 weeks)
**Reference:** blueprint.md section 4

- [ ] Differential privacy implementation (ε=1.0)
- [ ] Laplace noise generator
- [ ] Rounding to 0.5h bins
- [ ] Weekly aggregation
- [ ] Submission queue with retry logic
- [ ] Comprehensive tests for noise distribution

### Module 3: Calendar & Planning (2-3 weeks)
**Reference:** Port from web app components

- [ ] Shift templates (create, edit, delete)
- [ ] Week view calendar
- [ ] Drag-to-place shifts
- [ ] Review mode (compare planned vs tracked)
- [ ] Edit tracked times
- [ ] Confirm days as reviewed

### Module 4: Submission & Backend Integration (2-3 weeks)
**Reference:** blueprint.md section 6, backend/README.md

**Approach:** Extend existing `/backend` (FastAPI) with mobile endpoints. Same backend serves both web dashboard (daily reports) and mobile app (weekly noisy reports).

#### Backend Work (Extend Existing `/backend`)
- [ ] Create Alembic migration for `users` table:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    email_hash VARCHAR(64) UNIQUE NOT NULL,
    affiliation_token TEXT NOT NULL,
    hospital_domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Create Alembic migration for `submitted_reports` table:
  ```sql
  CREATE TABLE submitted_reports (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    week_start DATE NOT NULL,
    total_hours_worked FLOAT NOT NULL,    -- NOISY value
    total_overtime_hours FLOAT NOT NULL,  -- NOISY value
    staff_group VARCHAR(50) NOT NULL,
    hospital_domain VARCHAR(255) NOT NULL,
    privacy_epsilon FLOAT DEFAULT 1.0,
    submitted_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Create `/backend/app/routers/submissions.py` (new router)
- [ ] Implement `POST /submissions/weekly` endpoint
  - Accept noisy weekly data from mobile
  - Validate: week_start is Monday, hours 0-168
  - Store in `submitted_reports` table
- [ ] Implement `GET /submissions/history` endpoint
  - Return user's own past weekly submissions
  - Requires JWT auth
- [ ] Update `/backend/app/main.py` to include submissions router
- [ ] Test both endpoints coexist:
  - Web: `POST /reports/` (daily, raw)
  - Mobile: `POST /submissions/weekly` (weekly, noisy)
- [ ] Add README to `/backend` explaining dual-client architecture
- [ ] Deploy updated backend to Hetzner (Germany)

#### Mobile Work
- [ ] Email verification flow (reuse web backend)
- [ ] Week selection screen
- [ ] Summary screen (before/after privacy)
- [ ] Apply privacy pipeline
- [ ] Submit to backend
- [ ] Submission history screen
- [ ] Offline queue

### Module 5: Onboarding & Polish (2-3 weeks)

- [ ] Onboarding flow (5-screen tour)
- [ ] Settings screen
- [ ] Privacy settings explanation
- [ ] Data export (GDPR compliance)
- [ ] App icons, splash screen
- [ ] Notifications polish
- [ ] UI/UX improvements
- [ ] Dark mode support (optional)

### Module 6: iOS TestFlight (1 week)

- [ ] Apple Developer Account ($99/year) **← REQUIRED HERE**
- [ ] App ID, provisioning profiles
- [ ] Configure Info.plist (location permissions)
- [ ] EAS Build for iOS
- [ ] Upload to TestFlight
- [ ] Internal testing
- [ ] External testing (beta review)

### Module 7: Android Google Play (1 week)

- [ ] Google Play Developer Account ($25) **← REQUIRED HERE**
- [ ] Generate signing keystore
- [ ] Configure AndroidManifest.xml
- [ ] EAS Build for Android
- [ ] Upload to Google Play Console
- [ ] Internal testing track
- [ ] Beta testing

### Module 8: Beta Testing & Launch (2-3 weeks)

- [ ] Recruit 5-10 healthcare worker testers
- [ ] 1-week beta period
- [ ] Collect feedback
- [ ] Bug fixes
- [ ] Privacy policy, terms of service
- [ ] Public launch

---

## 📱 Testing Requirements & Timeline

### What You Need Now (Module 1)
- ✅ **Physical iOS device** (iPhone with latest iOS)
- ✅ **Physical Android device** (any Android 10+)
- ✅ **Expo Go app** (free, from App Store/Play Store)
- ✅ **Mac with Xcode** (for iOS development client)
- ✅ **Android Studio** (for Android development client)
- ❌ **Apple Developer Account** - NOT needed yet (only for TestFlight in Module 6)
- ❌ **Google Play Account** - NOT needed yet (only for Play Store in Module 7)

### What You'll Need Later

#### For Module 6 (TestFlight)
- 💰 **Apple Developer Account** ($99/year)
  - Required to distribute via TestFlight
  - Can build and test locally without it for now
  - Sign up at: https://developer.apple.com/programs/

#### For Module 7 (Google Play)
- 💰 **Google Play Developer Account** ($25 one-time)
  - Required to distribute via Play Store
  - Can build and test locally without it for now
  - Sign up at: https://play.google.com/console/signup

### Development Client vs. Expo Go

**For Module 1, you have two options:**

#### Option A: Expo Go (Simpler, Faster)
- ✅ No Apple/Google accounts needed
- ✅ Instant updates (scan QR code)
- ✅ Good for initial development
- ❌ Background geofencing may not work fully
- ❌ Some native features limited

**Recommended for:** Quick prototyping, UI development

#### Option B: Development Client (More Realistic)
- ✅ Full native features (geofencing, background tasks)
- ✅ Identical to production behavior
- ✅ Test background modes
- ❌ Slower to build/update
- ❌ Requires Xcode/Android Studio

**Recommended for:** Geofencing testing (Phase 1.6)

**You'll likely use both:**
- Days 1-10: Expo Go for UI development
- Days 11-14: Development client for geofencing testing

---

## 📈 Progress Tracking

**Module 1 Progress:** 0/80 tasks complete (0%)

**Milestones:**
- [ ] Phase 1.1 Complete (Setup)
- [ ] Phase 1.2 Complete (Database)
- [ ] Phase 1.3 Complete (Geofence Service)
- [ ] Phase 1.4 Complete (Tracking Manager)
- [ ] Phase 1.5 Complete (UI)
- [ ] Phase 1.6 Complete (Device Testing)
- [ ] Module 1 Complete (Decision Point)

---

## 🔧 Development Commands Reference

```bash
# Module 1 Setup
cd /Users/user01/open_workinghours
npx create-expo-app mobile-app --template blank-typescript
cd mobile-app

# Install dependencies
npx expo install expo-location expo-task-manager expo-sqlite expo-notifications react-native-maps
npm install uuid date-fns
npm install -D jest @testing-library/react-native @testing-library/jest-native

# Development
npm start                    # Start Expo dev server
npm test                     # Run unit tests
npm test -- --watch          # Run tests in watch mode
npm test -- --coverage       # Run tests with coverage report

# Build development clients
npx expo run:ios             # Build for iOS simulator/device
npx expo run:android         # Build for Android emulator/device

# Production builds (Module 6+)
eas build --platform ios     # Build for TestFlight
eas build --platform android # Build for Play Store
```

---

## 📚 Key Reference Documents

| Document | Purpose |
|----------|---------|
| `blueprint.md` | Complete system architecture (38KB, read first!) |
| `MODULE_1_PLAN.md` | Detailed Module 1 implementation guide with code examples |
| `backend/README.md` | Backend architecture, endpoints (web + mobile), deployment |
| `claude.md` | Context for AI assistants |
| `.vercelignore` | Protects web deployment from mobile changes |

---

## ❓ Common Questions

**Q: Can I skip the backend and test everything locally?**
A: Yes! Module 1 is 100% local (no backend needed). Backend is only needed for Module 4 (submission).

**Q: Do I need TestFlight to test on my iPhone?**
A: No! Use development client (`npx expo run:ios`). TestFlight is only for distributing to other testers.

**Q: What if geofencing doesn't work reliably?**
A: That's the point of Module 1! We validate early so we can pivot if needed.

**Q: Can I use the web app's calendar code?**
A: Yes! Port components from `components/week-view.tsx` and `lib/calendar-utils.ts` in Module 3.

**Q: Is the existing backend ready for mobile?**
A: Partially. Verification endpoints work, but mobile needs NEW weekly submission endpoints. See `backend/README.md`.

---

**Last Updated:** 2025-01-18
**Current Phase:** Module 1 - Setup (Day 1)
**Next Task:** Install Expo CLI and create mobile-app directory
