# Ticket: E2E suite modernization (iOS baseline currently 56/71)

**Priority:** Medium — should be green before relying on E2E as a release gate
**Created:** 2026-07-24 (found while running the suite after the overtime-scoping change)
**Status:** Open. Auth helper already fixed (see below); 15 failures remain, all
diagnosed as test-script drift or environment assumptions — NO app regressions.

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

## Duplicate-testID cleanup (related, optional)

`template-save`/`absence-save` exist in BOTH the dead `TemplatePanel` and
`InlinePicker`. Removing TemplatePanel
(`project-mgmt/ticket-remove-dead-template-panel.md`) resolves the ambiguity.
