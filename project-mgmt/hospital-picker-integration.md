# Hospital Picker Integration

**Created:** 2026-03-23
**Implemented:** 2026-03-24
**Status:** Implemented — tested in simulator (test mode). Backend deploy pending.
**Branch:** `feature/dp-data-model-alignment` (builds on existing taxonomy work)
**Depends on:** `project-mgmt/dp-data-model-alignment.md` (decisions D1–D12)

---

## Goal

Integrate hospital selection into the registration flow and connect it to the geofence setup. Users pick their hospital from a dataset of 1,220 German hospitals during registration. When they later set up a geofence, the map pre-populates with the hospital's coordinates.

---

## Design Decisions (from discussion)

### Hospital lives on the user profile, not on UserLocation
- `hospitalRefId` is stored on the backend user profile (via `PATCH /auth/me/profile`)
- `UserLocation` (SQLite, geofence) stays unchanged — no `hospitalRefId` column
- Rationale: 1 hospital per person, but potentially many geofence locations
- The geofence is just a lat/lon + radius + name — it doesn't need to know about hospital taxonomy

### Hospital picker is in registration, not geofence setup
- Users pick their hospital during registration (get it done upfront)
- The geofence setup flow reads the hospital from the profile to pre-populate the map
- Cleaner separation: profile = who you are, geofence = where you clock in

### Registration field order changes
- **New order:** State → Hospital → Profession → Seniority → (optional: Department)
- **Old order:** Profession → Seniority → State → (optional: Department)
- Rationale: State → Hospital cascades naturally (hospital list filtered by state)

### Hospital picker UX
- **Required field** — user must make a deliberate choice (pick a hospital or explicitly choose "Other")
- **Search-first:** shows no results until user types ≥2 characters
- **Filtered by state:** only shows hospitals in the user's selected Bundesland
- **Results show name + city** for disambiguation (e.g., "Charité — Berlin")
- **"Other" option** ("Sonstige" in German) — always visible at the bottom regardless of search query. Selecting it → `hospitalRefId` stays `null`, user proceeds without hospital link
- Validation blocks form submission until user either selects a hospital or explicitly picks "Other"

### Geofence setup pre-population
- When entering "Add Workplace" (`SetupScreen`), check if user has a `hospitalRefId`
- If yes → look up hospital lat/lon → pre-place pin, auto-fill name, skip to step 2
- If no → current 3-step flow unchanged
- Step 3 (naming) could be absorbed into step 2 for hospital-linked setups (name is already known), but this is optional / future improvement

### Dataset bundled in frontend
- The 1,220 hospitals are shipped as **JSON files partitioned by state** (e.g., `hospitals-BY.json`, `hospitals-NW.json`) — ~16 files, ~6-10KB each
- Only the selected state's file is loaded at picker time (lazy import), keeping memory usage low
- No backend API call needed for hospital search during registration
- Backend taxonomy endpoint (`GET /taxonomy/hospitals`) remains for other uses but is not called by the picker

---

## Data

### Hospital Dataset
- **Source:** `datasets/german_hospitals/output/german_hospitals.csv`
- **Count:** 1,220 hospitals
- **Fields:** name, lat, lon, staff_email_domain, website, street, postcode, city, state
- **Lat/lon coverage:** 100% (all 1,220 have coordinates)
- **State coverage:** 1,218 have valid Bundesland names, 2 have empty state (to be researched later; excluded from state-filtered lists for now)
- **State values:** Full German names (e.g., "Bayern", "Nordrhein-Westfalen") — need mapping to state codes (e.g., "BY", "NW") used in the picker

### State Code ↔ State Name Mapping
The hospital CSV uses full state names, but registration uses 2-letter codes. A mapping is needed:
```
BW → Baden-Württemberg    NI → Niedersachsen
BY → Bayern               NW → Nordrhein-Westfalen
BE → Berlin               RP → Rheinland-Pfalz
BB → Brandenburg          SL → Saarland
HB → Bremen               SN → Sachsen
HH → Hamburg              ST → Sachsen-Anhalt
HE → Hessen               SH → Schleswig-Holstein
MV → Mecklenburg-Vorp.    TH → Thüringen
```
This mapping already exists in `mobile-app/src/lib/taxonomy/constants.ts` (`GERMAN_STATES`) — reuse it.

