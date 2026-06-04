# Ticket: Privacy Doc — Code Changes

**Priority:** Pre-launch (blocking the full doc rollout — but doc rewrite can proceed in parallel)
**Component:** Mobile App, Backend
**Origin:** Code changes surfaced during the 2026-05-22 privacy audit + doc rewrite session.
**Related artifacts:**
- `docs/audit/data-inventory-2026-05-22.md` (Pass 1 — code-derived inventory)
- `docs/audit/inventory-vs-comms-diff-2026-05-22.md` (Pass 2 — claim vs reality diff)
- `docs/audit/draft-app-privacy-policy-2026-05-22.md` (drafted privacy policy)
- `project-mgmt/privacy-doc-assembly-todo.md` (doc-side rollout checklist)
- `project-mgmt/ticket-consent-re-acceptance-flow.md` (separate, related)

---

## Context

During the privacy audit (Pass 1 + Pass 2 on 2026-05-22), several mismatches between code behavior and existing comms were found. The doc rewrite (in `draft-app-privacy-policy-2026-05-22.md`) makes specific claims that depend on these code changes being implemented; until they are, parts of the new doc will be slightly aspirational rather than fully accurate.

These items are deliberately deferred from the doc-first phase. They should land before the new privacy policy is published publicly. Most are small; the bug-report item is larger because it changes the reporting UX and payload shape, not only retention.

---

## Items

### 1. Hospital opt-out — make "Other" a real opt-out

**Why:** The new doc says: "Pick 'Prefer not to share' as your hospital — your weekly hours never enter any published statistic." Today, picking "Other" stores `hospital_ref_id = 0` and the user still flows into state×specialty aggregation.

**Changes:**

| File | Change |
|---|---|
| `mobile-app/src/modules/auth/components/ProfileForm.tsx` L173-175 | When `hospitalValue === 'other'`, send `hospitalRefId: null` instead of `0` |
| `mobile-app/src/modules/auth/screens/ProfileScreen.tsx` L125 | Same change for the edit-profile path |
| `mobile-app/src/lib/i18n/translations/en.ts` (key `auth.register.hospitalOther`) | Rename label from "Other" → "Prefer not to share" |
| `mobile-app/src/lib/i18n/translations/de.ts` (key `auth.register.hospitalOther`) | Rename "Sonstige" → "Lieber nicht angeben" |
| `backend/app/aggregation.py` (around the `cell_key` query, L235+) | Add `WHERE hospital_ref_id IS NOT NULL` filter so opt-out users are excluded from state×specialty aggregation |
| `backend/app/schemas.py` | Verify already accepts `hospital_ref_id: int \| None` (L197, 276, 302, 402 — confirmed) |

**Acceptance criteria:**
- [x] User selects "Prefer not to share" during registration → backend stores `hospital_ref_id = NULL`
- [x] User updates profile to "Prefer not to share" → backend stores `hospital_ref_id = NULL`
- [x] Existing users with `hospital_ref_id = 0` are unaffected by this change (no migration needed; old data stays)
- [x] Aggregation test data confirms NULL-hospital users do not appear in state×specialty published stats
- [ ] Manual app smoke test confirms personal dashboard works normally for NULL-hospital users (tracking, calendar, etc. unaffected)

**Implementation status (2026-06-02):** Implemented in this branch. Mobile registration/edit-profile now send `hospitalRefId: null` for "Prefer not to share"; backend profile updates persist explicit `hospital_ref_id: null`; finalized-week aggregation excludes `hospital_ref_id IS NULL`; focused backend tests cover profile clearing and aggregate exclusion.

**Estimate:** ~1 hour

---

### 2. Bug reports — confirmation, two-tier diagnostics, and retention

**Why:** The new doc commits to a 90-day retention period for bug reports. Today, `feedback_reports` rows persist indefinitely — direct GDPR Art. 5(1)(e) (storage limitation) gap. The current app also sends the report immediately when the user taps "Report Issue" and includes saved work-location coordinates in `locations_details`, while the draft policy says the user confirms submission and does not clearly disclose coordinates. To balance debugging value with privacy and compliance, make bug reporting explicit and two-tiered:

1. **Default diagnostics (privacy-light):** sent only after a confirmation sheet. Includes app version/build, OS, coarse device model, screen/feature area if available, counts, and derived geofence telemetry (event type, timestamp, GPS accuracy, ignored flag/reason, aggregate counts). Do **not** include saved work-location names or coordinates by default.
2. **Optional location diagnostics:** a separate unchecked checkbox on the confirmation sheet. If the user enables it, include saved work-location names and approximate coordinates (round to 3 decimals, not exact lat/lon), plus recent geofence events with location names. This is for geofencing reliability bugs where location context is actually useful.

