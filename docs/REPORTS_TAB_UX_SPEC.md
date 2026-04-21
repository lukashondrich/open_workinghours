# Reports Tab — UX Specification

**Status:** Prototype built, iterating
**Date:** 2026-04-10
**Branch:** `feature/reports-tab`

---

## 1. Overview

Replace the Settings tab with a **Reports** tab. The screen has two jobs:

1. **Action** — move weeks from personal to collective (confirm → queue → send)
2. **Reward** — show what your contributions produced (collective stats)

### Week submission pipeline

```
Auto-send OFF:  Unconfirmed → Confirmed → [Queue button] → Queued → Sent (Sunday)
Auto-send ON:   Unconfirmed → Confirmed ──────────────────────────→ Sent (Sunday)
```

- **Unconfirmed → Confirmed**: Automatic when all 7 days are confirmed (per-day toggle in Calendar WeekView)
- **Confirmed → Queued**: User taps "Queue for Sunday" button below week list (auto-send OFF only)
- **Queued → Confirmed**: User taps undo (reversible until Sunday)
- **Confirmed/Queued → Sent**: Sunday transmission. **Irreversible.**
- **Day confirmation**: Per-day toggle in Calendar WeekView. All 7 days must be confirmed, including rest days (0h).

---

## 2. Navigation

```
Before:  [ Status ]  [ Calendar ]  [ Settings ]
After:   [ Status ]  [ Calendar ]  [ Reports  ]
```

- **Gear icon** on Status screen header → opens Settings (stack screen)
- Settings contains: Work Locations, Notifications, Permissions, Biometric, Legal, Report Issue, Sign Out, GDPR controls
- **Status:** Implemented in prototype.

---

## 3. Screen Layout

```
┌──────────────────────────────────────┐
│  Reports                             │
├──────────────────────────────────────┤
│                                      │
│  ┌ ✓ KW 11 sent (reward, dismiss) ┐ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌──── Collective Insights ────────┐ │
│  │  Placeholder bar chart (blurred)│ │
│  │  "Not yet available — share     │ │
│  │   with colleagues"              │ │
│  │  [App teilen]                   │ │
│  └─────────────────────────────────┘ │
│                                      │
│  DEINE EINREICHUNGEN                 │
│  ✈ Auto-Senden [toggle]             │
│                                      │
│  KW 15 · Apr 7 – 13                 │
│  4 Tage zu bestätigen               │
│                                      │
│  KW 14 · Mar 31 – Apr 6             │
│  ✓ Alle Tage bestätigt              │
│                                      │
│  KW 13 · Mar 24 – 30                │
│  Eingereiht für Sonntag             │
│                                      │
│  KW 12 · Mar 17 – 23                │
│  2 Tage zu bestätigen               │
│                                      │
│  [Für Sonntag einreihen]            │
│                                      │
│  ┌ GESENDET  5 Wochen beig…   ▸  ┐ │
│  └────────────────────────────────┘ │
│  (expands to horizontal chip scroll)│
│  ┌ KW11  KW10  KW9  KW8  KW7     ┐ │
│  └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```

---

## 4. Week Cards

Uniform tappable rows. Every card has the same shape — no buttons inside cards. Tapping any card navigates to Calendar WeekView for that week.

### Card anatomy

```
KW 15 · Apr 7 – 13          ← title (semibold)
4 Tage zu bestätigen         ← status line (color-coded)
```

### Status line variants

| State | Text | Color |
|-------|------|-------|
| Unconfirmed | `{N} Tage zu bestätigen` — N in **warning orange** | `colors.warning.main` for count, `colors.text.tertiary` for rest |
| Confirmed | `✓ Alle Tage bestätigt` | `colors.primary[700]` |
| Confirmed + auto-send | `Wird Sonntag gesendet` | `colors.primary[500]` |
| Queued | `Eingereiht für Sonntag` | `colors.primary[500]` |

### Queue action

No buttons inside cards. A single "Queue for Sunday" button appears below the week list when there are confirmed weeks and auto-send is OFF. Queues all confirmed weeks at once.

### History depth

