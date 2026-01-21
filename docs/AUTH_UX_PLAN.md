# Authentication UX Improvements Plan

**Created:** 2026-01-19
**Status:** Complete
**Approach:** Incremental improvements - email fix, streamlined flow, biometric unlock

---

## 1. Vision

Make returning users' login experience seamless:
- **Email preview shows code immediately** (no need to open email)
- **Single verification code** instead of double verification
- **Biometric unlock** (Face ID/Touch ID) eliminates codes entirely on trusted devices

---

## 2. Problem Statement

### Current Pain Points

1. **Email preview doesn't show code** — Code appears on line 4, past the ~100 character preview cutoff
2. **Double verification flow** — Returning users must:
   - Enter code #1 in EmailVerificationScreen
   - Enter code #2 in LoginScreen (redundant)
3. **No persistent authentication** — After 30-day token expiry, users repeat the full flow

### Root Cause Analysis

The `/auth/login` endpoint already validates verification codes, making EmailVerificationScreen redundant for returning users. The flow was designed for new user registration but applied uniformly to all users.

---

## 3. Phases

### Phase 1: Email Preview Fix (Quick Win)
- [x] Move verification code to first line of email body
- [x] Simplify email text for clarity
- [ ] Deploy to production

### Phase 2: Streamlined Login Flow
- [x] Add WelcomeScreen with "Log In" / "Create Account" choice
- [x] Route returning users directly to LoginScreen (single code)
- [x] Keep EmailVerificationScreen for new user registration only
- [x] Add i18n strings (EN/DE)

### Phase 3: Biometric Unlock
- [x] Install `expo-local-authentication`
- [x] Create BiometricService
- [x] Integrate into auth-context (biometric gate before session restore)
- [x] Add Settings toggle
- [x] Add iOS Face ID usage description
- [x] Add i18n strings (EN/DE)

---

## 4. Phase 1 Specifications

### 4.1 Current vs New Email Body

**Current:**
```
Hello,

Please verify your hospital affiliation using the information below. The code is valid for 15 minutes.

Verification code: 123456

If you did not request this, you can ignore this email.
```

**New:**
```
Your code is 123456

Use this code to log in to Open Working Hours. Valid for 15 minutes.

If you did not request this, you can ignore this email.
```

### 4.2 Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| P1-01 | Email preview shows "Your code is XXXXXX" | Check inbox preview |
| P1-02 | Code still works for login | Manual login test |
| P1-03 | Code still works for registration | Manual registration test |

### 4.3 Files to Modify

| File | Change |
|------|--------|
| `backend/app/email.py` | Update `send_verification_email()` template |
| `backend/app/routers/verification.py` | Simplify content passed to email function |

---

## 5. Phase 2 Specifications

### 5.1 New Auth Flow

```
App Launch
    │
    ▼
Token valid? ──Yes──► MainTabs (Status/Calendar/Settings)
    │
    No
    ▼
WelcomeScreen
    │
    ├── "Log In" ──────► LoginScreen ──► Enter email ──► Request code
    │                                         │              │
    │                                         ▼              ▼
    │                                    Enter code ◄── Receive email
    │                                         │
    │                                         ▼
    │                                    Logged in ──► MainTabs
    │
    └── "Create Account" ──► EmailVerificationScreen ──► RegisterScreen ──► MainTabs
```

### 5.2 Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| P2-01 | Fresh install shows WelcomeScreen | Manual test |
| P2-02 | "Log In" goes to LoginScreen directly | Manual test |
| P2-03 | LoginScreen flow: email → code → logged in (ONE code) | Manual test |
| P2-04 | "Create Account" goes to EmailVerificationScreen | Manual test |
| P2-05 | Registration flow unchanged | Manual test |
| P2-06 | All strings available in EN and DE | i18n check |

### 5.3 Files to Modify

| File | Change |
|------|--------|
| `mobile-app/src/navigation/AppNavigator.tsx` | Add WelcomeScreen to AuthStack |
| `mobile-app/src/modules/auth/screens/WelcomeScreen.tsx` | New file |
| `mobile-app/src/lib/i18n/translations/en.ts` | Add welcome screen strings |
| `mobile-app/src/lib/i18n/translations/de.ts` | Add welcome screen strings |

### 5.4 WelcomeScreen Design

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│       Open Working Hours           │
│                                    │
│   Track your shifts. Protect       │
│   your privacy.                    │
│                                    │
│                                    │
│   ┌────────────────────────────┐   │
│   │         Log In             │   │
│   └────────────────────────────┘   │
│                                    │
│   ┌────────────────────────────┐   │
│   │     Create Account         │   │
│   └────────────────────────────┘   │
│                                    │
│                                    │
└────────────────────────────────────┘
```

---

## 6. Phase 3 Specifications

### 6.1 Biometric Flow

```
App Launch
    │
    ▼
Token exists & valid?
    │
    ├── No ──► WelcomeScreen (normal flow)
    │
    Yes
    │
    ▼
Biometric enabled?
    │
    ├── No ──► Restore session ──► MainTabs
    │
    Yes
    │
    ▼
Prompt biometric
    │
    ├── Success ──► Restore session ──► MainTabs
    │
    └── Failure ──► Clear session ──► WelcomeScreen
