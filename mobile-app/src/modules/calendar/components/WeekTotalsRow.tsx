/**
 * Σ row under the week grid: tracked minutes per day (breaks subtracted,
 * overnight sessions split per day — the same helper as the month cells), and
 * an expandable gutter cell with the week figures stacked strictly inside the
 * time column (owner's design 2026-09-27: nothing under the day columns; the
 * parent widens the gutter while expanded). Scrolls horizontally with the
 * columns, never vertically. The FAB deliberately stays where it is.
 *
 * E2E/a11y: the gutter cell is NOT one accessible element wrapping the ⓘ —
 * the toggle and the ⓘ are separate accessible buttons inside an
 * accessible={false} container (CLAUDE.md rule).
 */
import React from 'react';
import { View, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { ChevronDown, ChevronUp, MapPin, CalendarDays, Check, Info } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import {
  formatDateKey,
  formatDuration,
  getTrackedMinutesForDate,
  type MonthSummary,
} from '@/lib/calendar/calendar-utils';
import type { TrackingRecord } from '@/lib/calendar/types';
import { t } from '@/lib/i18n';

/** Collapsed height; the parent subtracts it from the zoom-to-fit budget. */
export const WEEK_TOTALS_ROW_HEIGHT = 36;

interface WeekTotalsRowProps {
  weekDays: Date[];
  dayWidth: number;
  gutterWidth: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  summary: MonthSummary;
  trackingRecords: Record<string, TrackingRecord>;
  onInfoPress?: () => void;
}

function signedDuration(minutes: number): string {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : '';
  return sign + formatDuration(Math.abs(minutes));
}

export default function WeekTotalsRow({
  weekDays,
  dayWidth,
  gutterWidth,
  expanded,
  onToggleExpanded,
  summary,
  trackingRecords,
  onInfoPress,
}: WeekTotalsRowProps) {
  const planMode = !summary.hasElapsedDays;
  const plannedShown = planMode ? summary.monthPlannedMinutes : summary.plannedMinutes;
  const overtimeColor =
    summary.overtimeMinutes > 0
      ? colors.success.main
      : summary.overtimeMinutes < 0
      ? colors.error.main
      : colors.text.primary;
  const toggleLabel = planMode
    ? `${formatDuration(plannedShown)} ${t('calendar.month.planned')}`
    : `${signedDuration(summary.overtimeMinutes)} ${t('calendar.month.overtime')}`;

  return (
    <View style={styles.totalsRow} testID="week-totals-row">
      <View
        style={[styles.totalsTimeCell, { width: gutterWidth }]}
        accessible={false}
        collapsable={false}
      >
        <Pressable
          onPress={onToggleExpanded}
          style={styles.totalsSigmaRow}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={toggleLabel}
          testID="week-totals-toggle"
        >
          <Text style={styles.totalsSigma}>Σ</Text>
          {expanded ? (
            <ChevronUp size={12} color={colors.text.tertiary} />
          ) : (
            <ChevronDown size={12} color={colors.text.tertiary} />
          )}
        </Pressable>

        {expanded && (
          <View style={styles.totalsStack} accessible={false} collapsable={false} testID="week-totals-expanded">
            {!planMode && (
              <View
                style={styles.totalsStackLine}
                accessible={true}
                accessibilityLabel={`${signedDuration(summary.overtimeMinutes)} ${t('calendar.month.overtime')}`}
              >
                <Text style={styles.totalsStackIconText}>±</Text>
                <Text style={[styles.totalsStackValue, { color: overtimeColor }]} numberOfLines={1}>
                  {signedDuration(summary.overtimeMinutes)}
                </Text>
              </View>
            )}
            {!planMode && (
              <View
                style={styles.totalsStackLine}
                accessible={true}
                accessibilityLabel={`${formatDuration(summary.trackedMinutes)} ${t('calendar.month.tracked')}`}
              >
                <MapPin size={11} color={colors.text.tertiary} />
                <Text style={styles.totalsStackValue} numberOfLines={1}>
                  {formatDuration(summary.trackedMinutes)}
                </Text>
              </View>
            )}
            <View
              style={styles.totalsStackLine}
              accessible={true}
              accessibilityLabel={`${formatDuration(plannedShown)} ${t('calendar.month.planned')}`}
            >
              <CalendarDays size={11} color={colors.text.tertiary} />
              <Text style={styles.totalsStackValue} numberOfLines={1}>
                {formatDuration(plannedShown)}
              </Text>
            </View>
            {!planMode && summary.eligibleDayCount > 0 && (
              <View style={styles.totalsStackLine} accessible={true} testID="week-summary-fraction">
                <Check size={11} color={colors.text.tertiary} />
                <Text style={styles.totalsStackValue} numberOfLines={1}>
                  {summary.confirmedDayCount}/{summary.eligibleDayCount}
                </Text>
              </View>
            )}
            {onInfoPress && (
              <TouchableOpacity
                onPress={onInfoPress}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.totalsStackInfo}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.month.explainerA11yLabel')}
                testID="week-summary-info"
              >
                <Info size={13} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {weekDays.map((day) => {
        const dateKey = formatDateKey(day);
        const { trackedMinutes, hasTracking } = getTrackedMinutesForDate(dateKey, trackingRecords);
        return (
          <View key={dateKey} style={[styles.totalsCell, { width: dayWidth }]} testID={`week-day-total-${dateKey}`}>
            {hasTracking && (
              <Text style={styles.totalsText} numberOfLines={1}>
                {formatDuration(trackedMinutes)}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  totalsRow: {
    flexDirection: 'row',
    minHeight: WEEK_TOTALS_ROW_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.default,
  },
  totalsTimeCell: {
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    backgroundColor: colors.grey[50],
    alignItems: 'stretch',
  },
  totalsSigmaRow: {
    height: WEEK_TOTALS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  totalsSigma: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  totalsStack: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  totalsStackLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalsStackIconText: {
    width: 11,
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  totalsStackValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  totalsStackInfo: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  totalsCell: {
    height: WEEK_TOTALS_ROW_HEIGHT,
    borderRightWidth: 1,
    borderRightColor: colors.grey[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.error.dark,
  },
});
