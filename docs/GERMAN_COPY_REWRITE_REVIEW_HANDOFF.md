# German Copy Rewrite Review Handoff

**Date:** 2026-05-22  
**Purpose:** second-opinion review for the German app and website copy rewrite  
**Scope:** copy/i18n only; no intended behavior changes

## 1. Review Goal

Review the German copy changes for clarity, accuracy, privacy framing, and consistency with the current product behavior.

The main product model to verify against:

- Calendar days are confirmed locally.
- Complete confirmed weeks are submitted from the Reports tab.
- GPS coordinates, workplace names, shift templates, absences, and unconfirmed time records stay on the device.
- Submitted data consists of profile data plus confirmed weekly totals.
- Published output should be described as anonymized, aggregated statistics.

## 2. Copy Principles Applied

The rewrite follows these decisions:

- App UI uses informal `du`.
- Website marketing/download pages use `du`.
- Website legal/privacy/terms pages stay formal `Sie`.
- Avoid `Studie`; the product is framed as Open Working Hours and weekly contributions.
- Avoid wording that implies daily submission.
- Avoid saying raw submitted weekly contributions are anonymous.
- Say explicitly that GPS coordinates stay on the device.
- Reserve `anonymisiert` / `anonymisierte, aggregierte Statistiken` for published aggregate results.

Core privacy wording pattern:

> GPS-Koordinaten bleiben auf deinem Gerät. Bestätigte Wochensummen werden an Open Working Hours übermittelt. Veröffentlicht werden nur anonymisierte, aggregierte Statistiken.

## 3. Files Changed

Mobile app:

- `mobile-app/src/lib/i18n/translations/de.ts`
- `mobile-app/src/lib/i18n/translations/en.ts`

German website pages:

- `website/src/pages/de/app-privacy-policy.astro`
- `website/src/pages/de/privacy.astro`
- `website/src/pages/de/terms.astro`
- `website/src/pages/de/download.astro`
- `website/src/pages/de/index.astro`
- `website/src/pages/de/dossier.astro`
- `website/src/pages/de/dashboard.astro`

## 4. Main App Changes

### Onboarding And Calendar

The onboarding tooltips were rewritten from formal/awkward language to direct `du` copy.

Important semantic changes:

- `Tägliche Übermittlung` became `Tage bestätigen`.
- Calendar day actions now say `Bestätigen`, not `Einreichen`.
- The day-confirmation tooltip now says that a day is confirmed for the weekly overview and that sending happens later for a complete week in Reports.
- Week header states now use `Wochenbeitrag` language:
  - `Wochenbeitrag bereit — Berichte öffnen`
  - `Wochenbeitrag abgeschlossen ✓ — Berichte öffnen`

Review focus:

- Does `Wochenbeitrag bereit — Berichte öffnen` fit the available header space on small devices?
- Is `Berichte öffnen` clear enough, or should it be `In Berichten senden` for the ready state?

### Reports

The Reports tab now uses weekly contribution language:

- `Deine Einreichungen` -> `Deine Wochenbeiträge`
- `Auto-Senden` -> `Automatisch senden`
- `Für Sonntag einreihen` -> `Für Sonntag vormerken`
- `Eingereiht für Sonntag` -> `Für Sonntag vorgemerkt`

The first-time contribution overlay now says:

- `Mit diesem Wochenbeitrag trägst du deine bestätigte Wochensumme zu Open Working Hours bei.`
- `GPS-Koordinaten bleiben auf deinem Gerät`
- `Veröffentlicht werden nur anonymisierte, aggregierte Statistiken`
- `Ein gesendeter Wochenbeitrag kann nicht rückgängig gemacht werden`

Review focus:

- Does this sufficiently distinguish submission to backend from public publication?
- Is `vormerken` the right term for a queued Sunday send?

### Consent And Data Privacy

Consent and privacy copy now explicitly separates local data, submitted weekly totals, and public statistics.

Notable changes:

- Local data now says unconfirmed `Zeiterfassungen` stay on device.
- Submission point says profile plus confirmed weekly totals are transmitted.
- Deletion copy avoids overpromising that all previously aggregated public statistics disappear.

Review focus:

