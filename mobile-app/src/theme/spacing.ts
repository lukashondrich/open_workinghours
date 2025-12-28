/**
 * Open Working Hours - Spacing Scale
 *
 * Consistent spacing values based on 4px base unit.
 */

export const spacing = {
  /** 4px - Minimal spacing */
  xs: 4,
  /** 8px - Small spacing */
  sm: 8,
  /** 12px - Medium spacing */
  md: 12,
  /** 16px - Standard spacing */
  lg: 16,
  /** 20px - Large spacing */
  xl: 20,
  /** 24px - Extra large spacing */
  xxl: 24,
  /** 32px - Maximum spacing */
  xxxl: 32,
  /** 48px - Section spacing */
  section: 48,
} as const;

// Common padding presets
export const padding = {
  screen: {
    horizontal: spacing.xl,    // 20px
    vertical: spacing.lg,      // 16px
  },
  card: {
    horizontal: spacing.lg,    // 16px
    vertical: spacing.lg,      // 16px
  },
  button: {
    horizontal: spacing.lg,    // 16px
    vertical: spacing.md,      // 12px
  },
  input: {
    horizontal: spacing.lg,    // 16px
    vertical: spacing.md,      // 12px
  },
} as const;

// Common gap values
export const gap = {
  xs: spacing.xs,    // 4px
  sm: spacing.sm,    // 8px
  md: spacing.md,    // 12px
  lg: spacing.lg,    // 16px
} as const;
