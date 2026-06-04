# Ticket: Consent Re-Acceptance Flow for Legacy Accounts

**Priority:** Pre-launch (blocking)
**Component:** Mobile App (auth), Backend
**Related files:** `DataPrivacyScreen.tsx`, `ConsentBottomSheet.tsx`, `AuthService.ts`, `auth.py`

---

## Problem

Accounts created before GDPR consent tracking was added have `null` values for `terms_accepted_version`, `privacy_accepted_version`, and `consent_accepted_at` in the backend. The Data & Privacy screen shows "Not accepted" for these users, and there is no recorded proof of consent.

With a public launch approaching, every active user must have explicit, auditable consent on file.

## Current Behavior

- New registrations (email + social auth) correctly send `CURRENT_TERMS_VERSION` and `CURRENT_PRIVACY_VERSION` during registration — no gap there.
- Existing accounts with null consent fields can use the app without restriction.
- Data & Privacy screen shows "Not accepted" in orange, which is confusing but has no functional consequence.

## Desired Behavior

When `/auth/me` returns null consent fields, the app should block normal use and show the `ConsentBottomSheet` requiring the user to accept before proceeding. On acceptance, call the existing update-consent endpoint to persist the consent on the backend.

## Implementation Notes

- The `ConsentBottomSheet` component already exists and supports a `mode: 'update'` prop.
- The backend already has an update-consent endpoint that sets `terms_accepted_version`, `privacy_accepted_version`, and `consent_accepted_at`.
- The check should happen after successful login / token refresh, before rendering the main app.
- Consider placing the guard in the auth context or the root navigator so it catches all entry paths.
- After consent is accepted, refresh the user profile from `/auth/me` to update local state.

## Acceptance Criteria

- [x] Users with null consent fields see ConsentBottomSheet on app open
- [x] Users cannot dismiss or bypass the sheet without accepting
- [x] On acceptance, backend consent fields are populated with current versions and timestamp
- [x] Data & Privacy screen shows "Accepted" after re-acceptance
- [x] New registrations are unaffected (no double prompt)

## Implemented

- Implemented in the root navigator so login, token restore, biometric unlock, and social-auth return paths all run through the same guard.
- Main app screens, calendar export orchestration, and queued finalization stay unmounted while consent is stale or missing.
- The re-acceptance action posts the current `2026-05` terms/privacy versions to `/auth/consent`, then refreshes the user profile from `/auth/me` through `AuthService.updateConsent`.
- The sheet cannot be dismissed by drag or mask press. The visible secondary action in update mode signs the user out, so normal app use still requires acceptance.
- Focused coverage added for backend persistence, mobile consent-version helper logic, and the mobile auth-service request payload.
- Manual simulator smoke passed on 2026-06-04 using a local legacy/null-consent user: consent sheet blocked app use, `/auth/consent` returned 200, `/auth/me` refreshed, the main app unlocked, and Data & Privacy showed accepted consent.
