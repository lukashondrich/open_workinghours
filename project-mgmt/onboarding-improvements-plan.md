# Onboarding Improvements Plan

**Date:** 2026-04-15
**Branch:** `worktree-onboarding-improvements`
**Status:** Ready for implementation

---

## Context

Open Working Hours currently has a functional but minimal onboarding flow: Welcome → Email Verification → Registration → GDPR Consent → Empty Dashboard → "Add Workplace" → 3-step Location Wizard. It gets users through authentication and location setup, but lacks guidance beyond that.

This matters now because:

1. **The app's core interaction is novel.** Geofencing-based automatic clock-in/out is not something users have encountered before. Without explanation, users don't understand what they're enabling or why they should trust it.

2. **Permission grant rates directly affect usability.** On iOS, the system location dialog is one-shot — if a user declines, they must manually navigate to Settings to re-enable. Research (Nielsen Norman Group, Sentiance) shows pre-permission priming screens increase grant rates by 30-40%. We currently go straight to the OS dialog.

3. **The target audience is surveillance-wary.** Healthcare workers may associate location tracking with employer monitoring. The app's privacy-first architecture (on-device GPS, differential privacy, k-anonymity) is a major differentiator, but none of this is communicated during onboarding.

4. **Current copy is technically framed.** Strings like "Location permission is required to set up geofencing" or "Background Permission Missing" tell users what the system needs, not what they gain. UX research consistently shows benefit-framed copy outperforms requirement-framed copy for permission requests.

5. **Feature discoverability is low.** Calendar features (shift templates, batch placement, absences, manual sessions) are powerful but undocumented in-app. Only one tooltip exists (submission confirmation). Users discover features by accident or not at all.

### Research Sources

This plan is informed by:
- Nielsen Norman Group: mobile onboarding analysis, permission request design (3 strategies)
- Apple Human Interface Guidelines: onboarding, launching, requesting permissions
- Google Material Design: onboarding models (Quickstart, Self-Select, Top User Benefits)
- Sentiance / Incognia: location permission opt-in rate studies (24-96% range depending on design)
- Privacy-by-Design framework principles applied to onboarding UX

### Current State Audit

| Touch Point | Current Copy | Issue |
|-------------|-------------|-------|
| Foreground permission (SetupScreen) | "Location permission is required to set up geofencing." | Technical, no benefit framing |
| Background permission (location save) | "Background location permission is required for automatic tracking. You can continue anyway, but automatic clock-in/out will not work." | Loss-framed, no privacy reassurance |
| Permission warning banner | "Background Permission Missing — Automatic tracking is disabled." | Red/alarm styling, negative language |
| Empty state (StatusScreen) | "No workplace set up yet" | No value preview, no trust signal |
| Consent modal key points | "Your hours contribute to anonymous statistics (only when groups are large enough)" | Defensive, doesn't explain purpose or how privacy works |
| Calendar/shifts/absences | No first-time guidance | Only 1 tooltip exists (submit confirmation) |
| Permission denial | Banner reappears after 7 days, same copy | Timer-based only, no contextual re-prompting |

---

## Plan: 7 Improvements

### 1. Pre-Permission Priming Screen

**Why:** On iOS, the system location dialog can only be triggered once per permission type. If the user declines without understanding why, the permission is effectively burned — they must go to Settings manually. A custom explanation screen before the OS dialog gives users context and dramatically improves grant rates.

**What:** A full-screen component shown before the OS location dialog during the location setup wizard. Currently, `SetupScreen.tsx` auto-calls `requestForegroundPermissionsAsync()` on mount (line ~200). Instead, we intercept with a priming screen.

**Content:**
- Icon/illustration: pin on a map with a circle around it
- Headline: "Automatic clock-in/out"
- Body: "When you arrive at or leave your workplace, the app detects it and tracks your hours — no manual input needed."
- Privacy line: "Your location is checked on-device only. GPS coordinates are never sent to our servers."
- Two buttons: **"Enable Location"** → proceeds to OS dialog / **"Not Now"** → skips permission, continues wizard

