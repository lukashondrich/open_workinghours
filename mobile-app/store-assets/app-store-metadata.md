# App Store Connect — Submission Payload

Frozen text + structured declarations to paste into App Store Connect at submission. Authoritative for the next submission cycle; revise in place when copy changes rather than archiving.

**Companion artifacts:**
- Screenshots: `composed/{en,de}/*.png` (12 PNGs at 1320×2868). Regenerate via the pipeline in `README.md`.
- Privacy manifest (collected data types + API usage reasons): declared in `mobile-app/app.json` → `ios.privacyManifests`. See `privacy_architecture.md` § "iOS Privacy Manifest" for the rationale per data type.

---

## 1. Text fields (EN + DE)

### Subtitle (30 chars max)

| Locale | Text | Length |
|---|---|---|
| EN | `Track shifts. Protect privacy.` | 30/30 |
| DE | `Schichten erfassen. Privat.` | 27/30 |

### Promotional Text (170 chars, editable post-launch without re-review)

**EN** (163/170):
> Automatic shift tracking for healthcare workers — via geofencing or in seconds. Your daily detail stays on your device. Together they make change possible.

**DE** (153/170):
> Automatische Schichterfassung im Gesundheitswesen — per Geofencing oder manuell in Sekunden. Deine Tagesdaten bleiben auf deinem Gerät.

### Keywords (100 chars max, comma-separated, no spaces)

**EN** (93/100):
```
shift,nurse,doctor,hospital,healthcare,hours,timesheet,worktime,overtime,GDPR,privacy,tracker
```

**DE** (99/100):
```
schicht,arzt,pflege,krankenschwester,klinik,krankenhaus,arbeitszeit,überstunden,dsgvo,anonym,burnout
```

### Description (4000 chars max)

**EN** (~2,200 chars):

> **Track hours automatically. Improve working conditions.**
>
> Open Working Hours helps healthcare workers document actual working hours easily — and make structural problems visible.
>
> Overwork in healthcare is well known, but rarely documented. Without independent data, there's no foundation for change. Open Working Hours gives you a private record of your hours, and lets you contribute anonymously to aggregated statistics that show what working conditions actually look like across hospitals and specialties.
>
> **Simple**
> Tracking shouldn't be an additional burden. Automatic clock-in/out via geofencing as you arrive at and leave your workplace, or log shifts manually in seconds with reusable templates. Built for hospital life: fast, reliable, low-friction.
>
> **Creates transparency**
> Plan your shifts, track what actually happens, see overtime at a glance over 14 days. When you choose to contribute a confirmed week, it joins anonymized, aggregated statistics at the institutional level — turning isolated experience into a shared picture of working conditions.
>
> **Privacy from the start**
> Daily shift detail, your calendar, and location data stay on your device. Geofencing detection runs locally. Optional workplace search uses Photon (Komoot, Germany). Only aggregated statistics are ever published, and only when at least 5 people contribute to the same group (k-anonymity), with additional statistical noise to protect against re-identification.
>
> No employer access. EU-only infrastructure for hosting, email, and geocoding — optional Apple/Google sign-in is the only US touchpoint, under EU adequacy.
>
> No analytics SDKs. No advertising. No third-party trackers. GDPR compliant. Delete your data anytime.
>
> **For healthcare workers**
> Designed with and for doctors, nurses, midwives, and other healthcare workers. Use it solo from day one — your contributions become statistically meaningful as more colleagues join.
>
> Free. Non-commercial.
>
> Learn more: openworkinghours.org

**DE** (~2,350 chars):

