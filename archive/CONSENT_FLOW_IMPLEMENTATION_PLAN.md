# Consent Flow Implementation Plan

**Created:** 2026-01-07
**Status:** Planning
**Goal:** Implement GDPR-compliant consent flow with excellent user experience

---

## Part 1: Detailed Implementation Plan

### 1.1 Current Flow Analysis

```
Current Registration Flow:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Email           │     │ Enter           │     │ Register        │
│ Verification    │────▶│ 6-digit Code    │────▶│ (Profile Setup) │────▶ Main App
│                 │     │                 │     │ + Privacy Note  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Current Issues:**
- Privacy notice is informational only (not legally binding consent)
- No explicit acceptance action required
- No links to full Terms/Privacy Policy
- No consent timestamp recorded
- No consent versioning for policy updates

### 1.2 Proposed Flow Options

#### Option A: Separate Consent Screen (Before Profile)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Email           │     │ Enter           │     │ Consent         │     │ Register        │
│ Verification    │────▶│ 6-digit Code    │────▶│ Screen          │────▶│ (Profile Setup) │────▶ Main App
│                 │     │                 │     │ (NEW)           │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Pros:**
- Clear separation of legal acceptance from profile data entry
- User focuses on one task at a time
- Easy to show consent screen again on policy updates

**Cons:**
- Adds one more screen to onboarding (friction)
- May feel bureaucratic

#### Option B: Integrated Consent (Part of Register Screen)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────────┐
│ Email           │     │ Enter           │     │ Register Screen                 │
│ Verification    │────▶│ 6-digit Code    │────▶│ - Profile fields                │────▶ Main App
│                 │     │                 │     │ - Terms/Privacy checkbox (NEW)  │
└─────────────────┘     └─────────────────┘     │ - Key points summary (NEW)      │
                                                └─────────────────────────────────┘
```

**Pros:**
- Fewer screens, faster onboarding
- Single action to complete registration

**Cons:**
- Screen becomes crowded
- Legal consent may feel like an afterthought
- Harder to handle policy update re-consent

#### Option C: Progressive Disclosure Modal (Recommended)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Email           │     │ Enter           │     │ Register        │
│ Verification    │────▶│ 6-digit Code    │────▶│ (Profile Setup) │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                User taps "Create Account"
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Consent Modal   │
                                                │ (Bottom Sheet)  │────▶ Main App
                                                │                 │
                                                └─────────────────┘
```

**Pros:**
- Profile entry feels lightweight
- Legal consent is clearly separate but not a whole new screen
- Modal draws attention to the importance of consent
- Can be re-shown easily on policy updates
- Smooth animation makes it feel less bureaucratic

**Cons:**
- Slightly more complex implementation
- User might be surprised by modal after tapping "Create"

---

### 1.3 Recommended Approach: Option C with Enhancements

We recommend **Option C** with these UX enhancements:

1. **Pre-announce the consent step** on the Register screen
2. **Use a bottom sheet modal** (feels native, less intrusive than full screen)
3. **Show only key points** in modal, with links to full docs
4. **Single checkbox** for combined Terms + Privacy acceptance
5. **"I Agree" button** as clear affirmative action

### 1.4 Detailed Screen Designs

#### 1.4.1 Register Screen (Modified)

Changes to existing `RegisterScreen.tsx`:

```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│  Complete Your Profile                  │
│  Step 2 of 2                            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Email (read-only)               │   │
│  │ user@example.com                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Federal State (Bundesland)  ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Medical Specialty           ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Role Level                  ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │       Create Account            │   │  ← Button text unchanged
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  By continuing, you'll review our       │  ← NEW: Pre-announcement
│  Terms and Privacy Policy               │
│                                         │
└─────────────────────────────────────────┘
```

#### 1.4.2 Consent Bottom Sheet Modal (New)

Triggered when user taps "Create Account":

```
┌─────────────────────────────────────────┐
│                                         │
│  ━━━━━━━━━━  (drag handle)              │
│                                         │
│  Before you start                       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📋 Terms of Service                    │
│     Your agreement with us         →    │  ← Tappable, opens WebView
│                                         │
│  🔒 Privacy Policy                      │
│     How we protect your data       →    │  ← Tappable, opens WebView
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  In short:                              │
│                                         │
│  ✓ Your hours contribute to anonymous   │
│    statistics (groups of 10+ only)      │
│                                         │
│  ✓ GPS coordinates never leave          │
│    your device                          │
│                                         │
│  ✓ Delete your account and all          │
│    data anytime                         │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ☐ I agree to the Terms of       │   │
│  │   Service and Privacy Policy    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │       I Agree & Continue        │   │  ← Disabled until checked
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### 1.4.3 Policy Update Re-consent Screen

