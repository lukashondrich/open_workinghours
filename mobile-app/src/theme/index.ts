/**
 * Open Working Hours - Theme System
 *
 * Centralized design tokens for consistent styling across the app.
 *
 * Usage:
 *   import { colors, spacing, shadows } from '@/theme';
 *
 *   const styles = StyleSheet.create({
 *     container: {
 *       backgroundColor: colors.background.default,
 *       padding: spacing.lg,
 *       ...shadows.md,
 *     },
 *   });
 */

export { colors, getShiftColors, type ShiftColorKey } from './colors';
export { spacing, padding, gap } from './spacing';
export { fontSize, fontWeight, textStyles } from './typography';
export { shadows, createShadow } from './shadows';
export { borderRadius, borderWidth } from './borders';

// Theme constants for common use
export const theme = {
  // Standard card styling
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Standard screen container
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // Standard header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
} as const;
