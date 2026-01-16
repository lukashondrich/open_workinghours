# Known Issues

**Last Updated:** 2026-01-16

---

## Active Issues

(No active issues)

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
