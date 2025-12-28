import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClipboardList } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function LogScreen() {
  return (
    <View style={styles.container}>
      <ClipboardList size={64} color={colors.grey[400]} />
      <Text style={styles.title}>Work History Coming Soon</Text>
      <Text style={styles.subtitle}>Your tracked work sessions will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
