# Design Checklist

**Reference:** Theme tokens from `mobile-app/src/theme/`

---

## Overview

This checklist defines **measurable visual quality criteria** for the Open Working Hours app. Values are derived from the actual theme token files to ensure consistency.

**Use this for:** "Is this pixel-correct?" verification — specific spacing, colors, sizes.

**For higher-level guidance:** See `DESIGN_PRINCIPLES.md` for UX heuristics (NN/g-based), mobile best practices, and "does this feel right?" questions.

---

## Layout & Spacing

**Source:** `mobile-app/src/theme/spacing.ts`

### Spacing Scale (4px base)
| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Minimal spacing |
| `sm` | 8px | Small spacing |
| `md` | 12px | Medium spacing |
| `lg` | 16px | Standard spacing |
| `xl` | 20px | Large spacing |
| `xxl` | 24px | Extra large |
| `xxxl` | 32px | Maximum spacing |
| `section` | 48px | Section spacing |

### Standard Padding
| Context | Horizontal | Vertical |
|---------|------------|----------|
| Screen | 20px (`xl`) | 16px (`lg`) |
| Card | 16px (`lg`) | 16px (`lg`) |
| Button | 16px (`lg`) | 12px (`md`) |
| Input | 16px (`lg`) | 12px (`md`) |

### Checklist
- [ ] Elements align to 4px grid
- [ ] Screen horizontal padding: 20px
- [ ] Card padding: 16px
- [ ] Consistent gap between elements (8px, 12px, or 16px)
- [ ] No unintended overlap or clipping
- [ ] Content respects safe areas (notch, home indicator)

### Equal Distances Rule

**Principle:** When multiple elements are arranged in a row or grid, the spacing between them should be mathematically equal. This creates visual harmony and professional appearance.

**Applications:**
- Tab bar icons: `edge → icon1 → icon2 → icon3 → edge` should have equal gaps
- FAB positioning: margin from right edge = margin from bottom edge (or tab bar)
- Grid items: equal gutters between all items
- Button groups: equal spacing between buttons

**Checklist:**
- [ ] Tab bar items have equal horizontal distribution
- [ ] FAB has equal margins from right edge and bottom/tab bar
- [ ] Menu items have equal vertical spacing
- [ ] Grid gutters are consistent

---

## Visual Hierarchy & Separation

**Principle:** Visual boundaries between content areas, navigation, and interactive elements must be clear. Adjacent areas with the same background color create ambiguity.

### Divider Lines
- [ ] Section dividers extend full width (edge-to-edge)
- [ ] Divider color: `border.light` (`#E5E7EB`) or `border.default` (`#E0E0E0`)
- [ ] Divider thickness: 1px (hairline)
- [ ] No padding/margin on dividers unless intentional inset

### Background Differentiation
- [ ] Content areas use `background.default` (`#F8F9FA`)
- [ ] Cards/panels use `background.paper` (`#FFFFFF`)
- [ ] Adjacent sections with same function can share background
- [ ] Adjacent sections with different functions MUST have different backgrounds
- [ ] Footer/summary areas should NOT match navigation bar color

### Modal/Panel Overlays
- [ ] Backdrop dims ENTIRE screen (including header AND tab bar)
- [ ] Backdrop color: semi-transparent black (`rgba(0,0,0,0.5)` or similar)
- [ ] Only the panel/modal itself should appear "active"
- [ ] Dimmed areas should not appear interactive

---

## Typography

**Source:** `mobile-app/src/theme/typography.ts`

### Font Sizes
| Token | Value | Usage |
|-------|-------|-------|
| `xxs` | 9px | Ultra-small (zoomed calendar) |
| `xs` | 12px | Labels, captions |
| `sm` | 14px | Small body text |
| `md` | 16px | Body text |
| `lg` | 18px | Large body, menu items |
| `xl` | 20px | Section headers |
| `xxl` | 24px | Page titles |
| `xxxl` | 32px | Large titles |

