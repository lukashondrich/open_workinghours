# Cluster C Implementation Plan: Tracking Data UX

**Created:** 2026-01-06
**Status:** ✅ Implemented (with refinements)
**Estimated Effort:** 1 session
**Reference:** [User Test Feedback](./user-test-feedback-2026-01.md)
**Build:** #29 (pending upload)

---

## Overview

This plan addresses two UX issues identified in user testing:

1. **Short GPS records are hard to tap/delete** - Sessions under 15 minutes are visually too small to interact with
2. **14-day overview misleading for new accounts** - Shows empty bars for days before account existed

---

## Issue 1: Short GPS Records Hard to Tap

### Problem Analysis

At 1.0x zoom, tracking records are rendered with height proportional to duration:
- `height = (durationMinutes / 60) * hourHeight` where `hourHeight = 48px`
- A 5-minute session = 4px tall (visual AND tap target)
- Apple HIG minimum tap target: 44px

**Current code:** `WeekView.tsx:78-362` (TrackingBadge component)

### Solution: Two-Part Fix

#### Part A: Filter Short Sessions at Recording Time

**Rationale:** Sessions < 5 minutes are likely GPS noise (drift, briefly passing geofence). Not recording them:
- Eliminates impossible-to-tap records
- Maintains single source of truth (all saved = all displayed)
- Transparent to user

**Implementation:**

**File:** `mobile-app/src/modules/geofencing/services/TrackingManager.ts`

Find the clock-out handler and add duration check:

```typescript
// On clock-out, before saving to database
const durationMinutes = (clockOutTime - clockInTime) / 60000;

if (durationMinutes < 5) {
  console.log(`[TrackingManager] Session too short (${durationMinutes.toFixed(1)} min), not saving`);
  // Clean up any pending state but don't save to DB
  return;
}

// Proceed with saving session to database
```

**Threshold:** 5 minutes (configurable constant)

**Edge cases:**
- Active session showing < 5 min: Still display (might grow longer)
- User manually clocks out early: Session not saved, no error shown (silent discard)

#### Part B: Minimum Visual Height for Short Sessions

**Rationale:** Even 5-15 minute sessions are hard to tap (4-12px). Add minimum visual height while preserving timeline accuracy for longer sessions.

**Implementation:**

**File:** `mobile-app/src/modules/calendar/components/WeekView.tsx`

In `TrackingBadge` component (around line 172-186), modify height calculation:

```typescript
// Current code:
let height = (displayDuration / 60) * hourHeight;

// New code:
const MIN_TRACKING_HEIGHT = 16; // Minimum 16px for tappability
let height = Math.max(MIN_TRACKING_HEIGHT, (displayDuration / 60) * hourHeight);
```

**Visual impact:**
| Duration | Natural Height (1.0x) | With Minimum | Change |
|----------|----------------------|--------------|--------|
| 5 min | 4px | 16px | +12px |
| 10 min | 8px | 16px | +8px |
| 15 min | 12px | 16px | +4px |
| 20 min | 16px | 16px | None |
| 30+ min | 24px+ | 24px+ | None |

**Trade-off:** Sessions 5-20 minutes appear slightly taller than actual duration. This is acceptable because:
- Timeline remains proportionally accurate for most sessions
- User can still see relative durations
- Tappability is more important than pixel-perfect accuracy

### Files Changed (Issue 1)

1. `mobile-app/src/modules/geofencing/services/TrackingManager.ts` - Add 5-min filter
2. `mobile-app/src/modules/calendar/components/WeekView.tsx` - Add MIN_TRACKING_HEIGHT

### Testing (Issue 1)

1. **Filter test:** Clock in, wait 2 minutes, clock out → No session saved
2. **Filter test:** Clock in, wait 6 minutes, clock out → Session saved
3. **Visual test:** Create 5-min, 10-min, 30-min sessions → All visible and tappable
4. **Tap test:** Long-press 5-min session → Menu appears
5. **Delete test:** Delete short session → Successfully removed

---

## Issue 2: 14-Day Overview for New Accounts

### Problem Analysis

