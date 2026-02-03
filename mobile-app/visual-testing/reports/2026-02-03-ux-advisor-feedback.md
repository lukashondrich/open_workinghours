# UX Advisor Feedback Analysis

**Date:** 2026-02-03
**Advisor:** Moritz Müller
**Screens Reviewed:** Calendar (Month View, TemplatePanel, Tab Bar, FAB)

---

## Feedback Summary

The UX advisor identified 5 visual issues related to spacing, visual hierarchy, and alignment.

---

## Issue 1: Summary Divider Line Not Full Width

**Feedback:** "The line of the month view summary should go through from the left to the right completely."

**Screenshot:** `02-month-view.png`
**Location:** Horizontal divider above "0h Erfasst | 0h Geplant | 0m Überstunden"

**Problem:** The divider line has left and right margins, creating visual gaps.

**Principle Violated:** Visual boundaries should be unambiguous. Partial dividers create unclear section breaks.

**Added to Checklist:**
- `DESIGN_CHECKLIST.md` → Visual Hierarchy & Separation → Divider Lines
- `DESIGN_CHECKLIST.md` → Calendar-Specific → Month View: "Summary divider line: full width (edge-to-edge)"

---

## Issue 2: Summary Background Should Be Gray

**Feedback:** "The area should be gray and not white. Otherwise it's weird because the bottom bar is also white."

**Screenshot:** `02-month-view.png`
**Location:** Month view summary footer background

**Problem:** White summary area + white tab bar = no visual separation between content and navigation.

**Principle Violated:** Adjacent UI regions with different purposes must have different backgrounds to create visual hierarchy.

**Added to Checklist:**
- `DESIGN_CHECKLIST.md` → Visual Hierarchy & Separation → Background Differentiation
- `DESIGN_CHECKLIST.md` → Calendar-Specific → Month View: "Summary footer background: gray (#F8F9FA), NOT white"
- `DESIGN_PRINCIPLES.md` → Visual Separation & Hierarchy

---

## Issue 3: Tab Bar Icon Equal Spacing

**Feedback:** "In the bottom bar, the icons should be aligned well, regarding the rules of equal distances."

**Screenshot:** All screenshots (tab bar visible in all)
**Location:** Bottom tab bar (Status, Kalender, Einstellungen)

**Problem:** Tab bar items may not follow strict equal-distance distribution.

**Principle Violated:** **Equal Distances Rule** — horizontal elements should have mathematically equal spacing.

**Added to Checklist:**
- `DESIGN_CHECKLIST.md` → Layout & Spacing → Equal Distances Rule (new section)
- `DESIGN_CHECKLIST.md` → Interactive Elements: "Tab bar icons: equal horizontal distribution"
- `DESIGN_PRINCIPLES.md` → Visual Balance & Equal Distances (new section)

---

## Issue 4: Panel Should Dim Header and Tab Bar

**Feedback:** "When choosing the shift templates, the whole bottom bar and top bar should also be grayed out."

**Screenshot:** `04-panel-shifts.png`
**Location:** Header and tab bar when TemplatePanel is open

**Problem:** Calendar content is dimmed, but header and tab bar remain fully visible/white. This makes them look interactive when they shouldn't be.

**Principle Violated:** Modal overlays should dim the ENTIRE background to signal "this area is unavailable."

**Added to Checklist:**
- `DESIGN_CHECKLIST.md` → Visual Hierarchy & Separation → Modal/Panel Overlays
- `DESIGN_CHECKLIST.md` → Calendar-Specific → TemplatePanel: "Backdrop dims ENTIRE screen — including header AND tab bar"
- `DESIGN_PRINCIPLES.md` → Visual Separation & Hierarchy → Modal/Panel Overlays

---

## Issue 5: FAB Equal Distances

**Feedback:** "The FAB should also be aligned better. So also here the rule of equal distances applies."

**Screenshot:** `03-fab-menu.png`
**Location:** FAB button position (bottom-right corner)

**Problem:** FAB margin from right edge may not equal margin from bottom (above tab bar).

**Principle Violated:** **Equal Distances Rule** — FAB margins should be symmetric.

**Added to Checklist:**
- `DESIGN_CHECKLIST.md` → Interactive Elements: "FAB margins: equal distance from right edge AND from tab bar top"
- `DESIGN_CHECKLIST.md` → Layout & Spacing → Equal Distances Rule
- `DESIGN_PRINCIPLES.md` → Visual Balance & Equal Distances

---

## Updated Documentation

### DESIGN_CHECKLIST.md — New/Updated Sections

1. **Layout & Spacing → Equal Distances Rule** (NEW)
   - Tab bar icon distribution
   - FAB margin symmetry
   - Menu item spacing
   - Grid gutters

2. **Visual Hierarchy & Separation** (NEW)
   - Divider lines (full width)
   - Background differentiation
   - Modal/panel overlays (dim entire screen)

3. **Interactive Elements** (UPDATED)
   - FAB equal margins
   - Tab bar equal distribution

4. **Calendar-Specific → Month View** (UPDATED)
   - Summary background color
   - Summary divider full width

5. **Calendar-Specific → TemplatePanel** (UPDATED)
   - Backdrop dims header AND tab bar

6. **Common Issues to Watch** (UPDATED)
   - Unequal distances
   - Section blending
   - Partial dividers
   - Incomplete overlay

### DESIGN_PRINCIPLES.md — New Sections

1. **Visual Balance & Equal Distances**
   - The equal distances rule explained
   - Applications (tab bar, FAB, menus, grids)
   - Why it matters
   - How to verify

2. **Visual Separation & Hierarchy**
   - Content vs navigation backgrounds
   - Modal overlay coverage rules

---

## Implementation Priority

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| #4 Panel dim header/tab bar | Medium | Medium | 1 |
| #2 Summary background gray | Medium | Low | 2 |
| #1 Summary divider full width | Low | Low | 3 |
| #3 Tab bar equal spacing | Low | Low | 4 |
| #5 FAB equal margins | Low | Low | 5 |

**Recommendation:** Address issues #4 and #2 first — they have the most visual impact and align with standard modal/overlay patterns.

---

## Verification

After fixes are implemented, re-run visual testing to verify:
- [x] Month view summary has gray background — **VERIFIED 2026-02-03**
- [x] Month view divider extends full width — **VERIFIED 2026-02-03**
- [ ] ~~TemplatePanel backdrop covers header and tab bar~~ — **DEFERRED** (requires refactor: tab bar is outside screen component tree)
- [x] Tab bar vertical padding balanced — **VERIFIED 2026-02-03** (added paddingTop: 8 to tabBarStyle)
- [x] FAB has equal right and bottom margins — **VERIFIED 2026-02-03**
