# Known Issues

**Last Updated:** 2026-03-24

---

## Active Issues

### Android E2E: Month view toggle and location wizard flakiness

**Status:** Fix applied (2026-03-24) — awaiting rebuild + verification
**Discovered:** 2026-02-03 (documented), confirmed 2026-03-24
**Severity:** Medium — blocks full Android E2E green, does not affect iOS
**Affects:** `shifts.test.js`, `absences.test.js`, `manual-session.test.js`, `location.test.js`

**Symptoms:**
- `byI18nFast(driver, 'month')` — "Month"/"Monat" toggle not found after 5s timeout (~25-50% of runs)
- Location wizard: `setup-search-result-0` not found — geocoding timeout or search results don't render in time
- `manual-session.test.js` fails entirely because it depends on a configured location (cascading failure)
- Panel dismissal after double-tap shift placement sometimes doesn't complete, blocking subsequent Month toggle tap

**Scope:** 24 failures in full suite run (2026-03-24). Auth (5/5), Calendar (7/7), Registration (7/7) all pass consistently.

**Root causes (confirmed):**
1. **Month/Week toggle:** UiAutomator2 `textMatches()` regex fails when text isn't exposed during animation. Replaced with `testID`-based selection.
2. **Location wizard timing:** Photon geocoding 8s timeout too short on emulator. Increased to 15s.
3. **Panel dismissal race:** TemplatePanel 300ms animation was running even in TEST_MODE. Now skipped in TEST_MODE (follows ManualSessionForm pattern).

**Fixes applied (2026-03-24):**
1. Added `testID="toggle-week"` / `testID="toggle-month"` to `CalendarHeader.tsx` toggle buttons (+ `accessible={true}`, `accessibilityRole="button"`, parent `accessible={false}`)
2. Replaced all `byI18nFast(driver, 'month'/'week')` with `byTestId(driver, 'toggle-month'/'toggle-week')` in `shifts.test.js`, `absences.test.js`, `calendar.test.js`
3. Added `isTestMode()` animation skip to `TemplatePanel.tsx` (instant open/close in TEST_MODE)
4. Increased geocoding timeout in `actions.js` from 8s → 15s

**Rebuild required:** testID and TEST_MODE changes need `npm run build:android` before testing.

**Verify:**
```bash
cd mobile-app/e2e
npm run build:android                    # Rebuild with fixes
npm run infra:android                    # Terminal 1
PLATFORM=android npm run test:android    # Terminal 2 — expect improvement
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