```

### 6.2 Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| P3-01 | Settings shows biometric toggle (when available) | Manual test |
| P3-02 | Toggle hidden on devices without biometrics | Simulator test |
| P3-03 | Enabling requires successful biometric auth first | Manual test |
| P3-04 | App launch prompts biometric when enabled | Manual test |
| P3-05 | Successful biometric unlocks app | Manual test |
| P3-06 | Failed biometric shows login screen | Manual test |
| P3-07 | Face ID permission prompt shows correct reason | Manual test |
| P3-08 | All strings available in EN and DE | i18n check |

### 6.3 Files to Create/Modify

| File | Change |
|------|--------|
| `mobile-app/package.json` | Add `expo-local-authentication` |
| `mobile-app/src/lib/auth/BiometricService.ts` | New file - biometric utilities |
| `mobile-app/src/lib/auth/auth-context.tsx` | Add biometric check in restoreAuth |
| `mobile-app/src/modules/geofencing/screens/SettingsScreen.tsx` | Add biometric toggle |
| `mobile-app/app.json` | Add `NSFaceIDUsageDescription` |
| `mobile-app/src/lib/i18n/translations/en.ts` | Add biometric strings |
| `mobile-app/src/lib/i18n/translations/de.ts` | Add biometric strings |

### 6.4 BiometricService API

```typescript
// mobile-app/src/lib/auth/BiometricService.ts

export class BiometricService {
  // Check device capability
  static async isAvailable(): Promise<boolean>;

  // Check user has enrolled (Face ID configured, etc.)
  static async isEnrolled(): Promise<boolean>;

  // Get type for display: "Face ID" | "Touch ID" | "Biometrics"
  static async getBiometricType(): Promise<string>;

  // Prompt authentication
  static async authenticate(reason?: string): Promise<boolean>;

  // App preference (stored in SecureStore)
  static async isEnabled(): Promise<boolean>;
  static async setEnabled(enabled: boolean): Promise<void>;
}
```

### 6.5 iOS Configuration

```json
// app.json addition
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID to quickly unlock Open Working Hours"
      }
    }
  }
}
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Biometric data storage | Never stored by app; handled by OS |
| Credential security | JWT stored in SecureStore (encrypted) |
| Biometric bypass | Biometric gates access to stored token, not authentication itself |
| Device without biometrics | Falls back to normal email code flow |
| Failed biometric | Clears session, requires full login |

---

## 8. i18n Strings Required

### English (en.ts)

```typescript
welcome: {
  title: 'Open Working Hours',
  subtitle: 'Track your shifts. Protect your privacy.',
  logIn: 'Log In',
  createAccount: 'Create Account',
},
biometric: {
  settingsTitle: 'Use Face ID', // or Touch ID based on device
  settingsDescription: 'Unlock the app with Face ID',
  promptReason: 'Unlock Open Working Hours',
  enableFailed: 'Could not enable Face ID. Please try again.',
  notAvailable: 'Biometric authentication is not available on this device.',
  notEnrolled: 'Please set up Face ID in your device settings first.',
},
```

### German (de.ts)

```typescript
welcome: {
  title: 'Open Working Hours',
  subtitle: 'Schichten erfassen. Privatsphäre schützen.',
  logIn: 'Anmelden',
  createAccount: 'Konto erstellen',
},
biometric: {
  settingsTitle: 'Face ID verwenden',
  settingsDescription: 'App mit Face ID entsperren',
  promptReason: 'Open Working Hours entsperren',
  enableFailed: 'Face ID konnte nicht aktiviert werden. Bitte erneut versuchen.',
  notAvailable: 'Biometrische Authentifizierung ist auf diesem Gerät nicht verfügbar.',
  notEnrolled: 'Bitte richten Sie zuerst Face ID in den Geräteeinstellungen ein.',
},
```

---

## 9. Testing Plan

### Phase 1 Testing
1. Request verification code via app
2. Check email preview in inbox (without opening)
3. Verify code visible in preview
4. Complete login with code

### Phase 2 Testing
1. Fresh install → WelcomeScreen appears
2. Tap "Log In" → LoginScreen (not EmailVerification)
3. Enter email → receive single code → enter code → logged in
4. Sign out → WelcomeScreen
5. Tap "Create Account" → EmailVerificationScreen → complete registration

### Phase 3 Testing
1. Log in normally, go to Settings
2. Enable biometric toggle (prompts biometric)
3. Close app completely
4. Reopen → biometric prompt appears
5. Authenticate → app unlocks to MainTabs
6. Disable biometric in Settings
7. Close and reopen → no prompt, direct to MainTabs
8. Test on device without biometrics → toggle not shown

---

## 10. Rollout Plan

| Phase | Deploy | Rollback Plan |
|-------|--------|---------------|
| Phase 1 | Backend only (immediate) | Revert email.py |
| Phase 2 | App update via TestFlight | Previous build still works |
| Phase 3 | App update via TestFlight | Biometric is optional, disable in Settings |

---

## 11. Open Questions

None currently.

---

## 12. References

- [expo-local-authentication docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [expo-secure-store docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Existing auth code: `mobile-app/src/lib/auth/`
- Backend verification: `backend/app/routers/verification.py`
