# Social Auth: Sign in with Apple + Google

**Status:** Planning
**Branch:** `feature/social-auth`
**Goal:** Add one-tap Sign in with Apple (iOS) and Google (Android) alongside existing email-code auth, to reduce friction before WhatsApp group launch (~2000 doctors), without changing the app's current onboarding strictness or post-login behavior.

---

## Motivation

- **UX**: Current flow (enter email → wait for code → switch apps → paste code) has too much friction for cold outreach to 2000 people. One-tap auth (Face ID → done) dramatically improves first-time conversion.
- **Privacy**: Apple's `sub` is truly opaque (not reversible like an email hash). Google's `sub` is also opaque. Server stores zero PII for social-auth users.
- **Civic tech**: Email-code stays as a non-Big-Tech fallback. No Apple/Google account required to use the app.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth providers | Apple (iOS) + Google (Android) + email (both) | Platform-native UX; email as universal fallback. MVP: platform-native only — cross-platform social auth (Apple on Android, Google on iOS) deferred because non-native web-view UX undermines the one-tap goal |
| Google email | Discard, store only `sub` | Privacy consistency — same posture as Apple |
| Apple relay email | Skip for now | Operational overhead; in-app notification suffices for breach notification |
| Schema approach | Additive (`auth_provider` + `provider_sub` columns), keep the existing profile/onboarding contract | Existing users unaffected; no app-wide "half-complete user" state |
| Onboarding strictness | Match current email registration exactly | New social users should not enter the main app with a looser profile contract than email users |
| Onboarding detection | No persisted incomplete-user state | New social users complete registration before a `User` row + app session are created |
| Onboarding flow | Reuse the current required registration form and sentinel semantics | Same UX strictness as email; no profile-contract divergence |
| Account linking | None — separate accounts per provider | Simpler, more private, avoids rabbit hole |
| Auth response shape | Keep existing email auth behavior; social auth returns either an app session or a registration-required response | Minimizes churn and preserves current app behavior |
| Social registration completion | Writes the same legacy fields (`hospital_id`, `specialty`, `role_level`) and v2 taxonomy fields as current email registration | Downstream aggregation and reporting still depend on the current register contract |
| Shared UI components | Extract picker/consent logic from `RegisterScreen` into shared component | Avoids duplication between email registration and social registration screens |
| TEST_MODE | Fake `sub` + skip provider JWT verification | Same pattern as existing `123456` code mock |
| `.well-known` files | Verify necessity before implementing | `apple-app-site-association` and `assetlinks.json` may not be required for native sign-in MVP |

---

## Architecture

### Auth Flow: Social Login (New)

```
User opens app
  → WelcomeScreen: [Sign in with Apple] / [Sign in with Google] / "Sign in with email"
  → User taps Apple/Google button
  → OS presents native auth (Face ID / account picker)
  → OS returns identity token (JWT signed by Apple/Google)
  → Mobile app sends token to backend:
      POST /auth/apple  { identity_token: "eyJ..." }
      POST /auth/google { id_token: "eyJ..." }
  → Backend verifies token against provider's public keys
  → Backend extracts `sub` (stable, opaque user identifier)
  → Backend looks up existing User by (provider + sub)
      → Found    → issue app JWT (30-day, same as current)
                   → mobile stores JWT + user
                   → MainTabs / LockScreen (same as today)
      → Not found → return `registration_required` + short-lived `social_registration_token`
                   → mobile shows the same required registration form used by email signup
                   → user completes state, hospital selection, profession, seniority, consent
                   → mobile submits `POST /auth/social/register`
                   → backend creates full User row and issues app JWT
                   → MainTabs
```

### Auth Flow: Email (Existing, Unchanged)

```
User taps "Sign in with email"
  → Existing flow: email → code → verify → register/login
  → New users still complete the current required registration form
  → No changes to this path
```

### Session Restore (Unchanged for Authenticated Users)

```
App starts / returns from background
  → Restore JWT + user from secure storage
  → If token expired → WelcomeScreen
  → If token valid → MainTabs (or LockScreen if biometric enabled)
```

There is no authenticated "partially onboarded" social session. If a new social user closes the app before finishing registration, they restart from the welcome/auth flow, which matches the current email behavior more closely than persisting a half-complete app user.

### Data Flow

