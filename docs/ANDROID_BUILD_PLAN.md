# Android Build Plan - Open Working Hours

**Created:** 2026-01-19
**Status:** In Progress (Phase 4 - Testing)
**Goal:** Get a working Android build to testers as quickly as possible while ensuring geofencing and core features work correctly.

**Approach:** Google Maps API key + EAS-managed signing + Internal APK distribution

---

## Progress Summary (2026-01-20)

### Completed
- [x] Phase 1: Configuration (app.json, eas.json, expo-location plugin)
- [x] Phase 2: Google Maps API key setup and configured
- [x] Phase 3: First builds (preview + development profiles)
- [x] Installed expo-dev-client for hot reload development
- [x] Set up Android emulator (Pixel 7a) with adb
- [x] **Phase 4: Calendar gesture system fixed** (see detailed notes below)

### Android-Specific Fixes Applied
1. **Map animation on search** - Fixed map not animating to selected location (removed conflicting `setRegion` call)
2. **Button styling** - Changed all `variant="outline"` to `variant="secondary"` (outline had gray border on Android)
3. **Calendar gestures (WeekView)** - Complete platform-specific rewrite (see below)

### Known Issues (Remaining)
- App icon showing placeholder (adaptive-icon.png needs custom design)

### Files Modified
- `mobile-app/app.json` - Android config, Google Maps key, expo-location plugin
- `mobile-app/eas.json` - Android build profiles
- `mobile-app/src/modules/geofencing/screens/SetupScreen.tsx` - Map animation fix
- `mobile-app/src/modules/geofencing/screens/SettingsScreen.tsx` - Button styling
- `mobile-app/src/modules/geofencing/screens/DataPrivacyScreen.tsx` - Button styling
- `mobile-app/src/modules/geofencing/screens/PermissionsScreen.tsx` - Button styling
- `mobile-app/src/modules/auth/screens/WelcomeScreen.tsx` - Button styling
- `mobile-app/src/modules/calendar/components/WeekView.tsx` - Platform-specific gesture system

---

## Calendar Gesture System - Detailed Notes (2026-01-20)

### The Problem
WeekView calendar uses nested ScrollViews (horizontal for days, vertical for times) wrapped in RNGH GestureDetector for pinch zoom and edge swipe. This works on iOS but fails on Android:
- Scroll randomly works/fails (gesture conflicts)
- Pinch zoom jerky or non-functional
- Week navigation unreliable

### Root Cause
Android lacks iOS's native gesture coordination between RNGH and ScrollView. On iOS, the OS-level gesture system gracefully handles competing gestures. On Android, RNGH gestures intercept touches before ScrollView can respond.

### What We Tried (And Failed)

| Approach | Result | Why It Failed |
|----------|--------|---------------|
| Adjust Pan thresholds (`.minDistance(25)`, `.activeOffsetX([-25,25])`) | Scroll worked, week nav broke | Thresholds either too high (miss gestures) or too low (intercept scroll) |
| Add `.failOffsetY()` to Pan | Partial improvement | Still intercepted horizontal scroll |
| Manual Pan activation (`.manualActivation(true)`) | Scroll still broken | Gesture still captured touches even when not activating |
| Remove Pan gesture on Android (pinch only) | Scroll STILL broken | GestureDetector wrapper itself causes conflicts |
| Use RNGH ScrollView instead of RN ScrollView | Scroll worked, zoom broke | Two-finger touch captured as scroll, not pinch |
| RNGH ScrollView + `isPinching` check | Neither worked | State update timing issues |
| Various combinations of above | Various failures | Fundamental incompatibility |

### What Worked

**Complete separation of iOS and Android gesture systems:**

**iOS (unchanged):**
- `<GestureDetector>` wrapper with `Gesture.Simultaneous(pinchGesture, edgeSwipeGesture)`
- Week nav via overscroll bounce + velocity detection
- Works because iOS has native gesture coordination

**Android (new approach):**
- NO GestureDetector wrapper around content
- Pinch zoom via custom PanResponder on grid area
- Week nav via velocity-based edge detection (separate handler)
- Completely separate scroll end handlers per platform

### Key Code Patterns

