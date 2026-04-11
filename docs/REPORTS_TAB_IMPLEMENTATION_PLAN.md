# Reports Tab — Implementation Plan

**Status:** UI prototype complete (mock data). This plan covers wiring real data.
**Branch:** `feature/reports-tab`
**Date:** 2026-04-11
**Prerequisite:** `docs/REPORTS_TAB_UX_SPEC.md` (design reference)

---

## Overview

The prototype renders all UI with hardcoded mock data. This plan covers the work needed to make everything functional with real data from SQLite (on-device) and the backend API.

**Guiding principle:** Build in layers. Each phase produces a working increment that can be tested independently.

---

## Phase 1: Week State Computation (on-device only)

**Goal:** Replace `MOCK_ACTIVE_WEEKS` with real week data derived from `daily_actuals`.

### 1.1 Week computation service

**New file:** `modules/reports/services/WeekStateService.ts`

Computes week states from the existing `daily_actuals` SQLite table:

```
For each week (Monday → Sunday) from the user's first daily_actual to current week:
  1. Query: SELECT date, confirmed_at FROM daily_actuals WHERE date BETWEEN monday AND sunday
  2. Count confirmed days (any row with confirmed_at != null counts)
  3. Days with no row = unconfirmed (rest days need explicit 0h confirmation)
  4. Determine state:
     - 7/7 confirmed + already finalized on backend → 'sent'
     - 7/7 confirmed + queued locally → 'queued'
     - 7/7 confirmed → 'confirmed'
     - <7 confirmed → 'unconfirmed' (with remaining count)
```

**Data source:** `Database.ts` → `daily_actuals` table

**Key fields:**
- `date` (TEXT, ISO format)
- `planned_minutes` (INTEGER)
- `actual_minutes` (INTEGER)
- `confirmed_at` (TEXT, ISO timestamp)

**New query in Database.ts:**

```ts
async getDailyActualsForWeek(monday: string, sunday: string): Promise<DailyActual[]>
```

Returns all `daily_actuals` rows for the date range. The service computes week state from this.

### 1.2 Wire into ReportsScreen

