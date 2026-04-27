import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, PanResponder, Animated, useWindowDimensions } from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay, addMonths, subMonths } from 'date-fns';
import { TreePalm, Thermometer, Check, CircleHelp, X, ChevronDown, ChevronUp } from 'lucide-react-native';
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
  findOverlappingShift,
} from '@/lib/calendar/calendar-utils';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import type { AbsenceInstance } from '@/lib/calendar/types';
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
  onLongPress,
  indicators,
  isToday,
  isCurrentMonth,
  isTargetDay,
  flashType,
  flashCounter,
}: {
  date: Date;
  onPress: (date: Date) => void;
  onLongPress: (date: Date) => void;
  indicators: DayCellIndicators;
  isToday: boolean;
  isCurrentMonth: boolean;
  isTargetDay: boolean;
  flashType: 'place' | 'remove' | null;
  flashCounter: number;
}) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const lastFlashRef = useRef(0);

  // Trigger flash animation when flashCounter changes (handles repeat flashes on same cell)
  React.useEffect(() => {
    if (flashType && flashCounter !== lastFlashRef.current) {
      lastFlashRef.current = flashCounter;
      flashAnim.setValue(1);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [flashType, flashCounter]);

  const flashColor = flashType === 'remove'
    ? flashAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', 'rgba(239, 68, 68, 0.25)'] })
    : flashAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', 'rgba(34, 197, 94, 0.25)'] });

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
        isTargetDay && styles.dayCellTarget,
      ]}
      onPress={() => onPress(date)}
      onLongPress={() => onLongPress(date)}
      delayLongPress={400}
    >
      {/* Flash overlay for place/remove feedback */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, borderRadius: borderRadius.md }]}
      />
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
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const overtimeDisplay = formatOvertimeDisplay(totalOvertimeMinutes);
  const confirmedDisplay = formatOvertimeDisplay(confirmedOvertimeMinutes);

  const getOvertimeColor = () => {
    if (totalOvertimeMinutes > 0) return colors.success.main;
    if (totalOvertimeMinutes < 0) return colors.error.main;
    return colors.text.primary;
  };

  const formatHoursMinutes = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.timing(expandAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Interpolate height: collapsed ~28pt, expanded ~90pt
  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 62], // additional height for expanded content
  });

  return (
    <View style={styles.summaryFooter}>
      {/* Collapsed bar — always visible */}
      <TouchableOpacity
        onPress={toggleExpanded}
        style={styles.summaryCollapsedRow}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        testID="summary-toggle"
      >
        <Text style={[styles.summaryValue, { color: getOvertimeColor() }]}>
          {overtimeDisplay}
        </Text>
        <Text style={styles.summaryCollapsedLabel}>{t('calendar.month.overtime')}</Text>
        {expanded ? (
          <ChevronUp size={16} color={colors.text.tertiary} />
        ) : (
          <ChevronDown size={16} color={colors.text.tertiary} />
        )}
      </TouchableOpacity>

      {/* Expanded content — animated height */}
      <Animated.View style={{ height: expandedHeight, overflow: 'hidden' }}>
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
              {confirmedDisplay}
            </Text>
            <Text style={styles.summaryLabel}>{t('calendar.month.confirmed')}</Text>
          </View>
        </View>

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
      </Animated.View>
    </View>
  );
}

const SWIPE_THRESHOLD = 50; // pixels

