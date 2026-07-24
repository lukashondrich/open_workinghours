import { Animated, useWindowDimensions } from 'react-native';

/**
 * Slide-from-bottom show/hide for inline bottom sheets (the E2E-compatible
 * alternative to <Modal> — see CLAUDE.md).
 *
 * Closed state = translated a full window-height down AND opacity 0. The
 * opacity is the guarantee that a closed sheet can never peek above the tab
 * bar regardless of panel size, keyboard, or font scale; the window-height
 * slide distance always exceeds any panel (panels cap at <=85% height), so
 * no per-panel measurement is needed.
 *
 * Drive `animValue` 0→1 with useNativeDriver: true; both returned props are
 * native-driver compatible.
 */
export function useSheetSlide(animValue: Animated.Value): {
  opacity: Animated.Value;
  translateY: Animated.AnimatedInterpolation<number>;
} {
  const { height: windowHeight } = useWindowDimensions();
  return {
    opacity: animValue,
    translateY: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [windowHeight, 0],
    }),
  };
}