- Replace `MOCK_ACTIVE_WEEKS` with `useEffect` → `WeekStateService.getActiveWeeks()`
- Replace `MOCK_SENT_WEEKS` with `WeekStateService.getSentWeeks()` (initially empty — populated in Phase 3)
- Current week always appears as 'unconfirmed' at top (can't finalize until week is over)
- Show weeks going back to the user's first tracked week

### 1.3 Testing

- Unit test `WeekStateService` with mock SQLite data
- Verify on device: weeks populate from real daily_actuals
- Edge case: week with no tracking at all (all 7 days unconfirmed)

**Files touched:**
| File | Change |
|------|--------|
| `modules/reports/services/WeekStateService.ts` | New — week state computation |
| `services/Database.ts` | Add `getDailyActualsForWeek()` query |
| `screens/ReportsScreen.tsx` | Replace mock data with service calls |

---

## Phase 2: Queue State + Auto-Send Persistence

**Goal:** Per-card send toggles and auto-send preference persist across app restarts.

### 2.1 Schema addition

Add two fields to mobile SQLite:

**Option A — New `week_queue` table:**
```sql
CREATE TABLE IF NOT EXISTS week_queue (
  week_start TEXT PRIMARY KEY,       -- ISO Monday date
  status TEXT NOT NULL DEFAULT 'confirmed',  -- 'confirmed' | 'queued'
  queued_at TEXT,
  sent_at TEXT
);
```

**Option B — `user_preferences` key-value store (for auto-send):**
```sql
-- Already exists? Check Database.ts. If not:
INSERT OR REPLACE INTO user_preferences (key, value) VALUES ('auto_send', '0');
```

Check if `user_preferences` table exists in `Database.ts`. If not, create a lightweight one. Auto-send is a single boolean.

### 2.2 Queue logic

**In `WeekStateService`:**
- `queueWeek(weekStart: string)` → insert/update `week_queue` row to 'queued'
- `unqueueWeek(weekStart: string)` → update back to 'confirmed'
- `getQueuedWeeks()` → all rows with status='queued'
- `setAutoSend(enabled: boolean)` → persist preference
- `getAutoSend()` → read preference

**Auto-send behavior:**
When auto-send is ON and a week becomes fully confirmed (7/7 days), it's auto-queued. This check runs:
- On Reports screen mount
- When `daily_actuals` changes (if we have a listener/refresh mechanism)

### 2.3 Wire into ReportsScreen

- `handleToggleSend` → calls `queueWeek`/`unqueueWeek`
- `handleAutoSendToggle` → calls `setAutoSend` + auto-queues eligible weeks
- On mount: load queue state + auto-send preference

**Files touched:**
| File | Change |
|------|--------|
| `services/Database.ts` | Add `week_queue` table, `user_preferences` if needed |
| `services/WeekStateService.ts` | Queue/unqueue/auto-send methods |
| `screens/ReportsScreen.tsx` | Wire toggle handlers to persistence |

---

## Phase 3: Send-on-Open (Tier C)

**Goal:** When the app opens, check for queued weeks past their Sunday deadline and send them.

### 3.1 Finalization service

**New file:** `modules/reports/services/WeekFinalizationService.ts`

```ts
async function sendQueuedWeeks(): Promise<SendResult[]> {
  1. Query week_queue WHERE status = 'queued' AND week_end < today
  2. For each week:
     a. Verify all 7 work_events exist on backend (they should — daily submission sends them)
     b. Call POST /finalized-weeks { week_start: monday }
     c. On success: update week_queue status = 'sent', record sent_at
     d. On failure: log error, skip (retry next open)
  3. Return results for UI feedback
}
```

**Important:** `POST /finalized-weeks` expects the 7 `work_events` to already exist on the backend. The existing `DailySubmissionService` handles this. The finalization call just tells the backend to "seal" the week.

### 3.2 Trigger on app open

**In `App.tsx` or `AppNavigator.tsx`:**
- On app state change to 'active' (from background), call `sendQueuedWeeks()`
- Also call on initial mount
- Gate behind auth check (need valid JWT)

### 3.3 Sent weeks in UI

After successful send:
- Week moves from active list to sent history
- If Monday reward card logic: check if a week was just sent since last app open → show reward
- Reward state: persist "last shown reward week" in `user_preferences`

### 3.4 Pre-condition: daily submission completeness

Before finalizing a week, verify the 7 daily submissions succeeded:
- Check `daily_submission_queue` WHERE date IN week AND status = 'sent'
- If any day isn't sent yet, skip finalization (daily submission service will catch up)

**Files touched:**
| File | Change |
|------|--------|
| `services/WeekFinalizationService.ts` | New — send queued weeks to backend |
| `services/WeekStateService.ts` | Method to check daily submission completeness |
| `App.tsx` or `AppNavigator.tsx` | Trigger send-on-open |
| `screens/ReportsScreen.tsx` | Refresh data after send, show reward card |
| `services/Database.ts` | Query helpers for submission status |

---

## Phase 4: Calendar Deep-Link

**Goal:** Tapping a week card navigates to Calendar WeekView for that specific week.

### 4.1 Navigation params

Currently `navigation.navigate('Calendar', {})` — needs a `targetWeek` param.

**In `AppNavigator.tsx`:**
```ts
type MainTabParamList = {
  Calendar: { targetWeek?: string }; // ISO Monday date
  // ...
};
```

**In `CalendarScreen` or `WeekView`:**
- Read `route.params.targetWeek`
- If present, set the calendar's current week to that date on mount

### 4.2 Wire from ReportsScreen

```ts
const handleNavigateToWeek = (weekNumber: number) => {
  const monday = computeMondayFromWeekNumber(weekNumber, year);
  navigation.navigate('Calendar', { targetWeek: monday });
};
```

**Files touched:**
| File | Change |
|------|--------|
| `navigation/AppNavigator.tsx` | Add `targetWeek` param to Calendar |
| `screens/ReportsScreen.tsx` | Pass computed Monday date |
| Calendar components | Read and apply `targetWeek` param |

---

## Phase 5: Collective Insights (Real Data)

**Goal:** When DP stats are published for the user's group, unlock insight cards with real data.

### 5.1 Fetch stats

**New file:** `modules/reports/services/CollectiveInsightsService.ts`

```ts
async function fetchInsights(stateCode: string, specialty: string): Promise<InsightData | null> {
  1. GET /stats/by-state-specialty?state_code={stateCode}&specialty={specialty}&limit=1
  2. If response has a published cell (status != 'suppressed'):
     return { plannedMean, actualMean, overtimeMean, plannedCi, actualCi, overtimeCi, nDisplay, periodType }
  3. Else: return null (card stays locked)
}
```

**User's state + specialty:** Read from user profile (stored on-device after auth). Check how `DailySubmissionService` gets the JWT / user info.

### 5.2 User's own hours

For the "You" bar in card 1:
- Sum `daily_actuals.actual_minutes` for the most recent complete week
- Convert to hours
- Compare against group average from API

### 5.3 Unlock logic in UI

```tsx
const insights = useFetchInsights(userStateCode, userSpecialty);

// Card 1: You vs Group
if (insights && userWeekHours) {
  // Show real bars + numbers, no lock overlay
} else {
  // Show placeholder + lock overlay (current state)
}
```

**Card 2 (Regional Hospitals):** Requires a new backend endpoint (per-hospital aggregation). Leave locked with placeholder for now. Implementation deferred until hospital-level data exists.

**Card 3 (Trend):** Query `GET /stats/by-state-specialty` with multiple periods (last 4-8 weeks). If enough published periods exist, render sparkline with real data. Otherwise stays locked.

### 5.4 Chart rendering

For the real bars, no external chart library needed:
- Horizontal bars: computed `width` proportional to hours values (same `View` approach as placeholder)
- CI range: wider/lighter bar behind the main bar
- Values as text labels

If a real chart library is needed later (e.g., for the sparkline), `react-native-svg` is already installed — SVG-based charts can be built manually or with `victory-native`.

**Files touched:**
| File | Change |
|------|--------|
| `services/CollectiveInsightsService.ts` | New — fetch + parse DP stats |
| `screens/ReportsScreen.tsx` | Conditional rendering: locked vs real data |
| `services/WeekStateService.ts` | Method for user's own week hours |

---

## Phase 6: Export

**Goal:** Export button on sent history generates a sharable document of the user's submitted weeks.

### 6.1 Data collection

From on-device `daily_actuals` + `week_queue` (sent weeks):
```
For each sent week:
  - Week number, date range
  - Daily breakdown: planned_minutes, actual_minutes, source
  - Weekly totals: planned, actual, overtime
```

### 6.2 Output format

**Option A — Share as image:** Render a summary view, capture as image via `react-native-view-shot`, share via native share sheet.

**Option B — CSV export:** Generate CSV string, write to temp file, share via native share sheet.

**Recommendation:** Start with CSV (simpler, universally useful). Add image export later if users want visual sharing.

### 6.3 Implementation

```ts
async function exportSentWeeks(): Promise<void> {
  1. Query all sent weeks from week_queue + their daily_actuals
  2. Format as CSV: Week, Date, Planned (h), Actual (h), Overtime (h), Source
  3. Write to FileSystem.cacheDirectory
  4. Open native share sheet via expo-sharing
}
```

**Dependencies:** `expo-file-system` (already in Expo), `expo-sharing` (check if installed).

**Files touched:**
| File | Change |
|------|--------|
| `services/ExportService.ts` | New — CSV generation + share |
| `screens/ReportsScreen.tsx` | Wire export button `onPress` |

---

## Phase 7: Push Notifications (Tier B)

**Goal:** Backend sends push notification Sunday ~18:00 → user taps → app opens → Tier C fires.

### 7.1 Backend push infrastructure

- Requires push token storage: user registers device push token on login
- New table: `device_push_tokens` (user_id, token, platform, created_at)
- New endpoint: `POST /auth/push-token` to register
- Sunday cron job: for each user with queued/confirmed weeks, send push

### 7.2 Mobile push setup

- `expo-notifications` for push token registration + handling
- On notification tap: app opens → `sendQueuedWeeks()` fires (Tier C)
- Local notifications for reminders (unconfirmed days Sunday ~14:00)

### 7.3 Notification messages (from UX spec)

| Trigger | When | Message |
|---------|------|---------|
| Unconfirmed days remain | Sunday ~14:00 (local) | "You have unconfirmed days this week" |
| Confirmed but not queued | Sunday ~17:00 (local) | "Tap Queue to include KWxx in tonight's submission" |
| Ready to send | Sunday ~18:00 (push from backend) | "Your weekly data is ready to send" |
| Transmission complete | After send | "KWxx sent — N weeks contributed total" (local) |

**This is the most complex phase.** Defer until Phases 1-5 are working.

**Files touched:**
| File | Change |
|------|--------|
| Backend: `routers/auth.py` | Push token registration endpoint |
| Backend: `models.py` | `device_push_tokens` table |
| Backend: new cron/task | Sunday push send job |
| Mobile: `services/NotificationService.ts` | New — push registration + local scheduling |
| Mobile: `App.tsx` | Register push token on auth |

---

## Implementation Order

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
  (weeks)    (persist)    (send)     (deep-link)
                                        │
Phase 5 ◄───────────────────────────────┘
  (insights)
      │
Phase 6 ──→ Phase 7
  (export)    (push — defer)
```

**Phases 1-3 are the critical path** — they complete the core loop: confirm days → queue weeks → send on Sunday.

Phase 4 is quick and can be done anytime.

Phase 5 depends on having sent data (so users see themselves in the chart).

Phase 6 is independent — can be done anytime after Phase 2.

Phase 7 is deferred until the core loop is validated with real users.

---

## Open Questions

1. **Day confirmation UX in Calendar:** The Reports tab assumes per-day confirmation toggles exist in WeekView. Do they? If not, that's a prerequisite for Phase 1.

2. **Rest day confirmation:** The spec says rest days (0h) must be explicitly confirmed. Is there UI for this in the Calendar? Users might not think to "confirm" a day they didn't work.

3. **Backend work_event completeness:** `POST /finalized-weeks` requires all 7 work_events to exist. The daily submission service sends them, but what if a user has days with 0 planned and 0 actual? Does the backend create a work_event for those?

4. **User profile fields:** Card 1 needs `state_code` and `specialty` from the user's profile to query the right stats group. Where is this stored on-device?

5. **Expo-sharing:** Is `expo-sharing` already a dependency? If not, needs to be added for Phase 6.
