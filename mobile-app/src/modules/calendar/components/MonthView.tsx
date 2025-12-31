import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay } from 'date-fns';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { getMonthDays, formatDateKey, getColorPalette } from '@/lib/calendar/calendar-utils';
import { t } from '@/lib/i18n';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function DayCell({
  date,
  onPress,
  indicators,
  isToday,
  isCurrentMonth,
}: {
  date: Date;
  onPress: (date: Date) => void;
  indicators: {
    templateColors: string[];
    tracked: boolean;
    confirmed: boolean;
  };
  isToday: boolean;
  isCurrentMonth: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        !isCurrentMonth && styles.dayCellMuted,
        indicators.confirmed && styles.dayCellConfirmed,
        isToday && styles.dayCellToday,
      ]}
      onPress={() => onPress(date)}
    >
      <Text
        style={[
          styles.dayLabel,
          !isCurrentMonth && styles.dayLabelMuted,
          indicators.confirmed && styles.dayLabelConfirmed,
        ]}
      >
        {format(date, 'd')}
      </Text>
      <View style={styles.dotRow}>
        {indicators.templateColors.map((color: string, idx: number) => (
          <View key={`${color}-${idx}`} style={[styles.dot, { backgroundColor: color }]} />
        ))}
        {indicators.tracked && <View style={[styles.dot, styles.trackedDot]} />}
      </View>
    </TouchableOpacity>
  );
}

export default function MonthView() {
  const { state, dispatch } = useCalendar();
  const days = getMonthDays(state.currentMonth);

  const handleDayPress = (date: Date) => {
    dispatch({ type: 'SET_VIEW', view: 'week' });
    dispatch({ type: 'SET_WEEK', date });
  };

  const indicatorsForDate = (date: Date) => {
    const dateKey = formatDateKey(date);
    const templateColors: string[] = [];
    Object.values(state.instances)
      .filter((instance) => instance.date === dateKey)
      .forEach((instance) => {
        const palette = getColorPalette(instance.color);
        templateColors.push(palette.dot);
      });

    const tracked = Object.values(state.trackingRecords).some((record) => record.date === dateKey);
    const confirmed = state.confirmedDates.has(dateKey);

    return {
      templateColors: templateColors.slice(0, 3),
      tracked,
      confirmed,
    };
  };

  const firstWeekStart = startOfWeek(startOfMonth(state.currentMonth), { weekStartsOn: 1 });
  const lastWeekEnd = startOfWeek(endOfMonth(state.currentMonth), { weekStartsOn: 1 });
  const calendarDays: Date[] = [];
  let current = firstWeekStart;
  while (current <= lastWeekEnd) {
    calendarDays.push(current);
    current = addDays(current, 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_KEYS.map((key) => (
          <Text key={key} style={styles.weekdayLabel}>
            {t(`common.weekdays.${key}`)}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {calendarDays.map((date) => (
          <DayCell
            key={date.toISOString()}
            date={date}
            onPress={handleDayPress}
            indicators={indicatorsForDate(date)}
            isToday={isSameDay(date, new Date())}
            isCurrentMonth={date.getMonth() === state.currentMonth.getMonth()}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellToday: {
    backgroundColor: colors.primary[50],
  },
  dayCellConfirmed: {
    backgroundColor: colors.primary[100],
  },
  dayLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  dayLabelMuted: {
    color: colors.grey[500],
  },
  dayLabelConfirmed: {
    color: colors.primary[800],
    fontWeight: fontWeight.bold,
  },
  dotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    margin: 1,
  },
  trackedDot: {
    backgroundColor: colors.error.main,
  },
  confirmedDot: {
    backgroundColor: colors.primary[600],
  },
});
