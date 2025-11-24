# Navigation Redesign Plan - User Flows Integration

**Date:** 2025-11-24
**Status:** Planning
**Goal:** Redesign app navigation to support all Phase A user flows

---

## Current Problems

1. ❌ **Bottom sheet closes when tapping map** - No way to reopen without restarting
2. ❌ **No Settings screen** - Cannot access location management, notifications, permissions
3. ❌ **HomeScreen is primary** - Should be StatusScreen showing check-in state
4. ❌ **No permission warning UI** - App crashes if background permission denied
5. ❌ **No manual-only mode** - Cannot function without background permissions
6. ❌ **No Calendar screen** - Missing from navigation (needs placeholder)

---

## New Navigation Architecture

### Navigation Hierarchy

```
App Launch
│
├─ Check for saved locations
│  ├─ No locations → SetupScreen (first-time setup)
│  └─ Has locations → StatusScreen (primary)
│
StatusScreen (NEW - Primary Screen)
│  ├─ Header: [App Title] [Settings Icon]
│  ├─ Permission Warning Banner (if missing background permission)
│  ├─ Check-in Status Cards (one per location)
│  │  ├─ "Checked In at [Location]" (green indicator)
│  │  ├─ "Checked Out" (grey indicator)
│  │  └─ "Permissions Missing" (red indicator)
│  ├─ Manual Override Buttons (Check In / Check Out)
│  └─ Bottom Tab Navigation: [Status] [Calendar] [Settings]
│
├─ CalendarScreen (NEW - Placeholder)
│  └─ "Calendar coming soon - Use web dashboard: [URL]"
│
├─ SettingsScreen (NEW)
│  ├─ Work Locations → LocationsListScreen
│  ├─ Notifications (toggle check-in/out notifications)
│  ├─ Permissions (view status, request button)
│  └─ Data & Privacy (delete all data)
│
├─ LocationsListScreen (Repurposed HomeScreen)
│  ├─ Map showing all locations
│  ├─ List of locations (always visible, not bottom sheet)
│  ├─ Long-press location → Edit/Delete menu
│  ├─ Tap location → TrackingScreen (detailed view)
│  └─ "+ Add Location" button → SetupScreen
│
├─ TrackingScreen (Existing - Minor updates)
│  ├─ Detailed status for ONE location
│  ├─ Manual check-in/out buttons
│  ├─ Map with geofence circle
│  └─ "View Work History" → LogScreen (placeholder)
│
├─ SetupScreen (Existing - Update permission handling)
│  ├─ Allow completion without background permission
│  ├─ Show warning: "Manual mode only - grant background permission for automatic tracking"
│  └─ Save location but skip geofence registration if no permission
│
└─ LogScreen (Existing - Convert to placeholder)
   └─ "Work history coming soon - Use web dashboard: [URL]"
```

---

## Screen-by-Screen Breakdown

### 1. StatusScreen (NEW - Primary)

**Purpose:** Show current check-in status across all locations

**Layout:**
```
┌─────────────────────────────────────┐
│  Open Working Hours        [⚙️]     │ ← Header with Settings button
├─────────────────────────────────────┤
│ ⚠️ Background permission missing    │ ← Red warning banner (if needed)
│    [Go to Settings]                 │
├─────────────────────────────────────┤
│                                     │
│  📍 UCSF Medical Center             │ ← Location card
│  ● Checked In                       │ ← Green indicator
│  ⏱️ 2h 34m                           │ ← Elapsed time
│  [Check Out Now]                    │ ← Manual override
│                                     │
│  📍 San Francisco General           │ ← Another location
│  ○ Checked Out                      │ ← Grey indicator
│  Last session: 3h 12m               │
│  [Check In Now]                     │
│                                     │
└─────────────────────────────────────┘
│  [Status] [Calendar] [Settings]     │ ← Bottom tab navigation
└─────────────────────────────────────┘
```

**Features:**
- Shows all locations with independent check-in/out status
- Green indicator (●) = Checked In, Grey (○) = Checked Out
- Red banner at top if background permissions missing
- Manual check-in/out buttons per location
- Elapsed time for checked-in locations
- Settings button in header
- Bottom tab navigation to Calendar and Settings

**Data Required:**
- List of all locations from database
- Current geofence state per location (checked in/out)
- Background permission status
- Current timestamp (for elapsed time calculation)

**File:** `src/modules/geofencing/screens/StatusScreen.tsx` (NEW)

---

### 2. SettingsScreen (NEW)

