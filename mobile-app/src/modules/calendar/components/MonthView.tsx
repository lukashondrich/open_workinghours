import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay } from 'date-fns';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { getMonthDays, formatDateKey, getColorPalette } from '@/lib/calendar/calendar-utils';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
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
    padding: 16,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#8E8E93',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellToday: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  dayCellConfirmed: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  dayLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#111',
  },
  dayLabelMuted: {
    color: '#9E9E9E',
  },
  dayLabelConfirmed: {
    color: '#1B5E20',
    fontWeight: '700',
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
    backgroundColor: '#F44336',
  },
  confirmedDot: {
    backgroundColor: '#2E7D32',
  },
});
