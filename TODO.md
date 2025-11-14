# Open Working Hours - Master Todo List

## 📋 Complete Implementation Checklist

This is the master todo list for implementing the mobile location tracking app with differential privacy. Use this as your primary reference for tracking progress.

---

## Phase 0: Setup & Preparation (Week 0)

### Environment Setup
- [ ] 1. Install Node.js 18+ and pnpm
- [ ] 2. Install Expo CLI globally: `npm install -g expo-cli`
- [ ] 3. Install EAS CLI: `npm install -g eas-cli`
- [ ] 4. Create Expo account (for builds)
- [ ] 5. Install Xcode (Mac) for iOS development
- [ ] 6. Install Android Studio for Android development
- [ ] 7. Set up iOS simulator / Android emulator
- [ ] 8. Apply for Apple Developer Account ($99/year)
- [ ] 9. Set up Google Play Developer Account ($25 one-time)

### Backend Setup
- [ ] 10. Set up Hetzner server (EU region - Germany)
- [ ] 11. Install PostgreSQL 15+ on server
- [ ] 12. Configure firewall (allow 443, 80, PostgreSQL port)
- [ ] 13. Set up SSL certificate (Let's Encrypt)
- [ ] 14. Install Python 3.11+
- [ ] 15. Install Poetry or pip
- [ ] 16. Set up backend `.env` file with secrets

### Project Initialization
- [ ] 17. Create `mobile-app/` directory
- [ ] 18. Initialize Expo project: `npx create-expo-app mobile-app --template blank-typescript`
- [ ] 19. Install core dependencies (see package.json below)
- [ ] 20. Set up Git branch for mobile app development
- [ ] 21. Create project structure (folders: src/api, src/services, src/screens, etc.)

---

## Phase 1: Backend Foundation (Week 1)

### Database Schema
- [ ] 22. Create migration for `users` table (id, email_hash, affiliation_token, hospital_domain, created_at)
- [ ] 23. Create migration for `submitted_reports` table (id, user_id, week_start, total_hours, total_overtime, staff_group, hospital_domain, privacy_epsilon, submitted_at)
- [ ] 24. Add indexes: (user_id), (week_start, staff_group), (hospital_domain, week_start)
- [ ] 25. Run migrations on dev database
- [ ] 26. Run migrations on production database (Hetzner)

### Authentication
- [ ] 27. Update `users` model to store email as SHA256 hash
- [ ] 28. Implement JWT token generation (expiry: 30 days)
- [ ] 29. Create `get_current_user` dependency for protected routes
- [ ] 30. Add rate limiting to verification endpoints (3 req/min for request, 5 req/min for confirm)
- [ ] 31. Test verification flow with Postman

### Submissions API
- [ ] 32. Create `backend/app/routers/submissions.py`
- [ ] 33. Implement `POST /submissions/weekly` endpoint
- [ ] 34. Add validation: week_start must be Monday, hours 0-168, no future dates
- [ ] 35. Add duplicate check (prevent re-submitting same week)
- [ ] 36. Implement `GET /submissions/history` endpoint (user's own submissions)
- [ ] 37. Test submission endpoint with curl/Postman
- [ ] 38. Add CORS middleware for mobile app origins

### Analytics Updates
- [ ] 39. Update analytics query to aggregate weekly submissions by month
- [ ] 40. Update suppression logic (N < 5)
- [ ] 41. Test analytics endpoint returns correct aggregates

---

## Phase 2: Mobile App Foundation (Week 2)

### Project Structure
- [ ] 42. Create folder structure: `src/api`, `src/services`, `src/screens`, `src/components`, `src/store`, `src/lib`
- [ ] 43. Set up TypeScript types in `src/lib/types.ts` (copy from Next.js `lib/types.ts`)
- [ ] 44. Create constants file: `src/lib/constants.ts` (API URL, privacy params)

### Navigation
- [ ] 45. Install React Navigation dependencies
- [ ] 46. Create stack navigator structure (Onboarding, Main, Settings)
- [ ] 47. Create tab navigator for main app (Calendar, Tracking, Submission, Settings)
- [ ] 48. Implement navigation guards (redirect to onboarding if not verified)

### API Client
- [ ] 49. Create `src/api/client.ts` (HTTP client with auth headers)
- [ ] 50. Implement `src/api/verification.ts` (requestVerification, confirmVerification)
- [ ] 51. Implement `src/api/submissions.ts` (submitWeekly, getHistory)
- [ ] 52. Implement `src/api/analytics.ts` (fetchAnalytics)
- [ ] 53. Add retry logic with exponential backoff
- [ ] 54. Test API client connects to backend

### Local Storage
- [ ] 55. Install expo-sqlite, expo-secure-store, @react-native-async-storage/async-storage
- [ ] 56. Create `src/services/storage/Database.ts`
- [ ] 57. Implement SQLite schema: shift_templates, shift_instances, tracked_times, user_locations, submission_history
- [ ] 58. Implement database initialization with encryption (SQLCipher)
- [ ] 59. Create CRUD methods for each table
- [ ] 60. Create `src/services/storage/SecureStore.ts` wrapper (store affiliation_token)
- [ ] 61. Test local database read/write

### State Management
- [ ] 62. Install Zustand (or Redux Toolkit)
- [ ] 63. Create `src/store/authSlice.ts` (user, token, isVerified)
- [ ] 64. Create `src/store/calendarSlice.ts` (templates, instances - synced with local DB)
- [ ] 65. Create `src/store/trackingSlice.ts` (tracked times, active session)
- [ ] 66. Create `src/store/submissionSlice.ts` (pending queue, history)
- [ ] 67. Wire up store to persist to local DB on changes

### UI Components (Basic)
- [ ] 68. Create design system folder: `src/components/ui/`
- [ ] 69. Implement Button component
- [ ] 70. Implement Card component
- [ ] 71. Implement Input component
- [ ] 72. Implement Modal component
- [ ] 73. Set up theme colors (neutral palette from Next.js)

---

## Phase 3: Essential Privacy Features (Week 3)

### Differential Privacy Module
- [ ] 74. Create `src/services/privacy/DifferentialPrivacy.ts`
- [ ] 75. Implement `addLaplaceNoise(value, epsilon, sensitivity)` function
- [ ] 76. Implement `roundToBin(value, binSize)` function
- [ ] 77. Implement `applyPrivacyProtections(weeklyHours)` pipeline
- [ ] 78. Write unit tests for Laplace noise (verify distribution)
- [ ] 79. Write unit tests for rounding
- [ ] 80. Add constants: PRIVACY_CONFIG { epsilon: 1.0, sensitivity: 168, roundingGranularity: 0.5 }

### Aggregation Module
- [ ] 81. Create `src/services/privacy/Aggregation.ts`
- [ ] 82. Implement `aggregateWeek(dailyTrackedTimes[])` function
- [ ] 83. Handle edge cases (missing days, partial weeks)
- [ ] 84. Write unit tests

### Submission Queue
- [ ] 85. Create `src/services/privacy/SubmissionQueue.ts`
- [ ] 86. Implement `queueSubmission(weekData, user)` - applies privacy before queueing
- [ ] 87. Implement `processQueue()` - sends pending submissions
- [ ] 88. Implement `getQueue()`, `removeFromQueue()`, `moveToFailedQueue()`
- [ ] 89. Store queue in AsyncStorage
- [ ] 90. Set up background task to call `processQueue()` every 15 min
- [ ] 91. Test queue survives app restart
- [ ] 92. Test retry logic (manually fail network, verify retry)

### End-to-End Privacy Test
- [ ] 93. Create test data: 40 hours tracked across 5 days
- [ ] 94. Call `queueSubmission()` with test data
- [ ] 95. Verify noisy value is different from true value
- [ ] 96. Verify noisy value is sent to backend (check backend logs)
- [ ] 97. Verify backend stores noisy value (query database)
- [ ] 98. Verify true value never leaves device (check network logs)

---

## Phase 4: Onboarding Flow (Week 3 continued)

### Verification Screen
- [ ] 99. Create `src/screens/onboarding/VerificationScreen.tsx`
- [ ] 100. Port `VerificationForm` logic from Next.js component
- [ ] 101. Implement email input → request code → enter code → success
- [ ] 102. Store affiliation_token in SecureStore on success
- [ ] 103. Extract hospital_domain from email
- [ ] 104. Navigate to LocationSetupScreen after verification

### Location Setup Screen
- [ ] 105. Create `src/screens/onboarding/LocationSetupScreen.tsx`
- [ ] 106. Install react-native-maps
- [ ] 107. Implement map view with current location
- [ ] 108. Add "Drop Pin" button to set hospital location
- [ ] 109. Add radius slider (100m - 1000m, default 200m)
- [ ] 110. Add location name input
- [ ] 111. Save to local DB: user_locations table
- [ ] 112. Request location permissions (when in use)
- [ ] 113. Add "Skip for now" option (can add manually later)
- [ ] 114. Navigate to main app after setup

### Permissions Handling
- [ ] 115. Request "When In Use" location permission during setup
- [ ] 116. Show permission rationale screen (explain why location is needed)
- [ ] 117. Handle permission denied (offer manual clock-in/out only)
- [ ] 118. Add settings screen to re-request permissions later

---

## Phase 5: Calendar & Planning (Weeks 4-5)

### Templates
- [ ] 119. Create `src/screens/calendar/TemplateManager.tsx`
- [ ] 120. Port ShiftTemplatePanel logic from Next.js
- [ ] 121. Implement create template (name, start time, duration, color)
- [ ] 122. Implement edit template
- [ ] 123. Implement delete template (with confirmation)
- [ ] 124. Save templates to local DB
- [ ] 125. Implement template picker/selector

### Calendar Views
- [ ] 126. Create `src/screens/calendar/CalendarScreen.tsx`
- [ ] 127. Port WeekView component from Next.js
- [ ] 128. Implement time grid (Y-axis: hours, X-axis: days)
- [ ] 129. Implement drag-to-place shift from template
- [ ] 130. Implement tap empty slot to place shift
- [ ] 131. Show existing instances on grid
- [ ] 132. Implement instance editing (tap to edit start time/duration)
- [ ] 133. Implement instance deletion (swipe or long-press)
- [ ] 134. Create MonthView component (optional, can be post-MVP)
- [ ] 135. Add week navigation (prev/next buttons)

### Instance Management
- [ ] 136. Save instances to local DB on create/update/delete
- [ ] 137. Query instances for current week from DB
- [ ] 138. Handle instance spanning multiple days (split at midnight)
- [ ] 139. Prevent overlapping instances (validation)
- [ ] 140. Add 5-minute snap-to-grid
- [ ] 141. Implement move up/down buttons (5-minute increments)

### Review Mode
- [ ] 142. Create `src/screens/calendar/ReviewMode.tsx`
- [ ] 143. Toggle between planning and review mode
- [ ] 144. Query both instances (planned) and tracked_times (actual) for week
- [ ] 145. Display side-by-side or overlay comparison
- [ ] 146. Highlight discrepancies (planned 8h, tracked 7.5h)
- [ ] 147. Allow editing tracked times (adjust clock-in/clock-out)
- [ ] 148. Add notes field for corrections
- [ ] 149. Mark day as "reviewed" (is_reviewed flag)
- [ ] 150. Disable submit until all days reviewed

---

## Phase 6: Geofencing & Tracking (Weeks 6-7)

### Geofence Service
- [ ] 151. Create `src/services/geofencing/GeofenceService.ts`
- [ ] 152. Install expo-location, expo-task-manager
- [ ] 153. Implement `registerGeofence(location)` using expo-location
- [ ] 154. Implement `unregisterGeofence(locationId)`
- [ ] 155. Define background task for geofence events
- [ ] 156. Handle `onEnter` event → call `clockIn()`
- [ ] 157. Handle `onExit` event → call `clockOut()`
- [ ] 158. Add hysteresis (5-minute dwell time before clock-out)
- [ ] 159. Test geofence triggers in simulator (use fake location)
- [ ] 160. Test on real device near actual hospital

### Tracking Manager
- [ ] 161. Create `src/services/geofencing/TrackingManager.ts`
- [ ] 162. Implement `clockIn(locationId, method)` → save to tracked_times
- [ ] 163. Implement `clockOut(trackingId)` → update tracked_times with clock_out
- [ ] 164. Check for existing active sessions before clock-in
- [ ] 165. Auto-close stale sessions (> 24h old)
- [ ] 166. Calculate duration on clock-out
- [ ] 167. Link to shift_instance if one exists for that date/time

### Notifications
- [ ] 168. Install expo-notifications
- [ ] 169. Request notification permissions
- [ ] 170. Send notification on auto clock-in: "🟢 Clocked in at [Hospital Name]"
- [ ] 171. Send notification on auto clock-out: "Clocked out. Worked X hours."
- [ ] 172. Add persistent notification when tracking active (Android)
- [ ] 173. Handle notification tap (open app to tracking screen)

### Manual Clock-In/Out (Fallback)
- [ ] 174. Create `src/screens/tracking/TrackingStatusScreen.tsx`
- [ ] 175. Show current tracking status (active or inactive)
- [ ] 176. Show "Clock In" button when inactive
- [ ] 177. Show "Clock Out" button when active
- [ ] 178. Display duration timer during active session
- [ ] 179. Allow selecting location for manual clock-in
- [ ] 180. Test manual flow works without geofencing enabled

### Background Permissions
- [ ] 181. Request "Always Allow" location permission (optional)
- [ ] 182. Show explanation screen before requesting (iOS requirement)
- [ ] 183. Handle user declining background permission (manual mode)
- [ ] 184. Add settings toggle to enable/disable background tracking
- [ ] 185. Test background tracking works after app is closed
- [ ] 186. Test background tracking survives phone restart

### Location Management
- [ ] 187. Create `src/screens/settings/LocationsManager.tsx`
- [ ] 188. List all saved locations
- [ ] 189. Add new location (same UI as onboarding)
- [ ] 190. Edit location (change radius, name)
- [ ] 191. Delete location (with confirmation)
- [ ] 192. Toggle active/inactive (pause geofence without deleting)
- [ ] 193. Show map with geofence radius overlay

---

## Phase 7: Submission Flow (Week 8)

### Week Selection
- [ ] 194. Create `src/screens/submission/SubmissionScreen.tsx`
- [ ] 195. Query tracked_times grouped by week
- [ ] 196. Display list of weeks with data
- [ ] 197. Show week summary: total hours, days worked, review status
- [ ] 198. Disable unreviewed weeks (must review first)
- [ ] 199. Allow selecting single week or multiple weeks
- [ ] 200. Add date picker for selecting specific week

### Summary Screen
- [ ] 201. Create `src/screens/submission/SummaryScreen.tsx`
- [ ] 202. Display week details: dates, hours per day, total
- [ ] 203. Show "Before Privacy" vs "After Privacy" comparison
- [ ] 204. Display noisy values that will be sent
- [ ] 205. Show privacy parameters: ε=1.0, sensitivity=168, rounding=0.5h
- [ ] 206. Add info box explaining privacy protections
- [ ] 207. Add "Submit" button
- [ ] 208. Add "Cancel" button

### Submission Logic
- [ ] 209. On submit: aggregate week data
- [ ] 210. Apply privacy protections (round + noise)
- [ ] 211. Call `queueSubmission()`
- [ ] 212. Show loading spinner during submission
- [ ] 213. Handle success: show confirmation, mark as submitted in local DB
- [ ] 214. Handle failure: show error, keep in queue for retry
- [ ] 215. Navigate to submission history on success

### Submission History
- [ ] 216. Create `src/screens/submission/HistoryScreen.tsx`
- [ ] 217. Query local submission_history table
- [ ] 218. Display list of past submissions (week, date, hours)
- [ ] 219. Show sync status (pending, sent, failed)
- [ ] 220. Allow retrying failed submissions
- [ ] 221. Show backend response (if available)
- [ ] 222. Add export option (JSON or CSV)

---

## Phase 8: Settings & Polish (Week 8 continued)

### Settings Screen
- [ ] 223. Create `src/screens/settings/SettingsScreen.tsx`
- [ ] 224. Display user info (email, hospital domain)
- [ ] 225. Add "Manage Locations" link
- [ ] 226. Add "Privacy Settings" link
- [ ] 227. Add "Background Tracking" toggle
- [ ] 228. Add "Notifications" toggle
- [ ] 229. Add "Export My Data" button
- [ ] 230. Add "Privacy Policy" link
- [ ] 231. Add "Terms of Service" link
- [ ] 232. Add "About" section (app version, ε value)
- [ ] 233. Add "Log Out" button (clear SecureStore, reset state)

### Privacy Settings
- [ ] 234. Create `src/screens/settings/PrivacySettings.tsx`
- [ ] 235. Explain differential privacy in simple terms
- [ ] 236. Show current privacy parameters (ε=1.0)
- [ ] 237. Add info box: "Your data is protected with ε-differential privacy"
- [ ] 238. Link to learn more (external resource or in-app explanation)

### Data Export
- [ ] 239. Create `src/screens/settings/DataExport.tsx`
- [ ] 240. Implement export all data as JSON
- [ ] 241. Include: templates, instances, tracked_times, submissions
- [ ] 242. Use expo-sharing to let user save/share file
- [ ] 243. Test import on new device (manual process for MVP)

### UI Polish
- [ ] 244. Add loading states to all async operations
- [ ] 245. Add error boundaries
- [ ] 246. Add toast notifications for success/error (use react-native-toast-message)
- [ ] 247. Ensure all screens have proper back buttons
- [ ] 248. Add empty states (no templates, no tracked times, etc.)
- [ ] 249. Add skeleton loaders where appropriate
- [ ] 250. Test dark mode support (if desired)

---

## Phase 9: iOS Build & TestFlight (Week 9)

### iOS Setup
- [ ] 251. Enroll in Apple Developer Program ($99/year)
- [ ] 252. Create App ID in Apple Developer portal
- [ ] 253. Create provisioning profiles
- [ ] 254. Configure app.json with bundle identifier
- [ ] 255. Set up app icons (1024x1024, plus all sizes)
- [ ] 256. Create launch screen (splash screen)
- [ ] 257. Configure Info.plist for location permissions (NSLocationWhenInUseUsageDescription, NSLocationAlwaysUsageDescription)

### EAS Build (iOS)
- [ ] 258. Login to EAS: `eas login`
- [ ] 259. Configure EAS: `eas build:configure`
- [ ] 260. Update eas.json for iOS production build
- [ ] 261. Run iOS build: `eas build --platform ios --profile production`
- [ ] 262. Wait for build to complete (~20-30 min)
- [ ] 263. Download IPA file
- [ ] 264. Test IPA on physical device via TestFlight

### App Store Connect
- [ ] 265. Create app in App Store Connect
- [ ] 266. Fill out app metadata (name, description, keywords)
- [ ] 267. Add screenshots (iPhone 6.5", 6.7", iPad)
- [ ] 268. Add privacy policy URL
- [ ] 269. Configure data collection disclosures (location, working hours)
- [ ] 270. Submit build to TestFlight
- [ ] 271. Wait for Apple review (usually < 24h for TestFlight)
- [ ] 272. Add internal testers (up to 100)
- [ ] 273. Add external testers (beta review required)

---

## Phase 10: Android Build & Google Play (Week 9 continued)

### Android Setup
- [ ] 274. Create Google Play Developer account ($25 one-time)
- [ ] 275. Generate keystore for signing
- [ ] 276. Configure app.json with package name
- [ ] 277. Set up app icons for Android
- [ ] 278. Create launch screen (splash screen)
- [ ] 279. Configure AndroidManifest.xml for permissions

### EAS Build (Android)
- [ ] 280. Update eas.json for Android production build
- [ ] 281. Run Android build: `eas build --platform android --profile production`
- [ ] 282. Wait for build to complete
- [ ] 283. Download AAB (Android App Bundle)
- [ ] 284. Test APK on physical device

### Google Play Console
- [ ] 285. Create app in Google Play Console
- [ ] 286. Fill out store listing (title, description)
- [ ] 287. Add screenshots (phone, tablet)
- [ ] 288. Add app icon (512x512)
- [ ] 289. Configure content rating questionnaire
- [ ] 290. Add privacy policy URL
- [ ] 291. Configure data safety section (location, working hours)
- [ ] 292. Upload AAB to internal testing track
- [ ] 293. Add internal testers
- [ ] 294. Test internal release

---

## Phase 11: Testing & Feedback (Weeks 10-11)

### Internal Testing
- [ ] 295. Install on your own devices (iOS + Android)
- [ ] 296. Test complete user journey: onboard → plan → track → review → submit
- [ ] 297. Test geofencing accuracy (walk in/out of radius)
- [ ] 298. Test background tracking (close app, check if still works)
- [ ] 299. Test manual clock-in/out fallback
- [ ] 300. Test privacy protections (verify noisy values in backend)
- [ ] 301. Test submission queue retry logic (turn off WiFi)
- [ ] 302. Test data export/import
- [ ] 303. Test on multiple devices (different iOS/Android versions)
- [ ] 304. Document all bugs in GitHub issues

### Beta Testing
- [ ] 305. Invite 5-10 healthcare workers as beta testers
- [ ] 306. Provide onboarding instructions
- [ ] 307. Set up feedback channel (email, Slack, form)
- [ ] 308. Collect feedback after 1 week
- [ ] 309. Analyze feedback for critical issues
- [ ] 310. Prioritize bug fixes and UX improvements

### Bug Fixes
- [ ] 311. Fix critical bugs (crashes, data loss)
- [ ] 312. Fix high-priority UX issues
- [ ] 313. Optimize battery usage if needed
- [ ] 314. Improve notification text/timing
- [ ] 315. Release hotfix build to TestFlight/Internal Testing
- [ ] 316. Verify fixes with testers

---

## Phase 12: Documentation (Ongoing)

### User Documentation
- [ ] 317. Write privacy policy (GDPR-compliant)
- [ ] 318. Write terms of service
- [ ] 319. Create user guide: "How to set up geofencing"
- [ ] 320. Create user guide: "How to review and submit hours"
- [ ] 321. Create FAQ: "Why is my data noisy?"
- [ ] 322. Create FAQ: "Is my location tracked 24/7?"
- [ ] 323. Host documentation on website

### Technical Documentation
- [ ] 324. Update blueprint.md with mobile app architecture (this file!)
- [ ] 325. Document privacy implementation details
- [ ] 326. Document API endpoints in OpenAPI/Swagger
- [ ] 327. Write README.md for mobile-app/
- [ ] 328. Write CONTRIBUTING.md if open source
- [ ] 329. Document database schema
- [ ] 330. Create architecture diagrams (draw.io or similar)

### Legal & Compliance
- [ ] 331. Conduct Privacy Impact Assessment (PIA)
- [ ] 332. Document GDPR compliance measures
- [ ] 333. Document data retention policy
- [ ] 334. Document right to erasure process
- [ ] 335. Create data processing agreement template (if needed)
- [ ] 336. Consult with legal expert (if budget allows)

---

## Post-MVP: Planned Features (Phase 13+)

### Tier 2 Privacy Enhancements
- [ ] 337. Implement submission time jittering (0-24h delay)
- [ ] 338. Add backend API: `GET /hospitals/{domain}/size`
- [ ] 339. Implement hospital generalization for small hospitals
- [ ] 340. Create region mapping (small hospitals → regions)
- [ ] 341. Test generalization logic

### Advanced Privacy (Optional)
- [ ] 342. Implement randomized response for staff groups
- [ ] 343. Add user-controlled epsilon setting
- [ ] 344. Build privacy budget dashboard
- [ ] 345. Add lifetime budget tracking

### Features
- [ ] 346. Multi-hospital support (switch between hospitals)
- [ ] 347. Shift templates sharing (export/import)
- [ ] 348. Calendar sync with Google Calendar / Apple Calendar
- [ ] 349. Push reminders: "Don't forget to review this week!"
- [ ] 350. Biometric authentication (Face ID, fingerprint)

### Improvements
- [ ] 351. Improve geofence accuracy (use WiFi SSID as secondary signal)
- [ ] 352. Add analytics: track app usage patterns (privacy-preserving)
- [ ] 353. Optimize battery usage further
- [ ] 354. Add offline mode improvements
- [ ] 355. Improve error messages and user feedback

### Scaling
- [ ] 356. Set up production monitoring (Sentry, Datadog)
- [ ] 357. Set up backend auto-scaling (if needed)
- [ ] 358. Add database read replicas
- [ ] 359. Implement caching layer (Redis)
- [ ] 360. Add CDN for dashboard

---

## 📊 Progress Tracking

### Milestones
- [ ] Milestone 1: Backend API ready (Tasks 22-41)
- [ ] Milestone 2: Mobile app skeleton (Tasks 42-73)
- [ ] Milestone 3: Privacy features working (Tasks 74-98)
- [ ] Milestone 4: Onboarding complete (Tasks 99-118)
- [ ] Milestone 5: Calendar functional (Tasks 119-150)
- [ ] Milestone 6: Geofencing working (Tasks 151-193)
- [ ] Milestone 7: Submission flow complete (Tasks 194-222)
- [ ] Milestone 8: TestFlight live (Tasks 251-273)
- [ ] Milestone 9: Beta testing complete (Tasks 295-316)
- [ ] Milestone 10: Public launch ready

### Time Estimates
- Phase 1-3: ~3 weeks (Backend + Mobile foundation + Privacy)
- Phase 4-5: ~2 weeks (Onboarding + Calendar)
- Phase 6-7: ~2 weeks (Geofencing + Submission)
- Phase 8-10: ~2 weeks (Polish + Builds)
- Phase 11: ~2 weeks (Testing)
- **Total MVP: ~11 weeks**

### Priority Labels
- 🔴 **Critical**: Blocking other work, must be done first
- 🟠 **High**: Important for MVP
- 🟡 **Medium**: Nice to have for MVP
- 🟢 **Low**: Can wait for post-MVP

---

## 🎯 Recommended Starting Point

Based on the architecture, here's the optimal order:

### Week 1: Start Here
1. **Backend database schema** (Tasks 22-26) - Sets foundation
2. **Backend auth updates** (Tasks 27-31) - Critical for mobile app
3. **Backend submission endpoint** (Tasks 32-38) - Core functionality
4. **Privacy utilities** (Tasks 74-80) - Can be developed in parallel

**Why this order?**
- Backend needs to be ready before mobile app can test integration
- Privacy utilities are standalone (no dependencies) - good for parallel work
- You can test privacy utilities with simple scripts before mobile UI exists

### Week 2-3: Then Move To
1. **Mobile app initialization** (Tasks 42-54)
2. **Local storage setup** (Tasks 55-61)
3. **Privacy integration** (Tasks 85-98)
4. **Onboarding flow** (Tasks 99-114)

---

## 📝 Notes

- Use GitHub issues to track individual tasks
- Label tasks with phase numbers (phase-1, phase-2, etc.)
- Update this TODO.md as priorities change
- Mark tasks complete with commit references
- Keep sprint retrospectives after each phase

---

**Last updated**: 2025-01-15
**Target MVP completion**: Week 11 (mid-March 2025)
