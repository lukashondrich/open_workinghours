import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { Card, SettingsDetailLayout } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function NotificationsScreen() {
  const [checkInNotifications, setCheckInNotifications] = useState(true);
  const [checkOutNotifications, setCheckOutNotifications] = useState(true);

  return (
    <SettingsDetailLayout title={t('navigation.notifications')}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>{t('notificationsScreen.checkInNotifications')}</Text>
          <Switch
            value={checkInNotifications}
            onValueChange={setCheckInNotifications}
            trackColor={{ false: colors.grey[300], true: colors.primary[500] }}
            thumbColor={colors.white}
          />
        </Card>

        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>{t('notificationsScreen.checkOutNotifications')}</Text>
          <Switch
            value={checkOutNotifications}
            onValueChange={setCheckOutNotifications}
            trackColor={{ false: colors.grey[300], true: colors.primary[500] }}
            thumbColor={colors.white}
          />
        </Card>

        <Text style={styles.hint}>
          {t('notificationsScreen.hint')}
        </Text>
      </ScrollView>
    </SettingsDetailLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
