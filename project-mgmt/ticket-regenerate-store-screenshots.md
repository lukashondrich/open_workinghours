# Ticket: Regenerate App Store screenshots (month-overtime flow outdated)

**Priority:** Low
**Created:** 2026-07-23
**Status:** Open — do together with the next screenshot refresh, no urgency

## Summary

The MonthView summary footer changed semantics and layout (overtime now scoped to
elapsed days; dual "total vs. confirmed" display replaced by one headline + a
"X von Y Tagen bestätigt" completeness line; future months show "{X}h Geplant").
Screenshot flow `mobile-app/store-assets/flows/04-calendar-month-overtime.js`
captures exactly this footer, and flow `03-status-dashboard.js` captures the
Status widget, which gained the same fraction line (replacing the red nudge) and
today-excluded Soll/Ist totals — so the PNGs currently in App Store Connect no
longer match the live app for both flows.

## Why low priority

- The change is an improvement — the new footer shows a calmer, more truthful number
  (no more large red negative when a month is fully planned but barely begun).
- Screenshots don't need to be pixel-accurate to the current build to stay compliant;
  they just drift.

## What to do

1. Re-run the pipeline per `mobile-app/store-assets/README.md` (6 flows × 2 locales,
   `TEST_SCREENSHOT_SEED` build).
2. Sanity-check flow 04: seeded data shows a positive green overtime headline in the
   COLLAPSED footer (the fraction line only appears in the expanded state — add a
   `summary-toggle` tap to the flow if the expanded footer should be showcased).
   Verify it reads well as a marketing asset.
3. Sanity-check flow 03: the Status widget now shows the fraction line next to the
   legend and today-excluded Soll/Ist values.
4. Check whether the composed headline copy for 03 + 04 still fits the new UI.
5. Upload to App Store Connect with the next metadata or app update.
