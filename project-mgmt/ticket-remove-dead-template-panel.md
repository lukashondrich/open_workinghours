# Ticket: Remove dead TemplatePanel component

**Priority:** Low (cleanup)
**Created:** 2026-07-23 (found during the overtime-scoping code review)
**Status:** Open

## Summary

`mobile-app/src/modules/calendar/components/TemplatePanel.tsx` (~850 lines) is
unreachable UI. Its only open trigger, `dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' })`,
is dispatched exclusively from inside the component itself (its own close/save
handlers) — nothing else in the app ever flips `templatePanelOpen` to true. The
Group C picker unification (2026-02-09) moved template management into
`InlinePicker`, which creates/edits/arms templates directly.

The component is still mounted on every CalendarScreen render, runs its
animation effect, and had one of the closed-sheet-peek bugs fixed 2026-07-23 —
maintenance cost for something users can never see.

## What to do

1. Confirm no dispatch site for `TOGGLE_TEMPLATE_PANEL` outside the component
   (grep; true as of 2026-07-23).
2. Remove the component, its render in `CalendarScreen.tsx`, the
   `templatePanelOpen`/`templatePanelTab` state + `TOGGLE_TEMPLATE_PANEL`/
   `SET_TEMPLATE_PANEL_TAB` actions in `calendar-reducer.ts`, and any e2e
   helpers referencing its testIDs.
3. Check e2e flows still pass (some older flows may reference template-panel
   testIDs that InlinePicker reuses — `template-panel-overlay` lives in
   InlinePicker, not TemplatePanel).

## Why not now

Out of scope for the overtime-scoping change set; deletion touches the reducer
and e2e helpers and deserves its own focused verification run.