**Changes:**

| File | Change |
|---|---|
| `mobile-app/src/modules/geofencing/screens/SettingsScreen.tsx` | Replace immediate `reportIssue(state.user)` call with a confirmation sheet/modal. The user must tap an explicit Send action. Add an unchecked "Include location diagnostics" option with clear copy. |
| `mobile-app/src/lib/i18n/translations/en.ts` + `de.ts` | Add report-confirmation copy. Must state what default diagnostics include, that location diagnostics are optional, that approximate saved workplace coordinates may be included only if checked, and that reports are used only for debugging and deleted after 90 days. |
| `mobile-app/src/lib/utils/reportIssue.ts` | Accept `includeLocationDiagnostics: boolean`. Default payload excludes `locations_details` names/coordinates and any other raw location context. Optional payload includes location names and coordinates rounded to 3 decimals. Keep derived geofence telemetry useful for debugging. Add `diagnostics_scope` / `include_location_diagnostics` to the payload so backend/admin can see what was consented to. |
| `backend/app/schemas.py` | Add explicit fields for diagnostics scope if useful (`include_location_diagnostics`, `diagnostics_scope`). Keep accepting `locations_details` only for optional location diagnostics. |
| `backend/app/routers/feedback.py`, `backend/app/cleanup.py`, `backend/app/main.py` | Enforce diagnostics scope server-side, strip location details unless the optional scope was selected, and delete `feedback_reports` where `created_at < now() - 90 days`. |
| Deployment | Implemented as a startup purge plus daily FastAPI background cleanup. No separate cron sidecar is required for the current deployment model; if the service is later split into many workers, the purge is idempotent but may run once per worker. |
| `docs/data-retention-policy.md` | Add `feedback_reports: 90 days` to the retention table; remove stale "Device Identifiers: Not collected" / "GPS coordinates never transmitted" absolutes or qualify them for optional bug reports and Photon. |
| `website/src/pages/app-privacy-policy.astro` + `de/app-privacy-policy.astro` | Update §2.5 to match the final payload: confirmation first, default diagnostics vs optional location diagnostics, approximate coordinates only, 90-day retention. |
| `docs/ROPA.md` + `docs/DPIA.md` | Align bug-report category descriptions with the final two-tier payload and retention. |

**Implementation status (2026-06-02):** Implemented in this branch. Added optional description field, confirmation modal, unchecked location-diagnostics option, rounded optional coordinates, backend scope stripping, daily retention cleanup, and backend tests in `backend/tests/test_feedback.py`.

**Acceptance criteria:**
- [x] Tapping "Report Issue" opens a confirmation sheet; no report is sent until the user taps Send
- [x] The default Send path excludes saved work-location names and coordinates
- [x] The optional location-diagnostics checkbox is unchecked by default and has explicit copy about approximate saved workplace coordinates
- [x] When optional location diagnostics are enabled, saved location coordinates are rounded to 3 decimals before transmission
- [x] Backend payload/report record indicates which diagnostics scope was submitted
- [x] A test fixture with a >90-day-old feedback report is deleted by the cleanup task
- [x] Reports younger than 90 days are preserved
- [x] Cleanup task runs on at least daily cadence
- [x] `data-retention-policy.md`, RoPA, DPIA, and the app privacy policy reflect the two-tier payload and 90-day window
- [ ] Manual UI test confirms both paths: default diagnostics and optional location diagnostics

**Estimate:** ~2-3 hours including UI copy, payload changes, backend cleanup, and doc alignment

---

### 3. Photon proximity coordinate precision (data minimization)

**Why:** `GeocodingService.ts` L113 currently sends full GPS precision (e.g., `52.516275, 13.377704`) to Komoot/Photon as proximity bias. Photon uses these only to rank results — ranking quality is essentially identical with coordinates rounded to 2 decimals (~1 km precision). Less precision transmitted = better data minimization (GDPR Art. 5(1)(c)).

**Change:**

```ts
// GeocodingService.ts:113 — current
url += `&lat=${options.proximity.latitude}&lon=${options.proximity.longitude}`;

// proposed
const round2 = (n: number) => Math.round(n * 100) / 100;
url += `&lat=${round2(options.proximity.latitude)}&lon=${round2(options.proximity.longitude)}`;
```

