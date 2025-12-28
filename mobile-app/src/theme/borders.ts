/**
 * Open Working Hours - Border Styles
 *
 * Consistent border radii and widths.
 */

export const borderRadius = {
  /** 0px - No rounding */
  none: 0,
  /** 4px - Minimal rounding */
  xs: 4,
  /** 6px - Small rounding */
  sm: 6,
  /** 8px - Standard rounding (buttons) */
  md: 8,
  /** 12px - Medium rounding (cards) */
  lg: 12,
  /** 16px - Large rounding */
  xl: 16,
  /** 20px - Extra large rounding */
  xxl: 20,
  /** 24px - Maximum rounding */
  xxxl: 24,
  /** 9999px - Full/pill rounding */
  full: 9999,
} as const;

export const borderWidth = {
  /** 0px - No border */
  none: 0,
  /** 1px - Standard border */
  default: 1,
  /** 2px - Emphasized border */
  thick: 2,
} as const;
