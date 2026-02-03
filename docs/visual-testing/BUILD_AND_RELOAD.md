# Build System & Hot-Reload Guide

**Purpose:** Help subagents understand when code changes require a rebuild vs hot-reload.

---

## Build Types

### 1. Development Build (Hot-Reload Works)

**What it is:** App built with `expo start` or `expo run:ios --configuration Debug`, loading JS bundle from Metro bundler at runtime.

**How to identify:**
- Metro bundler running on port 8081
- App fetches bundle from `http://localhost:8081`
- Shake device shows "Reload" option
- Changes appear within seconds without reinstall

**When to use:** Active development, rapid iteration on JS/styling changes.

**Start development mode:**
```bash
cd mobile-app
npm start              # Expo Go
npx expo run:ios       # Dev client (Debug config)
```

### 2. TEST_MODE / Release Build (Rebuild Required)

**What it is:** App built with embedded JS bundle, used for E2E testing or production.

**How to identify:**
- Built with `--configuration Release` or via EAS
- Bundle embedded in app binary
- Metro running does NOT affect the app
- Changes require full rebuild + reinstall

**When to use:** E2E testing, TestFlight, production.

**The E2E build command:**
```bash
cd mobile-app/e2e
npm run build:ios      # TEST_MODE=true, Release config
```

---

## How to Tell Which Build Is Running

### Quick Check

```bash
# 1. Is Metro serving the app?
curl -s "http://localhost:8081/status"

# 2. Make an obvious change (add backgroundColor: 'red' to any component)
# 3. Save the file
# 4. Does the app update within 2-3 seconds?
#    - YES → Development build, hot-reload works
#    - NO  → Release build, rebuild required
```

### Definitive Check

If you made a code change and the app doesn't reflect it after saving:
1. The app is using an embedded bundle (Release build)
2. You MUST rebuild: `cd mobile-app/e2e && npm run build:ios`
3. Rebuild takes ~1-4 minutes depending on cache state

---

## What Changes Require What

| Change Type | Hot-Reload? | Rebuild? |
|-------------|-------------|----------|
| JS logic changes | ✅ Dev build | ❌ Release build needs rebuild |
| Style changes (colors, spacing) | ✅ Dev build | ❌ Release build needs rebuild |
| New npm package | ❌ | ✅ Always |
| Native code (iOS/Android) | ❌ | ✅ Always |
| app.json changes | ❌ | ✅ Always |
| New assets (images, fonts) | ⚠️ Sometimes | ✅ Safer to rebuild |

---

## For Visual Testing Subagents

### Before Making UI Fixes

1. **Determine build type:**
   - If E2E testing was recently run → likely Release build → rebuild required
   - If `npm start` is running and app updates on save → Dev build → hot-reload works

2. **When in doubt, rebuild:**
   ```bash
   cd mobile-app/e2e && npm run build:ios
   ```
   This takes 1-4 minutes but guarantees your changes are loaded.

### After Making Changes

1. **For Release builds:** Always rebuild before taking "after" screenshots
2. **For Dev builds:** Save file, wait 2-3 seconds, then screenshot

### Verification Protocol

1. Take BEFORE screenshot
2. Make code change
3. Rebuild if needed (Release build) or wait for hot-reload (Dev build)
4. Take AFTER screenshot
5. Compare:
   - **Change clearly visible** → Report success
   - **Change too subtle to confirm** → Report uncertainty, provide both screenshots, request human verification
   - **No visible change** → Suspect build issue, verify code loaded

---

## Common Pitfalls

### Pitfall 1: Assuming Hot-Reload Works
**Symptom:** Made change, relaunched app, nothing changed.
**Cause:** App is Release build with embedded bundle.
**Fix:** Rebuild with `npm run build:ios`.

### Pitfall 2: Metro Running ≠ App Using Metro
**Symptom:** Metro shows "Bundling..." but app doesn't update.
**Cause:** Release build ignores Metro, uses embedded bundle.
**Fix:** Rebuild, or switch to Dev build.

### Pitfall 3: Claiming Visual Verification Without Clear Evidence
**Symptom:** Saying "fix verified" when before/after screenshots look identical.
**Cause:** Change didn't load, or change too subtle to see.
**Fix:** Be honest about uncertainty. If you can't clearly see the difference, say so.

---

## Rebuild Commands Reference

```bash
# iOS (E2E/TEST_MODE build)
cd mobile-app/e2e
npm run build:ios          # ~1-4 minutes

# iOS (Development build)
cd mobile-app
npx expo run:ios           # Debug config, hot-reload enabled

# Android (E2E build)
cd mobile-app/e2e
npm run build:android      # Requires Android Studio setup

# Check Metro status
curl -s http://localhost:8081/status
lsof -i :8081
```
