# Draft: Consolidated Privacy Policy v2

**Status:** Drafted 2026-05-22 in session, ready to assemble into Astro pages.
**Inputs:** `data-inventory-2026-05-22.md` (Pass 1) + `inventory-vs-comms-diff-2026-05-22.md` (Pass 2).
**Source code commit referenced in links:** `49ea57b` (refresh to current `main` SHA at publication time and re-verify line numbers).

## What this file is

Full English + German drafts for the new consolidated `app-privacy-policy.astro`. Replaces three current pages:
- `website/src/pages/privacy.astro` (the explainer — retire)
- `website/src/pages/de/privacy.astro` (retire)
- `website/src/pages/app-privacy-policy.astro` + DE (replace body)

Structure: TL;DR panels (§1) → detailed inventory (§2) → what stays on device (§3) → third-party matrix (§4) → retention (§5) → rights (§6) → transfers (§7) → security (§8) → contact (§9).

Each claim in §1, §2, §4, §5, §8 links to the line of code that implements it (SHA-pinned permalinks).

---

## §1 — At-a-glance

### EN

**🟦 Collected — and tied to a name you picked**
- Your hospital affiliation — only if you pick a hospital from the list of ~1,220 German hospitals. You can opt out with "Prefer not to share", which keeps your hours out of all published statistics.
- The category fields you chose (specialty, role, seniority, state, profession)

→ *Details and code: §2*

**🟨 Collected — pseudonymous (no name attached)**
- A random user ID (UUID)
- A hash of your email (if you signed up with email) — derived with a secret key
- Your Apple or Google identifier (only if you used social sign-in)
- Your confirmed weekly hours: planned + actual totals only (no daily breakdown)
- Optional: device model, OS version, recent location events — only when you tap "Report Issue"

→ *Details and code: §2*

