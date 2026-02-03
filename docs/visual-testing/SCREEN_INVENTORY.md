# Screen Inventory

**Scope:** v1 — Calendar screens only

---

## Overview

This document lists all screens and states to capture for visual testing, along with navigation steps and expected testIDs.

---

## Navigation Reference

### Tab Bar
- `tab-status` — Status/Dashboard tab
- `tab-calendar` — Calendar tab (default to week view)
- `tab-settings` — Settings tab

### Calendar Controls
- `calendar-fab` — FAB button (visible in week view only)
- `calendar-prev` — Previous week/month
- `calendar-next` — Next week/month

### FAB Menu Options
- `fab-shifts-option` — Opens TemplatePanel (shifts tab)
- `fab-absences-option` — Opens TemplatePanel (absences tab)
- `fab-log-hours-option` — Opens ManualSessionForm

### Panel Controls
- `template-panel-overlay` — Tap to dismiss panel

---

## Screen Catalog

### 1. Week View (Empty State)

**Purpose:** Baseline calendar layout without data

**Navigation:**
1. `mobile_list_elements_on_screen` → find `tab-calendar` coordinates
2. `mobile_click_on_screen_at_coordinates` → tap calendar tab
3. Wait 500ms
4. Verify in week view (FAB should be visible)

**Screenshot:** `01-week-empty.png`

**What to check:**
- 7-day columns visible with equal width
- Hour markers on left side (readable)
- FAB visible in bottom-right
- Header shows current week
- Navigation arrows visible

---

### 2. Week View (With Shifts)

**Purpose:** Calendar with shift data

**Navigation:**
1. From week view, check if any shift blocks are visible
2. If no shifts exist, this screenshot can be skipped

**Screenshot:** `02-week-with-shifts.png`

**What to check:**
- Shift blocks have correct colors (from template)
- Shift labels readable
- No overlap issues unless intentional
- Time boundaries align with hour markers

---

### 3. Month View

**Purpose:** Month overview with summary indicators

**Navigation:**
1. From week view, find "Monat" (DE) or "Month" (EN) toggle
2. `mobile_list_elements_on_screen` → find toggle coordinates
3. `mobile_click_on_screen_at_coordinates` → tap month toggle
4. Wait 500ms

**Screenshot:** `03-month-view.png`

**What to check:**
- 6-row grid visible (42 day cells)
- Current month days full opacity
- Adjacent month days muted (40% opacity)
- Today highlighted
- Day numbers readable
- Shift/tracking indicators visible (if data exists)

---

### 4. FAB Menu Open

**Purpose:** Floating action button expanded state

**Navigation:**
1. From month view, switch back to week view (tap "Woche"/"Week")
2. Wait 500ms for FAB to appear
3. `mobile_list_elements_on_screen` → find `calendar-fab` or FAB coordinates
4. `mobile_click_on_screen_at_coordinates` → tap FAB
5. Wait 300ms for menu animation

**Screenshot:** `04-fab-menu.png`

**What to check:**
- FAB icon changed to X
- Menu items visible (3 options)
- Menu positioned above FAB
- Labels readable ("Shifts"/"Schichten", "Absences"/"Abwesenheiten", "Log Hours"/"Stunden erfassen")
- Shadow/elevation visible
- Backdrop overlay present

---

### 5. TemplatePanel (Shifts Tab)

**Purpose:** Shift template management panel

**Navigation:**
1. From FAB menu open state
2. `mobile_list_elements_on_screen` → find `fab-shifts-option` or "Shifts"/"Schichten" text
3. `mobile_click_on_screen_at_coordinates` → tap shifts option
4. Wait 500ms for panel slide-up animation

**Screenshot:** `05-panel-shifts.png`

**What to check:**
- Panel covers bottom portion of screen
- Rounded top corners
- Tab bar visible (Shifts/Absences toggle)
- "Shifts" tab active
- Template list or empty state
- "Add" button visible (`template-add`)
- Close affordance (tap backdrop or swipe down)

---

### 6. TemplatePanel (Absences Tab)

**Purpose:** Absence template management panel

**Navigation:**
1. From TemplatePanel (shifts tab)
2. Find "Abwesenheiten" (DE) or "Absences" (EN) tab
3. `mobile_click_on_screen_at_coordinates` → tap absences tab
4. Wait 300ms for tab switch

**Screenshot:** `06-panel-absences.png`

**What to check:**
- "Absences" tab active
- Vacation and sick sections (if templates exist)
- "Add" button visible (`absence-add`)
- Same panel styling as shifts tab

---

## Dismissing Panels

To return to clean state after panel screenshots:

**Option A:** Tap overlay
1. `mobile_list_elements_on_screen` → find `template-panel-overlay`
2. Tap overlay area (above panel)

**Option B:** Tap outside panel
1. Tap coordinates in top half of screen (y < 400)

---

## Screenshot Naming Convention

| # | State | Filename |
|---|-------|----------|
| 01 | Week view empty | `01-week-empty.png` |
| 02 | Week view with shifts | `02-week-with-shifts.png` |
| 03 | Month view | `03-month-view.png` |
| 04 | FAB menu open | `04-fab-menu.png` |
| 05 | Panel shifts tab | `05-panel-shifts.png` |
| 06 | Panel absences tab | `06-panel-absences.png` |

---

## Typical Element Coordinates (iPhone 15 Pro)

These are approximate — always use `mobile_list_elements_on_screen` for accurate positions.

| Element | Approx X | Approx Y |
|---------|----------|----------|
| tab-calendar | 195 | 750 |
| calendar-fab | 350 | 700 |
| Week/Month toggle | 280 | 100 |
| Panel backdrop tap | 200 | 200 |

**Screen size:** 393 x 852 points (iPhone 15 Pro)

---

## Future Screens (v2+)

- Status dashboard (HoursSummaryWidget, NextShiftWidget)
- Settings screens
- Location setup wizard
- ManualSessionForm
