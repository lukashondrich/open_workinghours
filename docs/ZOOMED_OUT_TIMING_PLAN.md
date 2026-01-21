# Zoomed-Out Timing Info for Tracking Records

**Status:** Implemented
**Priority:** UX Enhancement
**Requested:** Show end-time and duration for tracking records at zoomed-out states

---

## Current Behavior

| Zoom Scale | Hour Height | Tracking Records Show |
|------------|-------------|----------------------|
| ≥1.17 | ≥56px | Duration + edge labels (start/end times) |
| 0.67-1.16 | 32-55px | Duration only |
| <0.67 | <32px | **Nothing** (color blocks only) |

At overview (0.25) and compact (0.5) modes, tracking blocks are 12-24px tall and show no timing info.

---

## Proposed Changes

### New Disclosure Levels

| Zoom Scale | Hour Height | Duration | End Time | Start Time |
|------------|-------------|----------|----------|------------|
| ≥1.17 | ≥56px | 12px, centered | 12px, bottom edge | 12px, top edge |
| 0.67-1.16 | 32-55px | 12px, centered | hidden | hidden |
| 0.42-0.66 | 20-31px | **9px, centered** | **9px, bottom edge** | hidden |
| 0.25-0.41 | 12-19px | hidden | **9px, bottom edge** | hidden |

### Display Format at Low Zoom

Keep the **same spatial layout** as full disclosure (duration centered, end time at bottom edge), but with smaller fonts.

**Compact mode (20-31px):**
```
┌─────────────┐
│   2h 30m    │   (duration centered, 9px font)
│             │
│      11:00  │   (end time at bottom edge, 9px font)
└─────────────┘
```

**Minimal mode (<20px):**
```
┌─────────────┐
│      11:00  │   (end time at bottom edge only, 9px font)
└─────────────┘
```

Note: At minimal zoom, only end time shown (duration would overlap in such small blocks).

### Font Sizes

Add new smaller font size to typography.ts:
```typescript
export const fontSize = {
  xxs: 9,   // NEW: Ultra-small for zoomed-out calendar
  xs: 12,   // Labels, captions (existing)
  ...
}
```

Use `xxs` (9px) for zoomed-out states, `xs` (12px) for normal states.

---

## Implementation Steps

### 1. Add new font size
- File: `mobile-app/src/theme/typography.ts`
- Add `xxs: 9` for ultra-small text

### 2. Add new disclosure thresholds
- File: `mobile-app/src/modules/calendar/components/WeekView.tsx`
- Add `DISCLOSURE_COMPACT_HEIGHT = 20` (new threshold)
- Rename existing thresholds for clarity:
  - `DISCLOSURE_FULL_HEIGHT = 56` (unchanged)
  - `DISCLOSURE_REDUCED_HEIGHT = 32` (unchanged)
  - `DISCLOSURE_COMPACT_HEIGHT = 20` (new)
  - Below 20px = minimal

### 3. Update TrackingBlock component
- File: `mobile-app/src/modules/calendar/components/WeekView.tsx`
- Add new disclosure logic:
  ```typescript
  const showFullEdgeLabels = hourHeight >= DISCLOSURE_FULL_HEIGHT;     // ≥56px: start + end labels
  const showDurationFull = hourHeight >= DISCLOSURE_REDUCED_HEIGHT;    // ≥32px: duration (12px font)
  const showDurationCompact = hourHeight >= DISCLOSURE_COMPACT_HEIGHT; // ≥20px: duration (9px font)
  const showEndTimeCompact = hourHeight >= 12;                         // ≥12px: end time (9px font)
  ```
- Render logic:
  - `showFullEdgeLabels`: start time at top, end time at bottom (18px offset, 12px font) - unchanged
  - `showDurationFull`: duration centered (12px font) - unchanged
  - `!showDurationFull && showDurationCompact`: duration centered (9px font) - NEW
  - `!showFullEdgeLabels && showEndTimeCompact`: end time at bottom (reduced offset, 9px font) - NEW

### 4. Add new styles
- `trackingDurationTextSmall`: 9px font for compact duration
- `edgeLabelSmall`: 9px font for compact end time
- `edgeLabelBottomCompact`: reduced offset for small blocks (e.g., 10px instead of 18px)

---

## Visual Mockup

### At 0.5 scale (compact, ~24px height):
```
        ↑ (no start time label at this zoom)
┌──────────────────┐
│     2h 30m       │  ← 9px font, centered in block
│            11:00 │  ← 9px font, bottom edge (reduced offset)
└──────────────────┘
```

### At 0.25 scale (overview, ~12px height):
```
┌──────────────────┐
│            11:00 │  ← 9px font, bottom edge only
└──────────────────┘
```
(Duration omitted - not enough vertical space)

---

## Edge Cases

1. **Active sessions (no end time yet)**: Show duration only (confirmed by user)
2. **Very short blocks (<12px visual height)**: Skip text entirely
3. **Break time**: Show net duration (excluding breaks) for consistency with full zoom
4. **Short sessions (<5 min)**: Keep existing faded indicator, add small timing text

---

## Decisions (User Confirmed)

1. **Active sessions**: Show duration only (no "now" indicator)
2. **Layout**: Keep spatial positions - duration centered, end time at bottom edge (same as full zoom, just smaller fonts)

---

## Files to Modify

1. `mobile-app/src/theme/typography.ts` - Add xxs font size
2. `mobile-app/src/modules/calendar/components/WeekView.tsx` - Disclosure logic + styles

---

## Testing

- Test at all zoom levels: 0.25, 0.5, 0.67, 1.0, 1.25, 1.5
- Verify text remains readable at 9px
- Check active sessions display correctly
- Verify short sessions (<5 min) still show faded indicator
