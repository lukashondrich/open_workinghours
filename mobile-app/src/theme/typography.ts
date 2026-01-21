/**
 * Open Working Hours - Typography
 *
 * Font sizes and weights for consistent text styling.
 */

export const fontSize = {
  /** 9px - Ultra-small for zoomed-out calendar */
  xxs: 9,
  /** 12px - Labels, captions */
  xs: 12,
  /** 14px - Small body text */
  sm: 14,
  /** 16px - Body text */
  md: 16,
  /** 18px - Large body, menu items */
  lg: 18,
  /** 20px - Section headers */
  xl: 20,
  /** 24px - Page titles */
  xxl: 24,
  /** 32px - Large titles */
  xxxl: 32,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Pre-defined text styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    lineHeight: 40,
  },
  h2: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 32,
  },
  h3: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: 28,
  },

  // Body text
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: 20,
  },

  // Labels
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
  },

  // Buttons
  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: 24,
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },

  // Captions
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: 16,
  },
} as const;