`DashboardDataService.loadDashboardData()` always shows the last 14 days:
```typescript
const startDate = subDays(today, 13); // Hard-coded 14-day window
```

For a new account (created today), this shows 13 empty days before the account existed, which is misleading.

**Root cause:** Mobile app doesn't know when the account was created.

**Data availability:**
- Backend `User.created_at` exists (stored in PostgreSQL)
- `/auth/me` endpoint returns `created_at` via `UserOut` schema
- Mobile `User` type doesn't include `createdAt`
- Auth storage doesn't persist `createdAt`

### Solution: Fetch and Use Account Creation Date

#### Step 1: Add createdAt to Mobile User Type

**File:** `mobile-app/src/lib/auth/auth-types.ts`

```typescript
export interface User {
  userId: string;
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  createdAt?: string; // ISO date string, optional for backward compatibility
}
```

#### Step 2: Fetch User Data After Auth

**File:** `mobile-app/src/lib/auth/auth-context.tsx`

After successful login/register, call `/auth/me` to get full user data including `createdAt`:

```typescript
// After successful auth (in signIn or register function)
const authResponse = await authService.login(email, code);

// Fetch full user data including createdAt
try {
  const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${authResponse.accessToken}` }
  });
  const userData = await userResponse.json();

  // Merge createdAt into user object
  const userWithCreatedAt: User = {
    ...authResponse.user,
    createdAt: userData.created_at
  };

  await AuthStorage.saveAuth(authResponse.accessToken, userWithCreatedAt, authResponse.expiresAt);
} catch (error) {
  // Graceful degradation: proceed without createdAt
  console.warn('[Auth] Could not fetch user details:', error);
  await AuthStorage.saveAuth(authResponse.accessToken, authResponse.user, authResponse.expiresAt);
}
```

#### Step 3: Expose createdAt via Auth Context

**File:** `mobile-app/src/lib/auth/auth-context.tsx`

Ensure `user` in context includes `createdAt` when available.

#### Step 4: Update DashboardDataService

**File:** `mobile-app/src/modules/geofencing/services/DashboardDataService.ts`

Modify `loadDashboardData()` to accept optional `accountCreatedAt`:

```typescript
export async function loadDashboardData(
  accountCreatedAt?: string
): Promise<DashboardData> {
  const today = startOfDay(new Date());
  const todayKey = format(today, 'yyyy-MM-dd');

  // Calculate effective start date
  let startDate = subDays(today, 13); // Default: 14 days ago

  if (accountCreatedAt) {
    const accountStart = startOfDay(parseISO(accountCreatedAt));
    // Use the later of: 14 days ago OR account creation date
    if (isAfter(accountStart, startDate)) {
      startDate = accountStart;
    }
  }

  // ... rest of function
}
```

#### Step 5: Update HoursSummaryWidget for Pre-Account Days

**File:** `mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx`

Add visual indicator for days before account existed:

```typescript
// In DailyHoursData interface (or pass separately)
export interface DailyHoursData {
  date: string;
  plannedMinutes: number;
  actualMinutes: number;
  isConfirmed: boolean;
  isToday: boolean;
  isPreAccount?: boolean; // New field
}

// In widget rendering
{day.isPreAccount ? (
  <Text style={styles.noDataIndicator}>—</Text>
) : (
  // Normal bar rendering
)}
```

**Visual design:**
- Pre-account days: Gray "—" indicator (no bar)
- Widget maintains consistent width (always 14 slots)
- Clear distinction between "no data recorded" vs "account didn't exist"

#### Step 6: Pass createdAt from StatusScreen

**File:** `mobile-app/src/modules/geofencing/screens/StatusScreen.tsx`

```typescript
import { useAuth } from '@/lib/auth/auth-context';

// In component
const { user } = useAuth();

