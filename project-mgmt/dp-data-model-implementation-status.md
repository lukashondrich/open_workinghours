# DP Data Model Alignment — Implementation Status

**Created:** 2026-03-23
**Branch:** `feature/dp-data-model-alignment` (1 commit: `980c6ba`)
**Base:** `main` @ `6622b35`
**Plan:** `project-mgmt/dp-data-model-alignment.md` (decisions D1–D12)

---

## What Was Done

Everything was implemented in a single session and committed to a feature branch. **Main is untouched.** The implementation covers all 11 phases from the plan, but the user wants to review the frontend approach before merging anything.

### Backend (Phases 1–6) — Complete

| Phase | File | What |
|-------|------|------|
| 1 | `backend/app/taxonomy.py` | **New.** Single source of truth: `Profession`, `PhysicianSeniority`, `NurseSeniority`, `DepartmentGroup` enums. `SPECIALIZATIONS` dict (39+ Fachabteilungsschlüssel codes → group mapping). `GERMAN_STATES` (16 Bundesländer). `validate_seniority()` cross-check. |
| 2 | `backend/app/models.py` | 5 nullable columns on `User`: `profession`, `seniority`, `department_group`, `specialization_code`, `hospital_ref_id`. Same 5 on `FinalizedUserWeek`. `department_group` on `StatsByStateSpecialty`. All indexed where appropriate. |
| 2 | `backend/alembic/versions/i9j0k1l2m3n4_...py` | **New.** Single migration. All columns nullable. Indexes created. Clean downgrade. |
| 3 | `backend/app/schemas.py` | `UserRegisterIn`: dual-accept — v1 fields still required, v2 optional. Cross-validators for profession, seniority (must match profession), department_group, specialization_code, state_code (2-letter → validates against `ALL_STATE_CODES`). New `UserProfileUpdateIn` (all optional, same validators). `UserOut` extended with v2 fields. |
| 4 | `backend/app/routers/auth.py` | Registration stores v2 fields. New `PATCH /auth/me/profile` endpoint. Data export includes v2 fields. |
| 4 | `backend/app/routers/taxonomy.py` | **New.** `GET /taxonomy/hospitals?state=&q=&limit=` (CSV loaded in-memory at startup). `GET /taxonomy/departments` (10 groups with specializations). `GET /taxonomy/states` (16 entries). All public. |
| 4 | `backend/app/main.py` | Taxonomy router registered. |
| 4 | `backend/app/routers/finalized_weeks.py` | Snapshots v2 fields from user into `FinalizedUserWeek`. |
| 5 | `backend/app/dp_group_stats/config.py` | `use_department_group: bool = False` added to `DPGroupStatsV1Config`. |
| 5 | `backend/app/aggregation.py` | `_build_weekly_query` and `_build_multi_week_query` accept `use_department_group` param. When True: GROUP BY `department_group` instead of `specialty`, exclude NULL rows. Stores `department_group` in stat records. Flag stays False (default). |
| 6 | `backend/tests/test_taxonomy.py` | **New.** 8 tests: states (16 entries, structure), departments (10 groups, specializations), hospitals (search, filter by state, query, limit, structure). |
| 6 | `backend/tests/test_auth.py` | 9 new tests: v2 registration (with verified email setup), v1 backward compat, invalid seniority/profession combo, invalid state code, invalid department_group, profile update (happy path, partial, invalid seniority, auth required, reflects in GET /me). |
| 6 | `backend/tests/conftest.py` | Minor: added taxonomy router import. |

**Test results:** 135 passed, 4 pre-existing failures (SQLite UUID issues + missing email verification in old tests), 2 xfailed. Zero regressions.

### Mobile (Phases 7–11) — Complete but Needs Review

