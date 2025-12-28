/**
 * Open Working Hours - Color Palette
 *
 * Hospital teal/green primary color derived from brand logo.
 * Designed for professional, trustworthy healthcare aesthetic.
 */

export const colors = {
  // Primary - Hospital Teal/Green (from logo)
  primary: {
    50:  '#E6F5F1',   // Lightest (backgrounds, highlights)
    100: '#C0E6DD',   // Light tint
    200: '#96D6C8',   // Tint
    300: '#6CC5B3',   // Light
    400: '#4DB89F',   // Medium-light
    500: '#2E8B6B',   // PRIMARY (logo color)
    600: '#287B5F',   // Medium-dark
    700: '#216950',   // Dark
    800: '#1A5741',   // Darker
    900: '#134532',   // Darkest
  },

  // Semantic Colors
  success: {
    light: '#E6F5F1',
    main:  '#2E8B6B',   // Same as primary for brand consistency
    dark:  '#1A5741',
  },
  warning: {
    light: '#FFF8E1',
    main:  '#F57C00',
    dark:  '#E65100',
  },
  error: {
    light: '#FFEBEE',
    main:  '#D32F2F',
    dark:  '#B71C1C',
  },
  info: {
    light: '#E3F2FD',
    main:  '#1976D2',
    dark:  '#0D47A1',
  },

  // Neutral/Grey Scale
  grey: {
    50:  '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Text Colors
  text: {
    primary:   '#1A1A1A',
    secondary: '#5F6D7E',
    tertiary:  '#8E8E93',
    disabled:  '#BDBDBD',
    inverse:   '#FFFFFF',
  },

  // Background Colors
  background: {
    default: '#F8F9FA',
    paper:   '#FFFFFF',
    elevated: '#FFFFFF',
  },

  // Border Colors
  border: {
    light:   '#E5E7EB',
    default: '#E0E0E0',
    dark:    '#BDBDBD',
  },

  // Shift Template Colors (for calendar)
  shift: {
    teal: {
      bg:     '#E6F5F1',
      border: '#96D6C8',
      text:   '#134532',
      dot:    '#2E8B6B',
    },
    blue: {
      bg:     '#E3F2FD',
      border: '#90CAF9',
      text:   '#0D47A1',
      dot:    '#1E88E5',
    },
    amber: {
      bg:     '#FFF8E1',
      border: '#FFE082',
      text:   '#E65100',
      dot:    '#FF8F00',
    },
    rose: {
      bg:     '#FCE4EC',
      border: '#F48FB1',
      text:   '#880E4F',
      dot:    '#D81B60',
    },
    purple: {
      bg:     '#F3E5F5',
      border: '#CE93D8',
      text:   '#4A148C',
      dot:    '#8E24AA',
    },
    slate: {
      bg:     '#ECEFF1',
      border: '#B0BEC5',
      text:   '#37474F',
      dot:    '#607D8B',
    },
  },

  // Tracking/Review Mode Colors
  tracking: {
    bg:     'rgba(46, 139, 107, 0.15)',
    border: 'rgba(46, 139, 107, 0.5)',
    text:   '#216950',
    active: '#2E8B6B',
  },

  // Common utility colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

// Type for shift color keys
export type ShiftColorKey = keyof typeof colors.shift;

// Helper to get shift color palette
export function getShiftColors(color: ShiftColorKey) {
  return colors.shift[color];
}
