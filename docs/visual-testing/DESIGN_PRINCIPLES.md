# Design Principles

**Based on:** Nielsen Norman Group research and usability heuristics
**Context:** Healthcare time-tracking mobile app

---

## Overview

These principles guide visual and interaction design decisions for Open Working Hours. They are grounded in [NN/g's 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [Mobile UX best practices](https://www.nngroup.com/articles/mobile-ux-study-guide/).

When the specific checklist (`DESIGN_CHECKLIST.md`) doesn't cover a case, refer to these principles.

---

## Part 1: Core Heuristics Applied

### 1. Visibility of System Status

> "Keep users informed about what is going on through appropriate feedback."

**In this app:**
- Show tracking state clearly (clocked in/out, current duration)
- Indicate sync status with backend (submitted, pending, failed)
- Provide immediate feedback on actions (shift placed, template saved)
- Use animation sparingly to show state changes, not decoration

**Visual indicators:**
- Pulsing badge = active tracking session
- Checkmark = successfully saved/submitted
- Colored dots in month view = data exists for that day
- Progress indicators for any operation >1 second

---

### 2. Match Between System and Real World

> "Speak the users' language with familiar words and concepts."

**In this app:**
- Use healthcare terminology: "Dienst" (shift), "Schicht", not "event" or "block"
- Calendar metaphors match physical calendars (week view, month grid)
- Clock-in/out matches time clock mental model
- Location = workplace, not "geofence zone"

**Language guidelines:**
- German as primary (healthcare workers in Germany)
- Avoid technical jargon (no "geofencing", "k-anonymity" in UI)
- Use concrete terms: "8 Stunden geplant" not "480 minutes scheduled"

---

### 3. User Control and Freedom

> "Provide clearly marked exits and support undo/redo."

**In this app:**
- Every panel/overlay has a clear dismiss action (tap backdrop, X button)
- Shift placement can be undone (delete recently placed shift)
- Templates can be edited after creation
- No irreversible actions without confirmation
- Back gesture always works (no trapped states)

**Required patterns:**
- Confirmation dialogs for destructive actions (delete template, clear data)
- Cancel buttons on all forms
- Swipe-to-dismiss on bottom sheets

---

### 4. Consistency and Standards

> "Follow platform conventions. Don't make users wonder if different things mean the same."

**In this app:**
- Follow iOS Human Interface Guidelines / Material Design
- Tab bar at bottom (iOS convention)
- FAB for primary creation action (common pattern)
- Bottom sheets for contextual panels
- Standard gestures: swipe to navigate weeks, pinch to zoom

**Internal consistency:**
- Same colors mean the same things everywhere
- Primary teal = primary action, always
- Same button styles for same action types
- Consistent spacing (4px grid)

---

### 5. Error Prevention

> "Prevent problems before they occur. Better than good error messages."

**In this app:**
- Can't submit future dates (disabled, not error after attempt)
- Can't set end time before start time (constrained picker)
- Location required before logging hours (guided setup)
- Overlap detection warns before creating conflicting shifts

**Prevention patterns:**
- Disable invalid options rather than allowing then rejecting
- Smart defaults (today's date, typical shift times)
- Constrained inputs (time pickers, not free text)
- Validation as user types, not on submit

---

### 6. Recognition Rather Than Recall

> "Make options visible. Don't require users to remember information."

**In this app:**
- Templates visible in panel (don't need to remember names)
- Armed template shows name in toast ("Platziere: Neuer Dienst")
- Color coding persists across views (template color = shift color)
- Current week/month always labeled in header
- Today always highlighted in calendar

**Recognition aids:**
- Visual preview of shift in template row (color, time)
- Icons for absence types (tree = vacation, thermometer = sick)
- Inline labels, not tooltips requiring discovery

---

### 7. Flexibility and Efficiency of Use

> "Cater to both novice and expert users with shortcuts."

**In this app:**
- Double-tap to place shift (fast for experts)
- Long-press for context menu (alternative path)
- FAB menu for all creation actions (discoverable)
- Swipe gestures for week navigation (efficient)
- Template reuse (don't recreate shifts from scratch)

**Efficiency features:**
- Remember last-used template
- Quick access to common locations
- Minimal taps for frequent actions (clock in = 1 tap)

---

### 8. Aesthetic and Minimalist Design

> "Every extra element competes with relevant information."

**In this app:**
- Clean calendar grid without decorative elements
- Whitespace to separate logical groups
- Restrained color use (teal for emphasis only)
- No gradients, shadows only for elevation hierarchy
- Icons only where they add meaning

**Minimalism rules:**
- If it doesn't help the task, remove it
- Show secondary info on demand (tap to expand)
- Empty states have purpose (guide, don't decorate)
- No marketing or promotional content in core flows

---

### 9. Help Users Recognize, Diagnose, and Recover from Errors

> "Error messages in plain language with constructive solutions."

**In this app:**
- "Standort nicht verfügbar" + "GPS aktivieren" (problem + solution)
- "Überlappung erkannt" shows conflicting shifts
- Validation errors appear inline, near the field
- Recovery actions are buttons, not just text

**Error message format:**
```
[What happened] + [Why] + [What to do]
"Verbindung fehlgeschlagen. Kein Internet. Versuchen Sie es später erneut."
```

---

### 10. Help and Documentation

> "Provide documentation that is searchable, task-focused, and concise."

**In this app:**
- Onboarding hints for first-time users
- Inline tooltips for complex features (GPS review mode)
- Settings descriptions explain consequences
- No separate manual needed for core features

**Documentation approach:**
- Progressive disclosure (basic → advanced)
- Contextual help at point of need
- FAQ-style for common questions

---

## Part 2: Mobile-Specific Guidelines

### Touch Targets

**Minimum sizes:**
- Buttons: 44 × 44 pt (iOS) / 48 × 48 dp (Android)
- List items: 44 pt height minimum
- FAB: 56 × 56 pt
- Spacing between targets: 8 pt minimum

**Thumb zone consideration:**
- Primary actions in bottom half of screen
- FAB position (bottom-right) is thumb-accessible
- Tab bar within easy reach
- Avoid top corners for frequent actions

### Visual Balance & Equal Distances

**Principle:** The human eye is highly sensitive to unequal spacing. When elements are arranged in a row, column, or grid, the distances between them should be mathematically equal. This creates visual harmony and signals intentional, professional design.

**The Equal Distances Rule:**
```
For a row of 3 items across a container width:
  |  A  |  gap  |  B  |  gap  |  C  |
       ↑              ↑
    These gaps MUST be equal
```

**Applications:**
- **Tab bar:** Icons distributed with equal spacing from edges and between items
- **FAB positioning:** Right margin = bottom margin (above tab bar)
- **Menu items:** Equal vertical gaps between items
- **Grid layouts:** Consistent gutters in all directions

**Why it matters:**
- Unequal spacing looks "off" even if users can't articulate why
- Creates subconscious sense of disorder or amateur design
- Especially noticeable on mobile where screen space is limited

**How to verify:**
- Measure margins/gaps in design tools or with screenshot overlay
- Check that FAB margin-right equals margin-bottom
- Verify tab items are centered in equal-width columns

### Visual Separation & Hierarchy

**Principle:** Adjacent UI regions with different purposes must be visually distinct. When content areas and navigation have the same background color, users can't quickly parse the interface structure.

**Rules:**
- Content areas: use `background.default` (`#F8F9FA`)
- Navigation (tab bar): use `background.paper` (`#FFFFFF`)
- If footer/summary is in content area, it should NOT be white (same as tab bar)
- Divider lines should span full width to create clear boundaries

**Modal/Panel Overlays:**
- Backdrop must dim the ENTIRE screen
- This includes header AND tab bar
- Only the panel itself should appear "active"
- Dimmed areas signal "unavailable" — users shouldn't think they can tap there

### Content Density

**Mobile-first principles:**
- Show essential information first
- Defer secondary content to drill-down
- Chunk information into scannable units
- Use progressive disclosure for complexity

**For calendar:**
- Week view: Show shift blocks, not full details
- Tap to see details
- Month view: Indicators only (dots, icons)
- Summary stats aggregated (hours, not individual entries)

### Navigation

**Patterns used:**
- Tab bar for top-level sections (Status, Calendar, Settings)
- Bottom sheets for contextual actions (templates, forms)
- Stack navigation for drill-down (Settings → Location details)
- Modal-style for focused tasks (Manual session entry)

**Navigation rules:**
- Max 3 tabs (cognitive limit)
- No hamburger menu (poor discoverability)
- Breadcrumbs for deep navigation
- Always show current location (header)

### Forms & Input

**Based on [NN/g EAS Framework](https://www.nngroup.com/articles/eas-framework-simplify-forms/):**

1. **Eliminate** unnecessary fields
2. **Automate** what can be inferred (GPS location, date from context)
3. **Simplify** what remains (pickers over free text)

**Mobile input rules:**
- Use appropriate keyboard types (numeric for time)
- Leverage device features (GPS for location)
- Labels above fields (never placeholder-only)
- Inline validation as user types
- One primary action per screen

---

## Part 3: Healthcare Context

### User Environment

Healthcare workers use this app:
- During breaks (limited time)
- After long shifts (cognitive fatigue)
- In varying lighting conditions
- Often with one hand

**Design implications:**
- Fast core flows (clock in < 3 seconds)
- High contrast for readability
- Large, forgiving touch targets
- No complex gestures for essential actions

### Trust & Professionalism

**Visual tone:**
- Clean, professional aesthetic
- Subdued colors (teal, not bright primary colors)
- No playful illustrations or animations
- Consistent with healthcare app expectations

**Trust signals:**
- Clear data ownership messaging
- Visible sync status
- No dark patterns
- Transparent about what's tracked

### Data Sensitivity

**Privacy-conscious design:**
- Show what data is collected (Settings transparency)
- Explain why location is needed
- Local-first architecture visible (offline capable)
- Easy data export/deletion access

---

## Quick Reference

### When designing new features, ask:

| Heuristic | Question |
|-----------|----------|
| #1 Status | Does the user know what's happening? |
| #2 Real World | Is the language familiar to healthcare workers? |
| #3 Control | Can they easily exit or undo? |
| #4 Consistency | Does this match existing patterns? |
| #5 Error Prevention | Can we prevent mistakes before they happen? |
| #6 Recognition | Is information visible or must they remember? |
| #7 Flexibility | Is there a fast path for frequent users? |
| #8 Minimalism | Does every element serve a purpose? |
| #9 Error Recovery | Is the error message actionable? |
| #10 Help | Is guidance available in context? |

### Mobile checklist:

- [ ] Touch targets ≥ 44pt
- [ ] Primary actions in thumb zone
- [ ] Minimal typing required
- [ ] Works offline
- [ ] Appropriate keyboard types
- [ ] Labels above inputs
- [ ] Clear navigation hierarchy

---

## Sources

- [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/) — NN/g
- [Mobile UX Study Guide](https://www.nngroup.com/articles/mobile-ux-study-guide/) — NN/g
- [Mobile Input Field Checklist](https://www.nngroup.com/articles/mobile-input-checklist/) — NN/g
- [EAS Framework for Simplifying Forms](https://www.nngroup.com/articles/eas-framework-simplify-forms/) — NN/g
- [The State of Mobile UX](https://www.nngroup.com/articles/state-mobile-ux/) — NN/g