**🟩 Not collected**
- Your name or address
- Your daily schedule (we only ever see weekly totals)
- GPS coordinates (geofence detection runs on your device; coordinates never reach our backend)
- Sick days (stay on your device)
- Free-text employer names (you can only pick from the list)
- Biometric data (Face ID / fingerprint stays in your device's secure storage)
- Advertising or analytics identifiers (we have none)
- IP addresses in our application database (hosting-layer logs may briefly retain them — see §7)
- Hospital affiliation — if you chose "Prefer not to share" (your weekly hours stay on your device's record, but never enter any aggregated statistic)

**🟪 How it's protected**
- K-anonymity (groups need ≥ 5 users) + a dominance rule (no user can dominate a group's average)
- Differential privacy (Laplace noise added to published statistics)
- EU-only data residency (servers in Germany)
- Pseudonymisation (random user IDs; emails stored only as a salted hash with a secret key)
- Encryption in transit (TLS) and at rest

→ *Code references for these protections: §2 and §8*

### DE

**🟦 Erfasst — mit einem Namen, den Sie gewählt haben**
- Ihre Krankenhauszugehörigkeit — nur wenn Sie ein Krankenhaus aus der Liste von ~1.220 deutschen Krankenhäusern wählen. Mit „Lieber nicht angeben" können Sie sich abmelden — Ihre Stunden fließen dann in keine veröffentlichte Statistik mehr.
- Die Kategorien, die Sie gewählt haben (Fachgebiet, Rolle, Seniorität, Bundesland, Beruf)

→ *Details und Code: §2*

**🟨 Erfasst — pseudonym (kein Name daran)**
- Eine zufällige Nutzer-ID (UUID)
- Ein Hash Ihrer E-Mail (bei E-Mail-Anmeldung) — mit einem geheimen Schlüssel berechnet
- Ihre Apple- oder Google-Kennung (nur bei Social Login)
- Ihre bestätigten Wochenstunden: nur geplante + tatsächliche Summen (keine Tagesdetails)
- Optional: Gerätemodell, OS-Version, letzte Standortereignisse — nur wenn Sie „Problem melden" antippen

→ *Details und Code: §2*

**🟩 Nicht erfasst**
- Ihr Name oder Ihre Adresse
- Ihr Tagesplan (wir sehen nur Wochensummen)
- GPS-Koordinaten (Geofence läuft auf Ihrem Gerät; Koordinaten erreichen unser Backend nie)
- Krankheitstage (bleiben auf Ihrem Gerät)
- Frei eingegebene Arbeitgebernamen (Auswahl nur aus der Liste)
- Biometrische Daten (Face ID / Fingerabdruck bleiben im sicheren Speicher Ihres Geräts)
- Werbe- oder Analyse-IDs (haben wir nicht)
- IP-Adressen in unserer Anwendungsdatenbank (Hosting-Logs können sie kurz speichern — siehe §7)
- Krankenhauszugehörigkeit — wenn Sie „Lieber nicht angeben" wählten (Ihre Wochenstunden bleiben in Ihrem Gerät, aber in keiner aggregierten Statistik)

**🟪 Wie es geschützt wird**
- K-Anonymität (Gruppen brauchen ≥ 5 Nutzer:innen) + Dominanzregel (eine Person kann den Durchschnitt nicht dominieren)
- Differential Privacy (Laplace-Rauschen auf veröffentlichte Statistiken)
- Ausschließlich EU-Datenstandort (Server in Deutschland)
- Pseudonymisierung (zufällige Nutzer-IDs; E-Mails nur als gesalzener Hash mit geheimem Schlüssel)
- Verschlüsselung bei Übertragung (TLS) und im Ruhezustand

→ *Code-Verweise zu diesen Schutzmaßnahmen: §2 und §8*

---

## §2.1 — Account identity

### EN

> **What we collect:**
> - A random user ID (UUID) — internal identifier, never shown
> - A hash of your email address (HMAC-SHA256 with a server-side secret key) — only if you registered with an email
> - Apple's or Google's user identifier for you — only if you used social sign-in (your actual email address is discarded)
>
> **Why:** To recognize you across sessions and link your saved data to your account. The hash lets us look you up at login without ever storing your actual email; the Apple/Google identifier does the same job for social sign-in.
>
> **When:** Created on account creation, persists until you delete your account.
>
> **Legal basis:** Art. 6(1)(b) GDPR — necessary to perform our contract with you (account use).
>
> **Verify in code:**
> - User table definition: [`models.py` L76-96](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L76-L96)
> - Email hash implementation (HMAC-SHA256 with secret): [`security.py` L25-28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/security.py#L25-L28)

### DE

> **Was wir erfassen:**
> - Eine zufällige Nutzer-ID (UUID) — interne Kennung, wird nie angezeigt
> - Ein Hash Ihrer E-Mail-Adresse (HMAC-SHA256 mit einem serverseitigen geheimen Schlüssel) — nur bei Registrierung per E-Mail
> - Die Apple- oder Google-Nutzerkennung für Sie — nur bei Social Login (Ihre tatsächliche E-Mail-Adresse wird verworfen)
>
> **Warum:** Damit wir Sie sitzungsübergreifend erkennen und Ihre gespeicherten Daten Ihrem Konto zuordnen können. Der Hash erlaubt uns, Sie bei der Anmeldung wiederzufinden, ohne Ihre eigentliche E-Mail jemals zu speichern; die Apple-/Google-Kennung übernimmt diese Aufgabe bei Social Login.
>
> **Wann:** Wird bei der Kontoerstellung angelegt, bleibt bis zur Löschung Ihres Kontos bestehen.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO — zur Erfüllung unseres Vertrags mit Ihnen erforderlich (Kontonutzung).
>
> **Im Code nachprüfen:**
> - Nutzer-Tabellendefinition: [`models.py` Z. 76-96](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L76-L96)
> - E-Mail-Hash-Implementierung (HMAC-SHA256 mit Geheimnis): [`security.py` Z. 25-28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/security.py#L25-L28)

---

## §2.2 — Profile category fields

### EN

> **What we collect:**
> - Hospital affiliation — *optional; pick "Prefer not to share" and nothing is stored*
> - Specialty / department group
> - Role / seniority
> - Federal state (Bundesland)
> - Profession
>
> **Why:** To group your contributions with similar users when producing K-anonymous statistics. Without these, the published statistics could not exist.
>
> **When:** At account creation; you can edit them later in your profile.
>
> **Legal basis:** Art. 6(1)(b) GDPR for storing them as part of your account; Art. 6(1)(a) GDPR (consent) for using them to contribute to aggregated statistics.
>
> **Verify in code:** [`models.py` L85-103](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L85-L103)

### DE

> **Was wir erfassen:**
> - Krankenhauszugehörigkeit — *optional; mit „Lieber nicht angeben" wird nichts gespeichert*
> - Fachgebiet / Abteilungsgruppe
> - Rolle / Seniorität
> - Bundesland
> - Beruf
>
> **Warum:** Um Ihre Beiträge mit ähnlichen Nutzer:innen zu gruppieren, wenn wir K-anonyme Statistiken erstellen. Ohne diese Felder wären die veröffentlichten Statistiken nicht möglich.
>
> **Wann:** Bei der Kontoerstellung; in Ihrem Profil später änderbar.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO für die Speicherung als Teil Ihres Kontos; Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) für den Beitrag zu aggregierten Statistiken.
>
> **Im Code nachprüfen:** [`models.py` Z. 85-103](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L85-L103)

---

## §2.3 — Confirmed weekly hours

### EN

> **What we collect:**
> - Per finalized week: planned hours total + actual hours total (no daily breakdown)
> - The week's start date
> - Your country, state, specialty, hospital affiliation (or NULL if you opted out)
>
> **Why:** To produce K-anonymous, differentially-private statistics about working hours by group. Daily data is never transmitted — only weekly totals after you confirm.
>
> **When:** When you confirm all 7 days of a week and the week finalizes.
>
> **Legal basis:** Art. 6(1)(a) GDPR (consent specifically for statistical contribution).
>
> **Verify in code:**
> - Weekly submission table: [`models.py` L147-185](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L147-L185)
> - Aggregation query: [`aggregation.py` L54-90](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/aggregation.py#L54-L90)

### DE

> **Was wir erfassen:**
> - Pro abgeschlossener Woche: geplante Gesamtstunden + tatsächliche Gesamtstunden (keine Tagesaufschlüsselung)
> - Das Startdatum der Woche
> - Ihr Land, Bundesland, Fachgebiet, Krankenhauszugehörigkeit (oder NULL bei Opt-out)
>
> **Warum:** Um K-anonyme, differentially-private Statistiken über Arbeitsstunden nach Gruppen zu erstellen. Tagesdaten werden nie übertragen — nur Wochensummen nach Ihrer Bestätigung.
>
> **Wann:** Wenn Sie alle 7 Tage einer Woche bestätigen und die Woche abgeschlossen wird.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung speziell für den statistischen Beitrag).
>
> **Im Code nachprüfen:**
> - Wochen-Submissions-Tabelle: [`models.py` Z. 147-185](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L147-L185)
> - Aggregationsabfrage: [`aggregation.py` Z. 54-90](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/aggregation.py#L54-L90)

---

## §2.4 — Optional: Calendar export

### EN

> **What we collect:** Nothing. Calendar export writes to *your device's* calendar; no shift data reaches our backend.
>
> **What is shared with your device's calendar:** Shift name, start/end time, color, absence type (vacation/sick).
>
> **Where it goes after that:** Your device's calendar app. **If your calendar syncs with iCloud, Google Calendar, or is shared with anyone, those events appear there too.** You control this in your device's settings.
>
> **When:** Only if you enable the "Export to calendar" toggle in Settings.
>
> **Legal basis:** Art. 6(1)(a) GDPR (consent — toggled by you).
>
> **Verify in code:** [`CalendarExportManager.ts` L42](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarExportManager.ts#L42)

### DE

> **Was wir erfassen:** Nichts. Der Kalenderexport schreibt in den Kalender *Ihres Geräts*; keine Schichtdaten erreichen unser Backend.
>
> **Was an den Kalender Ihres Geräts übergeben wird:** Schichtname, Start-/Endzeit, Farbe, Abwesenheitsart (Urlaub/Krankheit).
>
> **Wohin es danach geht:** Die Kalender-App Ihres Geräts. **Wenn Ihr Kalender mit iCloud, Google Kalender oder anderen synchronisiert oder geteilt ist, erscheinen die Einträge auch dort.** Sie steuern dies in den Einstellungen Ihres Geräts.
>
> **Wann:** Nur wenn Sie den Schalter „In Kalender exportieren" in den Einstellungen aktivieren.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung — von Ihnen aktiviert).
>
> **Im Code nachprüfen:** [`CalendarExportManager.ts` Z. 42](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarExportManager.ts#L42)

---

## §2.5 — Optional: Bug reports

### EN

> **What we collect (only when you tap "Report Issue"):**
> - Your text description of the problem
> - Device model (e.g., "iPhone 15 Pro")
> - OS name and version
> - App version and build number
> - The last ~100 geofence events on your device — timestamps, event type, GPS accuracy in meters, and location names you've set up
> - If you're signed in: your user ID, hospital affiliation, specialty, role, and state (so we can correlate with your account)
>
> **Why:** To diagnose technical problems — especially geofencing reliability on Android, where we depend on real-world telemetry to find and fix bugs.
>
> **When:** Only when you tap "Report Issue" in Settings and confirm submission.
>
> **Retention:** Bug reports are kept for 90 days, then automatically purged. Reports are also deleted immediately when you delete your account.
>
> **Legal basis:** Art. 6(1)(a) GDPR (consent — initiated by you each time).
>
> **Verify in code:**
> - Mobile payload: [`reportIssue.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/lib/utils/reportIssue.ts)
> - Backend endpoint: [`feedback.py` L19-81](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/feedback.py#L19-L81)
> - Storage schema: [`models.py` L342-367](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L342-L367)

### DE

> **Was wir erfassen (nur wenn Sie „Problem melden" antippen):**
> - Ihre Textbeschreibung des Problems
> - Gerätemodell (z. B. „iPhone 15 Pro")
> - Betriebssystem-Name und -Version
> - App-Version und Build-Nummer
> - Die letzten ~100 Geofence-Ereignisse auf Ihrem Gerät — Zeitstempel, Ereignistyp, GPS-Genauigkeit in Metern und die von Ihnen eingerichteten Standortnamen
> - Wenn Sie angemeldet sind: Ihre Nutzer-ID, Krankenhauszugehörigkeit, Fachgebiet, Rolle und Bundesland (damit wir es Ihrem Konto zuordnen können)
>
> **Warum:** Zur Diagnose technischer Probleme — besonders der Geofencing-Zuverlässigkeit auf Android, wo wir auf reale Telemetriedaten angewiesen sind, um Fehler zu finden und zu beheben.
>
> **Wann:** Nur wenn Sie in den Einstellungen „Problem melden" antippen und die Übermittlung bestätigen.
>
> **Aufbewahrung:** Fehlerberichte werden 90 Tage aufbewahrt und danach automatisch gelöscht. Fehlerberichte werden außerdem sofort gelöscht, wenn Sie Ihr Konto löschen.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung — jedes Mal von Ihnen ausgelöst).
>
> **Im Code nachprüfen:**
> - Mobile-Payload: [`reportIssue.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/lib/utils/reportIssue.ts)
> - Backend-Endpoint: [`feedback.py` Z. 19-81](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/feedback.py#L19-L81)
> - Speicherschema: [`models.py` Z. 342-367](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L342-L367)

---

## §2.6 — Consent records

### EN

> **What we collect:**
> - Which version of the Terms of Service you accepted
> - Which version of the Privacy Policy you accepted
> - The timestamp of your acceptance
>
> **Why:** GDPR Art. 7 requires us to be able to demonstrate that you have given consent. These three fields are the legal record of that.
>
> **When:** At account creation; again if a major policy update requires re-acceptance.
>
> **Legal basis:** Art. 6(1)(c) GDPR — legal obligation (Art. 7 imposes the recordkeeping requirement).
>
> **Verify in code:** [`models.py` L106-108](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L106-L108)

### DE

> **Was wir erfassen:**
> - Welche Version der Nutzungsbedingungen Sie akzeptiert haben
> - Welche Version der Datenschutzerklärung Sie akzeptiert haben
> - Den Zeitstempel Ihrer Zustimmung
>
> **Warum:** Art. 7 DSGVO verpflichtet uns nachzuweisen, dass Sie eingewilligt haben. Diese drei Felder sind der rechtliche Nachweis dafür.
>
> **Wann:** Bei der Kontoerstellung; erneut, wenn ein wesentliches Update der Richtlinien eine Neu-Zustimmung erfordert.
>
> **Rechtsgrundlage:** Art. 6 Abs. 1 lit. c DSGVO — rechtliche Verpflichtung (Art. 7 schreibt die Dokumentation vor).
>
> **Im Code nachprüfen:** [`models.py` Z. 106-108](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/models.py#L106-L108)

---

## §3 — What stays on your device

### EN

> These categories of data are processed on your device only and never reach our backend.
>
> | What | Where on device | Verify |
> |---|---|---|
> | GPS coordinates | Geofence service (in-memory) — detection runs locally; only the resulting weekly hour totals are transmitted | [`GeofenceService.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/services/GeofenceService.ts) |
> | Shift templates, planned shifts, absences | Local SQLite database (`calendar.db`) | [`CalendarStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts) |
> | Tracking records (unconfirmed sessions) | Local SQLite (`tracking_records` table) — only weekly totals are submitted after you confirm | [`CalendarStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts) |
> | Sick days | Local SQLite (`absence_instances` with `type='sick'`) — never transmitted, even in weekly submissions | [`CalendarStorage.ts` L139](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts#L139) |
> | Biometric data (Face ID / fingerprint) | iOS Secure Enclave / Android Keystore — managed by the operating system; we never see it | Handled by `expo-local-authentication` |
> | Onboarding state, dismissed prompts | AsyncStorage — local UI preferences | n/a |

### DE

> Diese Datenkategorien werden ausschließlich auf Ihrem Gerät verarbeitet und erreichen unser Backend nie.
>
> | Was | Wo auf dem Gerät | Nachprüfen |
> |---|---|---|
> | GPS-Koordinaten | Geofence-Dienst (im Arbeitsspeicher) — Erkennung läuft lokal; übertragen werden nur die resultierenden Wochenstunden-Summen | [`GeofenceService.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/services/GeofenceService.ts) |
> | Schichtvorlagen, geplante Schichten, Abwesenheiten | Lokale SQLite-Datenbank (`calendar.db`) | [`CalendarStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts) |
> | Tracking-Datensätze (unbestätigte Sitzungen) | Lokale SQLite (`tracking_records`-Tabelle) — nach Ihrer Bestätigung werden nur Wochensummen übermittelt | [`CalendarStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts) |
> | Krankheitstage | Lokale SQLite (`absence_instances` mit `type='sick'`) — werden nie übertragen, auch nicht in Wochen-Submissions | [`CalendarStorage.ts` Z. 139](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarStorage.ts#L139) |
> | Biometrische Daten (Face ID / Fingerabdruck) | iOS Secure Enclave / Android Keystore — wird vom Betriebssystem verwaltet; wir sehen nichts davon | Verwaltet durch `expo-local-authentication` |
> | Onboarding-Status, weggeklickte Hinweise | AsyncStorage — lokale UI-Einstellungen | – |

---

## §4 — Third-party recipients

### EN intro

> When you use Open Working Hours, your data may pass through these services. Most are always involved (hosting, geocoding); some only if you choose specific features (social sign-in, calendar export). Every claim links to the line of code that implements it.

### EN matrix

| Purpose | Always or optional | Recipient | Location | Triggered by | Source |
|---|---|---|---|---|---|
| Backend hosting, database, backups | Always | Hetzner Online GmbH | Germany | All app use | [Hetzner DPA (standard terms)](https://www.hetzner.com/AV/DPA_en.pdf) · [signed 2026-01-13](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/GDPR_COMPLIANCE.md#processors) |
| Email verification codes | Email sign-in only | Brevo (Sendinblue) | EU | Registering or logging in via email | [Brevo DPA (standard terms)](https://www.brevo.com/legal/termsofuse/#data-processing-agreement) · [SMTP call: email.py L28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/email.py#L28) |
| Workplace search | Always (only when searching) | Komoot GmbH (Photon) | Germany | Searching for a workplace in setup | [GeocodingService.ts L105](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/services/GeocodingService.ts#L105) |
| Identity verification (Apple) | Optional | Apple Inc. | USA (under EU-US Data Privacy Framework) | Choosing "Sign in with Apple" | [social_auth.py L24-25](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/social_auth.py#L24-L25) |
| Identity verification (Google) | Optional | Google LLC | USA (under EU-US Data Privacy Framework) | Choosing "Sign in with Google" | [social_auth.py L26](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/social_auth.py#L26) |
| Calendar export | Optional | iOS Calendar (Apple) or Google Calendar | Your device + the sync service you have set up yourself (e.g., iCloud, Google) | Enabling the "Export to device calendar" toggle | [CalendarExportManager.ts L42](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarExportManager.ts#L42) |

*All source references current as of commit `49ea57b`. The full source code is public at [github.com/lukashondrich/open_workinghours](https://github.com/lukashondrich/open_workinghours).*

### DE intro

> Wenn Sie Open Working Hours nutzen, können Ihre Daten diese Dienste durchlaufen. Die meisten sind immer beteiligt (Hosting, Geocoding); andere nur, wenn Sie bestimmte Funktionen wählen (Social Login, Kalenderexport). Jede Aussage verlinkt zur Codezeile, die sie umsetzt.

### DE matrix

| Zweck | Immer oder optional | Empfänger | Standort | Ausgelöst durch | Quelle |
|---|---|---|---|---|---|
| Backend-Hosting, Datenbank, Backups | Immer | Hetzner Online GmbH | Deutschland | Jede App-Nutzung | [Hetzner AVV (Standardbedingungen)](https://www.hetzner.com/AV/DPA_de.pdf) · [unterzeichnet 2026-01-13](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/GDPR_COMPLIANCE.md#processors) |
| E-Mail-Verifizierungscodes | Nur bei E-Mail-Anmeldung | Brevo (Sendinblue) | EU | Registrierung / Anmeldung per E-Mail | [Brevo AVV (Standardbedingungen)](https://www.brevo.com/legal/termsofuse/#data-processing-agreement) · [SMTP-Aufruf: email.py Z. 28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/email.py#L28) |
| Suche nach Ihrem Arbeitsplatz | Immer (nur bei Suche) | Komoot GmbH (Photon) | Deutschland | Suche eines Arbeitsplatzes im Setup | [GeocodingService.ts Z. 105](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/services/GeocodingService.ts#L105) |
| Identitätsprüfung (Apple) | Optional | Apple Inc. | USA (EU-US-Datenschutzrahmen) | Wahl von „Mit Apple anmelden" | [social_auth.py Z. 24-25](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/social_auth.py#L24-L25) |
| Identitätsprüfung (Google) | Optional | Google LLC | USA (EU-US-Datenschutzrahmen) | Wahl von „Mit Google anmelden" | [social_auth.py Z. 26](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/social_auth.py#L26) |
| Kalenderexport | Optional | iOS Kalender (Apple) oder Google Kalender | Ihr Gerät + dem Sync-Dienst, den Sie selbst eingerichtet haben (z. B. iCloud, Google) | Aktivieren des Schalters „In Gerätekalender exportieren" | [CalendarExportManager.ts Z. 42](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/calendar/services/CalendarExportManager.ts#L42) |

*Alle Quellverweise auf Stand Commit `49ea57b`. Der vollständige Quellcode ist öffentlich unter [github.com/lukashondrich/open_workinghours](https://github.com/lukashondrich/open_workinghours).*

---

## §5 — Retention

### EN

> | Data | Retention |
> |---|---|
> | Account data (user_id, email hash or social-auth identifier, profile fields, consent records) | Until you delete your account |
> | Confirmed weekly hours | Until you delete your account, plus up to 30 days in immutable backups |
> | Bug reports | 90 days, then auto-purged. Deleted immediately if you delete your account. |
> | Aggregated statistics published from your contributions | Retained indefinitely — these are anonymous, not personal data |
> | Application logs (backend) | 7 days |
> | Database backups (Hetzner Object Storage, COMPLIANCE-mode Object Lock) | 30 days, immutable |
> | Hosting-layer logs (Hetzner, may contain IP addresses) | Per Hetzner standard retention; we have no application-layer access to these |
> | Verification codes (during email sign-in) | Deleted after use or expiry (typically minutes) |
> | Social registration tokens | 30 minutes |
>
> When you delete your account, the corresponding rows are removed within seconds. The 30-day backup window means a deleted account's data may persist in encrypted backups until that backup rotates out — this is documented in [`data-retention-policy.md`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/data-retention-policy.md).

### DE

> | Daten | Aufbewahrung |
> |---|---|
> | Kontodaten (Nutzer-ID, E-Mail-Hash oder Social-Auth-Kennung, Profilfelder, Einwilligungsdaten) | Bis Sie Ihr Konto löschen |
> | Bestätigte Wochenstunden | Bis zur Kontolöschung, plus bis zu 30 Tage in unveränderlichen Backups |
> | Fehlerberichte | 90 Tage, dann automatisch gelöscht. Sofortige Löschung bei Kontolöschung. |
> | Veröffentlichte aggregierte Statistiken aus Ihren Beiträgen | Unbegrenzt — diese sind anonym, keine personenbezogenen Daten |
> | Anwendungs-Logs (Backend) | 7 Tage |
> | Datenbank-Backups (Hetzner Object Storage, COMPLIANCE-Mode Object Lock) | 30 Tage, unveränderlich |
> | Hosting-Logs (Hetzner, können IP-Adressen enthalten) | Gemäß Hetzner-Standardaufbewahrung; wir haben keinen Anwendungs-Zugriff darauf |
> | Verifizierungscodes (bei E-Mail-Anmeldung) | Nach Verwendung oder Ablauf gelöscht (typischerweise Minuten) |
> | Social-Registration-Tokens | 30 Minuten |
>
> Bei Kontolöschung werden die zugehörigen Datensätze innerhalb von Sekunden entfernt. Das 30-Tage-Backup-Fenster bedeutet, dass Daten eines gelöschten Kontos in verschlüsselten Backups verbleiben können, bis das Backup ausrotiert — dokumentiert in [`data-retention-policy.md`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/data-retention-policy.md).

---

## §6 — Your rights

### EN

> | Right | How to use it |
> |---|---|
> | **Access** (Art. 15) — see what we hold about you | In-app: Settings → Data & Privacy → Export Data. Returns JSON of all your records. [`DataPrivacyScreen.tsx`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx) |
> | **Rectification** (Art. 16) — correct inaccurate data | In-app: Settings → Profile. All profile fields are editable. |
> | **Erasure** (Art. 17) — delete your account | In-app: Settings → Data & Privacy → Delete Account. [`auth.py` L406-457](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/auth.py#L406-L457) |
> | **Restriction** (Art. 18) — pause processing while a dispute is resolved | Contact us via the email below |
> | **Portability** (Art. 20) — receive your data in machine-readable form | In-app: Settings → Data & Privacy → Export Data. JSON format. |
> | **Objection** (Art. 21) — withdraw consent for statistical contribution | Pick "Prefer not to share" as your hospital — your weekly hours no longer enter any published statistic. Or contact us for broader objection. |
> | **Lodging a complaint** | You can complain to a supervisory authority at any time. For Germany, the responsible authority is the Berliner Beauftragte für Datenschutz und Informationsfreiheit ([www.datenschutz-berlin.de](https://www.datenschutz-berlin.de)). |
> | **Privacy budget transparency** (Art. 15) | Authenticated endpoint exposes your ε spend: `GET /auth/me/privacy-budget`. [`auth.py` L390-403](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/auth.py#L390-L403) |
>
> We do not make automated decisions or profile you (Art. 22 — not applicable).

### DE

> | Recht | So nutzen Sie es |
> |---|---|
> | **Auskunft** (Art. 15) — sehen, was wir über Sie speichern | In der App: Einstellungen → Daten & Datenschutz → Daten exportieren. Gibt JSON aller Ihrer Datensätze zurück. [`DataPrivacyScreen.tsx`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx) |
> | **Berichtigung** (Art. 16) — fehlerhafte Daten korrigieren | In der App: Einstellungen → Profil. Alle Profilfelder sind editierbar. |
> | **Löschung** (Art. 17) — Konto löschen | In der App: Einstellungen → Daten & Datenschutz → Konto löschen. [`auth.py` Z. 406-457](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/auth.py#L406-L457) |
> | **Einschränkung** (Art. 18) — Verarbeitung pausieren während ein Streit geklärt wird | Schreiben Sie uns per E-Mail (siehe unten) |
> | **Datenübertragbarkeit** (Art. 20) — Ihre Daten in maschinenlesbarer Form erhalten | In der App: Einstellungen → Daten & Datenschutz → Daten exportieren. JSON-Format. |
> | **Widerspruch** (Art. 21) — Einwilligung zur statistischen Beteiligung widerrufen | Wählen Sie „Lieber nicht angeben" als Krankenhauszugehörigkeit — Ihre Wochenstunden fließen in keine veröffentlichte Statistik mehr ein. Oder schreiben Sie uns für umfassenderen Widerspruch. |
> | **Beschwerderecht** | Sie können jederzeit Beschwerde bei einer Aufsichtsbehörde einlegen. Für Berlin ist das die Berliner Beauftragte für Datenschutz und Informationsfreiheit ([www.datenschutz-berlin.de](https://www.datenschutz-berlin.de)). |
> | **Privacy-Budget-Transparenz** (Art. 15) | Authentifizierter Endpoint zeigt Ihren ε-Verbrauch: `GET /auth/me/privacy-budget`. [`auth.py` Z. 390-403](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/routers/auth.py#L390-L403) |
>
> Wir treffen keine automatisierten Entscheidungen über Sie und führen kein Profiling durch (Art. 22 — nicht anwendbar).

---

## §7 — International transfers

### EN

> **Your account, your hours, and our analytics — all in Germany.** Backend, database, and backups run on Hetzner servers in Germany. Email codes route through Brevo (EU). Workplace search uses Komoot (Germany). See §4 for the full recipients matrix.
>
> **Two situations involve transfers to countries outside the EU/EEA — both are optional and triggered by your choices:**
>
> - **If you choose Apple Sign-In or Google Sign-In:** identity verification involves Apple Inc. (USA) or Google LLC (USA). These transfers occur under the EU-US Data Privacy Framework adequacy decision. The data sent during sign-in is what Apple/Google use to confirm the identity token is valid; we receive only an opaque identifier in return. Your email is not retained by us for social-auth users.
> - **If you enable Calendar Export and your device's calendar syncs to iCloud or Google Calendar:** the calendar entries follow your device's sync configuration, which may include US servers. This is between you and your calendar provider; we don't see or control it.
>
> **About hosting-layer IP addresses:** like every web server on the internet, Hetzner's infrastructure briefly sees and logs your IP address when your device makes a request. Our application database does not store IPs. Hetzner is based in Germany; their infrastructure logs stay in Germany.

### DE

> **Ihr Konto, Ihre Stunden, unsere Analytik — alles in Deutschland.** Backend, Datenbank und Backups laufen auf Hetzner-Servern in Deutschland. E-Mail-Codes laufen über Brevo (EU). Arbeitsplatzsuche nutzt Komoot (Deutschland). Siehe §4 für die vollständige Empfängermatrix.
>
> **Zwei Situationen beinhalten Übermittlungen in Länder außerhalb des EU/EWR — beide sind optional und durch Ihre Wahl ausgelöst:**
>
> - **Wenn Sie Apple- oder Google-Anmeldung wählen:** Die Identitätsprüfung beteiligt Apple Inc. (USA) oder Google LLC (USA). Diese Übermittlungen erfolgen unter dem EU-US-Datenschutzrahmen (Angemessenheitsbeschluss). Die bei der Anmeldung gesendeten Daten dienen Apple/Google zur Überprüfung des Identitäts-Tokens; wir erhalten im Gegenzug nur eine undurchsichtige Kennung. Ihre E-Mail wird bei Social Login von uns nicht gespeichert.
> - **Wenn Sie Kalenderexport aktivieren und Ihr Gerätekalender mit iCloud oder Google Calendar synchronisiert:** Die Kalendereinträge folgen der Sync-Konfiguration Ihres Geräts, was US-Server einschließen kann. Das liegt zwischen Ihnen und Ihrem Kalender-Anbieter; wir sehen und steuern das nicht.
>
> **Zu Hosting-Logs / IP-Adressen:** Wie bei jedem Webserver sieht die Infrastruktur von Hetzner Ihre IP-Adresse kurz, wenn Ihr Gerät eine Anfrage stellt, und protokolliert sie. Unsere Anwendungs-Datenbank speichert keine IPs. Hetzner sitzt in Deutschland; deren Infrastruktur-Logs bleiben in Deutschland.

---

## §8 — Security

### EN

> | Layer | What we do | Verify |
> |---|---|---|
> | Encryption in transit | TLS 1.2+ for all client–server traffic | [`docker-compose.yml`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/docker-compose.yml) (Caddy reverse-proxy with auto-TLS) |
> | Encryption at rest | Hetzner-managed disk encryption + immutable backups (COMPLIANCE-mode Object Lock) | [`data-retention-policy.md`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/data-retention-policy.md) |
> | Pseudonymisation | Random UUID user IDs; emails stored only as HMAC-SHA256 hashes with a server-side secret key | [`security.py` L25-28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/security.py#L25-L28) |
> | K-anonymity in published stats | Cells with fewer than 5 contributors are not published; dominance rule prevents any single user from being more than 30% of a group's contribution | [`dp_group_stats/config.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/config.py) |
> | Differential privacy | Laplace noise added to published values; per-user annual ε budget cap of 150 | [`dp_group_stats/mechanisms.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/mechanisms.py), [`accounting.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/accounting.py) |
> | Authentication tokens | JWT with 30-day expiry; stored in the device's hardware-backed secure storage (iOS Keychain / Android Keystore) | [`AuthStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/lib/auth/AuthStorage.ts) |
> | Rate limiting | 5 auth requests per minute per IP; 10 feedback submissions per minute per IP | [`rate_limit.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/rate_limit.py) |
>
> **Honest about limits:** pseudonymisation reduces but does not eliminate re-identification risk. At smaller hospitals, the combination of profile fields (hospital + specialty + seniority) could in principle allow identification by someone who already knows you work there. The K-anonymity threshold and differential privacy mechanisms above are designed to prevent this in published statistics, but the underlying operational data is still pseudonymous personal data — not anonymous — and is subject to all the protections in this notice. This is acknowledged in our [Data Protection Impact Assessment](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/DPIA.md), risk R7.

### DE

> | Ebene | Was wir tun | Nachprüfen |
> |---|---|---|
> | Transportverschlüsselung | TLS 1.2+ für gesamten Client-Server-Verkehr | [`docker-compose.yml`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/docker-compose.yml) (Caddy Reverse-Proxy mit Auto-TLS) |
> | Verschlüsselung im Ruhezustand | Von Hetzner verwaltete Festplattenverschlüsselung + unveränderliche Backups (COMPLIANCE-Mode Object Lock) | [`data-retention-policy.md`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/data-retention-policy.md) |
> | Pseudonymisierung | Zufällige UUID-Nutzer-IDs; E-Mails nur als HMAC-SHA256-Hashes mit serverseitigem geheimen Schlüssel gespeichert | [`security.py` Z. 25-28](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/security.py#L25-L28) |
> | K-Anonymität in veröffentlichten Statistiken | Zellen mit weniger als 5 Beitragenden werden nicht veröffentlicht; Dominanzregel verhindert, dass eine einzelne Person mehr als 30 % zum Gruppenbeitrag stellt | [`dp_group_stats/config.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/config.py) |
> | Differential Privacy | Laplace-Rauschen auf veröffentlichte Werte; jährliches ε-Budget pro Nutzer:in von 150 | [`dp_group_stats/mechanisms.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/mechanisms.py), [`accounting.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/dp_group_stats/accounting.py) |
> | Authentifizierungs-Tokens | JWT mit 30-Tage-Ablauf; im hardwaregesicherten Gerätespeicher (iOS Keychain / Android Keystore) | [`AuthStorage.ts`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/mobile-app/src/lib/auth/AuthStorage.ts) |
> | Rate-Limiting | 5 Auth-Anfragen pro Minute pro IP; 10 Feedback-Einreichungen pro Minute pro IP | [`rate_limit.py`](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/backend/app/rate_limit.py) |
>
> **Ehrlich zu Grenzen:** Pseudonymisierung reduziert das Re-Identifikationsrisiko, eliminiert es aber nicht. An kleineren Krankenhäusern könnte die Kombination der Profilfelder (Krankenhaus + Fachgebiet + Seniorität) grundsätzlich eine Identifikation durch jemanden ermöglichen, der bereits weiß, dass Sie dort arbeiten. Die oben beschriebene K-Anonymitätsschwelle und Differential Privacy verhindern dies in veröffentlichten Statistiken; die zugrundeliegenden operativen Daten bleiben jedoch pseudonyme personenbezogene Daten — nicht anonym — und unterliegen allen Schutzmaßnahmen dieser Erklärung. Diese Bewertung findet sich in unserer [Datenschutz-Folgenabschätzung](https://github.com/lukashondrich/open_workinghours/blob/49ea57b/docs/DPIA.md), Risiko R7.

---

## §9 — Responsible person

### EN

> **Lukas Hondrich**
> Karl-Marx-Str. 182
> 12043 Berlin
> Germany
>
> **Email:** lukashondrich@googlemail.com
>
> *(For German legal compliance, this matches the Impressum on the website. Update both pages together when this changes.)*
>
> **Data Protection Officer:** Not required — sole proprietor below GDPR Art. 37(1) thresholds.
>
> **Supervisory authority:** Berliner Beauftragte für Datenschutz und Informationsfreiheit, Friedrichstraße 219, 10969 Berlin, [www.datenschutz-berlin.de](https://www.datenschutz-berlin.de)

### DE

> **Lukas Hondrich**
> Karl-Marx-Str. 182
> 12043 Berlin
> Deutschland
>
> **E-Mail:** lukashondrich@googlemail.com
>
> *(Für die rechtliche Compliance in Deutschland muss dies dem Impressum auf der Website entsprechen. Aktualisieren Sie beide Seiten gemeinsam.)*
>
> **Datenschutzbeauftragter:** Nicht erforderlich — Einzelunternehmer unterhalb der Schwellen aus Art. 37 Abs. 1 DSGVO.
>
> **Aufsichtsbehörde:** Berliner Beauftragte für Datenschutz und Informationsfreiheit, Friedrichstraße 219, 10969 Berlin, [www.datenschutz-berlin.de](https://www.datenschutz-berlin.de)