> **Zeiten automatisch erfassen. Arbeitsbedingungen verbessern.**
>
> Open Working Hours hilft Beschäftigten im Gesundheitswesen, reale Arbeitszeiten einfach zu dokumentieren – und strukturelle Probleme greifbar zu machen.
>
> Überlastung im Gesundheitswesen ist bekannt – aber selten dokumentiert. Ohne unabhängige Daten fehlt die Grundlage für Veränderung. Open Working Hours gibt dir eine private Übersicht deiner Arbeitszeiten und ermöglicht es dir, anonym zu aggregierten Statistiken beizutragen, die zeigen, wie Arbeitsbedingungen in Krankenhäusern und Fachbereichen tatsächlich aussehen.
>
> **Einfach**
> Arbeitszeiterfassung sollte keine zusätzliche Belastung sein. Automatisches Ein- und Ausstempeln per Geofencing beim Betreten und Verlassen des Arbeitsplatzes – oder Schichten manuell in Sekunden anlegen, mit wiederverwendbaren Vorlagen. Für den Alltag im Krankenhaus gebaut: schnell, zuverlässig, unkompliziert.
>
> **Schafft Transparenz**
> Plane deine Schichten, erfasse was wirklich passiert, behalte deine Überstunden über 14 Tage im Blick. Wenn du eine bestätigte Woche freiwillig beiträgst, fließt sie in anonymisierte, aggregierte Statistiken auf Einrichtungsebene ein – und macht aus Einzelerfahrung ein geteiltes Bild der Arbeitsbedingungen.
>
> **Datenschutz von Anfang an**
> Tagesdetails zu Schichten, dein Kalender und Standortdaten bleiben auf deinem Gerät. Die Geofence-Erkennung läuft lokal. Die optionale Arbeitsplatzsuche nutzt Photon (Komoot, Deutschland). Veröffentlicht werden ausschließlich aggregierte Statistiken, und nur wenn mindestens 5 Personen zur gleichen Gruppe beitragen (k-Anonymität), mit zusätzlichem statistischem Rauschen zum Schutz vor Re-Identifikation.
>
> Kein Arbeitgeber-Zugriff. EU-Infrastruktur für Hosting, E-Mail und Geocoding – nur die optionale Apple-/Google-Anmeldung ist ein US-Berührungspunkt, unter EU-Angemessenheit.
>
> Keine Analytics-SDKs. Keine Werbung. Keine Drittanbieter-Tracker. DSGVO-konform. Daten jederzeit löschbar.
>
> **Für Gesundheitsberufe**
> Mit und für Ärztinnen, Pflegekräfte, Hebammen und andere Beschäftigte im Gesundheitswesen entwickelt. Nutze die App ab Tag eins für dich – deine Beiträge werden statistisch aussagekräftig, je mehr Kolleg*innen dazukommen.
>
> Kostenlos. Nicht-kommerziell.
>
> Mehr Infos: openworkinghours.org

---

## 2. Screenshot headlines (copy v2)

| # | Screen captured | DE | EN |
|---|---|---|---|
| 01 | Geofence map (LocationsListScreen) | Automatisch einstempeln. | Clock in automatically. |
| 02 | Calendar week + template panel | Schichten eintragen in Sekunden. | Log shifts in seconds. |
| 03 | Status dashboard (14-day chart) | Deine Arbeitszeit auf einen Blick. | Your hours at a glance. |
| 04 | Calendar month / overtime | Sieh, wie viel du wirklich arbeitest. | See how much you really work. |
| 05 | DataPrivacyScreen | Deine Daten, deine Kontrolle. | Your data, your control. |
| 06 | Reports / collective insights | Trage freiwillig und anonym zu Statistiken bei. | Contribute anonymously to public statistics. |

Source of truth: `copy/de.json`, `copy/en.json`. Editing those + `npm run compose` re-renders the 12 PNGs without re-capturing.

---

## 3. Privacy Nutrition Labels (App Store Connect)

Apple's web UI prompt is structured: *what data → linked to user? → used for tracking? → purpose?* The five declarations below mirror `ios.privacyManifests` in `app.json` so Apple's submission cross-check passes.

| Apple grouping → Data type | Linked | Tracking | Purpose | Notes for reviewer |
|---|---|---|---|---|
| Identifiers → User ID | YES | NO | App Functionality | UUID; backend account identifier |
| Contact Info → Email Address | YES | NO | App Functionality | Email sign-in only; hashed (HMAC-SHA256) at rest; not stored for Apple/Google users |
| Location → Coarse Location | NO | NO | App Functionality | Optional proximity bias on workplace search (rounded to 2 decimals, ~1.1 km), sent to Photon (Komoot, Germany). GPS for geofencing never leaves device. |
| Diagnostics → Other Diagnostic Data | YES | NO | App Functionality | Bug reports only; user-initiated; includes device model + last 100 geofence event metadata |
| Other Data → "Work profile and hours" (custom label) | YES | NO | App Functionality | Hospital, specialty, role, seniority + weekly planned/actual hour totals |

