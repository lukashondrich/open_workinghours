# Ticket: Regenerate App Store screenshots (month-overtime flow outdated)

**Priority:** Low
**Created:** 2026-07-23
**Status:** RESOLVED 2026-08-12 — superseded by the panoramic screenshot set.
Upload to App Store Connect remains (see below); everything else is done.

## Resolution (2026-08-12)

The refresh happened as part of building the new **5-slot panoramic screenshot
set** (`store-assets/compose-panorama.js`, see `store-assets/README.md` →
"Panoramic set"):

- All 6 flows recaptured × 2 locales from a fresh `TEST_SCREENSHOT_SEED` build
  (vNext of the July UX release). Flow 03 verified: quiet "9 von 12 Tagen
  bestätigt" fraction + today-excluded Soll/Ist, exactly as shipped.
- The panorama set drops the month view (flow 04) entirely — its slot is
  replaced by the dark privacy panorama. Point 2 below is therefore moot for
  the store set. (Flow 04's raw had also silently captured the *week* view,
  not the month view, since at least June — worth knowing if the flow is ever
  revived.)
- Headline copy for the new set lives in `copy/{en,de}.json` under
  `pano-tracking-1/2`, `single-calendar`, `pano-privacy-1/2`.
- Store-ready PNGs: `composed/{locale}/panorama/` (1320×2868, alpha-stripped,
  filename prefixes = upload order) + `resized/` (1284×2778 sips fallback for
  the 6.7" slot, pre-generated).
- The panorama gutter constant (60px) was verified against a live panoramic
  set (Calm, DE store) by solving seam-contour continuity: measured ≈62px
  (4.7% of a slot) — within measurement error of 60.

**DONE:** uploaded to App Store Connect with the v2.1.4 (#72) submission,
2026-08-13. Ticket fully closed.

---

Original ticket below for context.

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
