# Android Bug Fixes: Plan & Documentation (v3 — Deep Review)

**Date:** 2026-02-04
**Reporter:** Tester (Xiaomi 24090RA29G, Android 16, Build #39 v2.0.0)
**Environment:** Expo SDK 54, React Native 0.81.5, React 19.1.0, Fabric/New Arch enabled

---

## Bug Reports (6 total)

| # | Bug (German) | English | Status | Fix |
|---|-------------|---------|--------|-----|
| 1 | Dauer wird verdeckt | Keyboard covers duration input in bottom panels | **Fix planned** | Fix 1 below |
| 2 | Swipings week funktioniert nicht | Week swiping doesn't work | **Backlog** | Works on re-test; known gesture fragility |
| 3 | Keine Sonntage | No Sundays in month view | **Symptom of #4** | Fixed by Fix 2 |
| 4 | Große Schrift | Large system font breaks layout | **Fix planned** | Fix 2 below |
| 5 | Android Symbole verdecken | Android nav bar overlaps tab bar | **Fix planned** | Fix 3 below |
| 6 | Map wird nicht richtig angezeigt | Map not displayed correctly | **Backlog** | Research OSM alternatives |

### Reproduction Results (Pixel 7a Android 16 emulator)

- **Bug #1:** Confirmed — panel content hidden behind keyboard when tapping duration inputs
- **Bug #2:** Could not reproduce — swiping works. Tester confirmed it started working again
- **Bug #3:** Confirmed as symptom of #4 — at normal font scale Sundays visible; at 1.3x+ pushed off-screen
- **Bug #4:** Confirmed dramatically — at 1.3x only 3/7 weekday columns; at 1.5x tab labels "Stat...", single-digit day numbers
- **Bug #5:** Partially reproduced — tight spacing with 3-button nav, likely worse on Xiaomi
- **Bug #6:** NOT reproduced — map works on emulator. Likely device-specific or API key issue

---

## Research Findings (3 critical discoveries from v2, 3 new from v3)

### v2 Discoveries (still valid)
1. **KeyboardAvoidingView + adjustResize = double compensation** on Android
2. **Text.defaultProps removed in React 19** — mutations silently ignored
3. **React Navigation already handles tab bar safe area** — tabBarStyle doesn't override auto paddingBottom

### v3 New Discoveries

4. **KAV behavior="height" already works in this codebase** — SetupScreen.tsx:691-693 uses it on Android. The original panel rejection was based on older SDK/RN versions. Re-testing is the simplest path.

5. **1.2x font cap is too aggressive** — covers only ~85% of font-scaling users. Navigation headers and third-party components (maps, DateTimePicker) will scale independently regardless, creating a mismatch. A 1.5x cap covers ~95%+ while still preventing layout breaks.

6. **Nav bar overlap is likely a diagnostic issue, not a padding issue** — Source code proves auto `paddingBottom: insets.bottom` survives the current tabBarStyle merge. The real question is: does the Xiaomi device report `insets.bottom = 0` (MIUI bug), or is the nav bar visually transparent over correct padding?

---

## Fix 1: Keyboard covers bottom panel

### Problem
On Android, keyboard covers Color, Break Duration, Save/Cancel in TemplatePanel/ManualSessionForm.

### Root cause
`translateY`-animated panels operate outside layout flow. `adjustResize` doesn't affect them. With `edgeToEdgeEnabled: true`, `adjustResize` may behave like `adjustNothing`.

### Recommended approach: Re-test KAV behavior="height" first

SetupScreen.tsx:691-693 already uses `KeyboardAvoidingView` with `behavior="height"` on Android:
```tsx
// SetupScreen.tsx line 691
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

The panels currently use plain `View` on Android (TemplatePanel:286-289, ManualSessionForm:244-249) because KAV caused "flicker" — but that was on SDK 51/RN 0.74. We're now on SDK 54/RN 0.81.5/Fabric.

**Step 1: Change the Wrapper from `View` to `KeyboardAvoidingView` with `behavior="height"` on Android:**
```tsx
// Change from:
const Wrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
const wrapperProps = Platform.OS === 'ios'
  ? { behavior: 'padding' as const, style: styles.keyboardAvoidingView }
  : { style: styles.keyboardAvoidingView };

// To:
const wrapperProps = Platform.OS === 'ios'
  ? { behavior: 'padding' as const, style: styles.keyboardAvoidingView }
  : { behavior: 'height' as const, style: styles.keyboardAvoidingView };
// (Always use KeyboardAvoidingView, just different behavior per platform)
```

**Step 2 (fallback if KAV flickers):** Keyboard listener + maxHeight reduction with these corrections from research:
- Use `useWindowDimensions()` instead of `Dimensions.get()` (reactive, already used in codebase)
- Guard the `useEffect` with `Platform.OS === 'android'` to prevent iOS re-renders
- Add `LayoutAnimation.configureNext()` before setting maxHeight to smooth the transition
- Test with Samsung keyboard, Gboard, SwiftKey

### Files to modify
- `mobile-app/src/modules/calendar/components/TemplatePanel.tsx` (lines 286-289)
- `mobile-app/src/modules/calendar/components/ManualSessionForm.tsx` (lines 244-249)

### iOS impact: None
- iOS path (`behavior="padding"`) unchanged in both approaches

### Risk: Low (Step 1), Low-Medium (Step 2 fallback)

---

## Fix 2: Cap font scaling (also fixes Bug #3)

### Problem
Android system font scaling breaks layout at 1.3x+. Tab labels truncated, day numbers single digits, Sunday pushed off-screen.

### Root cause
No `maxFontSizeMultiplier` anywhere in codebase. All Text scales unbounded.

### ~~Rejected: Text.defaultProps~~
App uses React 19.1.0 — `defaultProps` on built-ins is removed.

### Recommended approach: maxFontSizeMultiplier={1.3} via AppText wrapper

**Why 1.3x:**
- 1.2x is too close to default (some devices ship at 1.15-1.3x)
- 1.3x is a compromise — covers most font-scaling users while preventing the dramatic breaks at 1.5x+
- The tester's device likely has ~1.3x, so this cap matches her setting exactly
- Navigation headers and third-party components scale independently regardless

**What about the tab bar?**
React Navigation already disables font scaling on iOS (via `SUPPORTS_LARGE_CONTENT_VIEWER`). For Android, add `tabBarAllowFontScaling: false` to screenOptions — tab labels at 10px are too small to scale usefully.

**Priority screens (by visual impact):**
1. `AppNavigator.tsx` — Add `tabBarAllowFontScaling: false`
2. `MonthView.tsx` — Day numbers, weekday headers (7-column grid)
3. `WeekView.tsx` — Time labels, day headers
4. `StatusScreen.tsx` — Dashboard cards
5. `TemplatePanel.tsx` / `ManualSessionForm.tsx` — Form labels

**Implementation: AppText/AppTextInput wrapper components**

Create wrapper components that enforce `maxFontSizeMultiplier={1.3}`:

```tsx
// mobile-app/src/components/ui/AppText.tsx
import React from 'react';
import { Text, TextProps } from 'react-native';

const MAX_FONT_SCALE = 1.3;

export function AppText(props: TextProps) {
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}

// mobile-app/src/components/ui/AppTextInput.tsx
import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

const MAX_FONT_SCALE = 1.3;

export function AppTextInput(props: TextInputProps) {
  return <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
```

Then migrate the 6 priority screens (~130 Text, ~14 TextInput elements) by replacing imports. The `maxFontSizeMultiplier` prop inherits from parent to child Text in Fabric (confirmed via TextAttributes.cpp:49-51), so nested Text components are covered by wrapping the parent.

**Things that will NOT be capped (by design):**
- Native stack headers (react-native-screens — no RN-level control)
- DateTimePicker (native Android/iOS widget)
- Map labels (native MapView)
- These are standard behavior across apps

### iOS impact: Minimal
- `maxFontSizeMultiplier` applies on both platforms
- iOS Dynamic Type rarely exceeds 1.2x in normal use; the 1.3x cap only affects "Larger Accessibility Sizes" users (~2-4% of all iOS users)
- Not an App Store rejection risk (many major apps cap or ignore Dynamic Type)

### Risk: Low-Medium

---

## Fix 3: Android nav bar overlaps tab bar

### Problem
Xiaomi device with 3-button nav: system nav bar may overlap tab bar.

### Root cause analysis (updated from v2)
Source code reading of `BottomTabBar.tsx:376-383` proves the current `tabBarStyle` does NOT override auto `paddingBottom`:
- Auto style applies `paddingBottom: insets.bottom` at line 378
- `tabBarStyle` (line 383) comes last but only has `paddingTop`, `backgroundColor`, `borderTopWidth`, `borderTopColor`
- `StyleSheet.flatten` only overrides explicitly present keys — absent `paddingBottom` preserves the auto value

**So the auto padding IS working correctly.** The real issue is one of:
1. MIUI reports `insets.bottom = 0` (known class of bug with Xiaomi/MIUI)
2. Transparent nav bar overlaps correct padding visually (edge-to-edge design)

### Recommended approach: Diagnose first, then targeted fix

**Phase 1: Diagnose.** Ask tester to check actual inset values. We can add a temporary debug display in Settings or use console logging.

**Phase 2: Based on diagnosis:**

**If `insets.bottom === 0` (MIUI bug):**
```tsx
const insets = useSafeAreaInsets();
const bottomInset = Platform.OS === 'android' && insets.bottom === 0
  ? 48  // Standard 3-button nav height; only when insets report zero
  : insets.bottom;
<Tab.Navigator safeAreaInsets={{ bottom: bottomInset }}>
```

Key differences from v2 plan:
- Only activates when `insets.bottom === 0` (not `< 24`)
- Uses 48dp (actual 3-button nav height) not 24dp
- Doesn't add excess padding on devices with gesture nav that correctly report small insets

**If nav bar is transparent over correct padding:**
Use `expo-navigation-bar` to set opaque background:
```tsx
import * as NavigationBar from 'expo-navigation-bar';
if (Platform.OS === 'android') {
  NavigationBar.setBackgroundColorAsync(colors.background.paper);
}
```

**Preventive measure (do regardless):**
Move `paddingTop: 8` from `tabBarStyle` to `tabBarItemStyle` to prevent future accidental overrides of auto padding:
```tsx
screenOptions={{
  tabBarStyle: {
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    // No padding here — auto insets handle bottom
  },
  tabBarItemStyle: {
    paddingTop: 8,  // Visual balance applied to items, not container
  },
}}
```

### iOS impact: None
- All changes Platform-guarded or Android-specific
- Moving paddingTop to tabBarItemStyle is cosmetically equivalent

### Risk: Low (preventive measure), Low-Medium (diagnostic-dependent fix)

---

## Backlog

### Bug #2: Week swipe gesture fragility
- Works on re-test. Known fragility in `WeekView.tsx:990-1033`
- Priority: Low (arrow buttons as fallback)

### Bug #6: Map display
- `app.json` has empty `googleMaps: {}` — missing API key
- Research `react-native-maplibre` as OSM alternative
- Priority: Medium

---

## Verification Plan

### Phase 1: Build

1. **Android:** Rebuild with changes, install on Pixel 7a emulator
   ```bash
   cd mobile-app/e2e && npm run build:android
   adb install -r <apk>
   ```
2. **iOS:** Rebuild for iOS simulator
   ```bash
   cd mobile-app/e2e && npm run build:ios
   ```

### Phase 2: E2E Regression (existing 48 tests)

Run the full existing test suite on both platforms to detect regressions. Use subagents for parallel platform testing.

**iOS (expect 48/48):**
```bash
cd mobile-app/e2e
npm run infra:ios      # Terminal 1
npm run test:ios       # Terminal 2
```

**Android (expect 45-48/48, known shifts flakiness ~25%):**
```bash
cd mobile-app/e2e
npm run infra:android  # Terminal 1
npm run test:android   # Terminal 2
```

**Key suites to watch for regressions:**
- `shifts.test.js` — Uses TemplatePanel (Fix 1 changes KAV wrapper)
- `manual-session.test.js` — Uses ManualSessionForm (Fix 1 changes KAV wrapper)
- `calendar.test.js` — Uses MonthView/WeekView (Fix 2 changes Text→AppText)
- `auth.test.js` — Tests tab bar visibility (Fix 3 changes tabBarStyle)

**Pass criteria:** Same or better pass rate as before changes (iOS 48/48, Android 45+/48).

### Phase 3: Targeted Manual Testing (Android)

These are manual tests using mobile-mcp or Maestro tools on the Android emulator because the existing E2E suite doesn't cover these scenarios.

**3a. Keyboard test (Fix 1) — subagent**
1. Launch app, navigate to Calendar tab
2. Tap FAB > Shifts > + New
3. Tap the duration minutes input field
4. **Screenshot:** Verify panel content stays above keyboard
5. **Check:** Save/Cancel buttons visible (scroll if needed)
6. Dismiss keyboard, verify panel returns to normal
7. Repeat for ManualSessionForm: FAB > Log Hours > tap start time
8. **Watch for:** Visual flicker when keyboard appears/disappears

**3b. Font scaling test (Fix 2) — subagent**
1. Set font scale:
   ```bash
   adb shell settings put system font_scale 1.3
   ```
2. Force-stop and relaunch app
3. **Screenshots at 1.3x:**
   - Status tab (dashboard cards)
   - Calendar tab, month view (check all 7 day columns, 2-digit numbers)
   - Calendar tab, week view (time labels, day headers)
   - Tab bar (labels readable, not truncated)
4. Set extreme scale:
   ```bash
   adb shell settings put system font_scale 1.5
   ```
5. **Screenshots at 1.5x:** Same screens — document what breaks (expected: some overflow at 1.5x since cap is 1.3x, but layout should degrade gracefully, not catastrophically)
6. Reset:
   ```bash
   adb shell settings put system font_scale 1.0
   ```

**3c. Nav bar diagnostic (Fix 3) — subagent**
1. Switch to 3-button navigation:
   ```bash
   adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton
   ```
2. **Screenshot:** Tab bar with 3-button nav — check for overlap
3. Capture `insets.bottom` value (from debug logging if added)
4. Switch to gesture navigation:
   ```bash
   adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural
   ```
5. **Screenshot:** Tab bar with gesture nav — check for excessive padding
6. **Document findings:** Report actual inset values and whether overlap occurs

### Phase 4: Visual Testing (iOS)

Use mobile-mcp tools on iOS simulator to check for visual regressions from AppText migration and tabBarStyle changes.

**Screens to capture and analyze — subagent:**
1. Status tab (dashboard) — check text sizing, card layout
2. Calendar month view — check day numbers, weekday headers, summary
3. Calendar week view — check time labels, day columns, session blocks
4. TemplatePanel (FAB > Shifts > + New) — check form labels, buttons
5. ManualSessionForm (FAB > Log Hours) — check time inputs, submit button
6. Tab bar — check label sizing, spacing, icon alignment

**Analysis criteria (per `docs/visual-testing/DESIGN_CHECKLIST.md`):**
- Text not truncated
- Spacing consistent with theme tokens
- Colors match theme
- Touch targets ≥44pt
- No visual glitches from AppText migration

**Save screenshots to:** `mobile-app/visual-testing/screenshots/2026-02-04/`

### Phase 5: Report

Generate summary report documenting:

| Test Area | Platform | Result | Notes |
|-----------|----------|--------|-------|
| E2E regression | iOS | ?/48 | |
| E2E regression | Android | ?/48 | |
| Keyboard (Fix 1) | Android | PASS/FAIL | Screenshots |
| Font 1.3x (Fix 2) | Android | PASS/FAIL | Screenshots |
| Font 1.5x (Fix 2) | Android | PASS/FAIL | Expected: graceful degradation |
| Nav bar (Fix 3) | Android | DIAGNOSTIC | Inset values + screenshots |
| Visual regression | iOS | PASS/ISSUES | Screenshots + checklist |

**Uncertain results are OK** — clearly document what was tested, what passed, what couldn't be verified, and why. The human reviewer (you) makes the final call.

### Subagent Strategy

During implementation + verification, use subagents for:
1. **Build agent** — Build iOS and Android in parallel (background)
2. **iOS E2E agent** — Run existing 48 tests on iOS
3. **Android E2E agent** — Run existing 48 tests on Android
4. **Android manual test agent** — Keyboard, font scaling, nav bar tests with screenshots
5. **iOS visual test agent** — Screenshot capture and analysis

Each subagent gets full context: the specific fix being verified, the expected behavior, the tools to use, and the pass/fail criteria. The main agent (me) reviews all subagent results and produces the final report.

---

## Files Summary

| File | Change | Risk | iOS Impact |
|------|--------|------|------------|
| `TemplatePanel.tsx` | KAV behavior="height" on Android (or keyboard listener fallback) | Low | None |
| `ManualSessionForm.tsx` | Same as TemplatePanel | Low | None |
| `AppNavigator.tsx` | `tabBarAllowFontScaling: false`, move paddingTop to itemStyle, safeAreaInsets override | Low | None (Platform guard) |
| `components/ui/AppText.tsx` | New wrapper: `<Text maxFontSizeMultiplier={1.3}>` | Low | Caps at 1.3x |
| `components/ui/AppTextInput.tsx` | New wrapper: `<TextInput maxFontSizeMultiplier={1.3}>` | Low | Caps at 1.3x |
| `MonthView.tsx` | Replace `Text` imports with `AppText` | Low | Caps at 1.3x |
| `WeekView.tsx` | Replace `Text` imports with `AppText` | Low | Caps at 1.3x |
| `StatusScreen.tsx` | Replace `Text` imports with `AppText` | Low | Caps at 1.3x |

---

## Session Recovery (2026-02-05)

**Issue:** Verification session crashed due to API error — accumulated screenshots (>2000px dimension) in conversation history triggered `invalid_request_error` on every subsequent API call. Session became unrecoverable.

### Implementation Status

All 3 fixes are **implemented but uncommitted**:

| Fix | Files Modified | Status |
|-----|----------------|--------|
| 1 (Keyboard) | `TemplatePanel.tsx`, `ManualSessionForm.tsx` | ✅ Code complete |
| 2 (Font scaling) | `AppText.tsx`, `AppTextInput.tsx` (new), `MonthView.tsx`, `WeekView.tsx`, `StatusScreen.tsx`, `TemplatePanel.tsx`, `ui/index.ts` | ✅ Code complete |
| 3 (Nav bar) | `AppNavigator.tsx` | ✅ Code complete |

### Verification Status

| Task | Status | Artifacts |
|------|--------|-----------|
| Android APK build | ✅ Done | `mobile-app/e2e/app-release.apk` (112MB) |
| iOS simulator build | ⚠️ Needs verification | No .app bundle found |
| E2E regression (48 tests) | 🔴 Not run | Session crashed before/during |
| Font scaling 1.3x test | ✅ Done | Screenshots captured |
| Font scaling 1.5x test | ✅ Done | Screenshots captured |
| 3-button nav test | ✅ Done | Screenshot captured |
| Keyboard test (Fix 1) | ❓ Unknown | No screenshot found |
| iOS visual testing | ⬜ Not started | |

### Screenshots Captured

Location: `mobile-app/visual-testing/screenshots/2026-02-04/`

| Screenshot | Test |
|------------|------|
| `android-status-1.3x.png` | Font scaling - Status screen |
| `android-calendar-1.3x.png` | Font scaling - Calendar |
| `android-month-1.3x.png` | Font scaling - Month view |
| `android-week-1.3x.png` | Font scaling - Week view |
| `android-status-1.5x.png` | Font scaling stress test |
| `android-month-1.5x.png` | Font scaling stress test |
| `android-status-3button.png` | Nav bar overlap test |
| `android-welcome-1.3x.png` | Font scaling - Welcome |

### Remaining Work

1. Verify/rebuild iOS simulator app
2. Run E2E regression tests on both platforms
3. Verify keyboard fix (Fix 1) with manual test
4. iOS visual testing
5. Generate final verification report
6. Commit changes

---

## Workflow Improvements: Mobile Testing with Screenshots

**Root cause of crash:** When using mobile-mcp tools, `mobile_take_screenshot` embeds full-resolution images in the conversation. Android emulator screenshots (Pixel 7a: 1080x2400) accumulate quickly. The API has a 2000px dimension limit for "many-image requests" — once exceeded, all subsequent API calls fail, including `/compact`.

### Options Under Consideration

#### Option A: Resize Screenshots Before Embedding

**Approach:** Modify the screenshot workflow to downscale images before they enter conversation.

**Pros:**
- Allows more screenshots per session
- Main agent can still see images directly

**Cons:**
- Loses detail for debugging (small text, precise pixel issues)
- Doesn't address the fundamental accumulation problem
- Would require MCP tool modification or post-processing

**Implementation complexity:** Medium (need to intercept/resize images)

#### Option B: Subagent Isolation for Visual Work

**Approach:** Always use a dedicated subagent for mobile testing that takes screenshots and returns text summaries. Main agent never sees raw images.

**Pros:**
- Main conversation stays clean — no image accumulation
- Subagent can take many screenshots without affecting main session
- Subagent crash is recoverable (just spawn a new one)
- Text summaries are searchable and persistent

**Cons:**
- Indirection — main agent relies on subagent's interpretation
- Can't "show" user the actual screenshot in main conversation
- Subagent still has same image limits (but isolated)

**Implementation complexity:** Low (workflow change, no code changes)

#### Option C: File-Based Screenshots with Path References

**Approach:** Always use `mobile_save_screenshot` instead of `mobile_take_screenshot`. Reference screenshots by file path. Only read specific images when needed.

**Pros:**
- No automatic embedding in conversation
- Can accumulate unlimited screenshots
- Main agent can selectively read images when needed

**Cons:**
- Requires discipline to use save vs take
- Reading images still adds them to conversation
- More manual workflow

**Implementation complexity:** Low (behavioral change)

#### Option D: Combined Approach (Recommended?)

**Approach:** Combine B + C:
1. **Subagent does all mobile testing** — isolated conversation
2. **Subagent saves screenshots to files** — not embedded
3. **Subagent returns text report** — findings, pass/fail, file paths
4. **Main agent reads specific images only if needed** — for user review

**Pros:**
- Best of both worlds — isolation + file-based storage
- Main conversation never accumulates images passively
- Full-resolution screenshots preserved on disk
- Recoverable from subagent crashes
- User can view screenshots directly from file paths

**Cons:**
- Most complex workflow to follow consistently
- Requires clear documentation and discipline

**Implementation complexity:** Low-Medium (workflow docs + subagent prompt templates)

### Decision: Two Specialized Subagents

After discussion, the recommended approach is **Option D (Combined)** with two specialized subagents:

1. **E2E Regression Agent** — Runs Appium test suite, no screenshots needed
2. **Visual Inspector Agent** — Screenshot-based analysis, isolated from main conversation

**Key decisions:**
- Visual Inspector chooses when to embed screenshots (trade-off: context vs detail)
- Downsampled images (50%) available when full resolution isn't needed
- When uncertain, escalate to human rather than main agent viewing images
- Main agent receives text reports with file paths, not raw images

**Full templates:** See `docs/MOBILE_TESTING_AGENTS.md`

---

## Mobile Testing Agent Templates (Summary)

### Agent 1: E2E Regression Agent

**When to use:** Running the existing Appium test suite to check for regressions after code changes.

**Subagent type:** `Bash` (primarily runs npm scripts)

**Prompt template:**

```
Run E2E regression tests for [PLATFORM: ios | android | both].

CONTEXT:
- Working directory: /Users/user01/open_workinghours
- Test location: mobile-app/e2e/
- Expected results: iOS 48/48 (~200s), Android 45-48/48 (~160s, known shifts flakiness)

PREREQUISITES (verify before running tests):
1. Check if simulator/emulator is running:
   - iOS: xcrun simctl list devices | grep Booted
   - Android: adb devices
2. Check if Appium infrastructure is running (or start it)

WORKFLOW:
1. Verify prerequisites
2. If infra not running: npm run infra:[platform] (run in background)
3. Wait for infra to be ready (~10s)
4. Run tests: npm run test:[platform]
5. Capture full output

DO NOT:
- Take screenshots (tests are testID-based, not visual)
- Use mobile-mcp tools (Appium handles device interaction)
- Attempt to fix failing tests (report only)

REPORT FORMAT:
## E2E Regression Results — [Platform]

**Result:** [PASS | FAIL] ([X]/48 tests)
**Duration:** [X]s

### Summary
[1-2 sentences: all passing, or which suites failed]

### Failures (if any)
| Suite | Test | Error |
|-------|------|-------|
| [suite] | [test name] | [error message] |

### Notes
[Any observations: flakiness, timing issues, infrastructure problems]
```

**Example invocation:**
```
Task(subagent_type="Bash", prompt="Run E2E regression tests for ios. [template above]")
```

---

### Agent 2: Visual Inspector Agent

**When to use:**
- Visual regression testing (systematic screen checks)
- Manual bug verification (specific fix validation)
- Any task requiring screenshot analysis

**Subagent type:** `general-purpose` (needs file ops, mobile-mcp, vision)

**Prompt template:**

```
Visual inspection task: [DESCRIPTION]

CONTEXT:
- Platform: [ios | android]
- Device: [device ID or "auto-detect"]
- Screenshot directory: mobile-app/visual-testing/screenshots/[YYYY-MM-DD]/

REFERENCE DOCS:
- Design checklist: docs/visual-testing/DESIGN_CHECKLIST.md
- Screen inventory: docs/visual-testing/SCREEN_INVENTORY.md
- Theme tokens: mobile-app/src/theme/

CHECKS TO PERFORM:
[List specific checks, e.g.:]
1. Font scaling at 1.3x — verify all 7 day columns visible in month view
2. Nav bar overlap — check tab bar not obscured by system nav
3. [etc.]

WORKFLOW:

For each check:

1. **Try view hierarchy first** (saves context, fast):
   - Use mobile_list_elements_on_screen to see element structure
   - Many issues are detectable without vision: missing elements, wrong text, layout broken
   - If the check can be answered from hierarchy → answer it, move on

2. **If visual confirmation needed**, choose resolution:
   - **Full resolution**: For pixel-level detail (font rendering, exact spacing, small text)
   - **Downsampled (50%)**: For general layout, color, major visual issues
   - Save to file: mobile_save_screenshot(device, saveTo="[screenshot_dir]/[name].png")

3. **To analyze a screenshot**:
   - Read the saved file to embed it in your context
   - Analyze against design checklist criteria
   - Note: Each embedded image uses context — be selective

4. **If uncertain about a finding**:
   - DO NOT ask main agent to view the image
   - Instead, document the uncertainty clearly in your report
   - Include file path so human can review directly
   - Mark as "NEEDS HUMAN REVIEW" with specific question

CONTEXT MANAGEMENT:
- View hierarchy analysis: ~0 context cost, use freely
- Downsampled screenshot: ~moderate context cost
- Full resolution screenshot: ~high context cost
- Choose based on what the check actually requires
- When in doubt, save to file + describe in text, let human view if needed

DO NOT:
- Embed screenshots in main agent conversation (return text report only)
- Accumulate more than ~5-6 full-resolution images in your own context
- Guess at issues you can't verify — mark as uncertain instead

REPORT FORMAT:

## Visual Inspection Report — [Description]

**Platform:** [iOS/Android] ([device])
**Date:** [YYYY-MM-DD]
**Checks:** [X] performed, [Y] passed, [Z] issues, [W] needs review

### Results

| # | Check | Method | Result | Screenshot | Notes |
|---|-------|--------|--------|------------|-------|
| 1 | [description] | hierarchy/vision | PASS/FAIL/REVIEW | [path or "—"] | [notes] |

### Issues Found

#### Issue #[N]: [Title]
- **Severity:** Low | Medium | High
- **Screenshot:** `[file path]`
- **Expected:** [what should happen]
- **Actual:** [what was observed]
- **Recommendation:** [suggested fix]

### Needs Human Review

#### Review #[N]: [Question]
- **Screenshot:** `[file path]`
- **Context:** [what you checked, what you saw]
- **Question:** [specific question for human]

### Screenshots Saved
[List of all saved file paths for reference]
```

**Example invocations:**

```
# Systematic visual regression
Task(subagent_type="general-purpose", prompt="""
Visual inspection task: Calendar screens visual regression after AppText migration

Platform: ios
Device: auto-detect
Screenshot directory: mobile-app/visual-testing/screenshots/2026-02-05/

CHECKS TO PERFORM:
1. Month view — day numbers readable, 7 columns, summary section
2. Week view — time labels, day headers, session blocks
3. FAB menu — all options visible, proper spacing
4. TemplatePanel — form labels not truncated
5. Tab bar — labels readable, icons aligned

[rest of template]
""")
```

```
# Specific bug verification
Task(subagent_type="general-purpose", prompt="""
Visual inspection task: Verify Android font scaling fix (Bug #4)

Platform: android
Device: emulator-5554
Screenshot directory: mobile-app/visual-testing/screenshots/2026-02-05/

SETUP (run before checks):
adb shell settings put system font_scale 1.3

CHECKS TO PERFORM:
1. Status screen — dashboard cards readable, no truncation
2. Month view — all 7 day columns visible, 2-digit day numbers fit
3. Week view — time labels readable, day headers fit
4. Tab bar — labels not truncated ("Status", "Kalender", "Einstellungen")

TEARDOWN (run after checks):
adb shell settings put system font_scale 1.0

[rest of template]
""")
```

---

### Orchestration Pattern

When the main agent needs mobile testing:

```
1. DECIDE which agent(s) needed:
   - Code changes that might break flows → E2E Regression Agent
   - Visual changes (styling, layout, spacing) → Visual Inspector Agent
   - Both? Run in sequence (E2E first to catch functional breaks)

2. SPAWN subagent with appropriate template
   - Fill in [PLACEHOLDERS] with specifics
   - Set run_in_background=true if doing multiple tasks

3. RECEIVE text report from subagent
   - Parse results
   - If "NEEDS HUMAN REVIEW" items exist, relay to user with file paths

4. AGGREGATE if multiple agents ran
   - Combine into single summary for user

5. NEVER read screenshot files in main conversation
   - Exception: User explicitly requests to see a specific image
   - Even then, warn about context cost first
```

---

### Downsampling Screenshots

When Visual Inspector needs a downsampled image, use ImageMagick (available on macOS):

```bash
# Save full resolution first
mobile_save_screenshot(device, saveTo="path/to/full.png")

# Create 50% downsampled version
convert path/to/full.png -resize 50% path/to/downsampled.png

# Read the downsampled version for analysis
Read(file_path="path/to/downsampled.png")
```

The agent can then analyze the downsampled version while preserving the full resolution file for human review if needed.

---

### Recovery from Subagent Crash

If a Visual Inspector subagent crashes (too many images):

1. Note which checks were completed (from partial output if available)
2. Spawn new subagent with remaining checks only
3. New prompt should reference: "Checks 1-3 already completed. Continue from check 4."
4. Screenshots from crashed session are preserved on disk

---
