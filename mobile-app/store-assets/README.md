# App Store Screenshot Pipeline

Automated capture + composition of App Store screenshots in EN + DE.

## Output

12 PNGs at 1320×2868 (iPhone 16 Pro Max display) ready to drag into App Store Connect:

```
composed/
├── en/
│   ├── 01-geofence.png
│   ├── 02-calendar-week-template.png
│   ├── 03-status-dashboard.png
│   ├── 04-calendar-month-overtime.png
│   ├── 05-privacy.png
│   └── 06-collective-insights.png
└── de/  (same six)
```

## How it works

```
                ┌─────────────────────────────────────────┐
                │           capture-all.js                │
                │  (orchestrator: per locale, per flow)   │
                └────────────┬────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        ┌──────────────┐         ┌──────────────┐
        │  lib/locale  │         │  flows/NN-*  │
        │ set locale + │  ────▶  │ Appium nav + │
        │ restart app  │         │  capture     │
        └──────────────┘         └──────┬───────┘
                                        │
                                  raw/{locale}/NN-*.png
                                        │
                                        ▼
                                ┌──────────────┐
                                │  compose.js  │
                                │ SVG headline │
                                │ + tinted bg  │
                                └──────┬───────┘
                                        │
                              composed/{locale}/NN-*.png
```

## Setup (one-time)

```bash
cd mobile-app/store-assets
npm install            # installs sharp

# Ensure e2e infra is set up (uses Appium + helpers from ../e2e/)
cd ../e2e
npm install            # if not already done
npm install -g appium
appium driver install xcuitest
```

## Run

```bash
# 1. Start infra (Appium + simulator + Metro)
cd mobile-app/e2e
npm run infra:ios

# 2. Build the app in TEST_MODE (once, or after testID changes)
npm run build:ios

# 3. Capture all screenshots (both locales)
cd ../store-assets
npm run capture        # ~5 min total, 12 PNGs

# Or one locale at a time
npm run capture:en
npm run capture:de

# Or re-compose without re-capturing (after headline copy edit)
npm run compose
```

## File layout

```
store-assets/
├── lib/
│   ├── capture.js       # screenshot + status bar override
│   └── locale.js        # set iOS simulator locale + restart
├── flows/
│   ├── 01-geofence.js   # one .js per screenshot; navigates + captures
│   ├── 02-calendar-week-template.js
│   ├── 03-status-dashboard.js
│   ├── 04-calendar-month-overtime.js
│   ├── 05-privacy.js
│   └── 06-collective-insights.js
├── copy/
│   ├── en.json          # { "01-geofence": { "headline": "..." }, ... }
│   └── de.json
├── raw/                 # captured PNGs (gitignored)
├── composed/            # final marketing PNGs (gitignored)
├── compose.js           # sharp-based: headline + bg overlay
└── capture-all.js       # orchestrator
```

## Adding / editing a screenshot

1. **Add a new flow:** copy `flows/01-geofence.js`, change navigation + filename.
2. **Add the headline:** edit `copy/en.json` + `copy/de.json` with matching key.
3. **Run:** `npm run capture`.

## Design conventions (visual style)

- **Canvas:** 1320×2868 (iPhone 16 Pro Max).
- **Background:** tinted teal `#f0fdfa` (brand color at low opacity over white).
- **Headline:** top ~25% of canvas, centered, 110pt bold, color `#1c1917`.
- **Screenshot:** scaled to fit bottom ~75% with horizontal padding, no device frame.

Tunables live in `compose.js` (constants at top of file).

## Conventions

- Each flow is a standalone Node script: `node flows/01-geofence.js` runs it directly.
- Flows read `process.env.LOCALE` to know where to save (`raw/en/` or `raw/de/`).
- `ensureAuthenticated()` + `ensureLocationConfigured()` are reused from `../e2e/helpers/actions.js`.
- TEST_MODE must be enabled in the build (auth code `123456`, mock geocoding).

## V1 status — what works, what's stubbed

| Flow | Captures | Status |
|------|----------|--------|
| 01 geofence | LocationsListScreen with map + geofence circle around the mocked "Charité Berlin" location | ✅ Should work fully |
| 02 calendar-week-template | Week view + Shifts InlinePicker open with "Frühschicht" template | ✅ Seeded via `lib/seed.js` |
| 03 status-dashboard | 14-day status view | ⚠ Empty unless shifts placed (see below) |
| 04 calendar-month-overtime | Month view | ⚠ Empty unless shifts placed (see below) |
| 05 privacy | DataPrivacyScreen | ✅ Should work fully |
| 06 collective-insights | Reports tab | ⚠ Empty unless backend returns published data for this user's state+specialty (see below) |

**Seed model (v1):** `lib/seed.js → ensureMinimalSeed()` ensures one shift template exists. It does **not** place shifts on the calendar — so flows 03 and 04 will show an empty status dashboard / empty month view.

### Phase 2 work to fully populate screenshots

1. **Place shifts on the current week** (for flows 03 + 04 to look populated). Add to `lib/seed.js`:
   ```js
   async function placeShiftsOnCurrentWeek(driver) {
     // arm template-row-0, then double-tap a few week-day-column-{dateKey} elements
     // idempotency: skip if month-day-{dateKey}-shifts already exists
   }
   ```
   Pattern lives in `e2e/flows/shifts.test.js` (test "should double-tap day column...").

2. **Place an absence on one day** (for flow 04's "sick day visible" framing). Pattern in `e2e/flows/absences.test.js`.

3. **Mock CollectiveInsightsService for flow 06.** The Reports tab fetches from `/stats/by-state-specialty` on the real backend — with one active user, no published data exists. Options:
   - Add `isTestMode()` check to `CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights()` returning canned data.
   - Or insert a published row into the prod DB for a synthetic state+specialty used only in TEST_MODE.

4. **Tweak TEST_MODE seed data origin.** If you'd rather seed via a baked-in app routine than via UI actions, add a `SCREENSHOT_MODE=true` flag (sibling to `TEST_MODE`) that triggers in-app seeding on first launch — faster than UI-driven seed, but requires app code changes.

## Apple requirements reference

- Required size: **6.9" iPhone** (1320×2868) — covers all smaller iPhones via auto-scaling.
- 3-10 screenshots per locale per device size. We ship **6**.
- No beta/coming-soon language in screenshots (App Store reject reason).
- Status bar should look clean (9:41, full battery/signal) — handled by `lib/capture.js`.
