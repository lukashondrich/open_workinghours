import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';

type ToastProps = {
  visible: boolean;
  message: string;
  testID?: string;
};

export function Toast({ visible, message, testID }: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }, 1800);
      });
    }
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none" testID={testID}>
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xxxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: colors.grey[900],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  text: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
});