- **Active weeks** (Unconfirmed, Confirmed, Queued): Always show all. Piling up is intentional — nudges compliance.
- **Sent weeks**: Collapsible section with horizontal chip scroll.
- **Current week**: Always at top of active list as Unconfirmed (can't be queued until week is over).

---

## 5. Auto-Send

### Toggle style

Compact inline toggle matching the GPS toggle in CalendarHeader:

```
[✈ Auto-Senden] [switch]
```

- Small pill/badge with Send icon + label, then a Switch
- Inactive: grey background (`colors.grey[100]`), grey text
- Active: teal tint (`colors.primary[50]`), primary text (`colors.primary[700]`)

### Behavior

| Auto-send | What happens when all 7 days are confirmed |
|-----------|-------------------------------------------|
| **OFF** | "Queue for Sunday" button appears below week list. User must tap to queue. |
| **ON** | Week auto-queued. Card shows "Wird Sonntag gesendet". No action needed. |

### Default

OFF (opt-in). Users should understand what they're sharing before enabling.

### Important distinction

Auto-send ≠ auto-confirm. Users always confirm days manually in the Calendar. Auto-send only skips the "Queue" button in Reports.

---

## 6. Collective Insights

White elevated card near the top of the screen. **Gated**: only visible to users who have sent at least 1 week. Users with 0 contributions see the placeholder.

### Before DP threshold (k-anonymity not met) or no contributions

- Stylized/blurred bar chart (planned vs actual hours) as placeholder
- Text: "Collective insights for your region are not yet available — share the app with colleagues to contribute"
- **No numbers about how many users exist** (leaks group size, undermines DP)
- Share button → native share sheet with pre-written message + app store link

### After DP threshold (stats published)

Real DP-aggregated stats for the user's state × specialty:

- Bar chart: average planned hours vs average actual hours ± CI
- Average overtime ± CI
- ~N contributors (using `n_display`, rounded to nearest 5)
- Period label (weekly/biweekly/monthly per config)

Data source: `GET /stats/by-state-specialty` (already built).

Mobile shows only the user's own region/specialty. Broader exploration deferred to the website.

---

## 7. Sent History

Collapsible section at the bottom. White elevated card.

### Collapsed (default)

```
┌──────────────────────────────────────┐
│  GESENDET   5 Wochen beigetragen  ▸ │
└──────────────────────────────────────┘
```

### Expanded

```
┌──────────────────────────────────────┐
│  GESENDET   5 Wochen beigetragen  ▾ │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  [KW11] [KW10] [KW9] [KW8] [KW7] → │  (horizontal scroll)
└──────────────────────────────────────┘
```

- Tap header to toggle
- Chips scroll horizontally when list is long
- Both header and chip row on white elevated cards

---

## 8. Monday Reward Card

When the app opens after a successful Sunday transmission:

```
┌──────────────────────────────────────┐
│  ✓ KW 13 sent                     ✕ │
│  9 weeks contributed total           │
└──────────────────────────────────────┘
```

- Appears once at top of Reports screen
- Dismissable
- Light teal background (`colors.primary[50]`)

---

## 9. First-Time Explanation

On the first submission action (tapping "Queue for Sunday" or enabling auto-send), show an inline overlay:

```
┌──────────────────────────────────────┐
│                                      │
│     Your first contribution          │
│                                      │
│  By submitting this week, you're     │
│  contributing your working hours     │
│  to the collective dataset.          │
│                                      │
│  • Weekly totals are anonymized      │
│    and added to aggregate stats      │
│  • No individual shifts are shared   │
│  • After Sunday, this can't be       │
│    undone                            │
│                                      │
│        [Got it]                      │
│                                      │
└──────────────────────────────────────┘
```

- Shown once (first queue or first auto-send enable)
- Inline `<View>` overlay, not `<Modal>` (must be E2E testable)

---

## 10. Sunday Transmission

### Reliability cascade

Implementation uses three tiers. Build in order C → B → A.

| Tier | Mechanism | When | Notes |
|------|-----------|------|-------|
| **C. Send on app open** | Every app open, check for unsent queued weeks past their Sunday. Send immediately. | Next app open | 100% reliable. Foundation — always needed. Build first. |
| **B. Push notification** | Backend sends push Sunday ~18:00. User taps → app opens → Tier C logic fires. | Sunday 18:00 | This is the "Sunday moment." Build second. |
| **A. Background fetch** | `expo-background-fetch` (iOS) / `WorkManager` (Android). | Sunday 18:00–20:00 | OS controls timing. Least reliable on iOS. Defer until data shows B is insufficient. |

### What gets sent

For each queued week, the app calls `POST /finalized-weeks` with `week_start` (Monday). The backend:

1. Sums the 7 `work_events` for that week
2. Snapshots user demographics
3. Creates an immutable `FinalizedUserWeek`
4. Blocks future edits to those work events

### Notifications

| Trigger | When | Message |
|---------|------|---------|
| Unconfirmed days remain | Sunday ~14:00 | "You have unconfirmed days this week" |
| Confirmed but not queued (auto-send OFF) | Sunday ~17:00 | "Tap Queue to include KW14 in tonight's submission" |
| Ready to send (Tier B push) | Sunday ~18:00 | "Your weekly data is ready to send — tap to submit" |
| Transmission complete | After send | "KW14 sent — N weeks contributed total" |

---

## 11. Edge Cases

| Case | Behavior |
|------|----------|
| No shifts planned all week | Week still appears — all 7 days need confirmation (rest days = 0h) |
| Current incomplete week | Shown as Unconfirmed with X/7 progress. Cannot be queued until week is over. |
| Past week, partially confirmed | Unconfirmed with remaining count in warning orange |
| Past week, all confirmed, auto-send ON | Auto-queued, shows "Sending Sunday" |
| User un-confirms a day after queuing | Week moves back to Unconfirmed |
| Sunday arrives, nothing queued | Nothing sent, no error |
| User opens Monday after transmission | Monday reward card shown |
| App not open on Sunday | Tier A attempts background send. Tier B sends push. Tier C sends on next app open. |
| No network | Retry next time app has connectivity. Week stays queued. |

---

## 12. Prototype Status

### What's built (mock data) — updated 2026-04-10

| Component | Status | Notes |
|-----------|--------|-------|
| Navigation (tab + gear icon) | ✅ Done | Settings is now stack screen via gear icon on StatusScreen |
| ReportsScreen layout | ✅ Done | Full vertical list with all sections |
| Collective insights (3 swipeable cards) | ✅ Done | You vs Group, Regional Hospitals, Overtime Trend — with page dots |
| Lock overlays on insight cards | ✅ Done | Semi-transparent watermark with lock icon + explanation text per card |
| Auto-send toggle (global) | ✅ Done | Right-aligned in section header row, GPS-style pill + switch |
| Per-card send switches | ✅ Done | Mini switch (0.8 scale, lighter colors) on each week card trailing edge |
| Week cards | ✅ Done | Tap → calendar, switch → queue/unqueue; disabled when unconfirmed or auto-send on |
| Remaining days in warning orange | ✅ Done | Salient count for unconfirmed weeks |
| Sent history (collapsible vertical list) | ✅ Done | Single white card with header + vertical week rows, export icon (no chevron) |
| Monday reward card | ✅ Done | Dismissable, teal tint |
| First-time overlay | ✅ Done | Inline view, not Modal |
| Share App button | ✅ Done | On card 1, below lock overlay (tappable) |
| i18n (EN + DE) | ✅ Done | All strings translated |

### Design decisions made during iteration

| Decision | Rationale |
|----------|-----------|
| Per-card switches instead of bulk queue button | Global auto-send = bulk action; individual switches = granular control. Clean hierarchy. |
| Lock watermark overlay (not lock icon in header) | Clearly signals the chart content is placeholder, not real data |
| Export icon replaces chevron on sent history | Row already tappable to expand; icon promotes export and doubles as interactive affordance |
| Abstract region map (not Germany outline) | Region ≠ Germany; data is per-state × specialty. Stylized grey box + pins reads as "a region" |
| Lighter switch colors on per-card toggles | Visual hierarchy: global toggle at full color dominates, per-card toggles recede |
| No motivational progress indicators (e.g. "3 of 5 needed") | Would leak group size below k-anonymity threshold — violates DP constraints |

### What's next (real data integration)

| Task | Notes |
|------|-------|
| Wire to SQLite | Query `daily_actuals` for day confirmation state, compute week states |
| Week queue state persistence | Store queued/auto-send preference in mobile DB |
| Calendar deep-link | Navigate to specific week when tapping a card |
| Send-on-open (Tier C) | Check for unsent queued weeks on app open, call `POST /finalized-weeks` |
| Push notification (Tier B) | Backend sends Sunday push, app opens → Tier C fires |
| Collective insights (real data) | Fetch from `GET /stats/by-state-specialty`, remove lock overlay, render real chart |
| Export functionality | Generate PDF/CSV of sent weeks from on-device data |

---

## 13. Files Affected

| Area | Files |
|------|-------|
| Navigation | `AppNavigator.tsx` — tab change, Settings as stack screen |
| New screen | `modules/reports/screens/ReportsScreen.tsx` |
| Status screen | `StatusScreen.tsx` — gear icon for Settings |
| Calendar link | WeekView navigation support (jump to specific week) |
| Submission | New service: weekly finalization + send-on-open logic |
| Database | Mobile schema: auto-send preference, week queue state |
| Backend | `POST /finalized-weeks` already exists |
| i18n | `en.ts`, `de.ts` — reports section translations |
| Notifications | Sunday notification scheduling |

---

## Deferred Items

- **Chart library choice** — decide when building the real collective insights charts
- **Website access control for granular stats** — revisit after user growth
- **Auto-send onboarding prompt** — when and how to suggest enabling auto-send
- **Hospital-level aggregation** — needs new backend endpoint + hospital affiliation in user profile
