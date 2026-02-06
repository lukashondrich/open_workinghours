import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, PanResponder, Animated, useWindowDimensions } from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay, addMonths, subMonths } from 'date-fns';
import { TreePalm, Thermometer, Check, CircleHelp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import {
  getMonthDays,
  formatDateKey,
  getColorPalette,
  getAbsencesForDate,
  getMonthSummary,
  formatOvertimeDisplay,
  getTrackedMinutesForDate,
} from '@/lib/calendar/calendar-utils';
import { computePlannedMinutesForDate, getInstanceWindow, getDayBounds, computeOverlapMinutes } from '@/lib/calendar/time-calculations';
import { t } from '@/lib/i18n';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

interface DayCellIndicators {
  templateColors: string[];
  tracked: boolean;
  confirmed: boolean;
  hasVacation: boolean;
  hasSick: boolean;
  hasActivity: boolean;
  overtimeMinutes: number; // tracked - planned for this day
}

function DayCell({
  date,
  onPress,
  indicators,
  isToday,
  isCurrentMonth,
}: {
  date: Date;
  onPress: (date: Date) => void;
  indicators: DayCellIndicators;
  isToday: boolean;
  isCurrentMonth: boolean;
}) {
  const overtimeDisplay = formatOvertimeDisplay(indicators.overtimeMinutes);

  // Determine overtime color
  const getOvertimeColor = () => {
    if (indicators.overtimeMinutes > 0) return colors.success.main; // green
    if (indicators.overtimeMinutes < 0) return colors.error.main; // red
    return colors.grey[500]; // grey for zero
  };

  const dateKey = format(date, 'yyyy-MM-dd');

  return (
    <TouchableOpacity
      testID={`month-day-${dateKey}`}
      accessibilityRole="button"
      style={[
        styles.dayCell,
        !isCurrentMonth && styles.dayCellMuted,
        isToday && styles.dayCellToday,
      ]}
      onPress={() => onPress(date)}
    >
      <Text
        style={[
          styles.dayLabel,
          !isCurrentMonth && styles.dayLabelMuted,
        ]}
      >
        {format(date, 'd')}
      </Text>
      {/* Row 1: Shift dots (always present for consistent layout) */}
      <View style={styles.dotRow} accessible={false}>
        {indicators.templateColors.length > 0 && (
          <View testID={`month-day-${dateKey}-shifts`} accessible={false} style={{ flexDirection: 'row', gap: 2 }}>
            {indicators.templateColors.map((color: string, idx: number) => (
              <View key={`${color}-${idx}`} style={[styles.dot, { backgroundColor: color }]} />
            ))}
          </View>
        )}
        {indicators.tracked && <View testID={`month-day-${dateKey}-tracked`} style={[styles.dot, styles.trackedDot]} />}
      </View>
      {/* Row 2: Absence icons (always present for consistent layout) */}
      <View style={styles.absenceRow} accessible={false}>
        {indicators.hasVacation && <View testID={`month-day-${dateKey}-vacation`}><TreePalm size={10} color="#6B7280" /></View>}
        {indicators.hasSick && <View testID={`month-day-${dateKey}-sick`}><Thermometer size={10} color="#92400E" /></View>}
      </View>
      {/* Row 3: Confirmation status - overtime for confirmed, ? for unconfirmed with activity */}
      <View style={styles.confirmRow}>
        {indicators.confirmed ? (
          <View style={styles.overtimeColumn}>
            <Text style={[styles.overtimeText, { color: getOvertimeColor() }]}>
              {overtimeDisplay}
            </Text>
            <Check size={10} color={colors.primary[500]} />
          </View>
        ) : indicators.hasActivity ? (
          <CircleHelp size={12} color={colors.grey[400]} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

interface MonthlySummaryFooterProps {
  trackedHours: number;
  plannedHours: number;
  vacationDays: number;
  sickDays: number;
  confirmedOvertimeMinutes: number;
  totalOvertimeMinutes: number;
}

function MonthlySummaryFooter({
  trackedHours,
  plannedHours,
  vacationDays,
  sickDays,
  confirmedOvertimeMinutes,
  totalOvertimeMinutes,
}: MonthlySummaryFooterProps) {
  const overtimeDisplay = formatOvertimeDisplay(totalOvertimeMinutes);
  const confirmedDisplay = formatOvertimeDisplay(confirmedOvertimeMinutes);

  // Determine overtime color
  const getOvertimeColor = () => {
    if (totalOvertimeMinutes > 0) return colors.success.main;
    if (totalOvertimeMinutes < 0) return colors.error.main;
    return colors.text.primary;
  };

  // Format hours as "Xh Ym" instead of decimal
  const formatHoursMinutes = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <View style={styles.summaryFooter}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatHoursMinutes(trackedHours)}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.month.tracked')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatHoursMinutes(plannedHours)}</Text>
          <Text style={styles.summaryLabel}>{t('calendar.month.planned')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: getOvertimeColor() }]}>
            {overtimeDisplay}
          </Text>
          <Text style={styles.summaryLabel}>{t('calendar.month.overtime')}</Text>
          {/* Always reserve space for hint to prevent layout shift */}
          <Text style={[styles.confirmedHint, confirmedOvertimeMinutes === totalOvertimeMinutes && { opacity: 0 }]}>
            {confirmedOvertimeMinutes !== totalOvertimeMinutes
              ? `(${confirmedDisplay} ${t('calendar.month.confirmed')})`
              : ' ' /* invisible placeholder */}
          </Text>
        </View>
      </View>

      {/* Always render row to maintain consistent footer height */}
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
  );
}

const SWIPE_THRESHOLD = 50; // pixels

export default function MonthView() {
  const { state, dispatch } = useCalendar();
  const { width: screenWidth } = useWindowDimensions();
  const days = getMonthDays(state.currentMonth);

  // Animation state
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use ref to avoid stale closure in panResponder
  const currentMonthRef = useRef(state.currentMonth);
  currentMonthRef.current = state.currentMonth;

  // Ref to track transitioning state (avoids stale closure)
  const isTransitioningRef = useRef(false);

  // Animated month navigation
  const animateToMonth = useCallback((direction: 'prev' | 'next') => {
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const targetX = direction === 'prev' ? screenWidth : -screenWidth;

    Animated.timing(slideAnim, {
      toValue: targetX,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Update month
      const newMonth = direction === 'prev'
        ? subMonths(currentMonthRef.current, 1)
        : addMonths(currentMonthRef.current, 1);
      dispatch({ type: 'SET_MONTH', date: newMonth });

      // Reset animation instantly
      slideAnim.setValue(0);
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    });
  }, [screenWidth, slideAnim, dispatch]);

  // Keep ref to animateToMonth for panResponder
  const animateToMonthRef = useRef(animateToMonth);
  animateToMonthRef.current = animateToMonth;

  // Swipe navigation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal swipes (more horizontal than vertical)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right → previous month
          animateToMonthRef.current('prev');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left → next month
          animateToMonthRef.current('next');
        }
      },
    })
  ).current;

  const handleDayPress = (date: Date) => {
    dispatch({ type: 'SET_VIEW', view: 'week' });
    dispatch({ type: 'SET_WEEK', date });
  };

  const indicatorsForDate = (date: Date): DayCellIndicators => {
    const dateKey = formatDateKey(date);
    const templateColors: string[] = [];
    const { start: dayStart, end: dayEnd } = getDayBounds(dateKey);

    Object.values(state.instances)
      .filter((instance) => {
        const { start, end } = getInstanceWindow(instance);
        return computeOverlapMinutes(start, end, dayStart, dayEnd) > 0;
      })
      .forEach((instance) => {
        const palette = getColorPalette(instance.color);
        templateColors.push(palette.dot);
      });

    const plannedMinutes = computePlannedMinutesForDate(state.instances, dateKey);

    // Get tracked minutes with proper multi-day session handling
    const { trackedMinutes, hasTracking } = getTrackedMinutesForDate(dateKey, state.trackingRecords);

    const confirmed = state.confirmedDates.has(dateKey);

    // Check for absences
    const absences = getAbsencesForDate(state.absenceInstances, dateKey);
    const hasVacation = absences.some((a) => a.type === 'vacation');
    const hasSick = absences.some((a) => a.type === 'sick');

    // Has activity if there are shifts, tracking, or absences
    const hasActivity = templateColors.length > 0 || hasTracking || hasVacation || hasSick;

    // Calculate overtime for this day
    const overtimeMinutes = trackedMinutes - plannedMinutes;

    return {
      templateColors: templateColors.slice(0, 3),
      tracked: hasTracking,
      confirmed,
      hasVacation,
      hasSick,
      hasActivity,
      overtimeMinutes,
    };
  };

  // Build calendar grid - always 42 cells (6 weeks) for consistent layout
  const firstWeekStart = startOfWeek(startOfMonth(state.currentMonth), { weekStartsOn: 1 });
  const calendarDays: Date[] = [];
  for (let i = 0; i < 42; i++) {
    calendarDays.push(addDays(firstWeekStart, i));
  }

  const weeksCount = 6;

  // Calculate month summary
  const summary = useMemo(
    () =>
      getMonthSummary(
        state.currentMonth,
        state.instances,
        state.trackingRecords,
        state.absenceInstances,
        state.confirmedDates,
      ),
    [state.currentMonth, state.instances, state.trackingRecords, state.absenceInstances, state.confirmedDates],
  );

  const totalOvertimeMinutes = summary.trackedMinutes - summary.plannedMinutes;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View style={[styles.animatedContent, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_KEYS.map((key) => (
            <Text key={key} style={styles.weekdayLabel}>
              {t(`common.weekdays.${key}`)}
            </Text>
          ))}
        </View>
        <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {calendarDays.map((date) => (
            <View
              key={date.toISOString()}
              style={{ width: `${100 / 7}%`, height: `${100 / weeksCount}%` }}
            >
              <DayCell
                date={date}
                onPress={handleDayPress}
                indicators={indicatorsForDate(date)}
                isToday={isSameDay(date, new Date())}
                isCurrentMonth={date.getMonth() === state.currentMonth.getMonth()}
              />
            </View>
          ))}
        </View>
      </Animated.View>
      <MonthlySummaryFooter
        trackedHours={summary.trackedMinutes / 60}
        plannedHours={summary.plannedMinutes / 60}
        vacationDays={summary.vacationDays}
        sickDays={summary.sickDays}
        confirmedOvertimeMinutes={summary.confirmedOvertimeMinutes}
        totalOvertimeMinutes={totalOvertimeMinutes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  animatedContent: {
    flex: 1,
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
    flex: 1,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellToday: {
    backgroundColor: colors.primary[50],
  },
  dayLabel: {
    fontSize: fontSize.sm,
    marginBottom: 2,
    color: colors.text.primary,
  },
  dayLabelMuted: {
    color: colors.grey[500],
  },
  dotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    minHeight: 8,
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
  absenceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
    minHeight: 10,
  },
  confirmRow: {
    marginTop: 2,
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overtimeColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  overtimeText: {
    fontSize: 9,
    fontWeight: fontWeight.medium,
  },
  // Summary Footer Styles
  summaryFooter: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.lg, // Counteract container padding for full-width border
    backgroundColor: colors.background.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
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
    fontSize: fontSize.lg,
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
    height: 40,
    backgroundColor: colors.border.default,
  },
  confirmedHint: {
    fontSize: 9,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  absenceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    minHeight: 32, // Consistent height even when empty
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