// When loading dashboard
const dashboard = await loadDashboardData(user?.createdAt);
```

### Backward Compatibility

**Existing users without createdAt:**
- `createdAt` is optional in User type
- If missing, `loadDashboardData()` uses default 14-day window
- No breaking changes for existing installations
- Next login will fetch and store `createdAt`

### Files Changed (Issue 2)

1. `mobile-app/src/lib/auth/auth-types.ts` - Add `createdAt` to User
2. `mobile-app/src/lib/auth/auth-context.tsx` - Fetch `/auth/me` after auth
3. `mobile-app/src/modules/geofencing/services/DashboardDataService.ts` - Account-aware date range
4. `mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx` - Pre-account day indicator
5. `mobile-app/src/modules/geofencing/screens/StatusScreen.tsx` - Pass createdAt to loader

### Testing (Issue 2)

1. **New account test:** Register new account → Dashboard shows only today (or few days)
2. **Existing account test:** Login with old account (no createdAt) → Shows full 14 days
3. **Re-login test:** Sign out and back in → createdAt now stored, dashboard adjusts
4. **Visual test:** Pre-account days show "—" indicator
5. **Network failure test:** /auth/me fails → Graceful degradation, shows 14 days

---

## Implementation Order

1. **Issue 1, Part A:** Filter < 5 min sessions at recording time
2. **Issue 1, Part B:** Add MIN_TRACKING_HEIGHT to WeekView
3. **Test Issue 1** on simulator
4. **Issue 2, Steps 1-2:** Add createdAt to types and fetch after auth
5. **Issue 2, Steps 3-6:** Update dashboard service and widget
6. **Test Issue 2** on simulator
7. **Build and deploy** to TestFlight

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Existing sessions < 5 min in DB | Display filter in WeekView (hide if < 5 min) |
| /auth/me call adds latency | Non-blocking call, graceful degradation |
| Existing users without createdAt | Optional field, default to 14-day window |
| Timezone issues with createdAt | Use `startOfDay()` after parsing to local TZ |

---

## Success Criteria

- [x] No sessions < 5 minutes are saved to database
- [x] All displayed sessions are visible (min 8px height)
- [x] All displayed sessions are tappable (20px hitSlop)
- [x] New accounts see appropriate date range in dashboard
- [x] Pre-account days show "—" indicator, not empty bars
- [x] Existing users unaffected (backward compatible)
- [x] "Session Discarded" notification for short sessions
- [x] Duration format consistent across app (e.g., "1h 30min")

---

## Implementation Notes (2026-01-06)

### Final Implementation Details

**Issue 1: Short GPS Records**

| Setting | Planned | Final |
|---------|---------|-------|
| Min session duration | 5 min | 5 min ✓ |
| Min visual height | 16px | 8px (less clunky) |
| Tap target | 16px | 20px (via hitSlop) |

**Additional improvements:**
- Added "Session Discarded" notification when session < 5 min is deleted
- Changed duration format from "0.3 hours" to "20min" across the app

**Issue 2: 14-Day Overview**

Implemented as planned:
- `createdAt` added to User type and fetched from `/auth/me`
- `DashboardDataService` accepts `accountCreatedAt` parameter
- Pre-account days show "—" indicator

### Files Changed

```
mobile-app/src/modules/geofencing/services/TrackingManager.ts
  - Added MIN_SESSION_MINUTES = 5
  - Delete sessions < 5 min on clock-out
  - Added "Session Discarded" notification
  - Changed duration format to use formatDuration()

mobile-app/src/modules/calendar/components/WeekView.tsx
  - Added MIN_TRACKING_HEIGHT = 8
  - Added MIN_TRACKING_HIT_SLOP = 20
  - Added hitSlop to Pressable for tappability

mobile-app/src/lib/auth/auth-types.ts
  - Added createdAt to User and MeResponse interfaces

mobile-app/src/modules/auth/services/AuthService.ts
  - Extract created_at from /auth/me response
  - Call getCurrentUser() after registration

mobile-app/src/modules/geofencing/services/DashboardDataService.ts
  - Added accountCreatedAt parameter to loadDashboardData()
  - Added isPreAccount flag to DailyHoursData

mobile-app/src/modules/geofencing/components/HoursSummaryWidget.tsx
  - Show "—" for pre-account days
  - Changed to use formatDuration() for consistency

mobile-app/src/modules/geofencing/screens/StatusScreen.tsx
  - Pass user?.createdAt to loadDashboardData()
```