For existing users when Terms/Privacy Policy are updated:

```
┌─────────────────────────────────────────┐
│                                         │
│  ━━━━━━━━━━  (drag handle)              │
│                                         │
│  We've updated our terms                │
│                                         │
│  We've made some changes to our         │
│  Terms of Service and Privacy Policy.   │
│  Please review and accept to continue.  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📋 Terms of Service                    │
│     Updated January 2026           →    │
│                                         │
│  🔒 Privacy Policy                      │
│     Updated January 2026           →    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  What changed:                          │
│  • [Brief summary of changes]           │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ☐ I agree to the updated Terms  │   │
│  │   and Privacy Policy            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │       I Agree & Continue        │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

### 1.5 Technical Implementation

#### 1.5.1 New Files to Create

```
mobile-app/src/
├── modules/auth/
│   ├── components/
│   │   └── ConsentBottomSheet.tsx    (NEW)
│   └── screens/
│       └── ConsentScreen.tsx         (NEW - for policy updates)
├── lib/auth/
│   ├── consent-storage.ts            (NEW)
│   └── consent-types.ts              (NEW)
└── lib/i18n/translations/
    ├── en.ts                         (UPDATE - add consent keys)
    └── de.ts                         (UPDATE - add consent keys)
```

#### 1.5.2 Consent Types

```typescript
// lib/auth/consent-types.ts

export interface ConsentRecord {
  termsVersion: string;      // e.g., "2026-01"
  privacyVersion: string;    // e.g., "2026-01"
  acceptedAt: string;        // ISO 8601 timestamp
}

export const CURRENT_TERMS_VERSION = '2026-01';
export const CURRENT_PRIVACY_VERSION = '2026-01';

export function needsConsent(record: ConsentRecord | null): boolean {
  if (!record) return true;
  return (
    record.termsVersion !== CURRENT_TERMS_VERSION ||
    record.privacyVersion !== CURRENT_PRIVACY_VERSION
  );
}
```

#### 1.5.3 Consent Storage

```typescript
// lib/auth/consent-storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConsentRecord } from './consent-types';

const CONSENT_KEY = 'user_consent';

export const ConsentStorage = {
  async save(record: ConsentRecord): Promise<void> {
    await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  },

  async get(): Promise<ConsentRecord | null> {
    const data = await AsyncStorage.getItem(CONSENT_KEY);
    return data ? JSON.parse(data) : null;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(CONSENT_KEY);
  },
};
```

#### 1.5.4 Auth State Extension

Add to `auth-types.ts`:

```typescript
export interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  token: string | null;
  expiresAt: Date | null;
  // NEW
  consentRecord: ConsentRecord | null;
  needsConsentUpdate: boolean;
}
```

#### 1.5.5 Navigation Logic Update

In `AppNavigator.tsx`, add consent check:

```typescript
function getAuthenticatedComponent(authState: AuthState) {
  // Check if user needs to re-consent to updated policies
  if (authState.needsConsentUpdate) {
    return <ConsentScreen mode="update" />;
  }
  return <MainTabs />;
}
```

#### 1.5.6 ConsentBottomSheet Component

```typescript
// modules/auth/components/ConsentBottomSheet.tsx

interface ConsentBottomSheetProps {
  visible: boolean;
  onAccept: () => void;
  onCancel: () => void;
  mode: 'initial' | 'update';
}

