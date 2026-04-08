# Workflow Patterns

How to structure work, parallelize tasks, and use subagents effectively.

---

## Overview

For complex or specialized work, lean towards using subagents. This keeps the main conversation focused and recoverable.

| Workflow | Approach | Documentation |
|----------|----------|---------------|
| Building Features | Task decomposition, parallel execution | Below |
| Bug Investigation | Reproduce → fix → test | Below |
| **Testing** | **Use specialized subagents** | **[docs/testing/](./testing/)** |
| Deployment | See deployment.md | `docs/deployment.md` |

---

## Building Features

```
1. Read CLAUDE.md + relevant ARCHITECTURE.md
2. Create *_PLAN.md if complex
3. Implement with tests
4. Update ARCHITECTURE.md
5. Archive plan doc
```

### Multi-Phase Task Workflow

For complex features with 3+ distinct phases, use task decomposition:

```
Phase 1: Setup/Infrastructure (Sequential)
    └── Task 1.1: Prerequisites
    └── Task 1.2: Verification

Phase 2: Implementation (Parallel where possible)
    ├── Task 2.1: Component A
    ├── Task 2.2: Component B
    └── Task 2.3: Component C

Phase 3: Integration & Verification (Sequential)
    └── Task 3.1: Full test run
    └── Task 3.2: Documentation update
```

**Task definition:**

| Field | Description | Example |
|-------|-------------|---------|
| **Subject** | Brief imperative title | "Add permission dialog handling" |
| **Description** | What needs to be done | "Add auto-dismissal for Android notification permission dialog" |
| **ActiveForm** | Present continuous for progress | "Adding permission handling" |
| **Dependencies** | What must complete first | blockedBy: ["1"] |

**Progress tracking:** `pending → in_progress → completed`

---

## Bug Investigation

```
1. Reproduce the issue
2. Identify root cause (logs, debugging)
3. Create minimal fix
4. Add regression test
5. Document in KNOWN_ISSUES.md if relevant
```

**Escalation triggers** — stop and reassess when:
- Build/install failures
- Unclear requirements
- Architectural decisions affecting multiple files
- Test failures with unclear root cause

---

## Testing

Testing often involves screenshots or long-running processes. Lean towards using specialized subagents:

| Test Type | Subagent | Documentation |
|-----------|----------|---------------|
| **E2E Regression** | Bash | **[mobile-app/e2e/README.md](../mobile-app/e2e/README.md)** — runbook, Android pitfalls, TEST_MODE |
| Visual Inspection | general-purpose | Manual workflow (see below) |

**E2E is the primary doc for testing.** It covers the full runbook, platform-specific issues (especially Android), and hard-won debugging lessons.

---

## Deployment

See `docs/deployment.md` for production deployment workflow.

---

## Technical Patterns

### testID Visibility on Android

React Native's `testID` maps to `resource-id` on Android.

**Problem:** Elements inside Views aren't visible to Appium/UiAutomator.

**Solution:** Add `accessible={false}` to parent Views:
```jsx
<View accessible={false}>
  <TouchableOpacity testID="my-button" accessible={true}>
    <Text>Click me</Text>
  </TouchableOpacity>
</View>
```

**Key rules:**
1. Parent View needs `accessible={false}` to prevent child aggregation
2. Tappable elements need `accessible={true}` to appear in tree
3. Add `collapsable={false}` to prevent Android view flattening

### Android Real Device Testing

**Always test Android bugs on the real Samsung, not the emulator.** The Pixel 7a emulator (API 36) has Google Maps SDK crashes, and visual fixes that look correct on the emulator may not work on real hardware (e.g., Samsung One UI rendering differences).

**Workflow:**
1. Connect Samsung via USB (see `docs/ANDROID_BUGS_2026-03-31.md` for setup)
2. Run local dev build: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" GOOGLE_MAPS_API_KEY=<your-google-maps-android-key> npx expo run:android --device R58W910C8QD`
3. After first build, changes hot-reload — no rebuild needed for JS changes
4. **Observe the bug on device before writing any fix** — take screenshots via `adb` or mobile-mcp
5. Test fix live via hot reload
6. Don't trust emulator results for visual or map-related bugs

**Samsung device:** Galaxy A14 (SM-A145F), Android 15, API 35, ADB ID `R58W910C8QD`

**Key lesson (2026-04-02):** Blind fix → EAS build → test cycle wasted 3 iterations on bugs 2, 4, 5. The observe-first approach on real hardware is essential.

### Android Hot Reload Can Silently Fail

**Problem:** Changes to React Native code may appear to apply on Android (console.log fires, state is correct) but the **visual output doesn't update**. This can waste hours debugging layout/rendering issues that don't actually exist in the code.

**When it happens:**
- Navigation-level components (`AppNavigator.tsx`)
- Components inside `Animated.View` hierarchies
- After native config changes (`app.json`, `gradle.properties`)

**How to verify your code is actually running:**
1. **Check Metro connection:** Open dev menu (`adb shell input keyevent 82`) — confirm "Connected to" shows the Metro URL
2. **Force full reload:** Dev menu → Reload (hot reload alone is not sufficient)
3. **When in doubt, rebuild:** `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npx expo run:android`

**Native config changes** (`app.json` android section, `gradle.properties`) always require a rebuild — hot reload cannot apply them. Note: `expo run:android` reuses the existing `android/` directory; changes to `app.json` may need manual updates in `gradle.properties` or a `npx expo prebuild --platform android --clean`.

**Rule of thumb:** If a visual change works on iOS but not Android, verify fresh code is running before investigating Android-specific rendering issues.

---

## Delegating to Subagents

Subagents don't share the main conversation's context. **You must provide it.**

### Before launching a subagent

1. **Identify the relevant specs** — which docs define the domain the agent will work in?
2. **Include those docs in the prompt** — either inline the key sections, or instruct the agent to read specific files before acting
3. **Instruct the agent to ask for clarification** rather than guess when it lacks context. Bias toward asking, not toward action.

### Domain-specific rules

| Domain | Source of truth | Must-read before editing |
|--------|----------------|--------------------------|
| Privacy / DP | `docs/dp-group-stats-*.md` | Requirements v2 (composition model, neighboring relation), Accounting model (per-user budget, families), Simulation spec (canonical params) |
| GDPR / Legal | `docs/GDPR_COMPLIANCE.md` + `privacy_architecture.md` | Both, plus the DP specs above if DP parameters are involved |
| Mobile UI | `mobile-app/ARCHITECTURE.md` | Architecture doc + E2E patterns in CLAUDE.md |
| Backend API | `backend/ARCHITECTURE.md` | Architecture doc |

### Common failure mode

Giving a subagent parameter values (e.g., "K_MIN=5, ε=1.0") without the specs that explain what they mean leads to plausible-sounding but wrong statements. The agent will fill in gaps with reasonable-sounding language that misrepresents the actual design.

**Example:** An agent told "ε=1.0, annual cap 150" wrote "ε=1.0 per cell per week" — conflating noise calibration with privacy cost, missing the composition model entirely. This contaminated 6 external-facing documents.

**Fix:** Always include the relevant spec sections so the agent understands the semantics, not just the numbers.

---

## Tips

- **Parallelize aggressively**: If tasks don't depend on each other, run them simultaneously
- **Fail fast**: Verify prerequisites before starting main work
- **Document as you go**: Update docs while context is fresh
- **Lean towards subagents**: For testing, exploration, and risky operations
