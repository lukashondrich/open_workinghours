import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { getColorPalette } from '@/lib/calendar/calendar-utils';
import { t, getDateLocale } from '@/lib/i18n';
import type { NextShiftData } from '../services/DashboardDataService';

interface NextShiftWidgetProps {
  nextShift: NextShiftData | null;
  onPress: () => void;
}

function formatShiftDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const locale = getDateLocale() === 'de' ? deLocale : undefined;

  if (isToday(date)) {
    return t('dashboard.nextShift.today');
  }
  if (isTomorrow(date)) {
    return t('dashboard.nextShift.tomorrow');
  }

  return format(date, 'EEEE, MMM d', { locale });
}

export default function NextShiftWidget({
  nextShift,
  onPress,
}: NextShiftWidgetProps) {
  const palette = nextShift ? getColorPalette(nextShift.color) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboard.nextShift.title')}</Text>
        <ChevronRight size={20} color={colors.text.tertiary} />
      </View>

      {nextShift ? (
        <View style={styles.shiftInfo}>
          {/* Color dot + Date */}
          <View style={styles.dateRow}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: palette?.dot || colors.primary[500] },
              ]}
            />
            <Text style={styles.dateText}>{formatShiftDate(nextShift.date)}</Text>
          </View>

          {/* Shift name + time */}
          <Text style={styles.shiftName}>{nextShift.name}</Text>
          <Text style={styles.timeRange}>
            {nextShift.startTime} – {nextShift.endTime}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('dashboard.nextShift.noShift')}</Text>
          <Text style={styles.emptyHint}>{t('dashboard.nextShift.tapToOpen')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  shiftInfo: {
    paddingTop: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  dateText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  shiftName: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  timeRange: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  emptyState: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});