```
                  ┌──────────────────────────┐
                  │      WelcomeScreen        │
                  │                           │
                  │  [Sign in with Apple]  ───────→ Apple Auth (iOS native)
                  │  [Sign in with Google] ───────→ Google Auth (Android native)
                  │  "Sign in with email" ───────→ Existing email flow
                  └──────────┬────────────────┘
                             │
                   identity_token / id_token / email+code
                             │
                             ▼
                  ┌──────────────────────────┐
                  │        Backend            │
                  │                           │
                  │  POST /auth/apple         │──→ Verify w/ Apple public keys
                  │  POST /auth/google        │──→ Verify w/ Google public keys
                  │  POST /auth/login         │──→ Existing email+code verify
                  │  POST /auth/register      │──→ Existing email registration
                  │                           │
                  │  Social existing user → JWT │
                  │  Social new user → registration_required │
                  │  Email → existing login/register flow │
                  └──────────┬────────────────┘
                             │
             either { access_token, user_id, expires_at }
               or { registration_required, social_registration_token }
                             │
                             ▼
                  ┌──────────────────────────┐
                  │     Mobile App            │
                  │                           │
                  │  existing user → MainTabs  │
                  │  new social user → SocialRegistrationScreen │
                  └───────────────────────────┘
```

---

## Backend Changes

### 1. Database: User Model

**File:** `backend/app/models.py`

Add two columns to `users` table:

```python
auth_provider = Column(String(20), nullable=True)   # NULL for email users; "apple" | "google" for social users
provider_sub  = Column(String(255), nullable=True, index=True)
```

Keep the existing registration/profile fields on `users` as they are today. Do **not** introduce persisted "pre-onboarding social users" with null profile fields. The only field that must relax is `email_hash`, because social-auth users do not have a stored email hash:

```python
email_hash    = Column(String(64), nullable=True, unique=True, index=True)  # was NOT NULL
```

Provider identity must be unique per provider namespace:

```python
__table_args__ = (
    UniqueConstraint("auth_provider", "provider_sub", name="uq_user_auth_provider_sub"),
)
```

User states after this change:

| Auth method | `email_hash` | `auth_provider` | `provider_sub` | `state_code` | Profile fields |
|-------------|-------------|-----------------|-----------------|--------------|----------------|
| Email (existing/new) | set | NULL | NULL | set | set |
| Apple (registered) | NULL | `"apple"` | set | set | set |
| Google (registered) | NULL | `"google"` | set | set | set |

**Migration:** Single Alembic migration. Additive columns + `email_hash` nullable + composite uniqueness on `(auth_provider, provider_sub)`. Existing rows unaffected.

**DP pipeline impact:** None expected from onboarding state, because incomplete social sign-ins are not persisted as full users and cannot finalize weeks.

### 2. Auth Response Shapes

**File:** `backend/app/schemas.py`

Keep the existing app-session auth response for flows that result in a logged-in app user:

```python
class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user_id: UUID
```

Add a new response for first-time social sign-ins that still need registration:

```python
class SocialAuthStartOut(BaseModel):
    status: Literal["authenticated", "registration_required"]
    access_token: str | None = None
    token_type: str | None = "bearer"
    expires_at: datetime | None = None
    user_id: UUID | None = None
    user: UserOut | None = None
    social_registration_token: str | None = None
```

`/auth/login` and `/auth/register` keep their current behavior. `/auth/apple` and `/auth/google` return:
- `status="authenticated"` for existing linked users
- `status="registration_required"` for first-time social sign-ins

### 3. New Endpoints

**File:** `backend/app/routers/auth.py`

#### `POST /auth/apple`

```python
# Request
{ "identity_token": "eyJ..." }

# Process
1. Decode Apple identity token (JWT)
2. Fetch Apple's public keys from https://appleid.apple.com/auth/keys (cached with TTL)
3. Verify signature (RS256) + expiry + audience (bundle ID) + issuer
4. Extract `sub` claim (stable, per-app user identifier)
5. Look up User by (auth_provider="apple", provider_sub=sub)
6. If found → issue JWT (same as current: 30-day, sub=user_id)
7. If not found → issue signed `social_registration_token` (30-minute expiry)
   that encodes provider + sub + expiry, but do NOT create a User row yet

# Rate limiting: 5 req/60s (same as /auth/login)

# Response
SocialAuthStartOut
```

#### `POST /auth/google`

```python
# Request
{ "id_token": "eyJ..." }

# Process
1. Decode Google ID token (JWT)
2. Verify against Google's public keys (https://www.googleapis.com/oauth2/v3/certs, cached with TTL)
3. Verify audience (Web/server client ID) + issuer (accounts.google.com)
4. Extract `sub` claim — discard email from token
5. Look up User by (auth_provider="google", provider_sub=sub)
6. If found → issue JWT
7. If not found → issue signed `social_registration_token` (30-minute expiry)

# Rate limiting: 5 req/60s (same as /auth/login)

# Response: same SocialAuthStartOut shape
```

