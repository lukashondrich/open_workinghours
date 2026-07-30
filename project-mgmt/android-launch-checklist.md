# Android Play Store launch — working checklist

**Created:** 2026-07-09 (during iOS launch follow-up). Companion to `WORKSTREAMS.md` §8.
**SUBMISSION AAB (2026-07-30): versionCode 6, v2.1.3, production profile** —
`expo.dev/artifacts/eas/X2g4v72arPU1X2gTLjZzknE9MNz63ENFnGxo911cWnw.aab`
Binary-verified: READ/WRITE_CALENDAR ✓, ACCESS_BACKGROUND_LOCATION ✓,
FOREGROUND_SERVICE_LOCATION ✓, Maps key ✓, versionName 2.1.3 ✓,
LocationTaskService ✓. Contains all 2026-07 fixes + react-native-maps 1.29.
*(Supersedes the versionCode-5 AAB below, which predates every fix from the
July test campaign.)*

---

## ✅ AAB verified (inspected the actual binary manifest, 2026-07-09)

Confirmed present in the built AAB — not inferred from config:
- Permissions: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_FINE/COARSE_LOCATION`, `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`
- Foreground service **typed `location`** (`LocationTaskService`) — Android 14 requirement met
- Google Maps API key embedded with a real value → maps will render
- Google Sign-In (`gms.auth.api.signin`) wired; package `com.openworkinghours.mobileapp`
- targetSdk 36 (≥ Play's 34 minimum)

**Conclusion: the build is sound; installing it will not waste your time.**

---

## On-device test checklist (prioritized by Android risk)

Use email-code login (`demo@openworkinghours.org` / `123456`) — **Google Sign-In will fail until the SHA-1 is registered** (see below), that's expected.

1. [x] App launches, no crash *(2026-07-27/29, A14, local release build)*
2. [x] **Maps render** *(2026-07-29)* — found + worked around the blank-tiles paint race (`loadingEnabled` + onMapReady camera nudge; durable fix = react-native-maps upgrade, see Pre-submission section). NOT a key problem.
3. [x] **Geofencing on a real walk** *(2026-07-29)*: clock-in/out times "pretty accurate" — **the doc-mums blocker is verified on-device**. Tested with the app alive (foreground/background), NOT swipe-killed.
4. [x] **Foreground keepalive / swipe-kill** *(2026-07-30)*: clock-in AND clock-out worked with the app swipe-killed — the Android-only keepalive + health-check restart path is verified on the A14.
5. [~] **Prominent disclosure order**: flow observed during on-device setup (primer before OS dialog) — **the screen RECORDING for the Play declaration is still to be captured** (fresh install, ~90s)
6. [x] Notifications *(2026-07-30, user-tested)*
7. [x] Calendar flows *(2026-07-30, user-tested)*
8. [x] Save-location-during-active-session *(2026-07-30, user-tested — old bug remains non-reproducible)*
9. [x] Samsung-specifics *(2026-07-30)*: no map flicker / tab bar issues
10. [x] **Reports tab in German** *(2026-07-30, A14 screenshot-verified)*: "DEINE WOCHENBEITRÄGE" + "Automatisch senden" toggle fully on-screen; week cards KW27–31 with German dates + honest states. Note: the app reads the device language at process start — German requires de FIRST in the system language list + app force-stop (no live switching; `localeConfig` polish item above).

**Additional fixes landed during on-device testing (2026-07-27/29):** duplicate + status-bar-crammed header on Add Location (Setup was the only screen missing the Android `headerShown:false` branch; all other secondary screens audited clean), blank-map paint race workaround, primer safe-area, month-footer jitter, calendar permissions (local builds).

---

## Play "App content" — fill-in-ready answers

*(Required before even internal testing goes live. Authoritative source for edge cases: `docs/audit/data-inventory-2026-05-22.md`.)*

### Data safety form
Mapped from the iOS Privacy Nutrition Labels (`store-assets/app-store-metadata.md` §3).

| Data type | Collected (leaves device)? | Shared w/ 3rd party? | Purpose | Linked to user? | Notes |
|---|---|---|---|---|---|
| **Email address** | Yes | No | Account management, App functionality | Yes | Email sign-in only; hashed at rest; NOT collected for Apple/Google sign-in users |
| **User IDs** | Yes | No | App functionality | Yes | UUID backend account ID |
| **Approximate location** | Yes (optional) | See note | App functionality | No | Only optional workplace search — ~1.1 km coordinate to Photon/Komoot (Germany). No user identifier attached |
| **Precise location** | **No** | No | — | — | Geofencing GPS **never leaves the device** — declare NOT collected |

- **Tracking question → "No, we do not track."** (Audit-verified: no third-party SDKs, no ads, no cross-app/site linking.)
- **Data encrypted in transit:** Yes. **User can request deletion:** Yes (in-app account deletion cascades to work_events).
- **Judgment calls to confirm against the audit doc before submitting:**
  - *Approximate location "shared":* Photon/Komoot is a geocoding service provider. Play may treat provider processing as "collected" rather than "shared" — check the audit's recipient classification.
  - *Profession / federal state / specialty* (collected at registration for k-anonymity grouping): declare under **Personal info → other**, collected, linked, App functionality.
  - *Work-hours totals* (confirmed weekly sums submitted on contribution; daily detail stays on device): declare under **App activity** or Personal info → other. No coordinates, no daily breakdown leave the device.

### Content rating (IARC questionnaire) — expected answers
All of these are **No**: violence, sexual content, profanity, controlled substances, gambling, user-to-user communication/UGC sharing, sharing user location with other users, digital purchases. Category: Utility/Productivity. → **Result: Everyone / PEGI 3 / USK 0.**

### Other App-content declarations
- Privacy policy URL: `https://openworkinghours.org/app-privacy-policy` ✅ (live)
- Ads: **No ads**
- Government app: No · Financial features: No
- Target audience: adults (18+/working professionals) — not directed at children
- App access: provide the demo login (`demo@openworkinghours.org` / `123456`) in "App access" so review can get in

