import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
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

  // Base actual = actual time up to planned amount (primary portion)
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
            {/* 1. Primary (actual worked) - rendered at bottom due to column-reverse */}
            {baseActualHeight > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.actualBar,
                  { height: baseActualHeight },
                ]}
              />
            )}

            {/* 2a. Success/overtime - above primary if actual > planned */}
            {overtimeHeight > 0 && (
              <View
                style={[
                  styles.barSegment,
                  styles.overtimeBar,
                  { height: overtimeHeight },
                ]}
              />
            )}

            {/* 2b. Grey (unworked planned) - above primary if actual < planned */}
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

  const deviationColor = data.deviation >= 0 ? colors.warning.main : colors.error.main;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboard.hoursSummary.title')}</Text>
        <ChevronRight size={20} color={colors.text.tertiary} />
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
          <Text style={styles.summaryLabel}>{t('dashboard.hoursSummary.plan')}</Text>
          <Text style={styles.summaryValue}>{formatHours(data.totalPlanned)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('dashboard.hoursSummary.actual')}</Text>
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
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 20, // Chart height + indicator space
    alignItems: 'flex-end',
    marginBottom: spacing.md,
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
    backgroundColor: colors.primary[500],
  },
  overtimeBar: {
    backgroundColor: colors.warning.main, // Amber/orange for overtime
  },
  unworkedBar: {
    backgroundColor: colors.grey[300],
  },
  indicatorRow: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 9,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
  },
  questionMark: {
    fontSize: 9,
    color: colors.error.main,
    fontWeight: fontWeight.semibold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.grey[200],
    gap: spacing.xxl,
  },
  summaryItem: {
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryDeviation: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summaryDeviationValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
