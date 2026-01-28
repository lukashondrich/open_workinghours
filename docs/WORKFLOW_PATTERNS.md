# Workflow Patterns

Reusable patterns for implementing features and fixing issues in this codebase.

---

## Multi-Agent Task Workflow

A structured approach for complex, multi-step tasks that benefits from parallel execution and clear progress tracking.

### When to Use

- Tasks with 3+ distinct phases or steps
- Work that can be parallelized (independent subtasks)
- Complex debugging or investigation
- Cross-cutting changes (multiple files/systems)

### Structure

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

### Task Definition Template

Each task should include:

| Field | Description | Example |
|-------|-------------|---------|
| **Subject** | Brief imperative title | "Add permission dialog handling" |
| **Description** | What needs to be done, acceptance criteria | "Add auto-dismissal for Android notification permission dialog" |
| **ActiveForm** | Present continuous for progress display | "Adding permission handling" |
| **Dependencies** | What must complete first | blockedBy: ["1"] |

### Dependency Rules

1. **Sequential tasks**: Use `blockedBy` to create dependency chain
2. **Parallel tasks**: No dependencies between them, can run simultaneously
3. **Integration tasks**: Block on all implementation tasks

### Example: Android E2E Testing (2026-01-27)

**Phase 1: Infrastructure (Sequential)**
```
Task 1: Install e2e-testing APK and verify TEST_MODE
  - Download APK from EAS
  - Install on emulator
  - Verify code "123456" works
```

**Phase 2: Investigation (Parallel)**
```
Task 2: Verify tab testIDs on Android
  - Navigate to each tab using testID
  - Confirm accessibility tree exposure

Task 3: Add permission dialog handling
  - Add Android system dialog dismissal
  - Handle notification permission

Task 4: Fix test ordering and state management
  - Add ensureAuthenticated() helper
  - Update tests to use it
```

**Phase 3: Integration**
```
Task 5: Run full test suite and document results
  - Execute npm run test:android
  - Update CLAUDE.md with results
```

### Progress Tracking

Update task status as you work:

```
pending → in_progress → completed
```

- Mark `in_progress` BEFORE starting work
- Mark `completed` only when fully done
- If blocked, note the blocker in task comments

### Escalation Triggers

Stop and reassess when:

- Build/install failures
- Unclear requirements about expected behavior
- Architectural decisions affecting multiple files
- Test failures with unclear root cause

### Verification Checklist

After each phase:

- [ ] All phase tasks marked complete
- [ ] Verification step passed (tests, manual check)
- [ ] No regressions introduced
- [ ] Documentation updated if needed

---

## Other Workflow Patterns

### Feature Implementation

```
1. Read CLAUDE.md + relevant ARCHITECTURE.md
2. Create *_PLAN.md if complex
3. Implement with tests
4. Update ARCHITECTURE.md
5. Archive plan doc
```

### Bug Investigation

```
1. Reproduce the issue
2. Identify root cause (logs, debugging)
3. Create minimal fix
4. Add regression test
5. Document in KNOWN_ISSUES.md if relevant
```

### Deployment

See `docs/deployment.md` for production deployment workflow.

---

## Tips

- **Parallelize aggressively**: If tasks don't depend on each other, run them simultaneously
- **Fail fast**: Verify prerequisites before starting main work
- **Document as you go**: Update docs while context is fresh
- **Time-box investigation**: Set limits on debugging before escalating

---

## Android E2E Testing Patterns

### testID Visibility on Android

React Native's `testID` maps to `resource-id` on Android. Common issues:

**Problem**: Elements inside Views aren't visible to Appium/UiAutomator.

**Solution**: Add `accessible={false}` to parent Views:
```jsx
<View accessible={false}>        {/* Allows children to be individually accessible */}
  <TouchableOpacity
    testID="my-button"
    accessible={true}>           {/* Makes this element findable */}
    <Text>Click me</Text>
  </TouchableOpacity>
</View>
```

**Key rules:**
1. Parent View needs `accessible={false}` to prevent child aggregation
2. Tappable elements need `accessible={true}` to appear in tree
3. Add `collapsable={false}` to prevent Android view flattening
4. Use `resourceIdMatches(".*testId.*")` selector for robustness

**References:**
- [RN Issue #6560](https://github.com/facebook/react-native/issues/6560) - accessible aggregation
- [RN Issue #30226](https://github.com/facebook/react-native/issues/30226) - testID visibility
