# Consent Withdrawal & Account Deletion Implementation Plan

**Created:** 2026-01-12
**Status:** Deployed & Tested
**Implemented:** 2026-01-12
**Tested:** 2026-01-12
**Author:** Claude + Lukas

---

## Background

### Legal Requirement

GDPR Article 7(3) requires that:
> "It shall be as easy to withdraw consent as to give consent."

Additionally, Article 17 (Right to Erasure) requires that users can request deletion of their personal data.

### Key Insight from Legal Research

During analysis, we clarified that for Open Working Hours:

- **Consent covers both storage AND aggregation** - there's no use case for "store my data but don't aggregate it"
- **Withdrawal = Deletion** - when a user withdraws consent, we must delete their personal data (no other legal basis to retain it)
- **Aggregated statistics remain** - k-anonymous statistics are not personal data under GDPR and can be retained

This means the implementation is simpler than initially thought: withdrawing consent triggers account deletion, not a separate "opt-out of stats" toggle.

### Implementation Notes (2026-01-12)

The following was implemented beyond the original plan:

1. **FeedbackReport cleanup**: DELETE /auth/me also deletes FeedbackReport records (no FK cascade)
2. **VerificationRequest cleanup**: DELETE /auth/me also deletes VerificationRequest by email_hash
3. **Demo account protection**: Demo account (for Apple review) cannot be deleted (returns 403)
4. **Pending queue warning**: Users are warned if they have pending submissions before deletion

### Testing Notes (2026-01-12)

**Bug fixed during testing:**
- SQLAlchemy session conflict: `current_user` was attached to a different session than `db`
- Fix: Re-fetch user in the endpoint's session before deletion (`auth.py:287-288`)

**Design decision confirmed:**
- Withdrawal = Deletion (user cannot continue using app after withdrawal)
- Rationale: Simpler UX, no real use case for "track privately without contributing to stats"
- Alternative (opt-out of stats while keeping account) deferred unless legal counsel advises otherwise

---

## Current State

### Backend

| Feature | Status | Location |
|---------|--------|----------|
| Cascade delete configured | ✅ Done | `models.py:98` - `cascade="all, delete-orphan"` |
| Work event deletion | ✅ Done | `DELETE /work-events/{id}` |
| User account deletion | ✅ Done | `DELETE /auth/me` in `routers/auth.py` |

### Mobile App

| Feature | Status | Location |
|---------|--------|----------|
| Local data deletion | ✅ Done | `DataPrivacyScreen.tsx` |
| Sign out | ✅ Done | `SettingsScreen.tsx` |
| Consent status display | ✅ Done | `DataPrivacyScreen.tsx` |
| Account deletion | ✅ Done | `DataPrivacyScreen.tsx` + `AuthService.ts` |
| In-app policy viewing | ❌ Deferred | Phase 2 |

### Database

Consent fields already exist on User model (added 2026-01-09):
- `terms_accepted_version`
- `privacy_accepted_version`
- `consent_accepted_at`

---

## Target State

After implementation:

1. **Users can view consent status** in DataPrivacyScreen:
   - "Terms of Service: Accepted ✓"
   - "Privacy Policy: Accepted ✓"
   - "Accepted on: Jan 12, 2026"

2. **Users can withdraw consent** via a clear button:
   - Shows confirmation dialog explaining consequences
   - Deletes backend account (user + work_events via cascade)
   - Clears local data
   - Signs out user
   - Shows success confirmation

3. **Users can view policies** (Phase 2):
   - Terms of Service viewable in-app
   - Privacy Policy viewable in-app
   - Works offline (embedded text)

---

## Implementation Plan

### Phase 1: Account Deletion (Priority)

#### 1.1 Backend: Add DELETE /auth/me Endpoint

**File:** `backend/app/routers/auth.py`

```python
@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> None:
    """
    Delete current user account and all associated data.

    GDPR Art. 17 (Right to Erasure) implementation.
    Work events are automatically deleted via cascade.
    Aggregated statistics are retained (anonymous data).
    """
    logger.info(f"User {current_user.user_id} requested account deletion")
    db.delete(current_user)
    db.commit()
```

**Test:** Add test in `backend/tests/test_auth.py`

#### 1.2 Mobile: Add deleteAccount to AuthService

**File:** `mobile-app/src/modules/auth/services/AuthService.ts`

```typescript
/**
 * Delete user account and all backend data (GDPR Art. 17)
 * DELETE /auth/me
 */
static async deleteAccount(token: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication expired. Please login again.');
    }
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete account');
  }
}
```

#### 1.3 Mobile: Update User Type with Consent Fields

**File:** `mobile-app/src/lib/auth/auth-types.ts`

Add to User interface:
```typescript
termsAcceptedVersion?: string;
privacyAcceptedVersion?: string;
consentAcceptedAt?: string;
```

**File:** `mobile-app/src/modules/auth/services/AuthService.ts`

Update `getCurrentUser()` to map these fields from the API response.

#### 1.4 Mobile: Update DataPrivacyScreen

**File:** `mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx`

Add new sections:

