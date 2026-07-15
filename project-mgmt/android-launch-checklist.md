# Android Play Store launch — working checklist

**Created:** 2026-07-09 (during iOS launch follow-up). Companion to `WORKSTREAMS.md` §8.
**AAB built:** versionCode 5, `expo.dev/artifacts/eas/SwVQR8GGyWE8kezLA4m_ZNKeE8Aqu4xXnFY6Eb09pBQ.aab`

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

1. [ ] App launches, no crash
2. [ ] **Maps render** on the location setup screen (SetupScreen) — the historical Google-Maps-key risk
3. [ ] **Geofencing on a real walk**: clock-in on arrival at a saved workplace; clock-out ~5 min after leaving (hysteresis). *The core reliability test — this is the doc-mums blocker.*
4. [ ] **Foreground keepalive**: tracking notification appears; **swipe-kill the app** and confirm it still clocks you out (the Android-only keepalive + health-check restart)
5. [ ] **Prominent disclosure order**: the background-location priming screen (`PermissionPrimingScreen` / `backgroundPrimer`) shows **before** the OS "Allow all the time" dialog — *record this for the Play video*
6. [ ] Notifications: POST_NOTIFICATIONS prompt + a delivered clock-out notification
7. [ ] Calendar: create shift, apply template, add a day note, confirm/lock a day
8. [ ] **Re-verify the old deferred bug**: save a NEW location while a session is active → does it kill the session? (docs say not reproducible since 2026-04-04 — confirm)
9. [ ] Samsung-specifics (if on the A14): tab bar renders correctly, no map flicker between locations
10. [ ] **Reports tab in German**: header row "DEINE WOCHENBEITRÄGE" + "Automatisch senden" toggle fully on-screen (v2.1.1 layout fix — iOS-verified, Android pending); week cards show honest send states ("Wird gesendet…" for past weeks)

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

## Follow-ups that need your accounts (I can't reach them)
- [ ] **Google Sign-In SHA-1**: after first upload, copy the **App signing SHA-1** from Play Console → App integrity and register it (+ the EAS upload-key SHA-1) against the Android OAuth client in Google Cloud (same project as `googleWebClientId 819562297268-…`). Until then Sign-In = `DEVELOPER_ERROR`.
- [ ] If Play rejects "versionCode 5 already used" → tell Claude to bump + rebuild.
- [ ] (Optional) Play service-account JSON → wire `eas submit` android config for future auto-submits.