**Tracking question:** answer **"No, we do not track."** Verified by audit (`docs/audit/data-inventory-2026-05-22.md`) — no third-party SDKs, no advertising, no cross-app/website linking.

---

## 4. Other submission fields

| Field | Value |
|---|---|
| Privacy Policy URL | `https://openworkinghours.org/app-privacy-policy` (EN) / `/de/app-privacy-policy` (DE) |
| Support URL | `mailto:lukashondrich@googlemail.com` |
| Marketing URL | `https://openworkinghours.org` |
| Primary category | Productivity |
| Secondary category | *(none — deliberately omitted, see § 6)* |
| iPad support | No (`supportsTablet: false`) — see § 6 |
| Age rating | 4+ (walk the questionnaire to confirm) |
| Copyright | `2026 Lukas Hondrich` |

---

## 5. Reviewer notes (paste into "Notes" field at submission)

> **Reviewer notes — Open Working Hours**
>
> **IMPORTANT — common misclassification (Guideline 2.5.4):** This app is **NOT** an employer-issued or employer-controlled employee-tracking app, despite the geofencing + work-hours framing. It is a **self-tracking tool used by individual healthcare workers for their own private records.** The user and the data subject are the same person. No employer, MDM profile, or organization-level account ever has access to any data. The backend has no API for employer ingest. The persistent background location is used exactly the same way fitness apps use it — for the user to track their own activity. Healthcare shifts (emergencies, multi-hour ward rounds, night shifts) make manual clock-in/out impractical, which is why automatic geofence detection exists.
>
> **What the app does:** Open Working Hours is a working-hours documentation tool for healthcare workers (doctors, nurses, midwives, etc.) in Germany and the EU. Users track their shifts via automatic geofencing or manual entry, see overtime over 14 days, and can voluntarily contribute confirmed weekly hour totals to anonymized, aggregated statistics that document working conditions across hospitals and specialties.
>
> **Demo account:**
> - Email: `demo@openworkinghours.org`
> - Verification code: `123456`
>
> On the Welcome screen, tap "Continue with email", enter the email above, then `123456` as the 6-digit verification code. The backend recognizes this credential pair as the App Review demo account and grants access without sending a real email — no inbox required.
>
> **Permissions explained:**
> - *Background location:* Required for geofencing — automatic clock-in/out when the user arrives at or leaves a saved workplace. GPS coordinates never leave the device for this purpose; only the resulting weekly hour totals (no daily breakdown, no coordinates) are submitted to our backend when the user confirms a week.
> - *Notifications:* Used for exit-verification prompts (confirm clock-out when geofence fires) and week-finalization reminders.
> - *Calendar (full access):* Optional. Used only when the user explicitly exports shifts to their device calendar. Reads existing events to reconcile before writing, so write-only access would be insufficient.
> - *Face ID:* Optional lock-screen biometric.
>
> **Privacy architecture (summary):** Operational data resides on Hetzner servers in Germany. Aggregated statistics are published only when ≥5 users contribute to the same state+specialty group (k-anonymity), with additional Laplace noise (differential privacy), 90% confidence intervals, and a per-user/per-cell privacy-budget ledger that caps cumulative exposure. Full architecture and the budget-tracking details: openworkinghours.org/app-privacy-policy.
>
> **Healthcare disclaimer:** This app does not diagnose, treat, or monitor any medical condition. It tracks working hours for documentation and statistical contribution only.
>
> **Source:** Open source — `github.com/lukashondrich/open_workinghours`

The demo credentials are served by a backend bypass in `backend/app/routers/auth.py:163-186` (env vars `DEMO__EMAIL` + `DEMO__CODE`). See `docs/deployment.md` for env var config.

