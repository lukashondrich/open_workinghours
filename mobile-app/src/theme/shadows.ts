/**
 * Open Working Hours - Shadow Presets
 *
 * Consistent elevation shadows for iOS and Android.
 */

import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadows: Record<string, ShadowStyle> = {
  /** No shadow */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  /** Small shadow - subtle lift (cards, buttons) */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },

  /** Medium shadow - standard elevation (cards, modals) */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  /** Large shadow - prominent elevation (floating elements) */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  /** Extra large shadow - maximum elevation (modals, dropdowns) */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/**
 * Helper to create platform-specific shadow
 * iOS uses shadowColor/Offset/Opacity/Radius, Android uses elevation
 */
export function createShadow(level: keyof typeof shadows): ShadowStyle {
  const shadow = shadows[level];

  if (Platform.OS === 'android') {
    return { elevation: shadow.elevation };
  }

  return shadow;
}