### Background location declaration (the review hurdle — parallel to iOS 2.5.4)
- Complete the **Location permissions** declaration form.
- Record a **screen video** showing: (1) the prominent disclosure priming screen, (2) the OS "Allow all the time" prompt, (3) the geofencing auto clock-in/out feature that needs it.
- Reuse the iOS reviewer-notes framing (`store-assets/app-store-metadata.md` §5): self-tracking tool, user = data subject, no employer/MDM access, no employer ingest API.

---

## Store listing assets
- App name: **Open Working Hours**
- Short description (≤80): *"Track your working hours automatically. Privacy-first, for healthcare workers."*
- Full description (≤4000): reuse the iOS description (`store-assets/app-store-metadata.md` §1, EN + DE)
- App icon 512×512: export from `assets/adaptive-icon.png`
- ✅ **Feature graphic 1024×500: generated** → `mobile-app/store-assets/play/feature-graphic-1024x500.png` (branded teal + clock logo + tagline)
- ✅ **Play-compliant screenshots: generated** → `mobile-app/store-assets/play/screenshots/{en,de}/*.png` (6 each, padded to 1480×2868 = 1.938:1, under Play's 2:1 max; padding blends seamlessly with the pale-teal background)
- Regenerate both anytime with `node store-assets/play-assets.mjs` (outputs are gitignored like `composed/`; the script is committed)

---

## Pre-submission verification (added 2026-07-27, from the E2E session)

- [ ] *(Optional polish)* **Per-app language support (Android 13+):** the app doesn't declare `android:localeConfig`, so it doesn't appear in Settings → App languages. Nice-to-have for a bilingual app; not release-blocking. (Locale switching itself works via the system language list — the FIRST language in the list wins, and the app reads it at process start.)
- [x] **Blank-map paint race** *(RESOLVED 2026-07-30)*: react-native-maps upgraded 1.20.1 → **1.29.0** (commit `a469216`), verified with full E2E 71/71 on BOTH platforms + visual tile check. The `loadingEnabled` + camera-nudge workaround stays as defense in depth.

- [x] **AAB contains `READ_CALENDAR` + `WRITE_CALENDAR`** *(VERIFIED 2026-07-30 on the versionCode-6 submission AAB — binary check, both present)*.
- [x] **Sync Android `versionName`** *(RESOLVED 2026-07-30)*: the prebuild regeneration synced build.gradle to 2.1.3 automatically (versionName comes from app.json now).
- [ ] The `PermissionPrimingScreen` bottom-inset fix (2026-07-27) must be in the build — without it the primer's "Skip" button sits in the gesture zone on Android 15 (also relevant to the prominent-disclosure video, checklist item 5).

## Follow-ups that need your accounts (I can't reach them)
- [ ] **Google Sign-In SHA-1**: after first upload, copy the **App signing SHA-1** from Play Console → App integrity and register it (+ the EAS upload-key SHA-1) against the Android OAuth client in Google Cloud (same project as `googleWebClientId 819562297268-…`). Until then Sign-In = `DEVELOPER_ERROR`.
- [ ] **Maps API key SHA-1 (found 2026-07-27 via blank map on the A14):** the Maps key is restricted by package + SHA-1, so EVERY signing cert needs registering on it too — otherwise the map renders as a blank beige canvas (Google logo + location dot, no tiles): (1) the **Play App Signing SHA-1** (or Play builds ship with broken maps — same failure class in production), (2) the EAS upload key (presumably already there — EAS builds worked), (3) optionally the local debug keystore `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` for local test builds (public well-known cert — fine to remove after testing).
- [ ] If Play rejects "versionCode 5 already used" → tell Claude to bump + rebuild.
- [ ] (Optional) Play service-account JSON → wire `eas submit` android config for future auto-submits.