- Confirm legal accuracy of `personenbezogene Serverdaten` and retained anonymized aggregate statistics.
- Confirm whether `Profil und bestätigte Wochensummen` is complete enough for the actual backend payload.

### Hours Explainer

The new hours explainer sheet was cleaned up:

- `Sitzungen` -> more natural `Zeiten` / `Zeiterfassungen`
- `final markiert` -> `geprüft`
- `Bestätigten Überstunden` casing corrected to `bestätigten Überstunden`

Review focus:

- Confirm the explanations match the calculations in calendar/status summaries.

### Native Permission Prompts

`mobile-app/app.json` permission strings were reviewed and restored to English defaults.

Reason:

- without native localization files, iOS uses the Info.plist strings for every device locale
- German-only native permission prompts would be a regression for English-locale users
- German permission prompts should be handled in a separate follow-up with localized native resources

Review focus:

- Decide whether to add German `InfoPlist.strings` / Expo localization resources in a separate native localization task.

## 5. Missing Translation Keys Fixed

The following app keys were referenced in code but missing from translations:

- `setup.selectLocationPrompt`
- `calendar.templates.saveError`
- `calendar.templates.deleteMessage`
- `calendar.absences.saveError`

They were added to both German and English translation files.

## 6. Website Changes

### Formal Privacy Policy

`website/src/pages/de/app-privacy-policy.astro` now says that data is transmitted when a complete confirmed week is submitted or auto-send is enabled, not when a single day is confirmed.

It also changes:

- `Bestätigte Arbeitszeiten: Datum, geplante Minuten, tatsächlich gearbeitete Minuten`
- to weekly totals: calendar week, planned total hours, actual total hours

Review focus:

- Confirm this matches the current `/finalized-weeks` payload.
- Confirm the legal framing for server-side joining of weekly totals with stored profile fields.

### Privacy Overview

`website/src/pages/de/privacy.astro` now:

- lists confirmed weekly totals instead of confirmed daily work time
- moves optional hospital affiliation into collected data
- removes the inaccurate blanket claim that hospital/employer name is not collected
- says freely entered employer names are not collected

Review focus:

- Confirm `Krankenhauszugehörigkeit, falls aus der Liste ausgewählt` is the best legal/product phrase.

### Terms

`website/src/pages/de/terms.astro` now describes:

- confirming days
- submitting complete weekly contributions
- responsibility for submitted weekly contributions rather than daily submissions

### Marketing Pages

Marketing pages were adjusted away from broad `anonym erfassen/anonym beitragen` phrasing.

Examples:

- Download page now says transparent tracking plus anonymized insights.
- Homepage privacy section says GPS coordinates are not transmitted and users choose which confirmed weekly totals to contribute.
- Published output is described as anonymized, aggregated statistics.

## 7. Validation Already Run

Commands/checks run:

```bash
node translation-key parity check
node -e "JSON.parse(require('fs').readFileSync('mobile-app/app.json','utf8'))"
npm --prefix mobile-app test -- --runInBand src/modules/calendar/components/__tests__/InlinePicker.test.tsx src/modules/reports/screens/__tests__/ReportsScreen.test.tsx src/modules/calendar/screens/__tests__/CalendarExportScreen.test.tsx
git diff --check
```

Results:

- German and English translation files have 653 keys each.
- No used translation keys are missing in either locale.
- `app.json` parses.
- Focused Jest pass: 3 suites passed, 4 tests passed.
- `git diff --check` passed.

## 8. Known Non-Scope Items

This rewrite did not change behavior or submission logic.

The following were intentionally not addressed:

- English app copy still contains older `study` / `submitted` language in some places.
- Legal review of the privacy policy is still a separate task.
- A full visual/device QA pass was not run.
- Existing unrelated untracked files in the worktree were left untouched.

## 9. Suggested Review Checklist

1. Read the German app copy in `de.ts` and check for tone consistency.
2. Compare calendar/report copy against `WeekStateService` and `WeekFinalizationService`.
3. Confirm privacy statements against backend payloads and docs.
4. Check short header strings on small mobile screens.
5. Review website legal pages for formal tone and legal precision.
6. Decide whether English app copy should receive the same terminology cleanup in a follow-up.
