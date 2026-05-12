import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MapPin, Bell, ShieldCheck } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';

type PermissionPrimingIcon = 'location' | 'background' | 'notifications';

interface Props {
  icon: PermissionPrimingIcon;
  title: string;
  body: string;
  privacy?: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  loading?: boolean;
  testIDPrefix: string;
}

const ICONS = {
  location: MapPin,
  background: ShieldCheck,
  notifications: Bell,
};

export default function PermissionPrimingScreen({
  icon,
  title,
  body,
  privacy,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  loading = false,
  testIDPrefix,
}: Props) {
  const Icon = ICONS[icon];

  return (
    <View style={styles.container} accessible={false} collapsable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        accessible={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Icon size={40} color={colors.primary[600]} strokeWidth={2} />
        </View>
        <Text style={styles.title} testID={`${testIDPrefix}-title`}>
          {title}
        </Text>
        <Text style={styles.body} testID={`${testIDPrefix}-body`}>
          {body}
        </Text>
        {privacy && (
          <View style={styles.privacyBox}>
            <Text style={styles.privacyText} testID={`${testIDPrefix}-privacy`}>
              {privacy}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions} accessible={false} collapsable={false}>
        <Button
          onPress={onPrimary}
          loading={loading}
          disabled={loading}
          fullWidth
          size="lg"
          testID={`${testIDPrefix}-enable`}
        >
          {primaryLabel}
        </Button>
        <Button
          onPress={onSecondary}
          disabled={loading}
          fullWidth
          variant="ghost"
          testID={`${testIDPrefix}-skip`}
        >
          {secondaryLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.paper,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  privacyBox: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  privacyText: {
    fontSize: fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    padding: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