| Phase | File | What |
|-------|------|------|
| 7 | `mobile-app/src/lib/taxonomy/types.ts` | **New.** TypeScript types: `Profession`, `Seniority` (by profession), `DepartmentGroup`, `TaxonomyProfile`, `LabeledOption`, `StateOption`, `Hospital`. |
| 7 | `mobile-app/src/lib/taxonomy/constants.ts` | **New.** Bundled data mirroring backend: `PROFESSIONS`, `PHYSICIAN_SENIORITY`, `NURSE_SENIORITY`, `SENIORITY_BY_PROFESSION`, `DEPARTMENT_GROUPS`, `GERMAN_STATES`. All with EN + DE labels. |
| 7 | `mobile-app/src/lib/taxonomy/index.ts` | **New.** Barrel export. |
| 8 | `mobile-app/src/components/ui/Picker.tsx` | **New.** Reusable dropdown: trigger looks like Input, expands inline `Animated.View` below (no `<Modal>`), `FlatList` for options, `searchable` prop for hospital picker, all E2E-compatible (`testID`, `accessible`, `accessibilityRole`). |
| 8 | `mobile-app/src/components/ui/index.ts` | Export `Picker`. |
| 9 | `mobile-app/src/modules/auth/screens/RegisterScreen.tsx` | **Rewritten.** Required: Profession picker (2 options), Seniority picker (conditional on profession, 2–3 options), State picker (16 Bundesländer). Optional (collapsed): Department picker (10 groups). Sends both v1 legacy fields + v2 taxonomy fields to backend. |
| 10 | `mobile-app/src/modules/auth/screens/ProfileScreen.tsx` | **New.** Edit profile with same Picker components. Shows current values, saves via `PATCH /auth/me/profile`. Hint about future-weeks-only. |
| 10 | `mobile-app/src/lib/auth/auth-types.ts` | `User`: added `profession`, `seniority`, `departmentGroup`, `specializationCode`, `hospitalRefId`. `RegisterRequest`: added same. New `ProfileUpdateRequest`. |
| 10 | `mobile-app/src/modules/auth/services/AuthService.ts` | `register()`: sends v2 fields. `getCurrentUser()`: parses v2 fields. New `updateProfile()` method. |
| 10 | `mobile-app/src/modules/auth/services/TaxonomyService.ts` | **New.** `searchHospitals(query?, state?)` — calls `GET /taxonomy/hospitals`. |
| 10 | `mobile-app/src/navigation/AppNavigator.tsx` | Added `Profile` screen to stack. |
| 11 | `mobile-app/src/lib/i18n/translations/en.ts` | New keys: `auth.register.{requiredSection, optionalSection, professionLabel, professionPlaceholder, seniorityLabel, seniorityPlaceholder, stateLabel (updated), statePlaceholder (updated), departmentLabel, departmentPlaceholder, professionRequired, professionRequiredMessage, seniorityRequired, seniorityRequiredMessage, stateRequired, stateRequiredMessage}`, `auth.profile.*`, `navigation.profile`. |
| 11 | `mobile-app/src/lib/i18n/translations/de.ts` | German equivalents of all above. |
| 11 | `mobile-app/src/lib/testing/mockApi.ts` | `authMe` mock now includes `profession: 'physician'`, `seniority: 'assistenzarzt'`, `departmentGroup: 'innere_medizin'`. |

**TypeScript:** All new files compile. Pre-existing TS errors unchanged.

---

## What to Tackle Next: Frontend First

The user wants to start with the frontend in the next session. Here's the recommended approach:

### 1. Review the Picker Component

`mobile-app/src/components/ui/Picker.tsx` is the foundational new component. Check:
- Does it look right visually? (run on iOS simulator)
- Does the animation feel smooth?
- Does it handle long lists well? (hospital picker will have 1,220 items)
- E2E: is it testable via Appium/XCUITest?

### 2. Review the RegisterScreen Flow

`mobile-app/src/modules/auth/screens/RegisterScreen.tsx` is the biggest UX change. Questions:
- Is the profession → seniority → state flow intuitive?
- Should the "optional" section start expanded or collapsed?
- How does the form behave with keyboard avoidance when Picker is open?
- Do we need hospital search in registration or only in profile later?
- The screen no longer has `justifyContent: 'center'` — it flows top-down now. Is that OK?

