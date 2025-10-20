 Create a Markdown file with ASCII-only formatting for easy copy-paste
content = """# Open Working Hours - Web Review Prototype To-Do

**Scope:** user-facing only, fake data, clickable prototype.  
**Flow:** Month -> Week -> Day review.

---

## Goals
- Show Month -> Week -> Day review flow.
- Visualize scheduled vs actual with micro-bars (month) and ghost overlay (week/day).
- Support split-with-connector for over-midnight shifts.
- Allow quick add/remove breaks (double-tap).
- Compute/display totals: scheduled, actual, overtime, on-call credit.
- Provide fake data with a scenario switcher.

---

## Milestone 1 - App shell & navigation
- [ ] Top bar: dataset selector, view switch (MONTH/WEEK/DAY), week navigation (prev / today / next).
- [ ] Single "cursor date" shared by all views.
- [ ] Month day click -> opens that day’s Week view; Week day label click -> opens Day view.  
**DoD:** Switching views preserves week/day context.

## Milestone 2 - Month view (at-a-glance)
- [ ] Month grid (Mon-Sun).
- [ ] Each day shows two micro-bars: scheduled (top) and actual (bottom).
- [ ] Overtime indicator when actual > scheduled.
- [ ] Dim days outside the current month.  
**DoD:** Hover/click reveals per-day numbers (scheduled h, actual h, overtime h).

## Milestone 3 - Week view (workhorse)
- [ ] Columns = Mon-Sun; vertical axis = 0-24h with hour grid lines.
- [ ] Scheduled "ghost band" behind actual to compare quickly.
- [ ] Actual shifts as rounded bars; break ticks shown as inner gaps.
- [ ] Over-midnight: split at midnight with a thin connector indicating continuity.
- [ ] On-call shifts look distinct and display credit percentage.  
**DoD:** Night-shift fixture shows connector at midnight.

## Milestone 4 - Day view (edit focus)
- [ ] 0-24h ruler + scheduled ghost band + actual shifts.
- [ ] Double-tap in the timeline: toggle a default-length break near that time within the covering shift.
- [ ] Totals update immediately after break changes.  
**DoD:** Add/remove break shows visible gap and numbers update without reload.

## Milestone 5 - Totals & formulas
- [ ] Per-day: compute
  - actual
  - scheduled
  - overtime = max(actual - scheduled, 0)
  - oncall_credit = sum(oncall_minutes * pct)
- [ ] Per-week panel aggregates across the 7 days.
- [ ] Display rounded to 0.1h; keep minute precision internally.  
**DoD:** Changing a break alters day + week totals consistently.

## Milestone 6 - Fixtures & scenario switcher
- [ ] At least two fixtures:
  - Regular week: Mon-Fri 09:00-17:30 (30m break 13:00); Thu overtime; on-call block (e.g., 20:00-23:00 @ 50%).
  - Night shifts: several 19:00-07:00 with a short 01:00-01:15 break.
- [ ] Dataset selector swaps fixtures without page reload.  
**DoD:** Switching datasets updates all views and totals.

## Milestone 7 - Settings (user defaults, not persisted)
- [ ] Panel to set Default Day: start, end, default break length/time.
- [ ] Field for on-call credit % (applies to on-call segments in totals).  
**DoD:** Changing defaults affects newly added breaks (length) and on-call credit math.

## Milestone 8 - States, anomalies, affordances
- [ ] Mark unreviewed days (badge or style) based on a boolean in fixture data.
- [ ] Conflict hint if two shifts overlap on a day.
- [ ] Empty states for days with no schedule/shift.  
**DoD:** Overlapping-shift fixture produces a visible hint.

## Milestone 9 - Accessibility & i18n hygiene
- [ ] Labels for all interactive controls (ARIA where appropriate).
- [ ] Keyboard: Tab to focus days; Enter to open day; Esc to go back.
- [ ] 24h time; locale-aware names; Monday as first weekday.  
**DoD:** Keyboard path Month -> Day works; screen reader announces bars with times.

## Milestone 10 - QA & edge cases (fixtures or unit checks)
- [ ] DST week (23h/25h day): totals are correct.
- [ ] Split shifts (e.g., 07:00-11:00 and 14:00-18:00): render as two bars; totals correct.
- [ ] No schedule but actual exists -> overtime equals actual; UI makes this clear.  
**DoD:** All three cases render and calculate correctly.

## Milestone 11 - Export (lightweight)
- [ ] Weekly summary export with per-day rows: date, scheduled_h, actual_h, overtime_h, oncall_credit_h.
- [ ] Include a total row.  
**DoD:** File opens in a spreadsheet and matches on-screen totals.

## Milestone 12 - Experiment toggles (for user tests)
- [ ] Toggle: overtime indicator style (dot vs pill).
- [ ] Toggle: on-call display (shaded bar vs % badge only).
- [ ] Toggle: connector thickness at midnight.  
**DoD:** Toggling updates visuals live.