**Purpose:** Central hub for configuration and management

**Layout:**
```
┌─────────────────────────────────────┐
│  ← Settings                          │
├─────────────────────────────────────┤
│                                     │
│  📍 Work Locations              >   │ ← Opens LocationsListScreen
│                                     │
│  🔔 Notifications               >   │ ← Opens NotificationsScreen
│                                     │
│  🔒 Permissions                 >   │ ← Opens PermissionsScreen
│                                     │
│  🗑️ Data & Privacy              >   │ ← Opens DataPrivacyScreen
│                                     │
│  ℹ️ About                        >   │ ← Opens AboutScreen
│                                     │
└─────────────────────────────────────┘
```

**Sub-Screens:**

#### NotificationsScreen (NEW)
```
┌─────────────────────────────────────┐
│  ← Notifications                     │
├─────────────────────────────────────┤
│  Check-in notifications      [ON]   │ ← Toggle switch
│  Check-out notifications     [ON]   │ ← Toggle switch
└─────────────────────────────────────┘
```

#### PermissionsScreen (NEW)
```
┌─────────────────────────────────────┐
│  ← Permissions                       │
├─────────────────────────────────────┤
│  Location (Foreground)               │
│  ✅ Granted                          │
│                                     │
│  Location (Background)               │
│  ❌ Denied                           │
│  [Request Permission]                │ ← Button to open system settings
│                                     │
│  ℹ️ Background location is required  │
│     for automatic tracking. Without │
│     it, you can only use manual     │
│     check-in/out.                   │
└─────────────────────────────────────┘
```

#### DataPrivacyScreen (NEW)
```
┌─────────────────────────────────────┐
│  ← Data & Privacy                    │
├─────────────────────────────────────┤
│  Stored Data                         │
│  • 3 work locations                 │
│  • 42 work sessions                 │
│  • 5.2 MB total                     │
│                                     │
│  [Delete All Data]                   │ ← Red button, confirmation dialog
│                                     │
│  ⚠️ Warning: This action cannot be  │
│     undone. All locations and work  │
│     history will be permanently     │
│     deleted.                        │
└─────────────────────────────────────┘
```

**Files:**
- `src/modules/geofencing/screens/SettingsScreen.tsx` (NEW)
- `src/modules/geofencing/screens/NotificationsScreen.tsx` (NEW)
- `src/modules/geofencing/screens/PermissionsScreen.tsx` (NEW)
- `src/modules/geofencing/screens/DataPrivacyScreen.tsx` (NEW)

---

### 3. LocationsListScreen (Repurposed HomeScreen)

**Purpose:** Manage multiple work locations (accessed from Settings)

**Layout:**
```
┌─────────────────────────────────────┐
│  ← Work Locations                    │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                                     │
│         [Full-screen map]           │ ← Map is PRIMARY (fills screen)
│      Shows all location pins        │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  ═══ Locations (3/5) ═══            │ ← Collapsed bottom sheet
└─────────────────────────────────────┘

WHEN EXPANDED (user swipes up or taps):
┌─────────────────────────────────────┐
│  ← Work Locations                    │
├─────────────────────────────────────┤
│                                     │
│    [Map still visible at top]       │
│                                     │
├─────────────────────────────────────┤
│  ══ Locations (3/5) ══              │ ← Drag handle
│                                     │
│  📍 UCSF Medical Center         >   │ ← Tap → TrackingScreen
│     ● Checked In · 200m radius     │    Long-press → Edit/Delete
│                                     │
│  📍 SF General Hospital         >   │
│     ○ Checked Out · 150m radius    │
│                                     │
│  📍 Kaiser Permanente           >   │
│     ○ Checked Out · 200m radius    │
│                                     │
│  [+ Add New Location]               │ ← Opens SetupScreen
│                                     │
└─────────────────────────────────────┘
```

**Features:**
- **Map is PRIMARY** - fills most of screen, shows all location pins with geofence circles
- **Bottom sheet collapsed by default** - shows "Locations (3/5)" bar only
- **Expandable via swipe up or tap** - reveals full location list
- Shows check-in status per location
- Tap location → go to TrackingScreen for detailed view
- Long-press → Edit/Delete menu (existing)
- "+ Add Location" button at bottom of expanded sheet

**Changes from Current HomeScreen:**
- Map is now PRIMARY focus (full screen)
- Bottom sheet COLLAPSED by default (not auto-opened)
- Bottom sheet expandable via user interaction
- Accessed from Settings → Work Locations (not app launch)
- Add "← Work Locations" back button in header

