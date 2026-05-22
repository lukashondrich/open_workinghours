# Ticket: Overtime Completeness Indicator

**Priority:** Medium
**Context:** UX clarity — currently MonthView shows two overtime numbers (total vs. confirmed) which is confusing
**Status:** Open — design agreed, deferred (out of scope for the explainer work)

## Summary

Replace the dual "total overtime / confirmed overtime" display with **one overtime number plus a completeness fraction** ("16 von 19 Tagen bestätigt"). Apply the same treatment to the 14-day `HoursSummaryWidget` on the Status screen for symmetry.

When the period is fully confirmed, the fraction line disappears (or collapses to a quiet "Alle Tage bestätigt") so the UI doesn't carry dead weight in the common case.

## Why

- Two overtime numbers side by side ("Überstunden: +8h 45m" vs. "Bestätigt: +5h 30m") forces the user to mentally diff them and figure out what the gap means.
- The total is the headline the user cares about; confirmation is *completeness of input*, not a separate metric.
- Reframing as a fraction makes the confirmation concept honest (some days still pending) without competing for the headline.

## Design

### MonthView footer

```
Überstunden: +8h 45m  ⓘ
16 von 19 Tagen bestätigt
```

- Fraction line hidden when X = Y, or collapsed to "Alle Tage bestätigt" (DE) / "All days confirmed" (EN).
- Tapping the fraction could scroll/highlight unconfirmed days in the grid (nice-to-have, not required for v1).

### HoursSummaryWidget (Status screen, 14-day)

- Replace existing `"{X} to confirm"` nudge with the same `"X von Y bestätigt"` fraction.
- Keep the per-day faded-bar visual treatment for unconfirmed days (already in place at 0.4 opacity).
- ⓘ button in the header opens the same shared bottom sheet as MonthView.

## Denominator scoping

Use the same logic that already exists in `HoursSummaryWidget.tsx:164-167`:

```
days where (plannedMinutes > 0 OR actualMinutes > 0 OR hasVacation OR hasSick)
AND !isToday
AND !isPreAccount
```

Numerator = subset of those days where `isConfirmed === true` (or `locked === true` for MonthView).

## Implementation notes

**MonthView** — calculation is already available. No new data plumbing needed; `getMonthSummary()` already exposes `confirmedDates`, and the eligibility filter can be lifted from `HoursSummaryWidget`.

**HoursSummaryWidget** — needs a small extension to `DashboardDataService` (`/src/modules/geofencing/services/DashboardDataService.ts` around line 157-169) to expose `confirmedDayCount` and `eligibleDayCount` alongside the existing totals. The per-day `isConfirmed` field is already computed (line 144), just not aggregated.

**Shared bottom sheet (the ⓘ explainer)** is built separately and is the in-scope work for the current cycle.

## Files

| File | Change |
|------|--------|
| `mobile-app/src/modules/calendar/components/MonthView.tsx` | Replace dual-overtime footer rows with one total + completeness fraction |
| `mobile-app/src/lib/calendar/calendar-utils.ts` | Expose eligible-day count in `getMonthSummary()` |
| `mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx` | Replace `"{X} to confirm"` with fraction; keep faded bars |
| `mobile-app/src/modules/geofencing/services/DashboardDataService.ts` | Extend summary with `confirmedDayCount` + `eligibleDayCount` |
| `mobile-app/src/lib/i18n/translations/en.ts` + `de.ts` | New strings: `daysConfirmedFraction`, `allDaysConfirmed` |

## Out of scope

- The ⓘ explainer bottom sheet itself (done separately — that's the in-scope work that triggered this ticket)
- Tap-to-highlight unconfirmed days (v2 enhancement)
- Any change to the underlying confirmation flow / state machine