#### Google OAuth Client IDs

Three client IDs are involved in the Google flow:

| Client ID | Where it's used | Purpose |
|-----------|----------------|---------|
| **Android** | `@react-native-google-signin` config on Android | Mobile SDK presents sign-in UI |
| **iOS** | `@react-native-google-signin` config on iOS (if Google sign-in added on iOS later) | Not needed for MVP |
| **Web/Server** | Backend `audience` parameter when verifying the ID token | Backend validates token was issued for our app |

The Android client ID and Web client ID are created in the same Google Cloud project. The backend verifies against the **Web/Server** client ID as the audience.

#### Dependencies

- `python-jose[cryptography]` (already used) for JWT decoding and RS256 verification
- `httpx` — promote from dev to runtime dependency for fetching provider public keys with TTL caching

#### `POST /auth/social/register`

**File:** `backend/app/routers/auth.py`

This completes first-time registration for social-auth users. Rate limited: 5 req/60s (same as `/auth/register`).

**Input schema:** `SocialRegisterIn` — same field contract as `UserRegisterIn` minus `email`, plus `social_registration_token`. The `social_registration_token` has a 30-minute expiry (enough time to fill 5 fields + consent, with room for interruptions).

```python
{
  "social_registration_token": "eyJ...",
  "state_code": "BY",
  "hospital_ref_id": 42,
  "profession": "physician",
  "seniority": "assistenzarzt",
  "department_group": "innere_medizin",
  # Legacy fields derived from v2 selections
  "hospital_id": "sana-klinik-muenchen",
  "specialty": "innere_medizin",
  "role_level": "assistenzarzt",
  # Consent
  "terms_version": "1.0.0",
  "privacy_version": "1.0.0"
}
```

This endpoint must atomically:
- Verify the signed `social_registration_token`
- Create the `User` row with `auth_provider` + `provider_sub`
- Write the same legacy reporting fields used by current email registration
- Write the same v2 taxonomy fields and consent fields as current email registration
- Issue the normal app JWT

Important: reuse the current sentinel semantics instead of inventing a looser null state:
- concrete hospital selected → `hospital_ref_id=<id>`
- "Other" hospital selected → `hospital_ref_id=NULL`, `hospital_id="not_specified"`
- optional department not selected → `specialty="not_specified"`
- required seniority still maps to legacy `role_level`

`PATCH /auth/me/profile` remains an authenticated profile-edit endpoint for already-registered users. It is not repurposed as a pre-login onboarding completion endpoint.

### 5. `.well-known` Files (Verify Necessity)

Before implementing, verify whether these are required for native Sign in with Apple / Google Sign-In:

- `apple-app-site-association` — likely needed only for associated domains / shared web credentials, not for native `ASAuthorizationAppleIDProvider`
- `assetlinks.json` — likely needed only for Android App Links, not for Google Sign-In via the native SDK

If not required, defer. If required, serve as static JSON from nginx or the FastAPI app.

---

## Mobile App Changes

### 1. Dependencies

```
expo-apple-authentication                    # Ships with Expo SDK, no install needed
@react-native-google-signin/google-signin    # npm install + expo prebuild
```

Both require development builds (already using `expo run:ios` / `expo run:android`).

### 2. WelcomeScreen

**File:** `mobile-app/src/modules/auth/screens/WelcomeScreen.tsx`

Replace current two-button layout:

```
┌────────────────────────────────────┐
│                                    │
│        Open Working Hours          │
│        [logo / tagline]            │
│                                    │
│   ┌──────────────────────────┐     │
│   │   Sign in with Apple    │     │  ← iOS only, Apple's standard button
│   └──────────────────────────┘     │
│                                    │
│   ┌──────────────────────────┐     │
│   │  Sign in with Google     │     │  ← Android only, Google's standard button
│   └──────────────────────────┘     │
│                                    │
│         ── or ──                   │
│                                    │
│     Sign in with email →           │  ← small text link
│                                    │
│   By continuing, you agree to our  │
│   Terms of Service and Privacy     │
│   Policy.                          │
│                                    │
└────────────────────────────────────┘
```

- iOS: Show Apple button only (`Platform.OS === 'ios'`)
- Android: Show Google button only (`Platform.OS === 'android'`)
- "Sign in with email" navigates to existing EmailVerificationScreen / LoginScreen

### 3. AuthService

**File:** `mobile-app/src/modules/auth/services/AuthService.ts`

Add two methods:

```typescript
async loginWithApple(identityToken: string): Promise<SocialAuthStartResponse> {
  if (isTestMode()) return mockResponses.authAppleExistingUser; // or authAppleNewUser
  const response = await fetch(`${API_BASE}/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_token: identityToken }),
  });
  return response.json();
}