export function ConsentBottomSheet({ visible, onAccept, onCancel, mode }: ConsentBottomSheetProps) {
  const [accepted, setAccepted] = useState(false);
  const { t, locale } = useTranslation();

  const termsUrl = locale === 'de'
    ? 'https://openworkinghours.org/de/terms'
    : 'https://openworkinghours.org/terms';

  const privacyUrl = locale === 'de'
    ? 'https://openworkinghours.org/de/app-privacy-policy'
    : 'https://openworkinghours.org/app-privacy-policy';

  const openUrl = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={styles.title}>
        {mode === 'initial' ? t('consent.title') : t('consent.updateTitle')}
      </Text>

      {/* Policy links */}
      <TouchableOpacity onPress={() => openUrl(termsUrl)}>
        <PolicyCard icon="📋" title={t('consent.terms.title')} />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => openUrl(privacyUrl)}>
        <PolicyCard icon="🔒" title={t('consent.privacy.title')} />
      </TouchableOpacity>

      {/* Key points */}
      <View style={styles.keyPoints}>
        <Text style={styles.keyPointsTitle}>{t('consent.keyPoints.title')}</Text>
        <KeyPoint text={t('consent.keyPoints.aggregation')} />
        <KeyPoint text={t('consent.keyPoints.gpsLocal')} />
        <KeyPoint text={t('consent.keyPoints.deletion')} />
      </View>

      {/* Checkbox */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => setAccepted(!accepted)}
      >
        <Checkbox checked={accepted} />
        <Text style={styles.checkboxText}>{t('consent.checkbox')}</Text>
      </TouchableOpacity>

      {/* Accept button */}
      <Button
        title={t('consent.accept')}
        onPress={onAccept}
        disabled={!accepted}
      />
    </BottomSheet>
  );
}
```

#### 1.5.7 Register Screen Modification

```typescript
// In RegisterScreen.tsx

const [showConsent, setShowConsent] = useState(false);

const handleCreateAccount = () => {
  // Validate form first
  if (!validateForm()) return;

  // Show consent modal instead of immediately registering
  setShowConsent(true);
};