### Font Weights
| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Labels |
| Semibold | 600 | Buttons, subheaders |
| Bold | 700 | Headers |

### Text Styles
| Style | Size | Weight | Line Height |
|-------|------|--------|-------------|
| h1 | 32px | Bold | 40px |
| h2 | 24px | Bold | 32px |
| h3 | 20px | Semibold | 28px |
| body | 16px | Regular | 24px |
| bodySmall | 14px | Regular | 20px |
| label | 14px | Medium | 20px |
| labelSmall | 12px | Medium | 16px |
| button | 16px | Semibold | 24px |
| caption | 12px | Regular | 16px |

### Checklist
- [ ] Body text: 16px (`md`)
- [ ] Labels/captions: 12-14px (`xs`-`sm`)
- [ ] Headers differentiated by size AND weight
- [ ] Text hierarchy clear at a glance
- [ ] No truncation without ellipsis indicator
- [ ] Line heights appropriate (1.4-1.5x font size)

---

## Colors

**Source:** `mobile-app/src/theme/colors.ts`

### Primary Palette (Hospital Teal)
| Token | Hex | Usage |
|-------|-----|-------|
| `primary.50` | `#E6F5F1` | Light backgrounds |
| `primary.100` | `#C0E6DD` | Light tint |
| `primary.200` | `#96D6C8` | Tint |
| `primary.300` | `#6CC5B3` | Light |
| `primary.400` | `#4DB89F` | Medium-light |
| **`primary.500`** | **`#2E8B6B`** | **PRIMARY (logo)** |
| `primary.600` | `#287B5F` | Medium-dark |
| `primary.700` | `#216950` | Dark |
| `primary.800` | `#1A5741` | Darker |
| `primary.900` | `#134532` | Darkest |

### Semantic Colors
| Purpose | Light | Main | Dark |
|---------|-------|------|------|
| Success | `#E6F5F1` | `#2E8B6B` | `#1A5741` |
| Warning | `#FFF8E1` | `#F57C00` | `#E65100` |
| Error | `#FFEBEE` | `#D32F2F` | `#B71C1C` |
| Info | `#E3F2FD` | `#1976D2` | `#0D47A1` |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `text.primary` | `#1A1A1A` | Main text |
| `text.secondary` | `#5F6D7E` | Secondary text |
| `text.tertiary` | `#8E8E93` | Tertiary/hint |
| `text.disabled` | `#BDBDBD` | Disabled state |
| `text.inverse` | `#FFFFFF` | On dark backgrounds |

### Background Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `background.default` | `#F8F9FA` | Screen background |
| `background.paper` | `#FFFFFF` | Cards, panels |
| `background.elevated` | `#FFFFFF` | Elevated surfaces |

### Shift Template Colors
| Color | Background | Border | Text | Dot |
|-------|------------|--------|------|-----|
| Teal | `#E6F5F1` | `#96D6C8` | `#134532` | `#2E8B6B` |
| Blue | `#E3F2FD` | `#90CAF9` | `#0D47A1` | `#1E88E5` |
| Amber | `#FFF8E1` | `#FFE082` | `#E65100` | `#FF8F00` |
| Rose | `#FCE4EC` | `#F48FB1` | `#880E4F` | `#D81B60` |
| Purple | `#F3E5F5` | `#CE93D8` | `#4A148C` | `#8E24AA` |
| Slate | `#ECEFF1` | `#B0BEC5` | `#37474F` | `#607D8B` |

### Checklist
- [ ] Primary teal `#2E8B6B` used for main actions
- [ ] Background screens: `#F8F9FA`
- [ ] Cards/panels: `#FFFFFF`
- [ ] Primary text: `#1A1A1A`
- [ ] Secondary text: `#5F6D7E`
- [ ] Shift colors visually distinct
- [ ] Error states use `#D32F2F`
- [ ] Contrast ratio 4.5:1 minimum for text

---

## Interactive Elements

### Touch Targets
| Element | Minimum Size |
|---------|--------------|
| Buttons | 44 x 44px |
| Tab bar items | 44 x 44px |
| List items | 44px height |
| FAB | 56 x 56px |