---

## Existing Code (on branch `feature/dp-data-model-alignment`)

### Already implemented
| What | Where | Notes |
|------|-------|-------|
| `Hospital` type | `mobile-app/src/lib/taxonomy/types.ts` | Has `id, name, city, state, postcode` — **needs `lat, lon` added** |
| `Picker` component | `mobile-app/src/components/ui/Picker.tsx` | Supports `searchable` prop. Needs enhancement for search-first + subtitle |
| `RegisterScreen` | `mobile-app/src/modules/auth/screens/RegisterScreen.tsx` | Has profession/seniority/state/department pickers. Needs hospital picker + reorder |
| `ProfileScreen` | `mobile-app/src/modules/auth/screens/ProfileScreen.tsx` | Same pickers. Needs hospital picker added |
| `AuthService.updateProfile()` | `mobile-app/src/modules/auth/services/AuthService.ts` | Already sends `hospital_ref_id` to backend |
| `ProfileUpdateRequest` | `mobile-app/src/lib/auth/auth-types.ts` | Already has `hospitalRefId?: number` |
| `User` type | `mobile-app/src/lib/auth/auth-types.ts` | Already has `hospitalRefId?: number` |
| Backend `PATCH /auth/me/profile` | `backend/app/routers/auth.py` | Already accepts `hospital_ref_id` |
| Backend `GET /taxonomy/hospitals` | `backend/app/routers/taxonomy.py` | Works but doesn't return lat/lon — **needs lat/lon added** (or skip if frontend bundles data) |
| `TaxonomyService` | `mobile-app/src/modules/auth/services/TaxonomyService.ts` | Calls backend API — **may not be needed** if data is bundled |

### Not yet implemented
| What | Where | Notes |
|------|-------|-------|
| Hospital JSON bundle | `mobile-app/src/lib/taxonomy/hospitals.ts` or `.json` | Convert CSV → JSON, include id, name, lat, lon, city, state |
| Picker enhancement | `Picker.tsx` | Search-first mode (no results until ≥2 chars), subtitle support |
| Hospital picker in registration | `RegisterScreen.tsx` | After state, before profession |
| Hospital picker in profile | `ProfileScreen.tsx` | Editable |
| Geofence pre-population | `SetupScreen.tsx` | Read hospital from user profile, pre-place pin |
| i18n keys | `en.ts`, `de.ts` | Hospital picker labels |

---

## Implementation Plan

### Phase 1: Hospital data bundle

**Create JSON files partitioned by state in `mobile-app/src/lib/taxonomy/hospitals/`**

Convert the CSV into per-state JSON files using a script. Each file (e.g., `BY.json`) contains:
```json
[
  { "id": 42, "name": "Klinikum Nürnberg", "lat": 49.4521, "lon": 11.0767, "city": "Nürnberg" },
  ...
]
```

