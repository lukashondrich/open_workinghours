# In-App Consent & Terms Acceptance Flow

**Version:** 1.1
**Date:** January 2026; updated 2026-06-04
**Status:** Implemented; retained as behavior specification

---

## 1. Overview

This document specifies how the mobile app should collect user consent for Terms of Service and Privacy Policy acceptance. This is required to establish the legal basis for processing (Contract + Consent).

---

## 2. Requirements

### 2.1 Legal Requirements (GDPR)

- Consent must be **freely given** (user can decline)
- Consent must be **specific** (clear what they're agreeing to)
- Consent must be **informed** (access to full policies)
- Consent must be **unambiguous** (clear affirmative action)
- Consent must be **documented** (record of when consent was given)

### 2.2 When to Show Consent

The consent screen must appear:
1. **During registration** - After email verification, before profile completion
2. **On policy update** - When Terms or Privacy Policy materially change
3. **For legacy records** - When the backend user has missing consent versions or no consent timestamp

### 2.3 What User Must Agree To

1. **Terms of Service** - Contract for using the service
2. **Privacy Policy** - How data is processed
3. **Aggregation Consent** - Contribution to anonymized statistics (can be explained as part of Terms)

---

## 3. User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     REGISTRATION FLOW                            │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
     │   Enter      │     │   Enter      │     │   Consent    │
     │   Email      │────▶│   Code       │────▶│   Screen     │
     │              │     │              │     │   (NEW)      │
     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                      │
                                               User accepts
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │   Profile    │
                                              │   Setup      │
                                              └──────────────┘
```

---

## 4. Consent Screen Design

### 4.1 Screen Layout

```
┌─────────────────────────────────────────┐
│                                         │
│   Open Working Hours                    │
│                                         │
│   ─────────────────────────────────     │
│                                         │
│   Before you continue, please review    │
│   and accept our terms:                 │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │  📋 Terms of Service            │   │
│   │  What you agree to when using   │   │
│   │  the app                        │   │
│   │                        [Read →] │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │  🔒 Privacy Policy              │   │
│   │  How we protect and use         │   │
│   │  your data                      │   │
│   │                        [Read →] │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ─────────────────────────────────     │
│                                         │
│   Key points:                           │
│   • Your working hours contribute to    │
│     anonymized statistics (groups of    │
│     5+ only)                            │
│   • GPS coordinates stay on your device │
│   • You can delete your account and     │
│     all data anytime                    │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ ☑️ I have read and accept the   │   │
│   │    Terms of Service and         │   │
│   │    Privacy Policy               │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │         Continue                │   │
│   └─────────────────────────────────┘   │
│                                         │
│   By continuing, you agree to your      │
│   data being used as described in the   │
│   Privacy Policy.                       │
│                                         │
└─────────────────────────────────────────┘
```

### 4.2 German Version

```
┌─────────────────────────────────────────┐
│                                         │
│   Open Working Hours                    │
│                                         │
│   ─────────────────────────────────     │
│                                         │
│   Bevor du fortfährst, lies bitte       │
│   unsere Bedingungen:                   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │  📋 Nutzungsbedingungen         │   │
│   │  Was du bei der Nutzung der     │   │
│   │  App akzeptierst                │   │
│   │                       [Lesen →] │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │  🔒 Datenschutzerklärung        │   │
│   │  Wie wir deine Daten schützen   │   │
│   │  und verwenden                  │   │
│   │                       [Lesen →] │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ─────────────────────────────────     │
│                                         │
│   Wichtige Punkte:                      │
│   • Deine Arbeitszeiten fließen in      │
│     anonymisierte Statistiken ein       │
│     (nur Gruppen ab 5 Personen)         │
│   • GPS-Koordinaten bleiben auf         │
│     deinem Gerät                        │
│   • Du kannst dein Konto und alle       │
│     Daten jederzeit löschen             │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ ☑️ Ich habe die Nutzungs-       │   │
│   │    bedingungen und Datenschutz- │   │
│   │    erklärung gelesen und        │   │
│   │    akzeptiere sie               │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │         Weiter                  │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Mit dem Fortfahren stimmst du der     │
│   Datenverwendung gemäß der Datenschutz-│
│   erklärung zu.                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 5. Implementation Details

### 5.1 State Management

Add to auth flow state:
```typescript
interface AuthState {
  // ... existing fields
  termsAccepted: boolean;
  termsAcceptedAt: string | null;  // ISO timestamp
  termsVersion: string | null;      // e.g., "2026-01"
}
```

### 5.2 Local Storage

Store consent record on device:
```typescript
interface ConsentRecord {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;  // ISO timestamp
}

// Store in AsyncStorage or SecureStore
await AsyncStorage.setItem('consentRecord', JSON.stringify(consentRecord));
```

### 5.3 Backend Integration

Implemented behavior: **Store consent on backend**
- Store `terms_accepted_version`, `privacy_accepted_version`, and `consent_accepted_at` in `users`
- Update on registration and on policy updates
- Provides the audit trail required to demonstrate consent

```sql
ALTER TABLE users ADD COLUMN terms_accepted_version TEXT;
ALTER TABLE users ADD COLUMN privacy_accepted_version TEXT;
ALTER TABLE users ADD COLUMN consent_accepted_at TIMESTAMP;
```

Rejected alternative: **Local only**
- Store consent record on device
- Simpler but no server-side audit trail, so it does not satisfy the current compliance posture

### 5.4 Navigation Logic

```typescript
// In AuthNavigator or AppNavigator
function getInitialRoute(authState: AuthState): string {
  if (!authState.isAuthenticated) {
    return 'Login';
  }

  if (!authState.termsAccepted || needsTermsUpdate(authState.termsVersion)) {
    return 'ConsentScreen';
  }

  if (!authState.profileComplete) {
    return 'ProfileSetup';
  }

  return 'Home';
}

function needsTermsUpdate(userVersion: string | null): boolean {
  const CURRENT_TERMS_VERSION = '2026-05';
  return userVersion !== CURRENT_TERMS_VERSION;
}
```

### 5.5 Consent Screen Component

```typescript
// src/modules/auth/screens/ConsentScreen.tsx

export function ConsentScreen() {
  const [accepted, setAccepted] = useState(false);
  const { t } = useTranslation();

  const handleContinue = async () => {
    if (!accepted) return;

    const consentRecord = {
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
    };

    // Store locally
    await AsyncStorage.setItem('consentRecord', JSON.stringify(consentRecord));

    // Update backend audit record
    await api.updateConsent(consentRecord);

    // Navigate to profile setup
    navigation.replace('ProfileSetup');
  };

  return (
    <SafeAreaView>
      <ScrollView>
        <Text style={styles.title}>{t('consent.title')}</Text>
        <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>

        <TouchableOpacity onPress={() => openURL(TERMS_URL)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('consent.terms.title')}</Text>
            <Text style={styles.cardDescription}>{t('consent.terms.description')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => openURL(PRIVACY_URL)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('consent.privacy.title')}</Text>
            <Text style={styles.cardDescription}>{t('consent.privacy.description')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.keyPoints}>
          <Text style={styles.keyPointsTitle}>{t('consent.keyPoints.title')}</Text>
          {/* Key points list */}
        </View>

        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setAccepted(!accepted)}
        >
          <Checkbox checked={accepted} />
          <Text>{t('consent.checkbox')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !accepted && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!accepted}
        >
          <Text>{t('consent.continue')}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>{t('consent.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

### 5.6 Translation Keys

```typescript
// Add to en.ts
consent: {
  title: 'Open Working Hours',
  subtitle: 'Before you continue, please review and accept our terms:',
  terms: {
    title: 'Terms of Service',
    description: 'What you agree to when using the app',
    read: 'Read →',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How we protect and use your data',
    read: 'Read →',
  },
  keyPoints: {
    title: 'Key points:',
    point1: 'Your working hours contribute to anonymized statistics (groups of 5+ only)',
    point2: 'GPS coordinates stay on your device',
    point3: 'You can delete your account and all data anytime',
  },
  checkbox: 'I have read and accept the Terms of Service and Privacy Policy',
  continue: 'Continue',
  footer: 'By continuing, you agree to your data being used as described in the Privacy Policy.',
},

// Add to de.ts
consent: {
  title: 'Open Working Hours',
  subtitle: 'Bevor du fortfährst, lies bitte unsere Bedingungen:',
  terms: {
    title: 'Nutzungsbedingungen',
    description: 'Was du bei der Nutzung der App akzeptierst',
    read: 'Lesen →',
  },
  privacy: {
    title: 'Datenschutzerklärung',
    description: 'Wie wir deine Daten schützen und verwenden',
    read: 'Lesen →',
  },
  keyPoints: {
    title: 'Wichtige Punkte:',
    point1: 'Deine Arbeitszeiten fließen in anonymisierte Statistiken ein (nur Gruppen ab 5 Personen)',
    point2: 'GPS-Koordinaten bleiben auf deinem Gerät',
    point3: 'Du kannst dein Konto und alle Daten jederzeit löschen',
  },
  checkbox: 'Ich habe die Nutzungsbedingungen und Datenschutzerklärung gelesen und akzeptiere sie',
  continue: 'Weiter',
  footer: 'Mit dem Fortfahren stimmst du der Datenverwendung gemäß der Datenschutzerklärung zu.',
},
```

---

## 6. Policy Update Flow

When Terms or Privacy Policy are updated:

1. Increment version constant in app
2. After login, token restore, or biometric unlock, check whether backend consent versions and `consentAcceptedAt` match the current versions
3. If consent is missing, stale, or missing the audit timestamp, show the consent bottom sheet again
4. Keep normal app screens and queued finalization blocked until the user re-accepts
5. On acceptance, call `POST /auth/consent`, then refresh `/auth/me` before rendering the app

**May 2026 consolidated policy update:** The consent versions are `CURRENT_TERMS_VERSION = "2026-05"` and `CURRENT_PRIVACY_VERSION = "2026-05"`. This corresponds to the consolidated privacy-policy rewrite and profile/hospital-affiliation disclosure changes. Users with older versions, null versions, or no `consentAcceptedAt` timestamp see the re-acceptance bottom sheet on next authenticated app open.

---

## 7. Links to Policies

The consent screen should link to:
- Terms: `https://openworkinghours.org/terms` (EN) or `/de/terms` (DE)
- Privacy: `https://openworkinghours.org/app-privacy-policy` (EN) or `/de/app-privacy-policy` (DE)

Use WebView or system browser to open.

---

## 8. Testing Checklist

- [ ] Consent screen appears after email verification
- [ ] Cannot proceed without checking the checkbox
- [ ] Links to Terms and Privacy work correctly
- [ ] Correct language shown based on device locale
- [ ] Consent record is stored locally
- [ ] Consent record is stored on backend
- [ ] Returning user with valid consent skips consent screen
- [ ] User with outdated consent version sees consent screen again
- [ ] User with null backend consent fields sees consent screen again
- [ ] App main UI and queued finalization remain blocked until re-acceptance
- [ ] Checkbox state persists during navigation/rotation

---

## 9. Future Considerations

- **Granular consent**: If future features require separate consent, add additional checkboxes
- **Consent withdrawal**: Currently handled via account deletion; consider explicit withdrawal option
- **Consent audit log**: Backend could log all consent events for compliance
