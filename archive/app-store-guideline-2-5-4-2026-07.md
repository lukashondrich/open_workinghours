# App Store rejection under Guideline 2.5.4 — "employee tracking" misclassification

**Status:** ✅ RESOLVED — approved and live on the App Store (2026-07-08). Build #65 (patched expo-location, no `UIBackgroundModes:location`) cleared Guideline 2.5.4 review and v2.1.0 is now public. TestFlight invite friction removed; doc-mums distribution unblocked.
**Opened:** 2026-07-03
**Related:** `mobile-app/store-assets/app-store-metadata.md` (§ 5 reviewer notes), `project-mgmt/WORKSTREAMS.md` § 8 (App Store Launch workstream)

---

## Goal

Ship Open Working Hours v2.1.0 from TestFlight to the public iOS App Store — EN + DE, iPhone-only. This removes the TestFlight invite friction blocking distribution to the doc-mums WhatsApp group (~2k doctors, sister's contact) and is a precondition for the consumer subscription channel in the business model (`WORKSTREAMS.md` § 6). It also gives Apple-reviewed legitimacy to the privacy claims, which is a credibility asset for union outreach and institutional support conversations.

## What happened

### Round 1 — pre-review metadata blockers (resolved)

**2026-06-04:** First submission attempt of v2.1.0 build #60. App Store Connect refused to enter review with four blockers:
1. Primary category not selected — fixed in ASC (Productivity)
2. Content rights not declared — fixed in ASC (no third-party content)
3. Price tier not set — fixed in ASC (Free)
4. iPad screenshots missing — required a code change (`supportsTablet: false`)

**2026-06-12:** Build #61 attempted with `supportsTablet: false`. Failed twice in EAS "Install pods" phase with:
> The Swift pod AppCheckCore depends upon GoogleUtilities and RecaptchaInterop, which do not define modules.

A transitive dep in `@react-native-google-signin/google-signin@16.1.2` had flipped to Swift between #60 (2026-06-04) and #61 (2026-06-12). Fixed by adding `expo-build-properties` with `modular_headers: true` on the two pods. Build #62 succeeded and auto-submitted.

**2026-06-19:** DSA Trader Status blocker surfaced (EU Digital Services Act declaration required). Declared as Trader (WORKSTREAMS.md §6 documented business model, active fundraising via NLnet, institutional outreach — all activity that meets the DSA "trader" definition). Verification submitted to Apple.

### Round 2 — actual review rejection under 2.5.4 (open)

**2026-06-30:** Apple reviewed v2.1.0 build #62 on iPad Air 11" M3 and rejected under **Guideline 2.5.4 (Performance – Software Requirements)**. Reviewer's message:

> The app declares support for location in the UIBackgroundModes key in your Info.plist file but we are unable to locate any features besides employee tracking that require persistent location. Using the location background mode for the sole purpose of tracking employees is not appropriate.

The reviewer had classified Open Working Hours as an employer-issued employee-tracking app — the exact framing the reviewer notes had tried to preempt.

**2026-06-30 (reply):** Replied to Apple with:
- Written explanation reframing the app as a **self-tracking tool** used by individual healthcare workers for their own records (user and data subject are the same person)
- Structural comparison to fitness apps (user tracking their own activity, not surveillance)
- Emphasis on: no employer access, no API for employer ingest, no MDM integration, GPS never leaves the device for geofencing, aggregation is voluntary opt-in with k-anonymity + DP
- 45-second iPhone screen recording demonstrating: (1) user-initiated workplace setup, (2) the user's own hours dashboard, (3) user-controlled GDPR export/delete controls, (4) the voluntary contribution opt-in toggle

**2026-07-01:** Apple replied — verbatim repeat of the original rejection message, plus three screenshots showing what the reviewer saw in the app. The self-tracking reframing did not land. Their guidance:
> If the app has a feature besides tracking employees that requires persistent location, reply to this message and add a screen recording identifying that feature and showing it in use. Otherwise, it would be appropriate to revise the app to include additional features for your users that require persistent location.

## What we tried (technical fix attempt)

**2026-07-01:** Attempted a code-level fix instead of continued reframing.

**Diagnosis (theoretical):** Apple's specific technical concern was the `UIBackgroundModes: ["location"]` declaration in `Info.plist`. Reading Apple's documentation, this declaration is only required for **continuous background location updates** (like a navigation app). Geofencing (region monitoring via `CLLocationManager.startMonitoring(for:)`) is documented to work without this declaration — iOS delivers geofence events to suspended/terminated apps regardless.

**Code review:** The app's iOS location surface is:
- `Location.startGeofencingAsync` — used for the actual workplace geofencing
- `Location.startLocationUpdatesAsync` (continuous updates) — used only in `ForegroundKeepaliveService.ts`, which is **Android-only** (three `Platform.OS !== 'android'` early-returns; the service is a no-op on iOS)
- `Location.getCurrentPositionAsync` — used for accuracy validation inside geofence event handlers (foreground context, doesn't need the background mode)

Conclusion: iOS never actually used continuous background location, so `UIBackgroundModes: location` appeared to be baggage that only served to trigger Apple's "employee tracking" pattern match.

**Change made (commit `49ba0cc`):** Removed `UIBackgroundModes: ["location"]` from `app.json` → `ios.infoPlist`. Bumped `buildNumber` to 63.

Build #63 succeeded in EAS and auto-submitted to TestFlight.

## Why it didn't work

**2026-07-03:** Build #63 installed via TestFlight. **App crashes on startup.**

The theoretical claim ("geofencing doesn't need UIBackgroundModes:location per Apple docs") describes Apple's *documented API behavior* — not necessarily how expo-location's native module actually initializes. `App.tsx` runs two `TaskManager.defineTask` calls at **module scope** (lines 84 and 186), both for location-typed tasks (`GEOFENCE_TASK_NAME`, `LOCATION_KEEPALIVE_TASK_NAME`), the moment the JS bundle loads. Working theory: expo-location or expo-task-manager's iOS native module has an init check or entitlement handshake that requires `UIBackgroundModes: location` to be declared whenever location-typed tasks are registered, and refuses / throws when it's absent — crashing the app before the App component ever mounts.

**Not yet confirmed.** Diagnosis requires reading the `.ips` crash log from the device (Settings → Privacy & Security → Analytics & Improvements → Analytics Data). Specifically the `exception_type` / `termination_reason` and the first 10-20 frames of the crashed thread.

## Current state

- **Phone**: v2.1.0 build #63 installed, crashes on startup — can't use the app
- **App Store**: v2.1.0 build #62 in "Rejected" state under Guideline 2.5.4 — no path forward yet
- **Diagnosis**: pending crash log to confirm whether it's expo-location's native init, iOS launch-time entitlement check, or something else

## Options being considered (not decided)

Ordered rough guess of best → worst fit for the project's mission and scope:

1. **Understand the crash first, then decide.** May reveal a targeted fix that removes the background mode without breaking init (e.g., delaying task registration until permission granted, or upgrading expo-location to a version that handles this cleanly). Preferred path per user preference — no scoping decisions until we know what actually broke.

2. **Rework geofencing to not need the background mode declaration.** Depends on what the crash log reveals about *why* removing the mode broke init. Uncertain scope; may require patching expo-location, switching to a bare CLLocationManager wrapper, or upgrading dependencies.

3. **Add a legitimately continuous-location feature** to justify the mode declaration. E.g., a "Commute" widget showing distance/time from current location to the user's workplace. Real ~1-2 days of work. **User has stated preference against this** — feels like fake features stapled on to satisfy Apple. Kept as a fallback only.

4. **Escalate to Apple developer relations.** Reply asking for developer-relations review, argue the case with a human instead of first-line review. Free but slow (2-4 weeks) and no guarantee of success. Useful as parallel path if a code fix takes multiple iterations.

## Open questions

- What does the crash log say? (Blocks all other decisions.)
- Does expo-location have a documented requirement on `UIBackgroundModes: location` for geofencing? (Check their config plugin source and iOS module code.)
- Is there a newer version of expo-location that handles this differently?
- If we do need to keep `UIBackgroundModes: location`, can we successfully argue the case at Apple developer relations without adding a new feature? (Probability estimate: low — Apple's second rejection was verbatim, suggesting first-line reviewers won't budge.)

## Resolution (2026-07-05)

The `.ips` crash log was unavailable, but the crash cause was confirmed by reading expo-location 19.0.8's iOS source directly. Two independent blockers in the library — not in iOS itself:

1. **JS-level guard** — `LocationModule.swift` `startGeofencingAsync` throws `LocationUpdatesUnavailable` unless `UIBackgroundModes` contains `location` (via `EXTaskService hasBackgroundModeEnabled`, which reads Info.plist at runtime). Geofencing would silently fail to start even without a crash. The guard still exists on expo main (SDK 57), so upgrading doesn't help.
2. **The actual startup crash** — `EXGeofencingTaskConsumer.m:74` sets `locationManager.allowsBackgroundLocationUpdates = YES`. Apple documents that setting this flag without the `location` background mode raises an NSException. expo-task-manager persists registered tasks across app updates and restores them in `didFinishLaunchingWithOptions` (`EXTaskService _restoreTasks`), so build #63 (upgrade install over #62, which had the geofence task registered) crashed **before the JS bundle loaded**. This matches the observed symptom exactly.

Confirmed unaffected by removing the key (validated in code):
- Region monitoring is a CoreLocation system service — detection latency/accuracy and app wake behavior don't depend on `UIBackgroundModes`.
- `allowsBackgroundLocationUpdates` only affects continuous updates (`startUpdatingLocation`), which the geofencing consumer never requests.
- The 5-min exit hysteresis is timestamp-based in SQLite (`pendingExitAt`, resolved on next wake) — never needed background runtime.
- Accuracy validation (`getCurrentPositionAsync`) goes through `BaseLocationProvider`, which already sets `allowsBackgroundLocationUpdates = false` today — behavior identical before/after.

### Fix applied (staged for build #65)

- `patches/expo-location+19.0.8.patch` (via patch-package, `postinstall` script added):
  - `startGeofencingAsync`: removed the background-mode guard
  - `EXGeofencingTaskConsumer.m`: `allowsBackgroundLocationUpdates` now set conditionally on the background mode actually being declared (no NSException when absent)
- `app.json`: removed `UIBackgroundModes: ["location"]`, bumped `buildNumber` to 65
- `ios/` is gitignored — EAS prebuilds from `app.json`, so no plist edit needed (build #63 already proved removal propagates)

### Verification & resubmission (2026-07-05)

1. ✅ EAS build #65 → TestFlight (local device build wasn't possible — no signing certs on this Mac; all signing lives on EAS).
2. ✅ Upgrade install over #64 on the real device (the crash path — persisted task restoration): launches cleanly.
3. ✅ Walk test with app killed: clock-out fired (after 5-min hysteresis), clock-in fired on return.
4. ✅ ASC: build on rejected v2.1.0 swapped #62 → #65; Resolution Center reply sent — leads with "revised as suggested", states no persistent location / region monitoring only, notes the change is verifiable in the binary's Info.plist, includes demo account.

### Outcome (2026-07-08)

✅ Approved — v2.1.0 build #65 cleared Guideline 2.5.4 review and is live on the App Store. Resubmission (not just the Resolution Center reply) was the trigger: the message thread alone doesn't re-enter the queue; the version had to be explicitly resubmitted for review.

### Still open / follow-up

- **Description copy** — lawyer's HWG sweep + GDPR jargon call (task #31) was NOT blocking approval (rejection was purely the background mode). If their feedback lands, apply as a metadata-only update on the live version.
- **Upstream expo issue (optional)** — the `startGeofencingAsync` background-mode guard is overly strict (region monitoring doesn't need `UIBackgroundModes:location`) and forces exactly this Guideline 2.5.4 conflict. `npx patch-package expo-location --create-issue` drafts it from our patch. If fixed upstream, the patch can be dropped on a future SDK upgrade.
- **Patch is version-pinned** (`patches/expo-location+19.0.8.patch`) — regenerate when upgrading expo-location; the upstream guard still exists on expo main/SDK 57.