const handleConsentAccepted = async () => {
  setShowConsent(false);

  // Record consent
  const consentRecord: ConsentRecord = {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  // Now proceed with registration
  await handleRegister(consentRecord);
};

const handleRegister = async (consentRecord: ConsentRecord) => {
  setLoading(true);
  try {
    const result = await AuthService.register({
      email,
      hospitalId,
      specialty,
      roleLevel,
      stateCode,
      consentRecord, // Send to backend
    });

    // Save consent locally as well
    await ConsentStorage.save(consentRecord);

    await signIn(result.user, result.token, result.expiresAt);
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};

return (
  <>
    {/* Existing form UI */}

    <ConsentBottomSheet
      visible={showConsent}
      onAccept={handleConsentAccepted}
      onCancel={() => setShowConsent(false)}
      mode="initial"
    />
  </>
);
```

#### 1.5.8 Backend API Extension

Add consent fields to registration endpoint:

```python
# In backend/app/schemas.py

class RegisterRequest(BaseModel):
    email: str
    hospital_id: str
    specialty: str
    role_level: str
    state_code: Optional[str] = None
    # NEW
    terms_version: Optional[str] = None
    privacy_version: Optional[str] = None
    consent_timestamp: Optional[datetime] = None
```

```python
# In backend/app/models.py

class User(Base):
    # ... existing fields
    terms_accepted_version = Column(String, nullable=True)
    privacy_accepted_version = Column(String, nullable=True)
    consent_accepted_at = Column(DateTime, nullable=True)
```

---

### 1.6 Translation Keys

```typescript
// en.ts additions
consent: {
  title: 'Before you start',
  updateTitle: 'We\'ve updated our terms',
  updateSubtitle: 'Please review and accept to continue.',
  terms: {
    title: 'Terms of Service',
    subtitle: 'Your agreement with us',
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How we protect your data',
  },
  keyPoints: {
    title: 'In short:',
    aggregation: 'Your hours contribute to anonymous statistics (groups of 10+ only)',
    gpsLocal: 'GPS coordinates never leave your device',
    deletion: 'Delete your account and all data anytime',
  },
  checkbox: 'I agree to the Terms of Service and Privacy Policy',
  accept: 'I Agree & Continue',
  preAnnounce: 'By continuing, you\'ll review our Terms and Privacy Policy',
},

// de.ts additions
consent: {
  title: 'Bevor du startest',
  updateTitle: 'Wir haben unsere Bedingungen aktualisiert',
  updateSubtitle: 'Bitte prüfe und akzeptiere, um fortzufahren.',
  terms: {
    title: 'Nutzungsbedingungen',
    subtitle: 'Deine Vereinbarung mit uns',
  },
  privacy: {
    title: 'Datenschutzerklärung',
    subtitle: 'Wie wir deine Daten schützen',
  },
  keyPoints: {
    title: 'Kurz gesagt:',
    aggregation: 'Deine Stunden fließen in anonyme Statistiken ein (nur Gruppen ab 10)',
    gpsLocal: 'GPS-Koordinaten verlassen dein Gerät nicht',
    deletion: 'Lösche dein Konto und alle Daten jederzeit',
  },
  checkbox: 'Ich stimme den Nutzungsbedingungen und der Datenschutzerklärung zu',
  accept: 'Ich stimme zu & weiter',
  preAnnounce: 'Mit dem Fortfahren prüfst du unsere Nutzungsbedingungen und Datenschutzerklärung',
},
```

---

### 1.7 Implementation Steps

| Step | Task | Effort |
|------|------|--------|
| 1 | Create consent types and storage | Small |
| 2 | Add consent fields to backend User model + migration | Small |
| 3 | Update AuthService and RegisterRequest | Small |
| 4 | Create ConsentBottomSheet component | Medium |
| 5 | Modify RegisterScreen to show consent modal | Medium |
| 6 | Add ConsentScreen for policy update flow | Medium |
| 7 | Update AppNavigator for consent check | Small |
| 8 | Add translations (EN + DE) | Small |
| 9 | Test full flow (new user + policy update) | Medium |
| 10 | Update auth-context to track consent state | Small |

---

## Part 2: Critical Review

### 2.1 UX Weaknesses

| Issue | Severity | Description |
|-------|----------|-------------|
| **Surprise modal** | Medium | User taps "Create Account" expecting to proceed, but gets a modal. May feel like bait-and-switch. |
| **Two-tap to complete** | Medium | User must: (1) tap Create Account, (2) check checkbox, (3) tap "I Agree". Three actions vs one. |
| **Document reading burden** | Low | Users rarely read full Terms/Privacy. Key points help but may not be enough for true informed consent. |
| **Modal dismissal unclear** | Medium | If user taps outside modal or swipes down, what happens? They stay on Register screen with no feedback. |
| **No progress indication** | Low | User doesn't know this is the final step before accessing the app. |
| **Checkbox + Button redundancy** | Low | Having both checkbox AND button is belt-and-suspenders. Some apps use only a button with text "I Agree to Terms". |
| **Policy update disruption** | Medium | Existing users get blocked by consent screen. Could feel jarring if they just want to log a shift. |
| **Offline scenario** | Medium | Links to Terms/Privacy require internet. What if user is offline? |
| **Long modal on small screens** | Medium | The modal content is lengthy. On smaller iPhones, it might require significant scrolling. |

### 2.2 Legal Weaknesses

| Issue | Severity | Description |
|-------|----------|-------------|
| **Bundled consent** | Medium | Single checkbox for Terms + Privacy. Some jurisdictions prefer separate consent for different purposes. |
| **Pre-checked danger** | Low | Design must ensure checkbox is NEVER pre-checked. Current plan is correct but implementation must be careful. |
| **Consent before seeing full docs** | Medium | Users can accept without opening the links. Is this truly "informed"? |
| **No consent withdrawal UI** | Low | Users can delete account, but no explicit "withdraw consent" option. |
| **Version tracking on device only** | Low | If user reinstalls app, consent record is lost. Backend is source of truth but local state could get out of sync. |

### 2.3 Technical Weaknesses

| Issue | Severity | Description |
|-------|----------|-------------|
| **Bottom sheet library** | Low | Need to choose/implement a bottom sheet. react-native-bottom-sheet or custom? |
| **WebBrowser dependency** | Low | Using expo-web-browser for links. Ensure it's in dependencies. |
| **Race condition** | Low | User could tap "I Agree" multiple times quickly, potentially sending multiple registration requests. |
| **Backend migration** | Low | Adding columns to users table requires Alembic migration. Existing users will have NULL consent fields. |
| **Consent state hydration** | Medium | On app launch, need to check both local storage AND backend for consent state. Which is authoritative? |
| **Localized URLs** | Low | URL construction for DE/EN terms relies on locale detection being correct. |

### 2.4 Edge Cases Not Addressed

1. **User cancels consent modal repeatedly** - Should there be a limit? Message?
2. **User opens Terms, doesn't come back** - WebBrowser.openBrowserAsync returns when browser closes, but user might get distracted
3. **Consent version mismatch** - What if local says "2026-01" but backend says "2025-12"? Which wins?
4. **Demo account** - Does demo account need consent? Probably should skip for App Store review
5. **Account recovery** - If user deletes and re-registers with same email, do they need fresh consent?

---

## Part 3: Fixes for Weaknesses

### 3.1 Fix: Surprise Modal → Pre-announce Better

**Problem:** User taps "Create Account" and is surprised by modal.

**Fix:** Change the button text and add clearer pre-announcement:

```
Before:
┌─────────────────────────────────┐
│       Create Account            │
└─────────────────────────────────┘
By continuing, you'll review our
Terms and Privacy Policy

After:
┌─────────────────────────────────┐
│   Review Terms & Create Account │
└─────────────────────────────────┘
One more step: review our Terms
and Privacy Policy
```

The button text now sets expectation that there's a review step.

### 3.2 Fix: Two-Tap Redundancy → Single Action Option

**Problem:** Checkbox + Button feels redundant.

**Fix Option A:** Remove checkbox, use descriptive button only:

```
┌─────────────────────────────────┐
│   I Agree to Terms & Privacy    │
│   Policy and Create Account     │
└─────────────────────────────────┘
```

**Fix Option B (Recommended):** Keep checkbox but make it feel purposeful:

```
┌─────────────────────────────────┐
│ ☐ I have read and agree to the │
│   Terms and Privacy Policy      │
└─────────────────────────────────┘

       [Create My Account]         ← Only enabled when checked
```

This maintains clear affirmative action (GDPR-friendly) while the button becomes the natural completion step.

### 3.3 Fix: Modal Dismissal → Explicit Cancel

**Problem:** Unclear what happens if user dismisses modal.

**Fix:** Add explicit cancel option and prevent accidental dismissal:

```typescript
<BottomSheet
  visible={showConsent}
  onClose={() => {}} // Prevent swipe-to-dismiss
  enablePanDownToClose={false} // Disable drag-to-dismiss
>
  {/* Content */}

  <TouchableOpacity onPress={() => setShowConsent(false)}>
    <Text style={styles.cancelText}>Cancel</Text>
  </TouchableOpacity>
</BottomSheet>
```

Show "Cancel" link at bottom of modal. User returns to Register screen.

### 3.4 Fix: Offline Scenario → Embedded Summaries

**Problem:** Links require internet.

**Fix:** Include embedded summary that's always visible, make full docs optional:

```
In short:
✓ Your hours contribute to anonymous statistics
✓ GPS coordinates stay on your device
✓ Delete your account anytime

Full documents (requires internet):
📋 Terms of Service →
🔒 Privacy Policy →
```

The key points ARE the informed consent. Full docs are for users who want detail.

### 3.5 Fix: Long Modal → Scrollable with Fixed Footer

**Problem:** Modal too long on small screens.

**Fix:** Fixed header and footer, scrollable middle:

```
┌─────────────────────────────────┐
│  Before you start               │  ← Fixed header
├─────────────────────────────────┤
│                                 │
│  [Scrollable content area]      │  ← Scrollable
│  - Policy links                 │
│  - Key points                   │
│                                 │
├─────────────────────────────────┤
│  ☐ I agree to Terms & Privacy   │  ← Fixed footer
│  [Create My Account]            │
└─────────────────────────────────┘
```

### 3.6 Fix: Policy Update Disruption → Soft Introduction

**Problem:** Existing users get blocked, feels jarring.

**Fix:** Show a non-blocking banner first, then require action:

```
First login after policy update:
┌─────────────────────────────────────────┐
│ ℹ️ We've updated our Terms & Privacy    │
│    Policy. Please review when ready.    │
│    [Review Now]  [Later]                │
└─────────────────────────────────────────┘
```

If user taps "Later", they can use the app but:
- Banner persists at top of Status screen
- After 7 days OR on next significant action (e.g., submitting data), enforce the consent

This balances legal compliance with user experience.

### 3.7 Fix: Consent State Authority → Backend is Source of Truth

**Problem:** Local vs backend consent state could diverge.

**Fix:**
1. Backend is authoritative
2. On app launch, fetch user profile which includes consent status
3. Local storage is cache only
4. If user reinstalls, first API call returns consent status

```typescript
// In auth restoration flow
const user = await AuthService.getCurrentUser();
const needsConsent = !user.termsAcceptedVersion ||
                     user.termsAcceptedVersion !== CURRENT_TERMS_VERSION;
```

### 3.8 Fix: Demo Account → Skip Consent

**Problem:** Demo account for App Review needs to skip consent.

**Fix:** Check for demo account before showing consent:

```typescript
const handleCreateAccount = () => {
  if (isDemoEmail(email)) {
    // Skip consent for demo account
    handleRegister(null);
    return;
  }
  setShowConsent(true);
};
```

### 3.9 Fix: Race Condition → Loading State

**Problem:** Multiple taps could send multiple requests.

**Fix:** Disable button and show loading immediately:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleConsentAccepted = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);

  try {
    await handleRegister(consentRecord);
  } finally {
    setIsSubmitting(false);
  }
};

<Button
  title={isSubmitting ? t('common.loading') : t('consent.accept')}
  disabled={!accepted || isSubmitting}
  onPress={handleConsentAccepted}
/>
```

### 3.10 Fix: Existing Users Migration → Backfill Consent

**Problem:** Existing users have NULL consent fields.

**Fix:**
1. Database migration adds columns with NULL default
2. On first app update, existing authenticated users see "Policy Update" consent flow
3. They must accept to continue
4. This is actually correct legally - they should explicitly consent

```typescript
// In AppNavigator
if (authState.user && !authState.user.termsAcceptedVersion) {
  // Existing user who never formally consented
  return <ConsentScreen mode="initial" />;
}
```

---

## Part 4: Revised Implementation Plan

### 4.1 Final Flow Diagram

```
NEW USER:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Email           │     │ Enter           │     │ Register        │
│ Verification    │────▶│ 6-digit Code    │────▶│ Profile Setup   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                               Tap "Review Terms &
                                                Create Account"
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Consent Modal   │
                                                │ (Bottom Sheet)  │
                                                │ - Key points    │
                                                │ - Links to docs │
                                                │ - Checkbox      │
                                                │ - Create button │
                                                └────────┬────────┘
                                                         │
                                                    Accept
                                                         │
                                                         ▼
                                                    Main App


EXISTING USER (after policy update):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ App Launch      │     │ Auth Restored   │     │ Consent Banner  │
│                 │────▶│                 │────▶│ (Non-blocking)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                  7 days OR
                                                  data submission
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Consent Screen  │
                                                │ (Blocking)      │────▶ Main App
                                                └─────────────────┘
```

### 4.2 Final Component List

| Component | Type | Purpose |
|-----------|------|---------|
| `ConsentBottomSheet` | Modal | New user consent during registration |
| `ConsentBanner` | Banner | Soft reminder for existing users |
| `ConsentScreen` | Full Screen | Blocking consent for existing users |
| `PolicyCard` | UI Component | Tappable card linking to Terms/Privacy |
| `KeyPoint` | UI Component | Checkmark + text for key points |

### 4.3 Revised Effort Estimate

| Step | Task | Effort | Notes |
|------|------|--------|-------|
| 1 | Create consent types, storage, constants | Small | |
| 2 | Backend: Add consent fields + migration | Small | |
| 3 | Create PolicyCard and KeyPoint components | Small | Reusable |
| 4 | Create ConsentBottomSheet | Medium | With all fixes |
| 5 | Create ConsentBanner | Small | |
| 6 | Create ConsentScreen | Medium | Full-screen version |
| 7 | Modify RegisterScreen | Medium | Button text, modal trigger |
| 8 | Update AppNavigator | Medium | Consent state checks |
| 9 | Update auth-context | Small | Consent in state |
| 10 | Add translations | Small | EN + DE |
| 11 | Handle demo account | Small | Skip consent |
| 12 | Test all flows | Medium | New, update, demo, offline |

**Total Estimate:** Medium-sized feature, ~2-3 focused implementation sessions

---

## Summary of Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Consent timing** | After profile, before registration | Legally cleanest - consent before data submission |
| **UI pattern** | Bottom sheet modal | Native feel, less disruptive than full screen |
| **Consent granularity** | Single checkbox for Terms + Privacy | Simpler UX, both are required anyway |
| **Policy updates** | Soft banner → Hard block after 7 days | Balance legal compliance with UX |
| **State authority** | Backend is source of truth | Handles reinstalls, multiple devices |
| **Offline handling** | Key points always visible | Informed consent without internet |
| **Demo account** | Skip consent | Required for App Store review |

---

## Next Steps

1. Review this plan
2. Approve or request changes
3. Begin implementation starting with Step 1
