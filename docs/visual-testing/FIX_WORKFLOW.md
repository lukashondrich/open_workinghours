# Visual Fix Workflow

**Purpose:** Document the manager/subagent workflow for implementing and validating visual fixes.

---

## Overview

Visual fixes use a two-layer workflow:

1. **Manager** (main Claude session) — coordinates work, spawns subagents, verifies results
2. **Subagent** (spawned Task) — implements fix, takes screenshots, reports results

This separation ensures:
- Fixes are atomic and well-scoped
- Validation is honest (subagent admits uncertainty)
- Human is in the loop for verification

---

## Manager Responsibilities

### Before Spawning Subagent

1. **Identify the issue clearly**
   - What's wrong visually?
   - Which screen/component?
   - What should it look like after the fix?

2. **Gather context for subagent**
   - File path(s) likely involved
   - Relevant style/theme token values
   - Device ID for screenshots
   - Build system info (rebuild needed?)

3. **Reference the protocol docs**
   - `BUILD_AND_RELOAD.md` — when rebuild is needed
   - `VALIDATION_PROTOCOL.md` — how to verify
   - `DESIGN_CHECKLIST.md` — specific criteria

### Spawning the Subagent

Provide a comprehensive prompt including:

```
## Task: [Clear title]

### Context
- Project location
- What the app is

### The Issue
- What's wrong
- Where it is (screen, component)
- Expected result after fix

### Build System
- Is rebuild needed? (usually yes for TEST_MODE builds)
- Command to rebuild

### Step-by-Step Instructions
1. Take BEFORE screenshot
2. Make the fix (specific file, what to change)
3. Rebuild if needed
4. Take AFTER screenshot
5. Compare and report

### Validation Reminder
- Don't claim "verified" unless clearly visible
- If uncertain, hand off to human
```

### After Subagent Completes

1. **Review the subagent's report**
   - Did they follow the protocol?
   - Did they claim certainty or uncertainty?

2. **Show screenshots to human**
   - Always display BEFORE and AFTER
   - Even if subagent claims "clearly visible"

3. **Get human verification**
   - Ask: "Can you see the difference?"
   - Record the verdict

4. **Update tracking**
   - Mark issue as FIXED or still pending
   - Note any follow-up needed

---

## Subagent Responsibilities

### Follow the Validation Protocol

1. **Understand the build system**
   - Read `BUILD_AND_RELOAD.md`
   - Determine if rebuild is needed
   - Don't assume hot-reload works

2. **Take proper BEFORE screenshot**
   - Before making ANY code changes
   - Save with clear name: `{issue}-BEFORE.png`

3. **Make the fix**
   - Minimal change needed
   - Document what was changed

4. **Rebuild if needed**
   - Run build command
   - Wait for completion

5. **Take AFTER screenshot**
   - Same screen state as BEFORE
   - Save with clear name: `{issue}-AFTER.png`

6. **Compare honestly**
   - Look carefully at the specific area
   - Report one of:
     - **Clearly visible** — describe what's different
     - **Uncertain** — provide screenshots, request human verification
     - **No change** — report possible issues

### Key Rules for Subagents

- **Never claim "verified" unless you can clearly see the difference**
- **Uncertainty is okay** — better to hand off than falsely claim success
- **Provide screenshot paths** — always include both BEFORE and AFTER
- **Describe what you see** — don't just say "looks good"

---

## Human's Role

### When to Verify