**File:** `src/modules/geofencing/screens/LocationsListScreen.tsx` (rename from HomeScreen.tsx)

---

### 4. CalendarScreen (NEW - Placeholder)

**Purpose:** Placeholder for future calendar feature

**Layout:**
```
┌─────────────────────────────────────┐
│  Calendar                            │
├─────────────────────────────────────┤
│                                     │
│         📅                           │
│                                     │
│  Calendar Feature Coming Soon       │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Features:**
- Simple blank screen with "Coming Soon" message
- No links or buttons (fully blank placeholder)

**File:** `src/modules/geofencing/screens/CalendarScreen.tsx` (NEW)

---

### 5. TrackingScreen (Existing - Minor Updates)

**Current functionality is good, minor updates:**

**Changes Needed:**
- Add back button (← to return to StatusScreen or LocationsListScreen)
- Show permission warning banner if background permission missing
- Ensure manual check-in/out works without background permission

**File:** `src/modules/geofencing/screens/TrackingScreen.tsx` (UPDATE)

---

### 6. SetupScreen (Existing - Update Permission Handling)

**Changes Needed:**

1. **Allow setup without background permission:**
   ```typescript
   if (!backgroundGranted) {
     Alert.alert(
       'Background Permission Required',
       'Automatic tracking requires background location permission. Without it, you can only use manual check-in/out.\n\nYou can enable it later in Settings.',
       [
         { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
         { text: 'Continue Anyway', onPress: () => resolve(true) },
       ]
     );
   }

   // Save location WITHOUT registering geofence if no permission
   await db.insertLocation(location);

   if (backgroundGranted) {
     try {
       await geofenceService.registerGeofence(location);
     } catch (error) {
       console.warn('Failed to register geofence:', error);
     }
   }
   ```

2. **Update navigation after save:**
   - First location → go to StatusScreen (not TrackingScreen)
   - Additional locations → go back to LocationsListScreen

**File:** `src/modules/geofencing/screens/SetupScreen.tsx` (UPDATE)

---

### 7. LogScreen (Existing - Convert to Placeholder)

**Changes Needed:**
- Replace current implementation with blank placeholder
- Show "Work history coming soon" message
- No links or buttons (fully blank placeholder)

**File:** `src/modules/geofencing/screens/LogScreen.tsx` (UPDATE)

---

## Navigation Structure (React Navigation)

### Updated AppNavigator.tsx

```typescript
export type RootStackParamList = {
  // Main navigation (bottom tabs)
  MainTabs: undefined;

  // Setup flow
  Setup: undefined;

  // Detail screens (stack navigation)
  Tracking: { locationId: string };
  LocationsList: undefined;
  Notifications: undefined;
  Permissions: undefined;
  DataPrivacy: undefined;
  About: undefined;
  Log: { locationId: string };
};

export type MainTabParamList = {
  Status: undefined;
  Calendar: undefined;
  Settings: undefined;
};

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Status" component={StatusScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocations, setHasLocations] = useState(false);

  useEffect(() => {
    async function checkForLocations() {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();
      setHasLocations(locations.length > 0);
      setIsLoading(false);
    }
    checkForLocations();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName={hasLocations ? 'MainTabs' : 'Setup'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="LocationsList" component={LocationsListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Log" component={LogScreen} />
    </Stack.Navigator>
  );
}
```

---

## User Flows Mapping to Screens

### Flow 1: First-Time Setup
**User Flow:** Install → (Skip onboarding) → Add work location → Setup complete

**Navigation Path:**
```
App Launch
  → No locations detected
  → SetupScreen
     → Request foreground permission (required)
     → Request background permission (optional, show warning if denied)
     → User drops pin on map
     → User enters location name
     → Save location (with or without geofence)
  → Navigate to StatusScreen
```

**Changes:**
- SetupScreen allows completion without background permission ✓
- Navigate to StatusScreen after first location (not TrackingScreen) ✓

---

### Flow 2: Daily Automatic Operation

**Automatic Check-In:**
```
Geofence enter event (background)
  → GeofenceService registers entry
  → Database: Update check-in timestamp
  → Send notification: "Checked in at [Location]"
```

**Automatic Check-Out:**
```
Geofence exit event (background)
  → GeofenceService registers exit
  → Database: Update check-out timestamp, calculate duration
  → Send notification: "Checked out from [Location]"
```

**If Background Permission Missing:**
```
No geofence events
  → Manual-only mode
  → StatusScreen shows red warning banner
  → User must manually check in/out
```

---

### Flow 3: Active Status Check

**User Flow:** Open app → See current status

**Navigation Path:**
```
App Launch
  → Has locations
  → StatusScreen (primary)
     → Shows all locations with check-in status
     → Green indicator = Checked In
     → Grey indicator = Checked Out
     → Red banner = Permissions Missing
     → Manual override buttons available
```

**StatusScreen States:**
- **Checked In:** Green indicator (●), shows location name, elapsed time, "Check Out Now" button
- **Checked Out:** Grey indicator (○), shows "Checked Out", "Check In Now" button
- **Permissions Missing:** Red banner at top, "Go to Settings" button, manual buttons still work

---

### Flow 4: Manual Correction

**User Flow:** Override incorrect automatic tracking

**Manual Check-In:**
```
StatusScreen
  → User sees "Checked Out" (grey indicator)
  → Tap "Check In Now" button
  → Confirmation: "Manually checked in at [Time]"
  → Database: Update check-in timestamp (manual flag)
  → Status updates to "Checked In" (green indicator)
```

**Manual Check-Out:**
```
StatusScreen
  → User sees "Checked In" (green indicator)
  → Tap "Check Out Now" button
  → Confirmation: "Manually checked out at [Time]"
  → Database: Update check-out timestamp, calculate duration (manual flag)
  → Status updates to "Checked Out" (grey indicator)
```

---

### Flow 5: Calendar Review (Deferred - Placeholder)

**User Flow:** View work history

**Navigation Path:**
```
StatusScreen
  → Bottom tab: Tap "Calendar"
  → CalendarScreen (placeholder)
     → "Calendar coming soon"
     → "Use web dashboard: [URL]"
     → [Open Web Dashboard] button
```

---

### Flow 6 & 7: Export/Donate (Deferred)

**Not implemented in Phase A**

---

### Flow 8: Settings/Configuration

**User Flow:** Access settings, manage locations

**Navigation Path:**
```
StatusScreen
  → Tap Settings icon (⚙️) in header OR bottom tab
  → SettingsScreen
     ├─ Work Locations → LocationsListScreen
     │    ├─ View all locations on map
     │    ├─ Tap location → TrackingScreen (detailed view)
     │    ├─ Long-press → Edit/Delete menu
     │    └─ "+ Add Location" → SetupScreen
     ├─ Notifications → NotificationsScreen
     │    └─ Toggle check-in/out notifications
     ├─ Permissions → PermissionsScreen
     │    ├─ View foreground/background status
     │    └─ [Request Permission] button
     └─ Data & Privacy → DataPrivacyScreen
          ├─ View stored data summary
          └─ [Delete All Data] button (with confirmation)
```

---

## Implementation Plan

### Phase 1: Core Screens (2-3 hours)

**Tasks:**
1. ✅ Create `StatusScreen.tsx` (primary screen)
   - Show all locations with check-in/out status
   - Green/grey indicators
   - Manual check-in/out buttons
   - Elapsed time display
   - Settings icon in header

2. ✅ Create `SettingsScreen.tsx` (main settings hub)
   - List view with navigation items
   - Links to sub-screens

3. ✅ Create `CalendarScreen.tsx` (placeholder)
   - "Coming soon" message
   - Link to web dashboard

4. ✅ Rename `HomeScreen.tsx` → `LocationsListScreen.tsx`
   - Remove bottom sheet behavior
   - Make list always visible
   - Update navigation (accessed from Settings)
   - Add back button

5. ✅ Create `NotificationsScreen.tsx`
   - Toggle switches for check-in/out notifications

6. ✅ Create `PermissionsScreen.tsx`
   - Show foreground/background permission status
   - "Request Permission" button

7. ✅ Create `DataPrivacyScreen.tsx`
   - Show stored data summary
   - "Delete All Data" button with confirmation

---

### Phase 2: Navigation Integration (1-2 hours)

**Tasks:**
1. ✅ Update `AppNavigator.tsx`
   - Add bottom tab navigation (Status, Calendar, Settings)
   - Update initial route to MainTabs (if locations exist)
   - Add new screens to stack navigator

2. ✅ Update `SetupScreen.tsx`
   - Allow completion without background permission
   - Skip geofence registration if no permission
   - Navigate to StatusScreen after first location (not TrackingScreen)

3. ✅ Update `TrackingScreen.tsx`
   - Add back button to StatusScreen
   - Show permission warning banner if needed

4. ✅ Update `LogScreen.tsx`
   - Convert to placeholder (like CalendarScreen)

---

### Phase 3: Permission Warning UI (1 hour)

**Tasks:**
1. ✅ Create `PermissionWarningBanner.tsx` component
   - Red banner with warning icon
   - "Background permission missing" message
   - "Go to Settings" button
   - Reusable across screens

2. ✅ Integrate banner into StatusScreen
   - Show at top if background permission denied
   - Hide if permission granted

3. ✅ Integrate banner into TrackingScreen
   - Same behavior as StatusScreen

---

### Phase 4: Manual-Only Mode (1 hour)

**Tasks:**
1. ✅ Update GeofenceService
   - Add `hasBackgroundPermission()` method
   - Skip geofence registration if no permission
   - Allow manual check-in/out without geofences

2. ✅ Update Database schema (if needed)
   - Add `manualOverride: boolean` field to sessions table
   - Track whether check-in/out was manual or automatic

3. ✅ Update StatusScreen manual buttons
   - Work without background permission
   - Save manual check-in/out to database
   - Update UI immediately

---

### Phase 5: Testing & Bug Fixes (1-2 hours)

**Test Cases:**
- [ ] First-time setup without background permission
- [ ] First-time setup with background permission
- [ ] StatusScreen shows correct states (checked in/out)
- [ ] Manual check-in/out without background permission
- [ ] Manual check-in/out with automatic tracking enabled
- [ ] Bottom sheet removed from LocationsListScreen
- [ ] Settings navigation works (all sub-screens accessible)
- [ ] Permission warning banner appears correctly
- [ ] Delete all data works (with confirmation)
- [ ] Tab navigation works (Status, Calendar, Settings)
- [ ] Multiple locations show independent status

---

## Files to Create

**New Files:**
```
src/modules/geofencing/screens/StatusScreen.tsx         (350-400 lines)
src/modules/geofencing/screens/SettingsScreen.tsx       (150 lines)
src/modules/geofencing/screens/CalendarScreen.tsx       (50 lines)
src/modules/geofencing/screens/NotificationsScreen.tsx  (100 lines)
src/modules/geofencing/screens/PermissionsScreen.tsx    (150 lines)
src/modules/geofencing/screens/DataPrivacyScreen.tsx    (150 lines)
src/modules/geofencing/components/PermissionWarningBanner.tsx (80 lines)
```

**Files to Modify:**
```
src/navigation/AppNavigator.tsx                         (add tab navigation)
src/modules/geofencing/screens/SetupScreen.tsx          (permission handling)
src/modules/geofencing/screens/TrackingScreen.tsx       (add back button, warning banner)
src/modules/geofencing/screens/LogScreen.tsx            (convert to placeholder)
src/modules/geofencing/screens/HomeScreen.tsx           → LocationsListScreen.tsx (remove bottom sheet)
```

**Files to Delete:**
```
src/modules/geofencing/components/MapControls.tsx       (keep, still used in LocationsListScreen)
```

---

## Estimated Time

| Phase | Time | Description |
|-------|------|-------------|
| Phase 1 | 2-3 hours | Create core screens |
| Phase 2 | 1-2 hours | Navigation integration |
| Phase 3 | 1 hour | Permission warning UI |
| Phase 4 | 1 hour | Manual-only mode |
| Phase 5 | 1-2 hours | Testing & fixes |
| **Total** | **6-9 hours** | Full implementation |

---

## Success Criteria

- ✅ StatusScreen is primary screen showing check-in status
- ✅ Bottom tab navigation works (Status, Calendar, Settings)
- ✅ Settings screen accessible with all sub-screens
- ✅ LocationsListScreen accessible from Settings → Work Locations
- ✅ Bottom sheet removed from LocationsListScreen
- ✅ Manual check-in/out works without background permission
- ✅ Permission warning banner shows when needed
- ✅ Calendar and Log screens are placeholders linking to web dashboard
- ✅ App doesn't crash if background permission denied
- ✅ All user flows (1-4, 8) can be completed in app
- ✅ Multiple locations show independent check-in/out status

---

## Next Steps

1. **Review this plan** - Confirm navigation structure matches expectations
2. **Prioritize phases** - Should we implement all phases or start with Phase 1-2?
3. **Begin implementation** - Create StatusScreen first (most critical)
4. **Test incrementally** - Test each phase before moving to next

---

**Ready to start implementation when you confirm the plan!** 🚀
