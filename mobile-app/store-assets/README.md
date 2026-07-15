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
# 1. Start infra (Appium + simulator)
cd mobile-app/e2e
npm run infra:ios

# 2. Build the app in TEST_MODE with the screenshot seed (once per code change)
#    See "Build flags" below for what TEST_SCREENSHOT_SEED triggers.
cd ..
TEST_MODE=true TEST_SCREENSHOT_SEED=true npm run build:ios
# If `expo run:ios` fails with "No code signing certificates" on Xcode 26+,
# use the direct xcodebuild fallback documented in "Build pitfalls" below.

# 3. Capture all screenshots (both locales)
cd store-assets
npm run capture        # ~5 min total, 12 PNGs

# Or one locale at a time
npm run capture:en
npm run capture:de

# Or re-compose without re-capturing (after headline copy edit only)
npm run compose
```

## Build flags

| Env var | What it does |
|---|---|
| `TEST_MODE=true` | Mocks auth (code `123456`), mocks geocoding (returns Charité Berlin), skips animations. Required for the capture flows to navigate deterministically. Wired via `app.config.js` → `Constants.expoConfig.extra.TEST_MODE` → checked by `mockApi.ts:isTestMode()`. |
| `TEST_SCREENSHOT_SEED=true` | At app startup, `App.tsx` calls `seedDashboardTestData()` from `src/test-utils/seedDashboardData.ts`. Wipes existing state and seeds 14 days of varied shifts (Frühdienst / Spätdienst / Nachtdienst), one vacation day, one sick day, one location ("Klinikum München"), and two future shifts. Required for flows 03 + 04 to look populated. |

Verify the flag is baked into a freshly built `.app`:
```bash
plutil -p "$APP_PATH/EXConstants.bundle/app.config" | grep TEST_
```

## Build pitfalls

**Xcode 26 + devicectl bug:** `npx expo run:ios --configuration Release` may misdetect a booted iOS Simulator as a physical device and fail with "No code signing certificates are available." When that happens, fall back to a direct xcodebuild against the simulator destination — no signing required:

```bash
cd mobile-app/ios
TEST_MODE=true TEST_SCREENSHOT_SEED=true xcodebuild \
  -workspace OpenWorkingHours.xcworkspace \
  -scheme OpenWorkingHours \
  -configuration Release \
  -destination "platform=iOS Simulator,id=<sim-UDID>" \
  -derivedDataPath ./build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  build

xcrun simctl uninstall <sim-UDID> com.openworkinghours.mobileapp
xcrun simctl install   <sim-UDID> ./build/Build/Products/Release-iphonesimulator/OpenWorkingHours.app
```

Get the booted sim's UDID via `xcrun simctl list devices booted`.

**`expo prebuild` regenerates `ios/`:** The `ios/` directory is gitignored. Anything you edit there directly (e.g., `Info.plist`, `PrivacyInfo.xcprivacy`) will be overwritten on the next prebuild. Edit `mobile-app/app.json` instead — Expo bakes those fields in. The iOS privacy manifest lives at `app.json` → `ios.privacyManifests`; see `privacy_architecture.md` § "iOS Privacy Manifest" for the rationale.

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
- `ensureAuthenticatedForScreenshots()` (in `lib/seed.js`) bridges the new WelcomeScreen → LoginScreen, since the older e2e helpers only knew the legacy direct-to-login flow.
- TEST_MODE must be enabled in the build (auth code `123456`, mock geocoding). `TEST_SCREENSHOT_SEED=true` populates the dashboard data shown in flows 03 + 04.
- German shift names (`Frühdienst`, `Spätdienst`, `Nachtdienst`) and a German location (`Klinikum München`) are deliberately used in **both** locale runs. The primary audience is German healthcare workers; using the industry-standard shift terminology in the EN screenshots signals the target audience to anyone reviewing them.

## App Store metadata

The actual text submitted to App Store Connect (subtitle, promo, description, keywords, Nutrition Labels, reviewer notes, decisions log) lives in [`app-store-metadata.md`](./app-store-metadata.md). The headlines on the screenshots are in `copy/{en,de}.json`; the rest of the submission payload is in that doc.

## Flow status

| Flow | Captures | Populated by |
|---|---|---|
| 01 geofence | LocationsListScreen with map + geofence circle around the mocked Charité location | `ensureOneLocation` in `lib/seed.js` (searches for "Charité" via mocked geocoding) |
| 02 calendar-week-template | Week view + Shifts InlinePicker open with Frühdienst template | `ensureMinimalSeed` + the Shifts panel opened in the flow |
| 03 status-dashboard | 14-day Status chart with mixed planned/tracked/overtime + 2 future shifts in NextShiftWidget | `seedDashboardTestData()` at app startup (gated on `TEST_SCREENSHOT_SEED`) |
| 04 calendar-month-overtime | Month view with shifts + vacation + sick markers across the current month | same seed |
| 05 privacy | DataPrivacyScreen with consent versions + privacy budget | runs against the mocked `auth/me` response in `mockApi.ts` |
| 06 collective-insights | Reports tab → state×specialty stats card | `CollectiveInsightsService` returns canned values when `isTestMode()` |

If a flow comes back empty, the most likely cause is the build wasn't installed with `TEST_SCREENSHOT_SEED=true` baked in — re-verify with the `plutil` command above before debugging the flow itself.

## Apple requirements reference

- Required size: **6.9" iPhone** (1320×2868) — covers all smaller iPhones via auto-scaling.
- 3-10 screenshots per locale per device size. We ship **6**.
- No beta/coming-soon language in screenshots (App Store reject reason).
- Status bar should look clean (9:41, full battery/signal) — handled by `lib/capture.js`.

### 6.7" fallback (1284×2778)

In practice (verified 2026-06-04), App Store Connect's submission form sometimes rejects the canonical 1320×2868 PNGs from the **6.7" Display** screenshot slot even though Apple's documentation claims they auto-scale. If you see the error *"Mindestens ein Screenshot weist falsche Maße auf"* (or its English equivalent) listing acceptable sizes that include `1284 × 2778`, resize via macOS `sips`:

```bash
cd composed
mkdir -p en/resized de/resized
for f in en/*.png; do sips -z 2778 1284 "$f" --out "en/resized/$(basename "$f")"; done
for f in de/*.png; do sips -z 2778 1284 "$f" --out "de/resized/$(basename "$f")"; done
```

Aspect ratio is preserved within a barely-perceptible tolerance (1320/2868 = 0.4602 vs 1284/2778 = 0.4622). Drag from `en/resized/` and `de/resized/` instead.

If a 6.9" Display slot is also present in your form (Apple has been rolling this out), upload the original 1320×2868 PNGs there too — both slots accept screenshots independently.