**"Not Now" behavior:**
- User continues the location wizard normally (Steps 1→2→3), but without GPS access
- Map starts at a default region (Germany center) instead of centering on the user's current position
- Search/geocoding still works — user can find and tap-to-place their workplace manually
- Location is saved and geofence is configured, but remains inactive until permission is granted
- Stores `userDeclinedLocationPermission` flag in `OnboardingStorage` (used by re-prompting logic in item #6)
- User can grant permission later from Settings→Permissions, which activates the geofence immediately

This keeps the setup flow identical for all users and makes switching to automatic mode seamless later — the geofence is already configured, it just needs the permission toggle.

**Implementation: inline step 0 within SetupScreen** (not a separate stack screen). The wizard already switches between steps 1/2/3 via conditional render — this adds a step 0 before them. This is E2E-compatible by default: no `<Modal>`, no overlay, just a regular view in the existing component tree. Each button gets `testID` + `accessible={true}` + `accessibilityRole="button"`.

**Files:**
- Edit: `SetupScreen.tsx` — add step 0 (priming), gate permission request behind it; fallback to Germany default region when permission not granted
- Edit: `en.ts` / `de.ts` — new strings

---

### 2. Consent Key Points + Privacy Explainer Link

**Why:** The current consent modal lists three "key points" in plain text, all defensively framed ("never leaves", "delete anytime"). Healthcare workers concerned about employer surveillance need to understand the privacy architecture, not just be told it exists. However, the consent bottom sheet (520dp) is the wrong place for depth — users want to get through it quickly. The right approach: accurate, benefit-framed key points in the sheet, with a link to deeper explanation.

**What:** Revise the plain-text key points in `ConsentBottomSheet.tsx` with benefit-framed, factually precise copy. Add a "How your data is protected" link to a dedicated in-app privacy explainer screen (or deep-link to the website privacy page).

**Revised consent key points:**

1. ✓ "Your GPS coordinates, workplace names, shift templates, absences, and unconfirmed sessions stay on your device."
2. ✓ "Your profile and confirmed daily working-hour totals are sent to Open Working Hours so they can be aggregated into privacy-protected statistics."
3. ✓ "Public statistics are only shown for groups of 5+ people and include statistical noise to reduce re-identification risk."
4. ✓ "Delete your account anytime — all your data is permanently removed."

Key design decisions:
- **Do not say "only anonymized daily totals leave your phone."** That is not accurate for the current architecture: the backend receives authenticated confirmed daily totals plus profile/grouping data (region, profession, seniority, department/specialty, and optional hospital affiliation) so it can aggregate under the relevant cells.
- **Distinguish local tracking data from submitted aggregation data.** GPS coordinates, workplace names, shift templates, absences, and unconfirmed sessions stay on-device. Confirmed working-hour totals and profile attributes are backend data.
- **Use "privacy-protected statistics" for the public outputs**, not for raw authenticated backend records. Backend work events are better described as personal/pseudonymous source data used for aggregation; published aggregate statistics are the privacy-protected output.
- **Point 3 avoids the term "differential privacy"** (jargon) while remaining accurate about the mechanism. Progressive disclosure available via the link.
- **No inline data-flow diagram** — the bottom sheet is too cramped and users want to move through it quickly.

**"How your data is protected" link → Website privacy page:**
- Link in consent sheet opens `https://openworkinghours.org/privacy` (or the equivalent `/datenschutz` for German locale) via `Linking.openURL`
- The website already has comprehensive coverage: data flow, differential privacy, k-anonymity, what's collected vs not, no employer access, deletion rights
- No in-app explainer screen needed — avoids maintaining duplicate content and the website is the canonical source

**Files:**
- Edit: `ConsentBottomSheet.tsx` — revise key points, add "How your data is protected" link to website
- Edit: `en.ts` / `de.ts` — revised consent strings

---

### 3. Primed Background Location (Both Platforms)

**Why:** Currently, background location ("Always Allow") is requested during the location save flow in SetupScreen step 3 — before the user has ever experienced a geofence trigger. They don't yet understand what they're enabling. A priming screen before the OS dialog provides context and improves grant rates, while preserving the current geofencing architecture.

**Decision: Option A — Keep background permission during setup, but prime it well.**

The original plan considered deferring background permission on iOS until after a foreground geofence trigger. However, the current `GeofenceService.registerGeofence()` skips registration without background permission, so deferral would require building a new foreground-monitoring subsystem. Option A ships the priming UX improvement without that architectural risk. Option B (deferred with foreground monitor) remains a future improvement once real grant rate data is available.

**Flow (both platforms):**
```
Setup Step 3 → Save → Background permission priming screen
→ OS "Always Allow" dialog (iOS) / System settings (Android 11+)
→ Register geofence if granted; fall back to manual mode if not
```

**Android-specific notes:**
- Android 11+ behavior: `requestBackgroundPermissionsAsync()` opens the system settings page, not an in-app dialog. Priming copy must set expectation: "Next, Android will open Location settings. Choose 'Allow all the time.'"
- Older Android behavior: a direct OS permission prompt may appear instead.
- After the user returns to the app, always re-check background permission and call shared geofence registration logic if granted.

**Priming screen copy (both platforms):**
- Headline: "Automatic tracking — even in the background"
- Body: "To clock you in and out automatically when you arrive and leave, the app needs background location access."
- Privacy line: "GPS coordinates and workplace names stay on this device. Your profile and confirmed daily working-hour totals are sent only when you confirm a day."
- Buttons: **"Enable"** → OS dialog / **"Skip"** → manual mode, geofence not registered

**Files:**
- Edit: `SetupScreen.tsx` — add background priming screen before OS permission request on save
- New: `GeofenceRegistrationService.ts` — shared service for registering saved geofences after permission grants, app startup/foreground, and Settings grant. Required for the "grant permission later → activates immediately" promise.
- New: `BackgroundUpgradePrompt.tsx` — inline priming screen for "Always Allow". Uses inline `Animated.View` (not `<Modal>`), with `testID` props on all interactive elements. E2E-compatible.
- Edit/New: onboarding preference service — flags for background permission state
- Edit: `en.ts` / `de.ts`

**Future consideration (Option B):** Once real grant rate data is available, revisit deferring background permission on iOS by building a foreground active-location monitor that gives users a "magic moment" before requesting "Always Allow." This is a separate workstream requiring a new subsystem — not in scope for this release.

---

### 4. Benefit Framing Copy Pass

**Why:** All permission and setup copy currently uses either technical language ("required to set up geofencing") or loss framing ("will not work", "disabled", "missing"). UX research consistently shows that benefit-framed copy — explaining what the user gains — outperforms requirement-framed copy for permission requests and feature adoption.

**What:** Rewrite ~15 strings across the app.

| Screen | Current | Proposed |
|--------|---------|----------|
| Foreground denied alert | "Location permission is required to set up geofencing." | "To find your workplace on the map and set up automatic tracking, the app needs location access." |
| Background denied alert | "Background location permission is required for automatic tracking. You can continue anyway, but automatic clock-in/out will not work." | "Background location lets the app clock you in and out automatically — even when you're not looking at it. You can skip this and track manually instead." |
| Permission warning banner title | "Background Permission Missing" | "Enable automatic tracking" |
| Permission warning banner body | "Automatic tracking is disabled. Enable in Settings for geofencing to work." | "Enable background location to clock in and out automatically when you arrive and leave." |
| Empty state title | "No workplace set up yet" | "Set up your workplace to start tracking hours hands-free" |
| Setup step 2 hint | "Drag the map to position the marker at your workplace. The circle shows the automatic tracking zone." | "Position the circle over your workplace entrance. The app will detect when you enter and leave this area." |

**Also:** Restyle `PermissionWarningBanner.tsx` from red/alarm to blue/informational tone. Red implies something is broken. Blue communicates an available upgrade.

**Files:**
- Edit: `en.ts` / `de.ts` — ~15 string changes
- Edit: `PermissionWarningBanner.tsx` — color/style adjustment (red → blue/informational)
- Edit: `mobile-app/app.json` — update native iOS/Android permission strings shown by OS-level prompts; this requires a rebuild to take effect

---

### 5. Contextual Feature Education

**Why:** The app has exactly one onboarding tooltip (submission confirmation in WeekView). All other features — shift templates, batch mode, absences, manual sessions, the FAB menu — are undiscoverable without external guidance. Research (NN/g) shows contextual education at the moment of first encounter outperforms upfront tutorials, which users skip and forget.

**What:** Create a reusable `OnboardingTooltip` component and deploy it at first-encounter moments.

**New tooltips:**

| Trigger | Content |
|---------|---------|
| First time opening Calendar tab | "Plan your shifts here. The app compares your planned hours with GPS-tracked hours to build your dashboard." |
| First time tapping FAB | "**Shifts** — plan your schedule. **Absences** — mark vacation or sick days. **Log Hours** — add hours manually if GPS missed a session." |
| First time arming a shift (batch mode) | "Double-tap any day to place this shift. Tap the ✕ to stop." |
| First completed tracked session appears in dashboard | "This session was tracked automatically via GPS. Confirm the day to submit your hours." |

**Implementation notes:**
- **Must use inline `Animated.View` with `StyleSheet.absoluteFill`, NOT `<Modal>`.** The existing submit tooltip in WeekView uses `<Modal>`, which is invisible to XCUITest E2E tests. The new generic component must follow the E2E-compatible pattern from CLAUDE.md.
- Each tooltip is gated by a flag in the typed onboarding preference service
- The "tracked session" tooltip fires when a **completed** session first appears in the dashboard — not during the arrival moment (which is the product's "magic moment" and shouldn't be interrupted)
- Existing users will see tooltips naturally (the flags won't exist in their storage)

**E2E-compatible tooltip structure:**
```tsx
// OnboardingTooltip.tsx — E2E compatible pattern
<View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}
      accessible={false} collapsable={false}>
  {/* Semi-transparent backdrop */}
  <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}
                 testID="onboarding-tooltip-backdrop" />
  {/* Content card */}
  <Animated.View style={[styles.card, { opacity: cardOpacity }]}
                 accessible={false} collapsable={false}>
    <Text testID="onboarding-tooltip-title" accessible={true}>{title}</Text>
    <Text testID="onboarding-tooltip-body" accessible={true}>{body}</Text>
    <TouchableOpacity testID="onboarding-tooltip-dismiss"
                      accessible={true} accessibilityRole="button"
                      onPress={onDismiss}>
      <Text>Got it</Text>
    </TouchableOpacity>
  </Animated.View>
</View>
```

**Migrate existing submit tooltip:** The WeekView submit tooltip currently uses `<Modal>`. As part of this item, migrate it to use `OnboardingTooltip` for consistency and E2E compatibility.

**Files:**
- New: `OnboardingTooltip.tsx` — generic component using inline Animated.View (pattern above)
- Edit/New: onboarding preference service — new flags per tooltip
- Edit: `WeekView.tsx` — migrate existing submit tooltip from `<Modal>` to `OnboardingTooltip`
- Edit: `CalendarScreen.tsx` — calendar intro tooltip
- Edit: `CalendarFAB.tsx` — FAB tooltip
- Edit: `MonthView.tsx` or `WeekView.tsx` — batch mode tooltip
- Edit: `StatusScreen.tsx` — completed session tooltip
- Edit: `en.ts` / `de.ts`

---

### 6. Improved Denial Handling / Re-Prompting

**Why:** The current denial handling has two problems: (a) the `PermissionWarningBanner` uses timer-based re-prompting (7 days) with no contextual trigger, and (b) the banner never stops appearing. Timer-based re-prompting feels like nagging. Contextual re-prompting — triggered when the user is doing something that the denied permission would improve — feels helpful. And capping re-prompts respects the user's decision while still leaving the door open.

**Tiered re-prompt strategy by user type:**

| User type | Permission state | Re-prompt behavior |
|-----------|-----------------|-------------------|
| **Auto user** | Background granted | No prompts needed |
| **Upgrade candidate** | Foreground only | After first foreground trigger, then max 2 more contextual prompts on manual clock-in. "Don't ask again" option after 2nd. |
| **Denied all / "Not Now"** | No permissions granted | First prompt after 14 days of active manual use. Then max 1 more after 30 days. Then stop permanently. Softer copy: "Did you know automatic tracking is available?" |

Key design decisions:
- **Upgrade candidates** get contextual prompts on manual clock-in: "Enable background location to automate this." These feel helpful because the user is actively doing the thing the permission would automate.
- **Denied-all users** get fewer prompts (2 total), longer intervals (14 days, 30 days), and softer copy. The tone is informational ("Did you know...?"), not corrective ("Tired of...?").
- **After the cap is reached**, re-prompts stop permanently. The Settings→Permissions screen always shows current permission state and a way to grant — the user is never locked out of upgrading, they just aren't prompted anymore.
- **"Don't Ask Again" option** appears after the 2nd prompt for upgrade candidates, after the 1st prompt for denied-all users.
- **Styling:** Blue/informational (consistent with item #4), not red/alarm.
- **No "opens location settings" trigger** — too aggressive, the user may be checking settings for unrelated reasons.

**Files:**
- Edit: `PermissionWarningBanner.tsx` — restyle only; keep the component presentational
- New: `PermissionPromptPolicy.ts` — pure policy function that decides which prompt/banner to show from platform, permission state, prompt counts, dates, and user behavior
- Edit/New: onboarding preference service backed by `app_preferences` or `OnboardingStorage` — `permissionRePromptCount`, `lastRePromptDate`, `userDeclinedLocationPermission`, `permanentlyDismissedPermissionPrompt`
- Edit: `StatusScreen.tsx` — contextual re-prompt on manual clock-in
- Tests: unit tests for prompt policy caps/intervals/user-type branches
- Edit: `en.ts` / `de.ts`

---

### 7. Notification Permission Priming

**Why:** The app currently requests notification permission during startup in `App.tsx`. This has the same trust problem as location permissions: users are asked before they understand why notifications matter. Notifications are part of the tracking experience because they confirm clock-in/out events and support exit verification flows.

**What:** Move notification permission out of app initialization and into the onboarding/permission priming flow.

Recommended behavior:
- Do not request notification permission on app startup.
- Request notification permission after the user has saved a workplace or when they enable automatic tracking.
- Explain the benefit first: notifications confirm clock-in/out events and help the app verify when a session should end.
- If notification permission is denied, automatic tracking should still degrade gracefully where possible, but the app should clearly explain that clock-in/out alerts and some verification prompts may be less reliable.
- Treat notification re-prompts with the same policy discipline as location prompts: contextual, capped, and dismissable.

Files:
- Edit: `App.tsx` — remove unconditional `Notifications.requestPermissionsAsync()` from startup
- Edit: `SetupScreen.tsx` or permission onboarding component — add notification priming at the right moment
- New/Edit: notification permission helper/policy if needed
- Edit: `en.ts` / `de.ts`
- Edit: E2E setup flows if permission dialogs change

---

## Implementation Status (Updated 2026-04-21)

**Overall: 6/7 complete, 1 partially complete. All changes are unstaged (no commits yet).**

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Pre-permission priming screen | **Done** | Step 0 in SetupScreen, PermissionPrimingScreen component, "Not Now" → Germany default |
| 2 | Consent key points + privacy link | **Done** | Revised 4 key points, `getPrivacyExplainerUrl()` in legalUrls.ts, locale-aware link |
| 3 | Primed background location | **Done** | Both platforms, `permissionFlowStep` state in SetupScreen, Android settings navigation handled |
| 4 | Benefit framing copy pass | **Done** | ~15 strings rewritten, banner restyled red→blue, app.json native permission strings updated |
| 5 | Contextual feature education | **Partial** | `OnboardingTooltip` component done (E2E-compatible). Calendar + FAB tooltips wired. **Batch mode tooltip and tracked session tooltip have strings but are NOT wired into UI.** |
| 6 | Improved denial handling | **Done** | `PermissionPromptPolicy` with 8 unit tests, tiered re-prompting integrated in StatusScreen |
| 7 | Notification permission priming | **Done** | Removed from App.tsx startup, priming in SetupScreen save flow |

### New files created

| File | Purpose |
|------|---------|
| `src/components/OnboardingTooltip.tsx` | Generic tooltip (inline Animated.View, E2E-compatible) |
| `src/lib/storage/OnboardingPreferences.ts` | Typed preference service for all onboarding flags |
| `src/modules/geofencing/components/PermissionPrimingScreen.tsx` | Reusable priming screen (foreground, background, notifications) |
| `src/modules/geofencing/services/PermissionPromptPolicy.ts` | Pure policy function for re-prompt decisions |
| `src/modules/geofencing/services/GeofenceRegistrationService.ts` | Shared geofence registration after permission grants/startup |
| `src/modules/geofencing/__tests__/PermissionPromptPolicy.test.ts` | 8 unit tests |
| `src/modules/geofencing/__tests__/GeofenceRegistrationService.test.ts` | 4 unit tests |

### Remaining work

1. **Wire batch mode tooltip** — Show `OnboardingTooltip` when a shift is first armed (batch mode). Strings exist (`onboardingTooltips.batch.*`). Needs: check `hasSeenBatchTooltip` flag, show tooltip, mark seen on dismiss. Likely in MonthView or WeekView where arming happens.

2. **Wire tracked session tooltip** — Show `OnboardingTooltip` when a completed GPS-tracked session first appears in the dashboard. Strings exist (`onboardingTooltips.trackedSession.*`). Needs: check `hasSeenTrackedSessionTooltip` flag, detect first completed session in StatusScreen, show tooltip, mark seen on dismiss.

3. **Migrate existing submit tooltip in WeekView** — The plan called for migrating the existing `<Modal>`-based submit tooltip to use `OnboardingTooltip` for E2E compatibility and consistency. WeekView was modified (+137/-) but need to verify whether this migration happened or if the Modal is still there.

4. **Run unit tests** — Verify all 12 new tests pass (8 PermissionPromptPolicy + 4 GeofenceRegistrationService).

5. **Manual device testing** — Permission flows on iOS + Android (especially Android 11+ system settings navigation for background location).

6. **Commit and rebase** — All work is currently unstaged. Needs to be committed and rebased onto current main (which includes reports-tab and will need android-bugs branch merged).

---

## Implementation Order (Original Plan)

**Recommended sequence:**

| Step | Item | Rationale |
|------|------|-----------|
| 1 | **#2 Consent key points + privacy link** | Fixes factual accuracy first. Standalone. Links to website privacy page. |
| 2 | **#4 Benefit framing copy pass** | High ROI, low risk. Include native `app.json` permission strings and banner restyle. |
| 3 | **Permission infrastructure** | Add `PermissionPromptPolicy`, typed onboarding/preferences service, and `GeofenceRegistrationService`. Keeps prompt logic out of UI components. Testable without UI. |
| 4 | **#1 Pre-permission priming + #3 Background priming** | Both are priming screens in the setup wizard. Step 0 (foreground) + post-save (background). Includes "Not Now" → Germany default region fallback. |
| 5 | **#7 Notification permission priming** | Removes startup prompt and integrates notification consent into the same trust-building flow. |
| 6 | **`OnboardingTooltip` component + #5 Contextual feature education** | Build the generic tooltip component, migrate existing submit tooltip, deploy new tooltips. |
| 7 | **#6 Re-prompting** | Tiered re-prompt strategy. Depends on permission infrastructure from step 3 and preference flags. |

Steps 1–2 are pure copy changes that can ship immediately. Step 3 is foundational infrastructure. Steps 4–5 are the permission flow changes. Steps 6–7 are independent of each other and can be parallelized.

---

## Implementation Quality Review Notes

These notes are from code review against the current mobile codebase and should be considered before implementation.

### Data / Privacy Copy Accuracy

- Avoid saying backend submissions are "anonymized daily totals." The app sends authenticated confirmed daily totals and profile/grouping data to the backend.
- Use "privacy-protected statistics" for public aggregate outputs.
- Use "local/on-device" specifically for GPS coordinates, workplace names, shift templates, absences, and unconfirmed sessions.
- The privacy link in the consent sheet should point intentionally: the app privacy policy is currently available via `getPrivacyUrl()`, while the broader privacy explainer is `/privacy` and `/de/privacy`. Add a distinct helper if both links are needed.

### Permission State Architecture

- Treat permission prompting as a state/policy problem, not as scattered screen logic.
- Add a pure `PermissionPromptPolicy` with unit tests for user type, platform, prompt count caps, intervals, "Don't ask again", and manual-use triggers.
- Keep `PermissionWarningBanner` presentational. It should render a prompt decision; it should not own tiered policy logic.
- Prefer a typed preference service over raw ad hoc `SecureStore` keys. The app already has `app_preferences` in SQLite via `Database.setPreference()` / `getPreference()`. If `SecureStore` remains in use, keep a single typed wrapper and avoid growing one method per flag.

### Geofence Registration

- Current setup saves locations but only registers geofences if background permission is already granted.
- Add `GeofenceRegistrationService.ensureRegisteredGeofences()` and call it:
  - after setup save when permission is granted
  - after Settings/permission grant
  - when returning from Android system settings
  - on app startup/foreground
- This is required for the promised "grant later activates immediately" behavior.

### Setup Step 0 Edge Cases

- Step 0 should not appear in edit/view-only mode.
- Decide whether hospital-prepopulated setup should show Step 0 or skip directly to position adjustment.
- Default map region for no-permission/no-location should be Germany, not the current San Francisco fallback.
- `showsUserLocation` should be conditional on foreground permission, not always true.
- E2E location setup currently expects `setup-search-input` immediately after opening setup; tests must be updated for Step 0.

### Android Compatibility

- Android 11+ sends users to system settings for background location; older Android versions may show a direct permission prompt.
- The implementation must support both, then re-check permission after the user returns.
- Copy must not promise a normal in-app dialog on modern Android.

### iOS Background Strategy (Resolved: Option A)

- **Decision: Option A.** The app still asks for "Always Allow" during setup, but with a dedicated priming screen that explains the benefit and provides privacy reassurance before the OS dialog.
- Current `GeofenceService.registerGeofence()` requires background permission — this is preserved, no architectural changes needed.
- **Future consideration (Option B):** Defer background permission on iOS by building a foreground active-location monitor. Revisit once real grant rate data is available from Option A.

### Notification Permission

- Startup notification permission is in scope and should move out of `App.tsx`.
- Notification permission should be requested contextually, ideally after a workplace is saved or automatic tracking is enabled.
- Denial should degrade gracefully and be handled by the same prompt policy principles as location.

---

## Key Files Reference

| File | Path | Role |
|------|------|------|
| SetupScreen | `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` | Location wizard, permission requests |
| StatusScreen | `mobile-app/src/modules/geofencing/screens/StatusScreen.tsx` | Main dashboard, empty state |
| ConsentBottomSheet | `mobile-app/src/modules/auth/components/ConsentBottomSheet.tsx` | GDPR consent modal |
| PermissionWarningBanner | `mobile-app/src/modules/geofencing/components/PermissionWarningBanner.tsx` | Background permission banner |
| GeofenceService | `mobile-app/src/modules/geofencing/services/GeofenceService.ts` | Permission functions |
| TrackingManager | `mobile-app/src/modules/geofencing/services/TrackingManager.ts` | Session management |
| OnboardingStorage | `mobile-app/src/lib/storage/OnboardingStorage.ts` | First-time flags (currently only 1) |
| App preferences | `mobile-app/src/modules/geofencing/services/Database.ts` | Existing `app_preferences` key/value storage; candidate home for non-secret onboarding preferences |
| CalendarFAB | `mobile-app/src/modules/calendar/components/CalendarFAB.tsx` | Floating action button |
| WeekView | `mobile-app/src/modules/calendar/components/WeekView.tsx` | Existing tooltip pattern (uses Modal — do NOT copy this pattern) |
| App config | `mobile-app/app.json` | Native permission copy; changes require rebuild |
| App startup | `mobile-app/App.tsx` | Currently requests notification permission at startup |
| en.ts | `mobile-app/src/lib/i18n/translations/en.ts` | English strings |
| de.ts | `mobile-app/src/lib/i18n/translations/de.ts` | German strings |

## New Files

| File | Purpose |
|------|---------|
| `BackgroundUpgradePrompt.tsx` | Inline priming screen shown before OS background permission dialog during setup save. Uses inline `Animated.View`, E2E-compatible. |
| `OnboardingTooltip.tsx` | Generic reusable tooltip component (inline `Animated.View`, NOT `<Modal>`). E2E-compatible with `testID` props. |
| `PermissionPromptPolicy.ts` | Pure, tested prompt decision logic for location/notification prompting. |
| `GeofenceRegistrationService.ts` | Shared service for registering saved geofences after permission grants/startup/foreground. |

**Not creating (resolved decisions):**
- ~~`PrePermissionScreen.tsx`~~ → implemented as inline step 0 within `SetupScreen.tsx`
- ~~`PrivacyExplainerScreen.tsx`~~ → linking to website privacy page instead
- ~~`DataFlowDiagram.tsx`~~ → not needed (no in-app explainer screen)

## Onboarding / Permission Preference Keys (New)

Implementation note: prefer a typed preference service backed by `app_preferences` for non-secret onboarding/prompt state. `OnboardingStorage` can remain as the public wrapper if useful, but avoid scattering raw `SecureStore` keys across screens.

| Flag | Type | Used by |
|------|------|---------|
| `hasSeenConfirmTooltip` | boolean | Existing — submit tooltip |
| `userDeclinedLocationPermission` | boolean | #1 (priming "Not Now"), #6 (tiered re-prompting) |
| `userDeclinedBackgroundPermission` | boolean | #3 (background priming "Skip"), #6 (tiered re-prompting) |
| `hasSeenCalendarTooltip` | boolean | #5 |
| `hasSeenFABTooltip` | boolean | #5 |
| `hasSeenBatchTooltip` | boolean | #5 |
| `hasSeenTrackedSessionTooltip` | boolean | #5 |
| `permissionRePromptCount` | number | #6 (cap enforcement) |
| `lastRePromptDate` | date | #6 (interval enforcement) |
| `permanentlyDismissedPermissionPrompt` | boolean | #6 ("Don't ask again") |
| `notificationPermissionPromptCount` | number | #7 (cap enforcement) |
| `lastNotificationPromptDate` | date | #7 (interval/context enforcement) |
| `permanentlyDismissedNotificationPrompt` | boolean | #7 ("Don't ask again") |
