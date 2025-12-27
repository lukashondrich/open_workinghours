import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { getColorPalette } from '@/lib/calendar/calendar-utils';
import type { NextShiftData } from '../services/DashboardDataService';

interface NextShiftWidgetProps {
  nextShift: NextShiftData | null;
  onPress: () => void;
}

function formatShiftDate(dateStr: string): string {
  const date = parseISO(dateStr);

  if (isToday(date)) {
    return 'Today';
  }
  if (isTomorrow(date)) {
    return 'Tomorrow';
  }

  return format(date, 'EEEE, MMM d');
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
        <Text style={styles.title}>Next Shift</Text>
        <Text style={styles.chevron}>›</Text>
      </View>

      {nextShift ? (
        <View style={styles.shiftInfo}>
          {/* Color dot + Date */}
          <View style={styles.dateRow}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: palette?.dot || '#007AFF' },
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
          <Text style={styles.emptyText}>No shifts planned</Text>
          <Text style={styles.emptyHint}>Tap to open calendar</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  chevron: {
    fontSize: 20,
    color: '#8E8E93',
    fontWeight: '300',
  },
  shiftInfo: {
    paddingTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  shiftName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  timeRange: {
    fontSize: 13,
    color: '#8E8E93',
  },
  emptyState: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