```
┌─────────────────────────────────────────┐
│ CONSENT STATUS (NEW)                    │
│ Terms of Service: Accepted ✓            │
│ Privacy Policy: Accepted ✓              │
│ Accepted on: Jan 12, 2026               │
├─────────────────────────────────────────┤
│ LOCAL DATA (existing)                   │
│ Work Locations: 2                       │
│ Work Sessions: 15                       │
├─────────────────────────────────────────┤
│ SUBMISSION QUEUE (existing)             │
│ ...                                     │
├─────────────────────────────────────────┤
│ [Delete Local Data] (existing)          │
│ [Withdraw Consent & Delete Account] NEW │
└─────────────────────────────────────────┘
```

Withdrawal flow:
1. User taps "Withdraw Consent & Delete Account"
2. Alert: "This will permanently delete your account and all data from our servers. This cannot be undone."
3. User confirms
4. Call `AuthService.deleteAccount(token)`
5. Clear local SQLite data
6. Clear SecureStore (token, consent record)
7. Call `signOut()`
8. Show success alert

#### 1.5 Mobile: Add Translations

**Files:**
- `mobile-app/src/lib/i18n/translations/en.ts`
- `mobile-app/src/lib/i18n/translations/de.ts`

New keys:
```typescript
dataPrivacyScreen: {
  // existing keys...
  consentStatus: 'Consent Status',
  termsAccepted: 'Terms of Service',
  privacyAccepted: 'Privacy Policy',
  accepted: 'Accepted',
  acceptedOn: 'Accepted on {{date}}',
  withdrawConsent: 'Withdraw Consent & Delete Account',
  withdrawConfirmTitle: 'Delete Account?',
  withdrawConfirmMessage: 'This will permanently delete your account and all data from our servers. Your local data will also be cleared. This action cannot be undone.',
  withdrawConfirmButton: 'Delete Everything',
  accountDeleted: 'Account Deleted',
  accountDeletedMessage: 'Your account and all associated data have been permanently deleted.',
  deletionFailed: 'Failed to delete account. Please try again.',
}
```

---

### Phase 2: In-App Policy Viewing (Deferred)

To be implemented after Phase 1:

1. Create `TermsScreen.tsx` with embedded Terms of Service text
2. Create `PrivacyPolicyScreen.tsx` with embedded Privacy Policy text
3. Add navigation routes
4. Make "Terms of Service" and "Privacy Policy" in consent status section tappable
5. Add full policy text to translations (EN + DE)

**Trade-off:** Embedding policies means app updates are needed for policy changes. This is acceptable for offline access requirement.

---

## File Changes Summary

### Phase 1

| File | Change |
|------|--------|
| `backend/app/routers/auth.py` | Add `DELETE /auth/me` endpoint |
| `backend/tests/test_auth.py` | Add deletion test |
| `mobile-app/src/modules/auth/services/AuthService.ts` | Add `deleteAccount()` method, update `getCurrentUser()` |
| `mobile-app/src/lib/auth/auth-types.ts` | Add consent fields to User type |
| `mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx` | Add consent status + withdrawal UI |
| `mobile-app/src/lib/i18n/translations/en.ts` | Add new strings |
| `mobile-app/src/lib/i18n/translations/de.ts` | Add German translations |

### Phase 2 (Deferred)

| File | Change |
|------|--------|
| `mobile-app/src/modules/settings/screens/TermsScreen.tsx` | New file |
| `mobile-app/src/modules/settings/screens/PrivacyPolicyScreen.tsx` | New file |
| `mobile-app/src/navigation/AppNavigator.tsx` | Add routes |
| Translations | Add full policy text |

---

## Testing Checklist

### Backend
- [ ] `DELETE /auth/me` returns 204 on success
- [ ] User record is deleted from database
- [ ] Work events are cascade deleted
- [ ] Unauthenticated request returns 401
- [ ] Aggregated stats are NOT affected

### Mobile
- [ ] Consent status displays correctly with date
- [ ] Withdrawal confirmation dialog appears
- [ ] API call succeeds and account is deleted
- [ ] Local data is cleared after deletion
- [ ] User is signed out and sees login screen
- [ ] Error handling works (network failure, etc.)
- [ ] German translations are complete and correct

---

## Open Questions

1. **Confirmation UX:** Single confirmation dialog, or two-step (first warning, then "type DELETE")?
   - Recommendation: Single dialog with clear warning text is sufficient.

2. **Policy text updates:** When policies change, how do we notify users who have the old version embedded?
   - Could check `termsAcceptedVersion` vs `CURRENT_TERMS_VERSION` and prompt re-consent.

3. **Existing users without consent data:** The 4 users who registered before consent flow - should they see "Unknown" for consent date?
   - Recommendation: Show "—" or "Before Jan 2026" for null consent dates.

---

## References

- GDPR Article 7(3): Consent withdrawal
- GDPR Article 17: Right to erasure
- [European Commission - Consent Withdrawal](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/grounds-processing/what-if-somebody-withdraws-their-consent_en)
- [noyb.eu - Article 7(3)](https://noyb.eu/en/your-right-withdraw-your-consent-article-73)
- `docs/GDPR_COMPLIANCE.md` - Project compliance hub
- `docs/CONSENT_FLOW_IMPLEMENTATION_PLAN.md` - Original consent flow plan