```typescript
// Platform-conditional wrapper (NOT mixing in one GestureDetector)
const calendarContent = (<View>...</View>);
return Platform.OS === 'ios'
  ? <GestureDetector gesture={composedGesture}>{calendarContent}</GestureDetector>
  : calendarContent;

// Completely separate handlers (NOT if/else in one handler)
const handleHorizontalScrollEndDrag = Platform.OS === 'ios'
  ? handleHorizontalScrollEndDragIOS
  : handleHorizontalScrollEndDragAndroid;

// Android pinch via PanResponder (NOT RNGH Gesture.Pinch)
const androidPinchResponder = useRef(
  Platform.OS === 'android' ? PanResponder.create({
    onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
    // ... custom two-finger detection
  }) : null
).current;
```

### Lessons Learned

1. **Don't try to make RNGH GestureDetector work with ScrollView on Android** - it's fundamentally broken
2. **Complete separation > conditional logic** - separate handlers are cleaner than if/else branches
3. **PanResponder works reliably on both platforms** - use it for Android-specific gestures
4. **Velocity-based navigation needs tuning** - Android threshold (0.3) is lower than iOS (1.5)
5. **Track edge position at drag START** - more reliable than checking at drag END only

### Current Divergence

The codebases now have platform-specific paths in WeekView.tsx:
- **Shared:** All rendering, state management, business logic
- **iOS-only:** GestureDetector wrapper, RNGH pinch gesture, overscroll detection
- **Android-only:** PanResponder pinch, velocity-based edge detection, edge tracking refs

**Future unification possibility:** If RNGH improves Android ScrollView coordination, could potentially unify. For now, keep separate.

### Reference
- Full exploration history: `docs/ANDROID_GESTURE_FIX_PLAN.md`
- Architecture notes: `mobile-app/ARCHITECTURE.md` → "Android Gesture System"

---

## Phase 1: Configuration (app.json + eas.json)

### 1.1 Update app.json - Android section

Add missing Android configuration:

```json
"android": {
  "package": "com.openworkinghours.mobileapp",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "permissions": [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.VIBRATE"
  ],
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
    }
  }
}
```