---

## 6. Decisions & rationale

Copy went through two structured revision rounds before submission. Capturing the load-bearing decisions so the rationale survives the next revision cycle.

**Round 1 → v2 (post-review pass):**
- Dropped "evidence in collective bargaining, policy debates, or legal disputes" — reframed around documenting working conditions. Reason: leaning on "evidence in legal disputes" felt adversarial for marketing copy aimed at a healthcare audience.
- Removed all "closed beta" language. Reason: this is an open public launch on the App Store, not a closed beta.
- Removed "Built by an independent developer" line. Reason: solo-dev attribution shouldn't be a marketing line; copyright owner is named in the legal field instead.
- Removed `union`, `gewerkschaft`, `verdi` keywords. Reason: no official union affiliation; implying one would be misleading.

**Round 2 → v3 (post second review pass):**
- "no GPS coordinates are transmitted" → acknowledged Photon proximity bias. Reason: the published privacy policy (commit `c1691e9`) was rewritten to disclose this; App Store description had to match.
- "Not an employer tool. No third-party access. EU-only infrastructure." → split + qualified with Apple/Google JWKS being the US touchpoint. Reason: same — policy disclosure had to match App Store text.
- "Your hours stay on your device" → "Your daily detail stays on your device." Reason: weekly totals ARE submitted; the original wording could read as misleading to a regulator.
- DE subtitle "Anonym" → "Privat". Reason: "Anonym" is a GDPR term of art (anonymous = outside GDPR scope). Operational data is pseudonymous, not anonymous; only published stats are anonymous. "Privat" carries the same emotional payload without the legal claim.
- Added "doctors, nurses, midwives, and other healthcare workers." Reason: broader inclusion than the original "doctors, nurses, and other healthcare professionals."
- Added "No analytics SDKs. No advertising. No third-party trackers." Reason: the audit (`docs/audit/data-inventory-2026-05-22.md`) verified this; surfacing it adds a defensible differentiator.

**Kept "GDPR compliant" (not "GDPR-aligned"):**
- Self-review confirmed "compliant" is defensible as self-attestation given the implemented compliance posture (DPIA, RoPA, signed Hetzner+Brevo DPAs, retention policy, K-anonymity + DP, in-app rights endpoints, code-cited privacy notice). "Aligned" was offered as a softer alternative; the harder claim was retained.

**Screenshot copy v2 (post-launch UX iteration):**
- Shifted from noun-phrase headlines ("Schichten in Sekunden.") to imperative/action-instructional ("Schichten eintragen in Sekunden."). Reason: more directly tells the viewer what the app *does* rather than asserting an abstract benefit. Applied across 01-04 and 06; 05 kept its noun-phrase form because "Deine Daten, deine Kontrolle." is the privacy-statement framing the screen actually delivers.

**Open: "burnout" DE keyword.**
- Discoverability term, not a clinical claim. Lawyer cleared it under HWG (Heilmittelwerbegesetz) on the grounds that a working-time app isn't a medical product. Final HWG sweep was deferred to a later lawyer pass (task #31).

**Pre-submission iterations (2026-06-12):**
- **Dropped secondary App Store category.** Originally planned Health & Fitness as secondary; later considered Medical. Decided to omit secondary entirely for v1. Reason: Medical category invites Apple Guideline 1.4.1 scrutiny and amplifies HWG exposure right before the lawyer's HWG sweep — strictly riskier than just shipping with Productivity alone. Health & Fitness was also a category mismatch (OWH isn't fitness or wellness). Secondary is optional and can be added later (Business is the safer adjacent option if needed).
- **Dropped iPad support (`supportsTablet: false`).** Apple required iPad screenshots for the 13" iPad Pro to even enter review. The app is genuinely phone-only — geofencing for on-the-go workplace arrival, calendar designed for one-handed phone use. Adding iPad screenshots showing phone-sized UI on a large canvas would look unprofessional and could draw a "design doesn't fit the form factor" rejection. Cleaner to declare iPhone-only now and add iPad support deliberately later once iPad-specific layouts exist.