Human verification is needed when:
- Subagent claims "clearly visible" (confirm it's actually visible)
- Subagent is uncertain (make the call)
- Change is subtle (spacing, alignment, slight color)

### How to Verify

1. Manager displays BEFORE and AFTER screenshots
2. Human compares the specific area mentioned
3. Human confirms: "Yes I see it" or "No, looks the same"

### Verdict Recording

Human verdict determines the issue status:
- **Confirmed visible** → Issue marked FIXED
- **Not visible** → Fix didn't work or needs different approach
- **Uncertain** → May need higher resolution or different test

---

## Manager Validation Loop

**This is the critical step that saves context and ensures quality.**

After the subagent completes, the manager (main Claude session) validates the work before accepting it. This validation loop continues until the fix is confirmed or abandoned.

### The Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                      MANAGER VALIDATION LOOP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Subagent completes → Manager reviews report                    │
│                              ↓                                   │
│                    Manager shows screenshots                     │
│                       to human for verification                  │
│                              ↓                                   │
│                     Human provides verdict                       │
│                              ↓                                   │
│              ┌───────────────┼───────────────┐                   │
│              ↓               ↓               ↓                   │
│         "Yes, fixed"    "Not sure"    "No, same"                 │
│              ↓               ↓               ↓                   │
│         Mark DONE      Investigate     ITERATE                   │
│                        (zoom in,      (spawn new                 │
│                        different      subagent with              │
│                        angle)         different approach)        │
│                              ↓               ↓                   │
│                         Still unclear?   New fix attempt         │
│                              ↓               ↓                   │
│                         Mark as          Back to top             │
│                         NEEDS_REVIEW     of loop                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Manager Decision Tree

After showing BEFORE/AFTER to human:

| Human Says | Manager Action |
|------------|----------------|
| "Yes, I can see the fix" | Mark issue FIXED ✅, update tracking |
| "Not sure / too subtle" | Try zooming in, different screenshot angle, or mark NEEDS_REVIEW |
| "No, looks the same" | **Iterate**: analyze why, spawn new subagent with different approach |
| "Fix is wrong / broke something" | **Iterate**: revert if needed, spawn subagent with corrected approach |

### When to Iterate

Spawn a new subagent when:
- Human says fix isn't visible
- Subagent reported "no change visible"
- The approach was wrong (e.g., wrong file, wrong property)
- Build didn't actually include the changes

**Iteration prompt should include:**
- What was tried before (and why it didn't work)
- New approach to try
- Same BEFORE screenshot (or take fresh one if state changed)

### When to Stop Iterating

Stop after 2-3 attempts if:
- Fix requires architectural changes beyond visual tweaking
- Issue is actually a design decision, not a bug
- Human decides it's acceptable as-is

Mark as `WONT_FIX` or `DEFERRED` with reason.

### Context Efficiency

**Why this pattern saves context:**
- Subagent does the heavy lifting (file exploration, code changes, rebuilds, screenshots)
- Manager only sees: issue description → subagent summary → screenshots
- If iteration needed, new subagent starts fresh (doesn't inherit bloated context)
- Human stays in control without reading implementation details

---

## Example Flow

### Manager starts:
```
User wants to fix: "Summary background should be gray, not white"

I'll spawn a subagent with:
- Issue description
- File to modify (MonthView.tsx)
- Expected change (backgroundColor: paper → default)
- Build instructions
- Validation protocol reference
```

### Subagent executes:
```
1. Took BEFORE screenshot (14:47) — white background
2. Changed backgroundColor to colors.background.default
3. Rebuilt app (npm run build:ios)
4. Took AFTER screenshot (14:51) — gray background
5. Compared: "Clearly visible — summary is now gray vs white tab bar"
```

### Manager verifies:
```
Subagent claims "clearly visible"
Let me show human the screenshots...

[Displays BEFORE and AFTER]

"Can you see the difference?"
```

### Human confirms:
```
"Yes, I can see the difference"
```

### Manager records:
```
Issue #2: FIXED and VERIFIED ✅
```

---

## Example Flow: Iteration Needed

### Attempt 1:

**Subagent reports:**
```
Made fix: Added marginHorizontal: -16 to divider style
BEFORE/AFTER screenshots taken
Comparison: Uncertain — cannot clearly see difference
```

**Manager shows screenshots to human:**
```
Human: "No, looks the same to me"
```

**Manager decision: ITERATE**
```
The negative margin approach didn't work. Let me check the component
structure — the divider might be inside a padded container.

Spawning new subagent with:
- Previous approach (negative margin) didn't work
- New approach: Check if divider is inside ScrollView with contentContainerStyle padding
- Try removing padding from parent OR moving divider outside padded container
```

### Attempt 2:

**Subagent reports:**
```
Found issue: Divider was inside contentContainerStyle with padding
Fix: Moved divider outside the padded container
BEFORE/AFTER screenshots taken
Comparison: Clearly visible — divider now touches screen edges
```

**Manager shows screenshots to human:**
```
Human: "Yes, I can see it now"
```

**Manager records:**
```
Issue #1: FIXED and VERIFIED ✅ (2 attempts)
```

---

## Checklist for Each Fix

### Manager Checklist
- [ ] Issue clearly identified
- [ ] Subagent prompt includes all context
- [ ] Build system info provided
- [ ] Validation protocol referenced
- [ ] Screenshots shown to human after subagent completes
- [ ] Human verdict recorded

### Subagent Checklist
- [ ] Read BUILD_AND_RELOAD.md
- [ ] Took BEFORE screenshot
- [ ] Made minimal fix
- [ ] Rebuilt if needed (TEST_MODE builds always need rebuild)
- [ ] Took AFTER screenshot
- [ ] Compared honestly
- [ ] Reported with appropriate certainty level
- [ ] Provided both screenshot paths

---

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Subagent claims "verified" without clear evidence | Protocol requires describing what's different |
| BEFORE screenshot taken after fix already applied | Take BEFORE before any code changes |
| Assuming hot-reload works | Always check build type, rebuild if TEST_MODE |
| Manager accepts subagent's claim without human check | Always show screenshots to human |
| Subtle changes falsely claimed as visible | Subagent should admit uncertainty for subtle changes |

---

## Related Documentation

- `BUILD_AND_RELOAD.md` — When rebuild is needed vs hot-reload
- `VALIDATION_PROTOCOL.md` — Detailed validation steps and reporting
- `DESIGN_CHECKLIST.md` — Specific visual criteria to check
- `DESIGN_PRINCIPLES.md` — Higher-level UX principles