### FAB Specifications
| Property | Value |
|----------|-------|
| Size | 56 x 56px |
| Border radius | 28px (circle) |
| Position | Bottom-right |
| Margin from edge | 20px (`xl`) |
| Background | `primary.500` (`#2E8B6B`) |
| Icon color | White |
| Icon size | 28px |

### Checklist
- [ ] All touch targets 44x44px minimum
- [ ] FAB: 56x56px, bottom-right
- [ ] **FAB margins: equal distance from right edge AND from tab bar top** (e.g., 20px each)
- [ ] Buttons have visible tap feedback
- [ ] Clickable elements visually distinct from static
- [ ] Disabled states clearly muted
- [ ] **Tab bar icons: equal horizontal distribution** (equal spacing between items)

---

## Calendar-Specific

### Week View
- [ ] 7 day columns visible
- [ ] Columns equal width
- [ ] Hour markers visible on left
- [ ] Hour markers readable (12px minimum)
- [ ] Current time indicator visible (if today)
- [ ] Shift blocks properly colored
- [ ] Shift labels not truncated
- [ ] FAB visible and not obscuring content

### Month View
- [ ] 6-row grid (42 cells)
- [ ] Day numbers aligned consistently
- [ ] Current month days: full opacity
- [ ] Adjacent month days: ~40% opacity
- [ ] Today cell highlighted (border or background)
- [ ] Shift dots visible (if data)
- [ ] Tracking dot visible (if data)
- [ ] Absence icons visible (vacation tree, sick thermometer)
- [ ] **Summary footer background: gray (`#F8F9FA`), NOT white** — must differ from tab bar
- [ ] **Summary divider line: full width (edge-to-edge)**, no side margins

### TemplatePanel
- [ ] Bottom sheet pattern (slides up)
- [ ] Rounded top corners (16px radius)
- [ ] Semi-transparent backdrop
- [ ] **Backdrop dims ENTIRE screen — including header AND tab bar**
- [ ] Tab bar for Shifts/Absences toggle
- [ ] Active tab clearly indicated
- [ ] Template list scrollable if needed
- [ ] Add button visible
- [ ] Sufficient padding around content

### FAB Menu
- [ ] 3 menu items visible
- [ ] Items vertically stacked above FAB
- [ ] Labels readable
- [ ] Icons appropriate
- [ ] Shadow/elevation visible
- [ ] X icon in FAB when open

---

## Accessibility

### Visual
- [ ] Text contrast 4.5:1 minimum (WCAG AA)
- [ ] Large text contrast 3:1 minimum
- [ ] Icons have sufficient contrast
- [ ] Focus indicators visible (if applicable)
- [ ] Color not sole indicator of meaning

### Touch
- [ ] 44x44px minimum touch targets
- [ ] Sufficient spacing between targets (8px minimum)
- [ ] No overlapping touch areas

---

## Common Issues to Watch

| Issue | What to Look For |
|-------|------------------|
| Alignment | Elements not on grid, inconsistent margins |
| Spacing | Cramped or uneven gaps |
| **Unequal distances** | Tab icons, FAB margins, menu items not evenly spaced |
| Truncation | Text cut off without ellipsis |
| Contrast | Light text on light backgrounds |
| Overlap | Elements covering each other |
| Safe areas | Content under notch or home indicator |
| Tap targets | Small or overlapping buttons |
| Color consistency | Wrong shade of primary, inconsistent grays |
| **Section blending** | Adjacent areas (content vs nav) with same background color |
| **Partial dividers** | Separator lines that don't extend full width |
| **Incomplete overlay** | Modal/panel backdrop not covering header or tab bar |

---

## Severity Guidelines

| Severity | Criteria |
|----------|----------|
| **High** | Functional impact, accessibility failure, major visual break |
| **Medium** | Noticeable but not blocking, inconsistent with design system |
| **Low** | Minor polish, subtle alignment, nice-to-have improvement |
