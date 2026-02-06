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

**→ See [docs/testing/](./testing/)** for testing workflows.

Testing often involves screenshots or long-running processes. Lean towards using specialized subagents:

| Test Type | Subagent | Documentation |
|-----------|----------|---------------|
| E2E Regression | Bash | [testing/e2e-regression.md](./testing/e2e-regression.md) |
| Visual Inspection | general-purpose | [testing/visual-inspection.md](./testing/visual-inspection.md) |

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

---

## Tips

- **Parallelize aggressively**: If tasks don't depend on each other, run them simultaneously
- **Fail fast**: Verify prerequisites before starting main work
- **Document as you go**: Update docs while context is fresh
- **Lean towards subagents**: For testing, exploration, and risky operations
