import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { AppText as Text } from '@/components/ui/AppText';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { isTestMode } from '@/lib/testing/mockApi';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HoursExplainerSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      animValue.setValue(0);
      return;
    }
    if (isTestMode()) {
      animValue.setValue(1);
      return;
    }
    Animated.timing(animValue, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, animValue]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  const bullets = [
    { title: t('hoursExplainer.plannedTitle'), body: t('hoursExplainer.plannedBody') },
    { title: t('hoursExplainer.trackedTitle'), body: t('hoursExplainer.trackedBody') },
    { title: t('hoursExplainer.overtimeTitle'), body: t('hoursExplainer.overtimeBody') },
    { title: t('hoursExplainer.confirmedTitle'), body: t('hoursExplainer.confirmedBody') },
  ];

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      accessible={false}
      collapsable={false}
    >
      <TouchableWithoutFeedback accessible={false} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: animValue }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
            transform: [{ translateY }],
          },
        ]}
        accessible={false}
        collapsable={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('hoursExplainer.title')}</Text>
          <TouchableOpacity
            testID="hours-explainer-close"
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('hoursExplainer.close')}
          >
            <X size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {bullets.map((b) => (
          <View key={b.title} style={styles.bullet}>
            <Text style={styles.bulletTitle}>{b.title}</Text>
            <Text style={styles.bulletBody}>{b.body}</Text>
          </View>
        ))}

        <TouchableOpacity
          testID="hours-explainer-got-it"
          onPress={onClose}
          style={styles.gotItButton}
          accessible={true}
          accessibilityRole="button"
        >
          <Text style={styles.gotItText}>{t('hoursExplainer.close')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.md,
  },
  bullet: {
    marginBottom: spacing.md,
  },
  bulletTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  bulletBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  gotItButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  gotItText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