**Note**: Background location permissions (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`) are added automatically by the expo-location plugin when `isAndroidBackgroundLocationEnabled: true` is set.

**Files**: `mobile-app/app.json`

### 1.2 Update eas.json - Add Android profiles

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "simulator": false },
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

**Files**: `mobile-app/eas.json`

### 1.3 Update expo-location plugin config

Enable Android background location in the plugin:

```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Allow Open Working Hours to use your location to automatically track work hours.",
      "isAndroidBackgroundLocationEnabled": true,
      "isAndroidForegroundServiceEnabled": true
    }
  ]
]
```

**Note**: Setting `isAndroidBackgroundLocationEnabled: true` automatically adds:
- `ACCESS_BACKGROUND_LOCATION` permission
- `FOREGROUND_SERVICE` permission
- `FOREGROUND_SERVICE_LOCATION` permission

**Files**: `mobile-app/app.json`

### 1.4 Google Maps note

The app currently uses `react-native-maps` without a `provider` prop, which means:
- **iOS**: Uses Apple MapKit (no API key needed)
- **Android**: Uses Google Maps (API key required)

No code changes needed - just add the API key to app.json config.

---

## Phase 2: Google Maps API Key Setup

### 2.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create new project: "Open Working Hours"
3. Enable billing (required, but free tier covers 28k loads/month)

### 2.2 Enable Maps SDK for Android
1. APIs & Services → Library
2. Search "Maps SDK for Android"
3. Enable it

### 2.3 Create API Key
1. APIs & Services → Credentials
2. Create Credentials → API Key
3. Restrict key:
   - Application restrictions: Android apps
   - Add package name: `com.openworkinghours.mobileapp`
   - Add SHA-1 fingerprint (get from EAS after first build)
4. API restrictions: Maps SDK for Android only

### 2.4 Store API Key
Option A (for now): Add directly to app.json config.googleMaps.apiKey
Option B (production): Use EAS secrets: `eas secret:create GOOGLE_MAPS_API_KEY`

---

## Phase 3: First Android Build

### 3.1 Initial build (development profile)

```bash
cd mobile-app
eas build --platform android --profile development
```

This will:
- Prompt for EAS login (if needed)
- Generate Android keystore (EAS-managed)
- Build APK
- Provide download link

### 3.2 Get SHA-1 for API key restriction

After first build:
```bash
eas credentials --platform android
```

Copy SHA-1 fingerprint, add to Google Cloud API key restrictions.

### 3.3 Rebuild with restricted API key

```bash
eas build --platform android --profile preview
```

---

## Phase 4: Testing Checklist

### 4.1 Core functionality to verify on Android device

| Feature | Test Steps | Expected |
|---------|------------|----------|
| **App launch** | Install APK, open app | Splash → Home screen |
| **Location permission** | Go through setup | Foreground permission granted |
| **Background permission** | Continue setup | "Allow all the time" granted |
| **Map display** | Open location setup | Map renders with tiles |
| **Geocoding search** | Search for hospital | Results appear (Photon API) |
| **Geofence creation** | Complete setup wizard | Location saved |
| **Geofence enter** | Walk into geofence area | Clock-in notification |
| **Geofence exit** | Walk out of geofence | Clock-out after 5min hysteresis |
| **Calendar view** | Open calendar tab | Sessions displayed |
| **Notifications** | Various actions | Notifications appear |

### 4.2 Known Android differences to watch

- Background location permission is a **separate prompt** on Android 11+
- Geofencing may behave differently due to Doze mode
- Battery optimization may affect background tracking
- GPS accuracy varies more by device

---

## Phase 5: Distribution to Testers

### 5.1 Share APK

After successful build:
1. EAS provides download URL
2. Share URL with testers via email/Signal/etc.
3. Testers open link on Android device
4. May need to enable "Install from unknown sources"

### 5.2 Collect feedback

Key questions for testers:
- Does the app install and launch?
- Can you grant location permissions?
- Does the map display correctly?
- Does geofencing detect enter/exit?
- Any crashes or unexpected behavior?

---

## Files to Modify

| File | Changes |
|------|---------|
| `mobile-app/app.json` | Android package, versionCode, permissions, Google Maps key, expo-location plugin config |
| `mobile-app/eas.json` | Add android sections to all build profiles |

---

## Potential Issues & Mitigations

| Issue | Likelihood | Mitigation |
|-------|------------|------------|
| **Geofencing less reliable than iOS** | Medium | Android's Doze mode and battery optimization can delay geofence triggers. Test on multiple devices, consider prompting users to disable battery optimization for the app. |
| **Background location permission denied** | Medium | Users may grant foreground but deny "Allow all the time". App should handle gracefully - show explanation, link to settings. |
| **Google Maps API billing** | Low | Free tier (28k loads/month) should be sufficient for testing. Monitor usage in Cloud Console. |
| **Build fails on first attempt** | Medium | Common with first Android builds. Usually fixable - check EAS build logs for specific errors. |
| **Notification permission denied (Android 13+)** | Medium | expo-notifications handles the prompt, but users can deny. Clock-in/out confirmations won't appear, but tracking still works. |

---

## Future Considerations (Not in this plan)

- **Firebase/FCM**: Currently expo-notifications may work without explicit FCM setup for local notifications. If push notifications from server are needed later, Firebase setup required.
- **Play Store release**: Will need Google Play Console account, app listing, privacy policy, etc.
- **Detox Android E2E**: Add Android emulator config to detox.config.js
- **versionCode management**: Consider automating increment (EAS can auto-increment)

---

## Verification

1. Build completes without errors
2. APK installs on Android device/emulator
3. Map displays correctly (Google Maps tiles load)
4. Location permissions can be granted
5. Geofencing triggers on location change
6. Notifications appear for clock-in/out

---

## Estimated Effort

| Phase | Tasks |
|-------|-------|
| Phase 1 | Config changes (~15 min) |
| Phase 2 | Google Cloud setup (~20 min) |
| Phase 3 | First builds (~30 min build time) |
| Phase 4 | Testing (~1-2 hours on device) |
| Phase 5 | Share with testers (~5 min) |

**Total**: ~2-3 hours hands-on, plus build wait times

---

## Completion Checklist

When this plan is complete:
- [ ] Extract key Android setup info to `mobile-app/ARCHITECTURE.md`
- [ ] Update `docs/deployment.md` with Android build commands
- [ ] Archive this plan to `archive/ANDROID_BUILD_PLAN.md`
- [ ] Brief mention in `CLAUDE.md` Recent Updates
