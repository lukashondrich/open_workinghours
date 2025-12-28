import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Card } from '@/components/ui';

export default function NotificationsScreen() {
  const [checkInNotifications, setCheckInNotifications] = useState(true);
  const [checkOutNotifications, setCheckOutNotifications] = useState(true);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>Check-in notifications</Text>
          <Switch
            value={checkInNotifications}
            onValueChange={setCheckInNotifications}
            trackColor={{ false: colors.grey[300], true: colors.primary[500] }}
            thumbColor={colors.white}
          />
        </Card>

        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>Check-out notifications</Text>
          <Switch
            value={checkOutNotifications}
            onValueChange={setCheckOutNotifications}
            trackColor={{ false: colors.grey[300], true: colors.primary[500] }}
            thumbColor={colors.white}
          />
        </Card>

        <Text style={styles.hint}>
          Receive notifications when you automatically check in or out of your work locations
        </Text>
      </ScrollView>
    </View>
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