The `state` field is implicit (it's the filename). Generate with a build script from the CSV.

**Create `mobile-app/src/lib/taxonomy/hospitals.ts`** — loader + types:
```typescript
export interface HospitalEntry {
  id: number;        // row index (1-based, matches backend)
  name: string;
  lat: number;
  lon: number;
  city: string;
}

// Lazy-load hospitals for a given state code
export async function getHospitalsByState(stateCode: string): Promise<HospitalEntry[]> { ... }

// Look up a single hospital by id (loads all files, cached)
export async function getHospitalById(id: number): Promise<HospitalEntry | undefined> { ... }
```

Derive state name from `GERMAN_STATES` (already in `constants.ts`) — no separate `STATE_CODE_TO_NAME` constant needed.

**Update `mobile-app/src/lib/taxonomy/types.ts`**
- Add `lat: number` and `lon: number` to the existing `Hospital` interface

**Update `mobile-app/src/lib/taxonomy/index.ts`**
- Export `HospitalEntry`, `getHospitalsByState`, `getHospitalById`

### Phase 2: Picker enhancement

**Modify `mobile-app/src/components/ui/Picker.tsx`**

Add two new props/fields:
```typescript
interface PickerProps {
  // ... existing props ...
  searchMinChars?: number;     // minimum chars before showing results (default: 0 = show all)
}

export interface PickerOption {
  value: string;
  label: string;
  subtitle?: string;   // shown below label in smaller text (e.g., city name)
}
```

Behavior changes when `searchMinChars` is set (e.g., `searchMinChars={2}`):
- When picker opens, show the search input but no options list
- Show a hint text: "Type to search..." (or similar)
- Once `searchQuery.length >= searchMinChars`, show filtered results
- This avoids rendering 1,220 items at once

**"Other" option handling:** The caller adds a special `{ value: 'other', label: 'Sonstige / Other' }` option. The Picker should render options matching `searchMinChars` threshold, but always show any option with a `pinned: true` flag (or simply: always show options whose `value` is `'other'`) at the bottom regardless of search query.

**Performance note:** With `searchMinChars={2}`, the filtered list will be small (typically <20 results), so `ScrollView` + `.map()` is fine. No need for `FlatList`.

### Phase 3: Registration flow

**Modify `mobile-app/src/modules/auth/screens/RegisterScreen.tsx`**

New field order:
1. **State** (required) — existing Picker, 16 Bundesländer
2. **Hospital** (required) — new searchable Picker, filtered by selected state
3. **Profession** (required) — existing Picker, 2 options
4. **Seniority** (required) — existing Picker, conditional on profession
5. **Department** (optional, collapsed) — existing Picker, 10 groups

Hospital picker specifics:
- Only appears after state is selected
- Options = `await getHospitalsByState(stateCode)` mapped to PickerOptions, plus a pinned `{ value: 'other', label: 'Sonstige' }` entry
- `searchable={true}`, `searchMinChars={2}`
- Each option: label = hospital name, subtitle = city
- When "Other" selected → `hospitalRefId` stays `null`
- When hospital selected → store `hospitalRefId` = hospital.id
- Validation: form blocks submission until hospital field has a value (either a hospital or "Other")

State change resets hospital selection (same pattern as profession resetting seniority).

**Update registration payload:**
- `hospitalRefId` is already in `RegisterRequest` — just wire it up
- Legacy `hospitalId` field: set to hospital name (for backward compat with old backend) or `'not_specified'` if "Not listed"

### Phase 4: Profile screen

**Modify `mobile-app/src/modules/auth/screens/ProfileScreen.tsx`**

Add the same hospital picker (after state, before profession). Same behavior as registration.

Note: The profile screen already calls `AuthService.updateProfile()` which handles `hospitalRefId`.

### Phase 5: Geofence setup pre-population

**Modify `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx`**

When the screen loads (new location, not edit mode):
1. Read user from auth context
2. If `user.hospitalRefId` exists → call `getHospitalById(user.hospitalRefId)` to look up hospital data
3. If found → set `pinCoordinate` to `{ latitude: hospital.lat, longitude: hospital.lon }`
4. Set `name` to hospital name
5. Set `region` to center on hospital
6. Start at step 2 (skip search/tap-to-place step) — reuse the existing `editLocation` code path by constructing a synthetic editLocation object

If no `hospitalRefId` or hospital not found → current behavior (step 1 with search).

The name field in step 3 should be pre-filled but editable. Or if we want to try the 2-step flow:
- Step 2 bottom panel gets a name field (pre-filled, editable) + radius controls + save button
- Step 3 is skipped entirely when pre-populated

**Decision for implementer:** Start with the simple approach (pre-populate + skip to step 2, keep step 3 as-is). The 2-step optimization can come later.

### Phase 6: i18n

**Add keys to `mobile-app/src/lib/i18n/translations/en.ts` and `de.ts`:**

```
auth.register.hospitalLabel → "Hospital" / "Krankenhaus"
auth.register.hospitalPlaceholder → "Search your hospital..." / "Krankenhaus suchen..."
auth.register.hospitalOther → "Other" / "Sonstige"
auth.register.hospitalRequired → "Hospital required" / "Krankenhaus erforderlich"
auth.register.hospitalRequiredMessage → "Please select your hospital or choose 'Other'" / "Bitte wählen Sie Ihr Krankenhaus oder 'Sonstige'"
auth.register.hospitalSearchHint → "Type at least 2 characters to search" / "Mindestens 2 Zeichen eingeben"
auth.profile.hospitalLabel → "Hospital" / "Krankenhaus"
```

### Phase 7: Backend (optional / minor)

**Add lat/lon to `GET /taxonomy/hospitals` response (nice to have, not blocking):**

Modify `backend/app/routers/taxonomy.py`:
- Add `lat: float` and `lon: float` to `Hospital` model and `HospitalOut` schema
- Read lat/lon from CSV in `_load_hospitals()`

This isn't needed for the frontend picker (which bundles data), but keeps the API complete for other consumers.

### Phase 8: Test mock update

**Modify `mobile-app/src/lib/testing/mockApi.ts`:**
- Update `authMe` mock to include `hospitalRefId` pointing to a real hospital from the dataset
- Ensure E2E registration tests can select a hospital

---

## Verification

1. **Backend tests:** `cd backend && pytest tests/test_taxonomy.py -v` — existing tests should still pass
2. **Build app:** `npx expo run:ios` on the feature branch
3. **Registration flow:** Create new account → verify State → Hospital → Profession → Seniority order works
4. **Hospital search:** Select a state, type hospital name, verify filtered results show name + city
5. **"Not listed":** Select "Not listed", verify registration succeeds without `hospitalRefId`
6. **Profile edit:** Go to profile, change hospital, verify `PATCH /auth/me/profile` sends `hospital_ref_id`
7. **Geofence pre-population:** After registration with hospital, go to "Add Workplace" → verify pin is pre-placed at hospital coordinates and name is pre-filled
8. **Geofence without hospital:** Register with "Not listed" → verify "Add Workplace" starts at step 1 (normal flow)
9. **Backward compat:** Existing users (no `hospitalRefId`) → geofence setup works as before

---

## Edge Cases

- **State change during registration:** If user changes state after selecting a hospital, hospital selection must reset (hospital may not be in new state)
- **"Other" + geofence:** User gets normal 3-step flow, no pre-population. Could show a hint: "Add your hospital in your profile to auto-place the pin"
- **2 hospitals with empty state in CSV:** Excluded from state-filtered lists. To be researched later to determine correct state assignment. Acceptable loss for now (2/1,220).
- **Duplicate hospital names:** Some hospitals share names across cities — subtitle (city) disambiguates
- **Very long hospital names:** Picker option text should truncate with `numberOfLines={1}`
- **Existing users upgrading:** They have no `hospitalRefId`. The profile screen lets them add it. The geofence setup doesn't break — just no pre-population. Passive approach: no prompt/nudge on upgrade.

---

## File Change Summary

| File | Change | Phase |
|------|--------|-------|
| `mobile-app/src/lib/taxonomy/hospitals/` | **New.** Per-state JSON files (e.g., `BY.json`, `NW.json`) | 1 |
| `mobile-app/src/lib/taxonomy/hospitals.ts` | **New.** `HospitalEntry` type, `getHospitalsByState()`, `getHospitalById()` | 1 |
| `mobile-app/src/lib/taxonomy/types.ts` | Add `lat`, `lon` to `Hospital` interface | 1 |
| `mobile-app/src/lib/taxonomy/index.ts` | Export new items | 1 |
| `scripts/convert-hospitals-csv.ts` (or `.py`) | **New.** Build script: CSV → per-state JSON files | 1 |
| `mobile-app/src/components/ui/Picker.tsx` | Add `searchMinChars`, `subtitle` support | 2 |
| `mobile-app/src/modules/auth/screens/RegisterScreen.tsx` | Reorder fields, add hospital picker | 3 |
| `mobile-app/src/modules/auth/screens/ProfileScreen.tsx` | Add hospital picker | 4 |
| `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` | Pre-populate from hospital | 5 |
| `mobile-app/src/lib/i18n/translations/en.ts` | New hospital keys | 6 |
| `mobile-app/src/lib/i18n/translations/de.ts` | New hospital keys (German) | 6 |
| `backend/app/routers/taxonomy.py` | Add lat/lon to hospital response (optional) | 7 |
| `mobile-app/src/lib/testing/mockApi.ts` | Update mock with hospitalRefId | 8 |

---

## Data Storage Summary

| Where | What | Size | Notes |
|-------|------|------|-------|
| **Backend (PostgreSQL)** | `hospital_ref_id` on `users` table | 1 nullable integer column | Already existed in schema; now populated by registration/profile update |
| **Mobile (app bundle)** | 16 JSON files in `taxonomy/hospitals/` | ~126 KB total | Read-only reference data (name, lat, lon, city). Bundled like the state list — not user data |
| **Mobile (in-memory)** | `user.hospitalRefId` in auth context | 1 number | From `/auth/me` response, not persisted separately |
| **Mobile (SQLite)** | `UserLocation` table | **Unchanged** | Geofence stores lat/lon + radius + name. No `hospitalRefId` column — the hospital data is used at setup time to pre-populate, but the geofence is independent |

**Net data impact:** One integer per user on the backend. No new tables, no new columns (column already existed). No new on-device persistent storage.

---

## Implementation Notes (2026-03-24)

### Changes from plan during implementation

1. **Picker UX** — The trigger field itself becomes a TextInput when `searchable` (user types directly in the field they tap). No separate search bar in the dropdown. Cleaner UX.
2. **"Sonstige" instead of "Not listed"** — Escape hatch renamed to "Sonstige" (German) / "Other" (English) per user feedback.
3. **Removed "Pflichtangaben" section header** — Fields shown without a "Required" label.
4. **Removed "Weitere Angaben" collapsible** — Department picker shown inline with other fields, always visible.
5. **Test mode updates** — Added `hospitalRefId` to mock `authMe`, mock registration, and added test mode path for `updateProfile` (was missing, caused 404 in test mode).
6. **`STATE_CODE_TO_NAME`** — Not created as separate constant. Derived from existing `GERMAN_STATES` array.

### What's not yet deployed

- Backend already has `hospital_ref_id` column and accepts it on `POST /register`. However, `PATCH /auth/me/profile` needs the feature branch code deployed to production for profile updates to work.

### Actual files changed

| File | Change |
|------|--------|
| `scripts/convert-hospitals-csv.py` | **New.** Build script: CSV → per-state JSON |
| `mobile-app/src/lib/taxonomy/hospitals/*.json` | **New.** 16 per-state JSON files (1,218 hospitals) |
| `mobile-app/src/lib/taxonomy/hospitals.ts` | **New.** `HospitalEntry` type, `getHospitalsByState()`, `getHospitalById()` |
| `mobile-app/src/lib/taxonomy/types.ts` | Added `lat`, `lon` to `Hospital` interface |
| `mobile-app/src/lib/taxonomy/index.ts` | Exports hospital module |
| `mobile-app/src/components/ui/Picker.tsx` | Searchable trigger is now a TextInput; `searchMinChars`, `subtitle`, `pinned` support |
| `mobile-app/src/modules/auth/screens/RegisterScreen.tsx` | Reordered: State → Hospital → Profession → Seniority → Department. Removed section headers/toggle |
| `mobile-app/src/modules/auth/screens/ProfileScreen.tsx` | Same hospital picker, wired to `updateProfile` |
| `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` | Pre-populates pin from `user.hospitalRefId` via `getHospitalById()` |
| `mobile-app/src/lib/i18n/translations/en.ts` | Hospital picker keys |
| `mobile-app/src/lib/i18n/translations/de.ts` | Hospital picker keys (German) |
| `mobile-app/src/lib/testing/mockApi.ts` | `hospitalRefId` in mock user |
| `mobile-app/src/modules/auth/services/AuthService.ts` | `hospitalRefId` in mock registration + test mode `updateProfile` |

---

## Related Docs

| Document | Relationship |
|----------|-------------|
| `project-mgmt/dp-data-model-alignment.md` | Parent decisions (D1–D12), especially D8 (hospital from dataset) |
| `project-mgmt/dp-data-model-implementation-status.md` | What's already on the branch |
| `datasets/german_hospitals/output/german_hospitals.csv` | Source hospital data |
| `mobile-app/src/components/ui/Picker.tsx` | Component to enhance |
| `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` | Geofence setup to modify |