async loginWithGoogle(idToken: string): Promise<SocialAuthStartResponse> {
  if (isTestMode()) return mockResponses.authGoogleExistingUser; // or authGoogleNewUser
  const response = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  return response.json();
}
```

Add a `completeSocialRegistration()` method that posts the same required registration payload plus `social_registration_token` to `POST /auth/social/register`.

Keep the existing email login/register behavior intact. The social path can use a provider-specific response type without forcing a broad auth-response rewrite for email.

Because provider email is intentionally not stored, `User.email` must become optional (`email?: string`). Callsites that need updating:

| File | Current usage | Change needed |
|------|--------------|---------------|
| `auth-types.ts` | `email: string` (required) | Change to `email?: string` |
| `AuthService.ts` `getCurrentUser()` | `(token: string, email: string)` — injects email into User object | Change to `email?: string`, omit from User when undefined |
| `AuthService.ts` `updateProfile()` | `(token: string, email: string, ...)` — passes email to `getCurrentUser()` | Change to `email?: string` |
| `ProfileScreen.tsx:125` | `user.email` passed to `updateProfile()` | Already optional after above changes |
| `reportIssue.ts:147` | `user?.email \|\| null` | Already handles undefined — no change needed |

### 4. SocialRegistrationScreen (New)

**File:** `mobile-app/src/modules/auth/screens/SocialRegistrationScreen.tsx`

Shown after a first-time social sign-in returns `registration_required`. Contains the same required form contract as current email registration:

- State picker (required)
- Hospital picker (filtered by state, searchable) (required)
- Profession picker (required)
- Seniority picker (required, filtered by profession)
- Department group picker (optional)
- GDPR consent modal (Terms + Privacy, required)
- "Complete Setup" button → `POST /auth/social/register` → store JWT/user → MainTabs

**Implementation:** Extract the picker and consent logic from `RegisterScreen` into a shared component (e.g., `ProfileForm`). Both `RegisterScreen` and `SocialRegistrationScreen` use `ProfileForm`. `RegisterScreen` stays the path for new email users. `SocialRegistrationScreen` is the path for new social users. The required/optional fields and the sentinel mapping stay aligned across both.

### 5. Navigation & Auth State

**File:** `mobile-app/src/navigation/AppNavigator.tsx`

The app should not introduce a new authenticated-but-incomplete user branch. The flow stays:

```
unauthenticated
  → existing email/social user signs in → authenticated → MainTabs / LockScreen
  → new email user → RegisterScreen → authenticated → MainTabs
  → new social user → SocialRegistrationScreen → authenticated → MainTabs
```

Add `SocialRegistrationScreen` to the auth/navigation flow, but keep the authenticated app routing unchanged. Session restore should only ever restore fully registered users.

### 6. TEST_MODE

**File:** `mobile-app/src/lib/testing/mockApi.ts`

Add mock responses:

```typescript
authAppleExistingUser: {
  status: 'authenticated',
  access_token: 'mock-jwt-token-e2e-apple-12345',
  token_type: 'bearer',
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  user_id: 'mock-user-id-apple-67890',
},

authAppleNewUser: {
  status: 'registration_required',
  social_registration_token: 'mock-social-registration-token-apple',
},

authGoogleExistingUser: {
  status: 'authenticated',
  access_token: 'mock-jwt-token-e2e-google-12345',
  token_type: 'bearer',
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  user_id: 'mock-user-id-google-67890',
},

