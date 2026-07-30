# Ticket: E2E suite modernization (iOS baseline currently 56/71)

**Priority:** Medium — should be green before relying on E2E as a release gate
**Created:** 2026-07-24 (found while running the suite after the overtime-scoping change)
**Status:** ✅ **CLOSED 2026-07-27.** Definition of done met on BOTH platforms:
iOS 71/71 twice in a row from clean installs (2026-07-24), Android 71/71 twice
in a row from clean installs (2026-07-27, up from 0/71 at first run). Suite
order pinned via `e2e/testSequencer.js`. New baselines + all newly-discovered
pitfalls documented in `mobile-app/e2e/README.md` (pitfalls 13–17 + "Infra
ordering rules").

**Two REAL app bugs found & fixed along the way (the point of the exercise):**
1. The LOCAL `mobile-app/android/` dir (gitignored prebuild artifact) is a
   stale prebuild from before expo-calendar was added — its manifest lacked
   `READ_CALENDAR`/`WRITE_CALENDAR`, so calendar live-sync was dead in every
   LOCALLY-built APK ("Calendar permission required" instantly). EAS builds
   prebuild fresh and are unaffected (the plugin adds both permissions —
   verified in `expo-calendar/plugin/build/withCalendar.js`). Fixed locally
   by hand (NOT committable — gitignored); durable fix:
   `npx expo prebuild -p android --clean` at next Android maintenance.
   ⚠️ Before the Play submission, verify the built AAB actually contains the
   calendar permissions (`aapt2 dump permissions`), since the 2026-07-09 AAB
   inventory in `project-mgmt/android-launch-checklist.md` doesn't list them.
2. `PermissionPrimingScreen` had no bottom safe-area inset — on edge-to-edge
   Android the "Skip" button sat in the system gesture zone (taps = home
   gesture; also awkward for real users). Now uses `useSafeAreaInsets()`.

**Residual caveat:** the iOS 71/71 runs predate the `PermissionPrimingScreen`
safe-area change (app code, cross-platform). Low risk (additive padding), but
re-run the iOS suite against a rebuilt app before the next iOS release.
Also noted: Android `versionName` in build.gradle still says 2.0.0 (out of
sync with app.json 2.1.3) — sync before the Play upload.

## Context

The suite had been silently unrunnable since the 2026-05-13 WelcomeScreen
redesign: the shared auth helper still tapped `login-button` on the old welcome
screen, so every test failed at login ("Failed to authenticate"). The screenshot
pipeline bridged this in its own helper in June (`store-assets/lib/seed.js`);
the main suite never got the fix. **Fixed 2026-07-24** in
`e2e/helpers/actions.js` `performTestLogin` (taps `email-signin-button` first,
falls back to the legacy path). The historical "48/48" baseline predates the
redesign.

Current iOS baseline after the fix (quiet machine, clean install):
**56 passed / 15 failed** — auth, registration, calendar, location suites fully
green.

## Remaining failures, diagnosed

| Suite | Tests | Mechanism (verified) |
|---|---|---|
| `manual-session.test.js` | 2 | Suite-order dependency: needs a configured location, but jest's default ordering (by file size) now runs `location.test.js` LAST. Run log shows the form opened in its "no location" state (`cancel=true`, all other testIDs false). Fix: create a location in the suite's own setup, or pin suite order (jest `--testSequencer`). |
| `shifts.test.js` | 2 | Script drift in template creation: test types the name then `dismissKeyboard(driver, 'key')` (Return key) — on the InlinePicker create form this appears to submit/close the form, so the subsequent `~template-save` lookup times out. Manually verified 2026-07-24 that the real UI exposes `template-save` correctly (XCUITest hierarchy dump). Fix: dismiss keyboard without Return, or assert on the create-and-select result instead. |
| `absences.test.js` | 3 | Same mechanism as shifts (absence template create/edit/save). |
| `calendar-export.test.js` | 8 | Sync toggle never turns on: fresh-simulator EventKit permission flow / German system-dialog wording assumptions. Needs re-verification of the permission-dialog handling on a wiped simulator with DE locale. |

Also stale (harmless, unreachable in TEST_MODE): the registration fallback in
`ensureAuthenticated` still looks for `register-button` on the welcome screen,
and the LoginScreen register link has no testID.

## Definition of done

- 71/71 on iOS on a quiet machine, from a clean install, twice in a row.
- Suite order pinned or order-independent.
- Baseline documented in `mobile-app/e2e/README.md` (replace the stale 48/48
  numbers) and the `/e2e-ios` skill.

## Follow-up: e2e-android skill

Precondition met (71/71 both platforms) — `/e2e-android` skill created
2026-07-27 at `.claude/skills/e2e-android/`, encoding the green procedure and
the infra ordering rules.

## Duplicate-testID cleanup (related, optional)

`template-save`/`absence-save` exist in BOTH the dead `TemplatePanel` and
`InlinePicker`. Removing TemplatePanel
(`project-mgmt/ticket-remove-dead-template-panel.md`) resolves the ambiguity.
