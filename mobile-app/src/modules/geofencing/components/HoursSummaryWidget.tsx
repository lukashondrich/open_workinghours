/**
 * HoursSummaryWidget - 14-day hours overview chart
 *
 * Features:
 * - Side-by-side bars: green (planned) and rose (tracked)
 * - Dynamic Y-axis scale (12h default, expands to 16h or 24h if needed)
 * - Day labels on X-axis
 * - Faded bars for unconfirmed days (nudge to confirm)
 * - Absence icons (vacation/sick)
 * - Unconfirmed count nudge
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { ChevronRight, TreePalm, Thermometer } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { formatDuration } from '@/lib/calendar/calendar-utils';
import { isTestMode } from '@/lib/testing/mockApi';
import type { DailyHoursData } from '../services/DashboardDataService';
import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';

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
  return formatDuration(minutes);
}

function formatDeviation(minutes: number): string {
  if (minutes < 0) {
    return '-' + formatDuration(Math.abs(minutes));
  }
  return '+' + formatDuration(minutes);
}

// Get short day name (M, T, W...)
function getDayLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'EEEEE', { locale: enUS });
}

const BASE_CHART_HEIGHT = 100;
const BAR_WIDTH = 4;
const BAR_GAP = 1;

// Dynamic scale: default 12h, expand if needed
function getScaleConfig(days: DailyHoursData[]): { maxHours: number; ticks: number[]; chartHeight: number } {
  const maxMinutes = Math.max(...days.map(d => Math.max(d.plannedMinutes, d.actualMinutes)));
  const maxHoursNeeded = Math.ceil(maxMinutes / 60);

  if (maxHoursNeeded <= 12) {
    return { maxHours: 12, ticks: [0, 4, 8, 12], chartHeight: BASE_CHART_HEIGHT };
  } else if (maxHoursNeeded <= 16) {
    return { maxHours: 16, ticks: [0, 4, 8, 12, 16], chartHeight: BASE_CHART_HEIGHT * 1.33 };
  } else {
    return { maxHours: 24, ticks: [0, 8, 16, 24], chartHeight: BASE_CHART_HEIGHT * 1.5 };
  }
}

interface BarProps {
  day: DailyHoursData;
  maxHours: number;
  chartHeight: number;
  isLive: boolean;
}

function Bar({ day, maxHours, chartHeight, isLive }: BarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // TEST_MODE: Skip pulse animation for stable E2E element detection
    if (isTestMode()) {
      pulseAnim.setValue(1);
      return;
    }
    if (day.isToday && isLive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [day.isToday, isLive, pulseAnim]);

  if (day.isPreAccount) {
    return (
      <View style={styles.barContainer}>
        <View style={[styles.barArea, { height: chartHeight }]} />
        <Text style={styles.dayLabel}>—</Text>
      </View>
    );
  }

  const maxMinutes = maxHours * 60;
  const plannedHeight = Math.min(day.plannedMinutes / maxMinutes, 1) * chartHeight;
  const trackedHeight = Math.min(day.actualMinutes / maxMinutes, 1) * chartHeight;

  // Unconfirmed days appear faded (but not today - it can't be confirmed yet)
  const hasActivity = day.plannedMinutes > 0 || day.actualMinutes > 0 || day.hasVacation || day.hasSick;
  const barOpacity = (!hasActivity || day.isConfirmed || day.isToday) ? 1 : 0.4;

  return (
    <View style={styles.barContainer}>
      <View style={[styles.barArea, { height: chartHeight, opacity: barOpacity }]}>
        {/* Planned bar (green/teal) */}
        <View
          style={[
            styles.bar,
            styles.plannedBar,
            { height: plannedHeight || 1 },
          ]}
        />
        {/* Tracked bar (rose) */}
        <Animated.View
          style={[
            styles.bar,
            styles.trackedBar,
            {
              height: trackedHeight || 0,
              opacity: day.isToday && isLive ? pulseAnim : 1,
            },
          ]}
        />
      </View>
      {/* Day label */}
      <Text style={[styles.dayLabel, day.isToday && styles.todayLabel]}>
        {getDayLabel(day.date)}
      </Text>
      {/* Absence icons */}
      <View style={styles.statusRow}>
        {day.hasVacation && <TreePalm size={10} color={colors.primary[500]} />}
        {day.hasSick && <Thermometer size={10} color={colors.warning.dark} />}
      </View>
    </View>
  );
}

export default function HoursSummaryWidget({ data, isLive, onPress }: HoursSummaryWidgetProps) {
  const deviationColor = data.deviation >= 0 ? colors.primary[500] : colors.error.main;
  const { maxHours, ticks, chartHeight } = getScaleConfig(data.days);

  // Count unconfirmed days (excluding today and days with no activity)
  const unconfirmedCount = data.days.filter(day => {
    const hasActivity = day.plannedMinutes > 0 || day.actualMinutes > 0 || day.hasVacation || day.hasSick;
    return hasActivity && !day.isConfirmed && !day.isToday;
  }).length;

  // Build accessibility summary for screen readers
  const accessibilitySummary = t('dashboard.hoursSummary.accessibilitySummary', {
    planned: formatHours(data.totalPlanned),
    actual: formatHours(data.totalActual),
    deviation: formatDeviation(data.deviation),
    unconfirmed: unconfirmedCount,
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilitySummary}
      accessibilityHint={t('dashboard.hoursSummary.accessibilityHint')}
      testID="hours-summary-widget"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboard.hoursSummary.title')}</Text>
        <ChevronRight size={20} color={colors.text.tertiary} />
      </View>

      {/* Chart area with Y-axis - marked as not accessible to prevent tree enumeration errors */}
      <View style={styles.chartWrapper} accessible={false} importantForAccessibility="no-hide-descendants">
        {/* Y-axis */}
        <View style={[styles.yAxis, { height: chartHeight }]}>
          {ticks.slice().reverse().map((h) => (
            <View key={h} style={styles.yTickRow}>
              <Text style={styles.yTickLabel}>{h}h</Text>
              <View style={styles.yTickLine} />
            </View>
          ))}
        </View>

        {/* Bars */}
        <View style={[styles.chartContainer, { height: chartHeight + 28 }]}>
          {data.days.map((day) => (
            <Bar key={day.date} day={day} maxHours={maxHours} chartHeight={chartHeight} isLive={isLive} />
          ))}
        </View>
      </View>

      {/* Legend + unconfirmed nudge */}
      <View style={styles.legendRow}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary[500] }]} />
            <Text style={styles.legendText}>Planned</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.shift.rose.dot }]} />
            <Text style={styles.legendText}>Tracked</Text>
          </View>
        </View>
        {unconfirmedCount > 0 && (
          <Text style={styles.unconfirmedNudge}>
            {unconfirmedCount} to confirm
          </Text>
        )}
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
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  chartWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  yAxis: {
    width: 28,
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  yTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  yTickLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    width: 18,
    textAlign: 'right',
  },
  yTickLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.grey[200],
    marginLeft: 2,
  },
  chartContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.grey[300],
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
  },
  plannedBar: {
    backgroundColor: colors.primary[500],
  },
  trackedBar: {
    backgroundColor: colors.shift.rose.dot,
  },
  dayLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  todayLabel: {
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  statusRow: {
    height: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  unconfirmedNudge: {
    fontSize: 10,
    color: colors.error.main,
    fontWeight: fontWeight.medium,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.text.secondary,
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