authGoogleNewUser: {
  status: 'registration_required',
  social_registration_token: 'mock-social-registration-token-google',
},
```

Backend: when `TEST_MODE` env var is set, skip provider JWT verification and accept any token with a hardcoded `sub`.

---

## Configuration Checklist

### Apple Developer Portal
- [ ] Enable "Sign in with Apple" capability for app ID `com.openworkinghours.mobileapp`
- [ ] Verify whether associated domains entitlement is required for native sign-in (likely not)
- [ ] Configure email relay (deferred — not needed for launch)

### Google Cloud Console
- [ ] Create **Android** OAuth client ID for `com.openworkinghours.mobileapp` (SHA-256 fingerprint of signing key)
- [ ] Create **Web/Server** OAuth client ID (used by backend for audience verification)
- [ ] Configure OAuth consent screen
- [ ] Document which client ID goes where: Android ID → mobile config, Web ID → backend env

### Backend Server (Hetzner)
- [ ] Add to env/settings: Apple bundle ID (`com.openworkinghours.mobileapp`), Google Web client ID
- [ ] Promote `httpx` from dev to runtime dependency
- [ ] Verify whether `/.well-known/apple-app-site-association` is required; if so, serve via nginx
- [ ] Verify whether `/.well-known/assetlinks.json` is required; if so, serve via nginx
- [ ] Implement TTL cache for provider public keys (avoid fetching on every auth request)

### Expo / app.json
- [ ] Add `expo-apple-authentication` plugin config to `ios` section
- [ ] Add Google client IDs to `extra` config
- [ ] Rebuild development clients (`expo run:ios`, `expo run:android`)

---

## Testing Strategy

### Backend Tests

| Test case | What it verifies |
|-----------|-----------------|
| Apple login for existing linked user | `POST /auth/apple` with valid token → existing User reused, JWT issued |
| Google login for existing linked user | `POST /auth/google` with valid token → existing User reused, JWT issued |
| Apple login for first-time user | `POST /auth/apple` with valid token → `registration_required`, no partial User row created |
| Google login for first-time user | `POST /auth/google` with valid token → `registration_required`, no partial User row created |
| Returning Apple login reuses account | Same `sub` → same `user_id`, no duplicate |
| Returning Google login reuses account | Same `sub` → same `user_id`, no duplicate |
| Invalid/expired provider token rejected | 401 response, no user created |
| Social registration writes all fields | `POST /auth/social/register` → legacy fields + v2 taxonomy + consent all populated |
| Delete social-auth user | `DELETE /auth/me` → user + work_events deleted, no crash on NULL `email_hash` |
| Existing email flow unchanged | `/auth/login` + `/auth/register` behavior and schema remain compatible |

### Mobile / E2E Tests

| Test case | What it verifies |
|-----------|-----------------|
| TEST_MODE Apple login, existing user | Mock authenticated response → user stored → MainTabs |
| TEST_MODE Apple login, new user | Mock registration-required response → routed to SocialRegistrationScreen |
| TEST_MODE Google login, existing user | Mock authenticated response → user stored → MainTabs |
| TEST_MODE Google login, new user | Mock registration-required response → routed to SocialRegistrationScreen |
| Social registration flow | Fill the same required pickers as email registration → accept consent → complete → routed to MainTabs |
| Session restore completed user | Returning user → restored to MainTabs directly |
| Email login still works | "Sign in with email" → existing flow → MainTabs |
| Email registration still works | New email user still completes the current required registration form |
| Auth state transitions | unauthenticated → authenticated → locked → unlocked |

---

## What Does NOT Change

- `user_id` (UUID) — internal identity key, used by entire DP pipeline
- JWT issuance/verification — same `create_user_access_token()` / `verify_user_access_token()`
- `get_current_user()` dependency — only checks JWT, doesn't care how it was issued
- DP pipeline — `user_privacy_ledger`, `finalized_user_weeks`, k-anonymity grouping — all keyed on `user_id`
- LockScreen / biometric flow
- Email-code auth flow (kept as-is, visually deprioritized on WelcomeScreen)
- The minimum registration strictness for entering the main app
- Optional-field semantics such as "Other" / `not_specified`
- Work event submission
- Geofencing

---

## Privacy Policy Update

Add to privacy policy before WhatsApp launch:

> **Sign in with Apple / Google:** When you use Sign in with Apple or Sign in with Google, the respective provider processes your authentication. Apple/Google learn that you use Open Working Hours. We receive only an opaque, app-specific identifier — not your name or email address. You can also sign in with email if you prefer not to use a platform account.
>
> **Google Sign-In:** During authentication, Google transmits your email address to our server. We do not store it. We store only the opaque identifier (`sub`) from Google's token.

---

## Open Items / Future

- **Apple email relay**: Set up domain verification with Apple to enable sending to `@privaterelay.appleid.com` addresses. Needed if we want to email Apple-auth users (breach notifications, feature announcements). Not needed for launch.
- **Account linking**: Not supported. Separate accounts per provider. Would require matching on a shared attribute (email), which defeats the privacy goal. Deferred indefinitely.
- **Apple server-to-server notifications**: Apple can POST events when a user revokes app access or deletes their Apple ID. Without this, a revoked user's JWT stays valid until expiry (30 days), then they're bounced to WelcomeScreen where re-authorization restores the same account. Implement if revocation becomes a real issue; not needed for launch.
- **Passkeys**: Could add as a third auth method later (medium-term). Uses `react-native-passkey` + `py_webauthn`. Provides cross-platform privacy-preserving auth without platform dependency.
- **eIDAS 2.0 / EUDI Wallet**: Monitor for German healthcare Verifiable Credentials (2027+). Would enable VC-attested profession/state — stronger than self-reported data.
