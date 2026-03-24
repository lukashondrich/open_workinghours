# Known Issues

**Last Updated:** 2026-03-24

---

## Active Issues

### Android E2E: Month view toggle and location wizard flakiness

**Status:** Open
**Discovered:** 2026-02-03 (documented), confirmed 2026-03-24
**Severity:** Medium — blocks full Android E2E green, does not affect iOS
**Affects:** `shifts.test.js`, `absences.test.js`, `manual-session.test.js`, `location.test.js`

**Symptoms:**
- `byI18nFast(driver, 'month')` — "Month"/"Monat" toggle not found after 5s timeout (~25-50% of runs)
- Location wizard: `setup-search-result-0` not found — geocoding timeout or search results don't render in time
- `manual-session.test.js` fails entirely because it depends on a configured location (cascading failure)
- Panel dismissal after double-tap shift placement sometimes doesn't complete, blocking subsequent Month toggle tap

**Scope:** 24 failures in full suite run (2026-03-24). Auth (5/5), Calendar (7/7), Registration (7/7) all pass consistently.

**Root causes (suspected):**
1. **Month/Week toggle:** The toggle is rendered by `CalendarHeader.tsx` inside a `SegmentedControl`-like pattern. On Android, the text may not be exposed to UiAutomator2 when the calendar is in a transitional state (panel closing, view switching). The `byI18nFast` regex selector relies on text matching which may fail when the element is mid-animation or obscured.
2. **Location wizard timing:** Photon geocoding API is slow on emulator (network latency + cold start). The 8s timeout for `setup-search-result-0` is sometimes insufficient. Fallback map-tap works but subsequent steps may fail.
3. **Panel dismissal race:** After double-tapping to place a shift, the TemplatePanel is supposed to close. On Android, the close animation (~150ms) may not complete before the next test action fires.

**Workarounds:**
- Re-run flaky suites individually (usually passes on second attempt)
- Run iOS E2E for reliable regression testing (48/48, 100% stable)
- Run `registration.test.js` + `auth.test.js` + `calendar.test.js` for Android smoke test (19/19 stable)

**Potential fixes:**
1. Replace `byI18nFast` with `byTestId` for Month/Week toggle (add `testID="toggle-week"` / `testID="toggle-month"` to `CalendarHeader.tsx`)
2. Increase location wizard geocoding timeout from 8s → 15s, add retry loop
3. Add explicit `waitForExist` after panel close animations before proceeding to next action
4. Consider adding `TEST_MODE` animation skip for `CalendarHeader` toggle transitions

**Reproduce:**
```bash
cd mobile-app/e2e
npm run build:android                    # Fresh build with TEST_MODE
npm run infra:android                    # Terminal 1
PLATFORM=android npm run test:android    # Terminal 2 — expect ~24 failures
```

**Related:** `mobile-app/e2e/README.md` (Known flakiness section), `docs/E2E_TESTING_PLAN.md` (session logs)

---

## Resolved Issues

### Calendar doesn't immediately reflect clock-in/clock-out

**Status:** Fixed
**Discovered:** 2026-01-16
**Fixed:** 2026-01-16

**Original symptoms:**
- After clock-out, calendar still showed session as "active" (pulsating animation)
- Had to wait ~60 seconds for the calendar to sync

**Root cause:**
- No cross-module notification between Geofencing (TrackingManager) and Calendar modules
- Calendar only refreshed on 60-second polling interval

**Solution:**
Implemented an event-based notification system:
1. Created `src/lib/events/trackingEvents.ts` - simple EventEmitter for tracking state changes
2. TrackingManager emits `tracking-changed` event on clock-in/clock-out (auto and manual)
3. CalendarProvider subscribes to the event and refreshes tracking records when in review mode

**Files changed:**
- `src/lib/events/trackingEvents.ts` (new)
- `src/modules/geofencing/services/TrackingManager.ts`
- `src/lib/calendar/calendar-context.tsx`