### 3. Review the ProfileScreen

`mobile-app/src/modules/auth/screens/ProfileScreen.tsx` — accessible from Settings. Questions:
- Where in Settings should the "Edit Profile" link go?
- Does it need a confirmation dialog before saving?
- Should it show a diff of what changed?

### 4. E2E Test Updates — Done (2026-03-24)

Registration E2E tests updated for the new picker-based flow. **Android 7/7 pass.**

**What changed:**

| File | What |
|------|------|
| `mobile-app/e2e/helpers/actions.js` | `selectPickerOption(driver, pickerTestId, optionValue)` — reusable helper for Picker interaction (open, select option by testID pattern `{picker}-option-{value}`). `performTestRegistration(driver)` — full flow: WelcomeScreen → EmailVerification → RegisterScreen (pickers) → Consent → Main app. `ensureAuthenticated` updated to fall back to registration when login fails (handles fresh installs). Exported `performTestLogin`, `performTestRegistration`, `selectPickerOption`. |
| `mobile-app/e2e/flows/registration.test.js` | **New.** 7 tests: Welcome screen buttons, email verification, registration form picker visibility (conditional: hospital after state, seniority after profession), full registration completion with consent. Tests gracefully skip when already authenticated (`noReset: true`). |
| `mobile-app/src/components/ui/Picker.tsx` | Added `accessible={false}` to dropdown `ScrollView` — prevents Android child aggregation so individual option testIDs are exposed to UiAutomator2. |

**Test results (Android, 2026-03-24):**
- Registration suite: **7/7 pass** (~40s standalone, ~6s when already authenticated)
- Auth + Calendar: **12/12 pass** (no regressions)
- Full suite: 31/55 pass — 24 failures are all **pre-existing Android flakiness** (Month toggle, location wizard timing, panel dismissal). See `docs/KNOWN_ISSUES.md`.

**testID mapping (old → new):**
| Old (free-text) | New (picker) | Notes |
|-----------------|-------------|-------|
| `state-input` | `state-picker` | 16 Bundesländer options |
| `hospital-input` | `hospital-picker` | Searchable, per-state, with "Other" pinned |
| `role-input` | `profession-picker` + `seniority-picker` | Profession → Seniority cascade |
| `specialty-input` | `department-picker` | 10 department groups (optional) |

### 5. Things NOT in the Branch Yet

- **Hospital searchable picker in registration** — the Picker supports `searchable` but it's not wired up in RegisterScreen (hospital is deferred to profile)
- **Specialization picker** — physicians-only Level 2 dropdown (deferred per D2, "prompt later")
- **Settings → Profile link** — ProfileScreen exists but there's no navigation link in SettingsScreen yet

---

## Key Design Decisions Already Baked In

These come from `project-mgmt/dp-data-model-alignment.md` (D1–D12):

1. **Closed-set only** — no free-text fallback (D9)
2. **Progressive collection** — profession/seniority/state at registration, department/specialization/hospital later (D2)
3. **Backward compat** — old app versions keep working, old data stays as-is (D12)
4. **Dual-accept API** — backend accepts both v1 and v2 payloads in same endpoint (no version header)
5. **Profile mutability** — users can update via PATCH, changes apply to future weeks only (D6)
6. **Aggregation switchover deferred** — `use_department_group` flag stays False until enough users have new fields

---

## How to Pick Up

```bash
# See what's on the branch
git log --oneline main..feature/dp-data-model-alignment
git diff --stat main..feature/dp-data-model-alignment

# Work on the branch
git checkout feature/dp-data-model-alignment

# Run backend tests to verify
cd backend && source .venv/bin/activate && pytest -v

# Run mobile app to test UI
cd mobile-app && npm start
```

To split backend from mobile later:
```bash
# Create backend-only branch from main
git checkout main
git checkout -b feature/dp-taxonomy-backend
git cherry-pick 980c6ba  # then revert mobile files

# Or use interactive rebase to split the commit
```
