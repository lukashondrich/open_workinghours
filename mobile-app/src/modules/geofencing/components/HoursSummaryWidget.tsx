import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import type { DailyHoursData } from '../services/DashboardDataService';

interface HoursSummaryWidgetProps {
  data: {
    days: DailyHoursData[];
    totalPlanned: number;
    totalActual: number;
    deviation: number;
  };
  isLive: boolean;
  onPress: () => void;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours.toFixed(1) + 'h';
}

function formatDeviation(minutes: number): string {
  const hours = minutes / 60;
  const sign = hours >= 0 ? '+' : '';
  return sign + hours.toFixed(1) + 'h';
}

const CHART_HEIGHT = 60;
const BAR_WIDTH = 8;

interface BarProps {
  day: DailyHoursData;
  maxMinutes: number;
  isLive: boolean;
}

function Bar({ day, maxMinutes, isLive }: BarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for today's bar when live
  useEffect(() => {
    if (day.isToday && isLive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [day.isToday, isLive, pulseAnim]);

  const planned = day.plannedMinutes;
  const actual = day.actualMinutes;

  // Calculate heights (scale to max)
  const scale = maxMinutes > 0 ? CHART_HEIGHT / maxMinutes : 0;

  // Overtime = actual time beyond planned
  const overtime = Math.max(0, actual - planned);
  const overtimeHeight = overtime * scale;

  // Base actual = actual time up to planned amount (blue portion)
  const baseActual = Math.min(actual, planned);
  const baseActualHeight = baseActual * scale;

  // Unworked = planned time not yet worked (grey portion on top)
  const unworked = Math.max(0, planned - actual);
  const unworkedHeight = unworked * scale;

  // For days with no planned AND no actual, still show baseline
  const hasData = planned > 0 || actual > 0;

  return (
    <View style={styles.barContainer}>
      {/* Bar area */}
      <Animated.View
        style={[
          styles.barWrapper,
          { opacity: day.isToday && isLive ? pulseAnim : 1 },
        ]}
      >
        {/* Stacked bar - using column-reverse so first item is at bottom */}
        {hasData && (
          <View style={styles.barStack}>
            {/* 1. Blue (actual worked) - rendered at bottom due to column-reverse */}
            {baseActualHeight > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.actualBar,
                  { height: baseActualHeight },
                ]}
              />
            )}

            {/* 2a. Green (overtime) - above blue if actual > planned */}
            {overtimeHeight > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.overtimeBar,
                  { height: overtimeHeight },
                ]}
              />
            )}

            {/* 2b. Grey (unworked planned) - above blue if actual < planned */}
            {unworkedHeight > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.unworkedBar,
                  { height: unworkedHeight },
                ]}
              />
            )}
          </View>
        )}
      </Animated.View>

      {/* Status indicator (always shown at same position) */}
      <View style={styles.indicatorRow}>
        {day.isConfirmed ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : (
          <Text style={styles.questionMark}>?</Text>
        )}
      </View>
    </View>
  );
}

export default function HoursSummaryWidget({
  data,
  isLive,
  onPress,
}: HoursSummaryWidgetProps) {
  // Find max value for scaling (ensure minimum height for visibility)
  const maxMinutes = Math.max(
    ...data.days.map((d) => Math.max(d.plannedMinutes, d.actualMinutes)),
    60 // Minimum 1 hour scale to prevent tiny bars
  );

  const deviationColor = data.deviation >= 0 ? '#4CAF50' : '#FF3B30';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Last 14 Days</Text>
        <Text style={styles.chevron}>›</Text>
      </View>

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        {data.days.map((day) => (
          <Bar
            key={day.date}
            day={day}
            maxMinutes={maxMinutes}
            isLive={isLive}
          />
        ))}
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Plan</Text>
          <Text style={styles.summaryValue}>{formatHours(data.totalPlanned)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Actual</Text>
          <Text style={styles.summaryValue}>{formatHours(data.totalActual)}</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryDeviation]}>
          <Text style={[styles.summaryDeviationValue, { color: deviationColor }]}>
            {formatDeviation(data.deviation)}
          </Text>
        </View>
      </View>
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
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 20, // Chart height + indicator space
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '100%',
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barStack: {
    width: BAR_WIDTH,
    alignItems: 'center',
    flexDirection: 'column-reverse', // First child renders at bottom
  },
  barSegment: {
    width: BAR_WIDTH,
    borderRadius: 2,
  },
  actualBar: {
    backgroundColor: '#007AFF',
  },
  overtimeBar: {
    backgroundColor: '#4CAF50',
  },
  unworkedBar: {
    backgroundColor: '#E0E0E0',
  },
  indicatorRow: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 9,
    color: '#4CAF50',
    fontWeight: '600',
  },
  questionMark: {
    fontSize: 9,
    color: '#FF3B30',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 24,
  },
  summaryItem: {
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  summaryDeviation: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summaryDeviationValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
