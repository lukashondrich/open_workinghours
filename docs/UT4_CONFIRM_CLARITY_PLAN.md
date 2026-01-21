# UT-4: Confirm Action Clarity

**Created:** 2026-01-19
**Status:** Implemented
**Issue:** Users don't understand that "Confirm" means data becomes uneditable and gets submitted

---

## Problem

Users don't understand two critical consequences of the "Confirm" action:
1. **Permanence**: Data becomes uneditable after confirmation
2. **Submission**: Data gets published to the backend

Current UX only shows "Confirm?" button and a brief toast after confirmation.

---

## Solution

Two-part approach based on UX research:

### Part 1: First-Time Tooltip (One-Time Education)

Trigger a tooltip/modal when user taps confirm for the **first time ever**.

**Content (EN):**
```
ℹ️ Submitting Your Hours

This sends your tracked hours to the study.
Once submitted, they can't be edited.

[Got it]
```

**Content (DE):**
```
ℹ️ Stunden einreichen

Dies sendet deine erfassten Stunden an die Studie.
Nach dem Einreichen können sie nicht mehr bearbeitet werden.

[Verstanden]
```

**Behavior:**
- Appears as a small modal/tooltip near the confirm button
- User taps "Got it" → dismissed forever
- Flag stored in AsyncStorage: `hasSeenConfirmTooltip: true`
- If flag exists, skip tooltip and confirm immediately

### Part 2: Clearer Labeling + Inline Hint

**Button text change:**
| Current | New |
|---------|-----|
| "Confirm?" | "Submit" |
| "?" (compact) | "✓" (compact) |

**Header hint when reviewMode is active:**
- EN: `"Submit each day to finalize your hours"`
- DE: `"Reiche jeden Tag ein, um deine Stunden abzuschließen"`

Displayed in the header area, subtle gray text, only visible when GPS toggle is active.

---

## Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/i18n/translations/en.ts` | Add tooltip strings, update button text |
| `src/lib/i18n/translations/de.ts` | Add tooltip strings, update button text |
| `src/modules/calendar/components/WeekView.tsx` | Add tooltip logic, update button labels |
| `src/modules/calendar/components/CalendarHeader.tsx` | Add review mode hint text |

### New Files

| File | Purpose |
|------|---------|
| `src/lib/storage/onboardingStorage.ts` | AsyncStorage helpers for onboarding flags |

### Implementation Steps

1. **Add onboarding storage helper**
   - Create `onboardingStorage.ts` with `getHasSeenConfirmTooltip()` and `setHasSeenConfirmTooltip()`
   - Use `@react-native-async-storage/async-storage`

2. **Add translations**
   - `calendar.week.submit` → "Submit" / "Einreichen"
   - `calendar.week.submitCompact` → "✓"
   - `calendar.header.reviewHintSubmit` → hint text
   - `calendar.tooltip.confirmTitle` → tooltip title
   - `calendar.tooltip.confirmBody` → tooltip body
   - `calendar.tooltip.confirmDismiss` → "Got it" / "Verstanden"

3. **Update WeekView.tsx**
   - Import onboarding storage
   - Add state: `showConfirmTooltip: boolean`
   - On confirm button press:
     - Check `hasSeenConfirmTooltip` flag
     - If false: show tooltip, don't confirm yet
     - If true: proceed with confirmation
   - On tooltip dismiss:
     - Set flag to true
     - Proceed with confirmation
   - Update button text to use new translation keys

4. **Update CalendarHeader.tsx**
   - Add hint text below header when `reviewMode === true`
   - Style: small, gray, subtle

5. **Tooltip component**
   - Use React Native `Modal` or custom overlay
   - Position near the confirm button area
   - Simple design: icon, title, body, button
   - Light background with shadow

---

## Visual Design

```
┌─────────────────────────────────────────────┐
│  Week View Header                           │
│  ─────────────────────────────────────────  │
│  Submit each day to finalize your hours     │  ← New hint (gray, small)
├─────────────────────────────────────────────┤
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun    │
│   12    13    14    15    16    17    18    │
│  [✓]  [✓]  [Submit] ...                     │  ← New label
└─────────────────────────────────────────────┘

First-time tooltip (centered modal):
┌─────────────────────────────────┐
│  ℹ️ Submitting Your Hours       │
│                                 │
│  This sends your tracked hours  │
│  to the study. Once submitted,  │
│  they can't be edited.          │
│                                 │
│          [ Got it ]             │
└─────────────────────────────────┘
```

---

## Testing

- [x] First launch: tooltip appears on first confirm tap
- [x] After dismissing: tooltip never appears again
- [x] Button shows "Submit" (or "✓" compact)
- [x] Header hint visible only in review mode
- [x] German translations display correctly
- [x] Confirm flow still works after tooltip dismissal

**Note:** TypeScript check passes for all new code. Pre-existing TS errors in codebase are unrelated.

---

## Future Considerations

- Could add tooltip for other first-time actions (e.g., first shift placement)
- Onboarding storage could be extended for other flags
- Consider adding a "Learn more" link to privacy docs in tooltip

---

## References

- [NN/g: Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/)
- [Appcues: Mobile Onboarding Patterns](https://www.appcues.com/blog/essential-guide-mobile-user-onboarding-ui-ux)
- [Toggl: Timesheet Approvals](https://support.toggl.com/en/articles/8473437-how-do-i-submit-my-timesheets-for-approval)
