import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Info } from 'lucide-react-native';

import { AppText as Text } from '@/components/ui/AppText';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  dismissLabel?: string;
  onDismiss: () => void;
  testIDPrefix?: string;
}

export default function OnboardingTooltip({
  visible,
  title,
  body,
  dismissLabel = t('onboardingTooltips.gotIt'),
  onDismiss,
  testIDPrefix = 'onboarding-tooltip',
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(8);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      accessible={false}
      collapsable={false}
      testID={`${testIDPrefix}-container`}
    >
      <Animated.View
        style={[styles.backdrop, { opacity }]}
        testID={`${testIDPrefix}-backdrop`}
      />
      <Animated.View
        style={[styles.card, { opacity, transform: [{ translateY }] }]}
        accessible={false}
        collapsable={false}
        testID={`${testIDPrefix}-card`}
      >
        <View style={styles.header}>
          <View style={styles.icon}>
            <Info size={18} color={colors.primary[600]} />
          </View>
          <Text
            style={styles.title}
            testID={`${testIDPrefix}-title`}
            accessible={true}
          >
            {title}
          </Text>
        </View>
        <Text
          style={styles.body}
          testID={`${testIDPrefix}-body`}
          accessible={true}
        >
          {body}
        </Text>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.8}
          testID={`${testIDPrefix}-dismiss`}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
        >
          <Text style={styles.dismissText}>{dismissLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  card: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    top: '32%',
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.paper,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  dismissButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[500],
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
