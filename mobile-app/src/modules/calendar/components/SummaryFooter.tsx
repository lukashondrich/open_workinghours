/**
 * Collapsed-by-default hours summary (overtime headline → tracked / planned /
 * confirmation fraction / absence chips on expand), fed by a getRangeSummary()
 * result. Used by MonthView; the week view shows the same figures in its Σ
 * gutter cell (WeekTotalsRow) instead, for space.
 */
import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { TreePalm, Thermometer, ChevronDown, ChevronUp, Info } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { formatOvertimeDisplay, type MonthSummary } from '@/lib/calendar/calendar-utils';
import { getConfirmedFractionText } from '@/lib/calendar/confirmed-fraction';
import { t } from '@/lib/i18n';

interface SummaryFooterProps {
  summary: MonthSummary;
  onInfoPress: () => void;
  /** Extra container style (e.g. negative margins to span a padded parent). */
  style?: StyleProp<ViewStyle>;
}

function formatMinutesDisplay(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SummaryFooter({ summary, onInfoPress, style }: SummaryFooterProps) {
  const {
    trackedMinutes,
    plannedMinutes,
    monthPlannedMinutes,
    vacationDays,
    sickDays,
    overtimeMinutes,
    eligibleDayCount,
    confirmedDayCount,
    hasElapsedDays,
  } = summary;

  // Month hasn't started — show the plan, not a meaningless 0-balance
  const planMode = !hasElapsedDays;

  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const overtimeDisplay = formatOvertimeDisplay(overtimeMinutes);

  const getOvertimeColor = () => {
    if (overtimeMinutes > 0) return colors.success.main;
    if (overtimeMinutes < 0) return colors.error.main;
    return colors.text.primary;
  };

  // Confirmation completeness line; hidden for months with no elapsed eligible days
  const fractionText = getConfirmedFractionText(confirmedDayCount, eligibleDayCount);

  // Plan-mode months with no absences have nothing to expand
  const expandable = !planMode || vacationDays > 0 || sickDays > 0;

  // The animation follows the DERIVED open state, so swiping to a
  // non-expandable month collapses (and back restores) without imperative sync
  const isOpen = expanded && expandable;
  React.useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isOpen, expandAnim]);

  // Expanded content height is MEASURED (absolutely-positioned probe below) —
  // fixed budgets clipped the absence chips at large accessibility font sizes.
  const [contentHeight, setContentHeight] = useState(0);
  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || (planMode ? 32 : 80)],
  });

  return (
    <View style={[styles.summaryFooter, style]}>
      {/* Collapsed bar — always visible */}
      <TouchableOpacity
        onPress={expandable ? () => setExpanded((e) => !e) : undefined}
        style={styles.summaryCollapsedRow}
        activeOpacity={expandable ? 0.7 : 1}
        accessible={true}
        accessibilityRole="button"
        testID="summary-toggle"
      >
        {planMode ? (
          <>
            <Text style={styles.summaryValue}>{formatMinutesDisplay(monthPlannedMinutes)}</Text>
            <Text style={styles.summaryCollapsedLabel}>{t('calendar.month.planned')}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.summaryValue, { color: getOvertimeColor() }]}>
              {overtimeDisplay}
            </Text>
            <Text style={styles.summaryCollapsedLabel}>{t('calendar.month.overtime')}</Text>
          </>
        )}
        <TouchableOpacity
          onPress={onInfoPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.summaryInfoButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.month.explainerA11yLabel')}
          testID="month-summary-info"
        >
          <Info size={14} color={colors.text.tertiary} />
        </TouchableOpacity>
        {expandable &&
          (isOpen ? (
            <ChevronUp size={16} color={colors.text.tertiary} />
          ) : (
            <ChevronDown size={16} color={colors.text.tertiary} />
          ))}
      </TouchableOpacity>

      {/* Expanded content — animated height; the absolutely-positioned inner
          view lays out at natural height so onLayout measures the true size
          regardless of the animated container height */}
      <Animated.View style={{ height: expandedHeight, overflow: 'hidden' }}>
        <View
          style={styles.expandedContentProbe}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            // Ignore ±1px re-measurements: the probe's pixel-grid rounding
            // depends on the footer's own (animated) height, so alternating
            // 1px readings otherwise feed back into a permanent height
            // jitter loop (footer visibly vibrates a few px when expanded).
            setContentHeight((prev) => (prev !== 0 && Math.abs(prev - h) <= 1 ? prev : h));
          }}
        >
          {!planMode && (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatMinutesDisplay(trackedMinutes)}</Text>
                  <Text style={styles.summaryLabel}>{t('calendar.month.tracked')}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatMinutesDisplay(plannedMinutes)}</Text>
                  <Text style={styles.summaryLabel}>{t('calendar.month.planned')}</Text>
                </View>
              </View>

              {fractionText != null && (
                <Text style={styles.fractionText} testID="month-summary-fraction">
                  {fractionText}
                </Text>
              )}
            </>
          )}

          <View style={styles.absenceSummaryRow}>
            {vacationDays > 0 && (
              <View style={styles.absenceChip}>
                <TreePalm size={12} color={colors.primary[500]} />
                <Text style={styles.absenceChipText}>{vacationDays}</Text>
              </View>
            )}
            {sickDays > 0 && (
              <View style={styles.absenceChip}>
                <Thermometer size={12} color={colors.warning.dark} />
                <Text style={styles.absenceChipText}>{sickDays}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Summary Footer Styles
  summaryFooter: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  summaryCollapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryCollapsedLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  summaryInfoButton: {
    padding: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.default,
  },
  expandedContentProbe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  fractionText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  absenceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    minHeight: 20, // Consistent height even when empty
  },
  absenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.sm,
  },
  absenceChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
});