**Acceptance criteria:**
- [ ] Workplace search still returns the same first-page results in test queries (Berlin, Munich, small towns)
- [x] Inspecting network traffic confirms coords are rounded to 2 decimals before transmission

**Implementation status (2026-06-02):** Implemented in this branch. `GeocodingService.ts` rounds proximity coordinates to 2 decimals before constructing the Photon request URL; `GeocodingService.test.ts` verifies the generated `lat`/`lon` query params.

**Estimate:** ~5 min (+ ~15 min smoke testing)

---

### 4. Mobile in-app strings — align with new doc claims

**Why:** Several in-app strings make absolute privacy claims that the new doc qualifies. Either tighten the in-app copy or remove the absolute language.

**Files to scan and update:**

| String key | Current claim | Recommended fix |
|---|---|---|
| `setup.foregroundPrimer.privacy` (en.ts:585, de.ts:585) | "GPS coordinates are never sent to our servers" / "GPS-Koordinaten ... unser Backend nie" | Reword to: "GPS coordinates are processed on your device for clock-in/out. Workplace search uses Komoot (Germany); see Privacy Policy for details." |
| Any other "no third parties" / "completely anonymous" claims discovered in audit | — | Remove or qualify per the diff doc (`inventory-vs-comms-diff-2026-05-22.md`, Direction 2 + Direction 4 tables) |

**Acceptance criteria:**
- [ ] Grep for "GPS coordinates" / "no third parties" / "completely anonymous" in `en.ts` + `de.ts` returns only qualified phrasings or none
- [ ] User-facing copy is consistent with the new privacy policy doc

**Estimate:** ~1 hour

---

### 5. Consumer landing page — rewrite "no third parties" claim

**Why:** `feature/consumer-landing-page` branch contains `website/src/pages/index.astro` L308 (EN + DE) with "No employer, no third parties have access" — contradicted by Photon, Apple/Google sign-in, calendar export.

**Change:** Rewrite per the recipient-matrix-aware framing. Suggested wording in audit (Direction 2 / 4 tables).

EN proposed:
> "No employer access. Our infrastructure (hosting, email, geocoding) is EU-only. **Optional:** if you choose Apple or Google Sign-In, identity verification uses those providers (US) under their EU adequacy frameworks. The email-code path keeps you fully EU-only."

DE proposed:
> "Kein Arbeitgeber-Zugriff. Unsere Infrastruktur (Hosting, E-Mail, Geocoding) ist ausschließlich in der EU. **Optional:** Wenn Sie Apple- oder Google-Anmeldung wählen, übermittelt die Identitätsprüfung Daten an diese Anbieter (USA) unter dem EU-US-Datenschutzrahmen. Der E-Mail-Code-Pfad bleibt vollständig EU-only."

**Acceptance criteria:**
- [ ] `website/src/pages/index.astro` (on `feature/consumer-landing-page`) EN + DE versions no longer claim "no third parties"
- [ ] New wording is consistent with the recipient matrix in `app-privacy-policy.astro` §4

**Estimate:** ~15 min

---

### 6. Consent re-acceptance + version bump (cross-reference)

See `project-mgmt/ticket-consent-re-acceptance-flow.md` — covers the legacy re-acceptance UX. When that ticket is worked on, **also bump these constants** in the same change:

```ts
// mobile-app/src/lib/auth/consent-types.ts L13-14
export const CURRENT_TERMS_VERSION = '2026-05';   // was '2026-01'
export const CURRENT_PRIVACY_VERSION = '2026-05';  // was '2026-01'
```

The new policy version corresponds to the publication date of the consolidated privacy policy (this doc rewrite). Existing users will see the re-acceptance bottom sheet on next app open after the new build ships.

**Status:** Implemented in the root navigator with the `2026-05` version bump. See `project-mgmt/ticket-consent-re-acceptance-flow.md` for details and remaining manual smoke recommendation.

**Estimate (added on top of the existing ticket):** ~5 min

---

## Order of operations

Most items are independent. Suggested order if working sequentially:
1. Item 3 (Photon precision) — trivial, low risk, quickly verifiable
2. Item 1 (hospital opt-out) — most consequential for the new doc's claims
3. Item 2 (bug report confirmation + retention) — larger than the rest; pair UX, payload, cleanup, and doc wording in one change
4. Item 4 (mobile in-app strings) — paired with the doc rollout
5. Item 5 (landing page) — needs branch merge anyway
6. Item 6 (consent version bump) — combine with the existing re-acceptance ticket work

**Total estimate:** ~5-7 hours of focused work, excluding the consent re-acceptance flow (which is its own larger ticket).