export default function MonthView() {
  const { state, dispatch } = useCalendar();
  const { width: screenWidth } = useWindowDimensions();
  const days = getMonthDays(state.currentMonth);

  // Flash feedback for place/remove actions
  const [flashCell, setFlashCell] = useState<{ dateKey: string; type: 'place' | 'remove'; counter: number } | null>(null);

  const triggerFlash = (dateKey: string, type: 'place' | 'remove') => {
    setFlashCell(prev => ({ dateKey, type, counter: (prev?.counter ?? 0) + 1 }));
  };

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

  // Place the armed shift/absence on a given date
  const placeArmedOnDate = async (dateKey: string) => {
    if (state.armedTemplateId) {
      const template = state.templates[state.armedTemplateId];
      if (template) {
        const overlap = findOverlappingShift(dateKey, template.startTime, template.duration, state.instances);
        if (overlap) {
          // Silent skip — light haptic instead of disruptive alert during batch placement
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return;
        }
      }
      dispatch({ type: 'PLACE_SHIFT', date: dateKey });
      triggerFlash(dateKey, 'place');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (state.armedAbsenceTemplateId) {
      const absenceTemplate = state.absenceTemplates[state.armedAbsenceTemplateId];
      if (absenceTemplate) {
        const startTime = absenceTemplate.isFullDay ? '00:00' : (absenceTemplate.startTime || '00:00');
        const endTime = absenceTemplate.isFullDay ? '23:59' : (absenceTemplate.endTime || '23:59');

        const newInstance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'> = {
          templateId: absenceTemplate.id,
          type: absenceTemplate.type,
          date: dateKey,
          startTime,
          endTime,
          isFullDay: absenceTemplate.isFullDay,
          name: absenceTemplate.name,
          color: absenceTemplate.color,
        };

        try {
          const storage = await getCalendarStorage();
          const created = await storage.createAbsenceInstance(newInstance);
          dispatch({ type: 'ADD_ABSENCE_INSTANCE', instance: created });
          triggerFlash(dateKey, 'place');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.error('[MonthView] Failed to create absence instance:', error);
        }
      }
    }
  };

  // Remove the armed shift/absence from a given date
  const removeArmedFromDate = (dateKey: string) => {
    if (state.armedTemplateId) {
      const instanceToRemove = Object.values(state.instances)
        .find(i => i.templateId === state.armedTemplateId && i.date === dateKey);
      if (instanceToRemove) {
        dispatch({ type: 'DELETE_INSTANCE', id: instanceToRemove.id });
        triggerFlash(dateKey, 'remove');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else if (state.armedAbsenceTemplateId) {
      const absenceToRemove = Object.values(state.absenceInstances)
        .find(a => a.templateId === state.armedAbsenceTemplateId && a.date === dateKey);
      if (absenceToRemove) {
        dispatch({ type: 'DELETE_ABSENCE_INSTANCE', id: absenceToRemove.id });
        triggerFlash(dateKey, 'remove');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };

  // Handle day tap — unified gesture model:
  // Armed: single-tap places instantly
  // Not armed: single-tap navigates to WeekView
  const handleDayPress = (date: Date) => {
    const dateKey = formatDateKey(date);

    // Block tap on locked days
    const dayStatus = state.confirmedDayStatus[dateKey];
    if (dayStatus?.status === 'locked') return;

    if (state.armedTemplateId || state.armedAbsenceTemplateId) {
      placeArmedOnDate(dateKey);
      return;
    }

    // Not armed: navigate to week view
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    dispatch({ type: 'SET_WEEK', date: weekStart });
    dispatch({ type: 'SET_VIEW', view: 'week' });
  };

  // Long press: when armed, remove shift; when not armed, open InlinePicker
  const handleDayLongPress = (date: Date) => {
    const dateKey = formatDateKey(date);

    // Block on locked days
    const dayStatus = state.confirmedDayStatus[dateKey];
    if (dayStatus?.status === 'locked') return;

    if (state.armedTemplateId || state.armedAbsenceTemplateId) {
      removeArmedFromDate(dateKey);
      return;
    }

    dispatch({ type: 'OPEN_INLINE_PICKER', targetDate: dateKey });
  };

  // Get armed template info for batch indicator
  const armedTemplate = state.armedTemplateId
    ? state.templates[state.armedTemplateId]
    : null;
  const armedAbsenceTemplate = state.armedAbsenceTemplateId
    ? state.absenceTemplates[state.armedAbsenceTemplateId]
    : null;



  // Exit batch mode (disarm any armed template)
  const handleExitBatchMode = () => {
    if (state.armedTemplateId) {
      dispatch({ type: 'DISARM_SHIFT' });
    }
    if (state.armedAbsenceTemplateId) {
      dispatch({ type: 'DISARM_ABSENCE' });
    }
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

  // Build calendar grid - dynamic row count (5 or 6 weeks)
  const monthStart = startOfMonth(state.currentMonth);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // Mon=0 ... Sun=6
  const firstDayIndex = (monthStart.getDay() + 6) % 7;
  const daysInMonth = endOfMonth(state.currentMonth).getDate();
  const weeksCount = Math.ceil((firstDayIndex + daysInMonth) / 7);
  const totalCells = weeksCount * 7;

  const calendarDays: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    calendarDays.push(addDays(firstWeekStart, i));
  }

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
                onLongPress={handleDayLongPress}
                indicators={indicatorsForDate(date)}
                isToday={isSameDay(date, new Date())}
                isCurrentMonth={date.getMonth() === state.currentMonth.getMonth()}
                isTargetDay={state.inlinePickerTargetDate === formatDateKey(date)}
                flashType={flashCell?.dateKey === formatDateKey(date) ? flashCell.type : null}
                flashCounter={flashCell?.counter ?? 0}
              />
            </View>
          ))}
        </View>
        {/* Batch mode indicator — inside Animated.View for Android compatibility; fixed slot prevents layout shift */}
        <View style={styles.batchIndicatorSlot}>
          {(armedTemplate || armedAbsenceTemplate) && (
            <View style={styles.batchIndicator}>
              <View
                style={[
                  styles.batchDot,
                  {
                    backgroundColor: armedTemplate
                      ? getColorPalette(armedTemplate.color).dot
                      : armedAbsenceTemplate?.color || '#6B7280',
                  },
                ]}
              />
              <View style={styles.batchTextContainer}>
                <Text style={styles.batchText}>
                  {t('calendar.batch.placing')} {armedTemplate?.name || armedAbsenceTemplate?.name}
                </Text>
                <Text style={styles.batchHint}>
                  {t('calendar.batch.tapHint')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleExitBatchMode}
                style={styles.batchCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
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
  dayCellTarget: {
    borderWidth: 2,
    borderColor: colors.primary[500],
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginHorizontal: -spacing.lg, // Counteract container padding for full-width border
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
  // Batch mode indicator — fixed-height slot in normal flow (no absolute positioning)
  batchIndicatorSlot: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  batchDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.sm,
  },
  batchTextContainer: {
    flex: 1,
  },
  batchText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  batchHint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  batchCloseBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
