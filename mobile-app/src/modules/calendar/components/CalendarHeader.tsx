import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { addDays, format, startOfWeek, startOfMonth, addMonths, subMonths, getISOWeek } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';
import { ArrowRight, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { calendarEvents } from '@/lib/events/calendarEvents';
import { t, getDateLocale } from '@/lib/i18n';
import type { MainTabParamList } from '@/navigation/AppNavigator';
import { WeekStateService, type WeekState } from '@/modules/reports/services/WeekStateService';

type CalendarNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Calendar'>;

export default function CalendarHeader() {
  const { state, dispatch } = useCalendar();
  const navigation = useNavigation<CalendarNavigationProp>();
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMessage = ({ message }: { message: string }) => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
      setConfirmationMessage(message);
      confirmationTimerRef.current = setTimeout(() => {
        setConfirmationMessage(null);
        confirmationTimerRef.current = null;
      }, 2000);
    };
    calendarEvents.on('day-confirmation-message', handleMessage);
    return () => {
      calendarEvents.off('day-confirmation-message', handleMessage);
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
    };
  }, []);

  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);
  const weekStartKey = format(weekStart, 'yyyy-MM-dd');
  const weekConfirmedCount = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  ).filter((dateKey) => state.confirmedDates.has(dateKey)).length;
  const weekComplete = weekConfirmedCount === 7;

  const [weekState, setWeekState] = useState<WeekState | null>(null);
  const [autoSend, setAutoSend] = useState(false);
  const weekIsFinalized =
    weekState === 'queued' ||
    weekState === 'sent' ||
    (weekState === 'confirmed' && autoSend);

  useEffect(() => {
    if (!weekComplete) {
      setWeekState(null);
      return;
    }

    let cancelled = false;
    const fetchState = async () => {
      try {
        const [nextState, autoSendValue] = await Promise.all([
          WeekStateService.getWeekState(weekStartKey),
          WeekStateService.getAutoSend(),
        ]);
        if (!cancelled) {
          setWeekState(nextState);
          setAutoSend(autoSendValue);
        }
      } catch (error) {
        console.error('[CalendarHeader] Failed to load week state:', error);
      }
    };
    fetchState();

    const handleChanged = ({ weekStart: changedWeek }: { weekStart: string | null }) => {
      if (changedWeek === null || changedWeek === weekStartKey) {
        fetchState();
      }
    };
    calendarEvents.on('week-state-changed', handleChanged);

    return () => {
      cancelled = true;
      calendarEvents.off('week-state-changed', handleChanged);
    };
  }, [weekStartKey, weekComplete]);
  const locale = getDateLocale() === 'de' ? deLocale : undefined;
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekRangeLabel = sameMonth
    ? `${format(weekStart, 'MMM d', { locale })} - ${format(weekEnd, 'd', { locale })}`
    : `${format(weekStart, 'MMM d', { locale })} - ${format(weekEnd, 'MMM d', { locale })}`;
  const monthLabel = format(state.currentMonth, 'LLLL yyyy', { locale });
  const title = state.view === 'week' ? weekRangeLabel : monthLabel;

  const handlePrev = () => {
    console.log('[CalendarHeader] handlePrev called, view:', state.view);
    if (state.view === 'week') {
      // Use PREV_WEEK action (same as swipe navigation) to avoid potential date calculation issues
      console.log('[CalendarHeader] Dispatching PREV_WEEK');
      dispatch({ type: 'PREV_WEEK' });
    } else {
      const newDate = subMonths(state.currentMonth, 1);
      console.log('[CalendarHeader] Navigating to previous month:', newDate.toISOString());
      dispatch({ type: 'SET_MONTH', date: newDate });
    }
  };

  const handleNext = () => {
    console.log('[CalendarHeader] handleNext called, view:', state.view);
    if (state.view === 'week') {
      // Use NEXT_WEEK action (same as swipe navigation) to avoid potential date calculation issues
      console.log('[CalendarHeader] Dispatching NEXT_WEEK');
      dispatch({ type: 'NEXT_WEEK' });
    } else {
      const newDate = addMonths(state.currentMonth, 1);
      console.log('[CalendarHeader] Navigating to next month:', newDate.toISOString());
      dispatch({ type: 'SET_MONTH', date: newDate });
    }
  };

  const handleToday = () => {
    if (state.view === 'week') {
      dispatch({ type: 'SET_WEEK', date: startOfWeek(new Date(), { weekStartsOn: 1 }) });
    } else {
      dispatch({ type: 'SET_MONTH', date: startOfMonth(new Date()) });
    }
  };

  const handleReviewToggle = (value: boolean) => {
    dispatch({ type: 'TOGGLE_REVIEW_MODE' });
  };

  const setView = (view: 'week' | 'month') => {
    dispatch({ type: 'SET_VIEW', view });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={handleToday} activeOpacity={0.7} style={styles.titleSide}>
          <Text style={styles.label}>{t('calendar.header.title')}</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
            {state.view === 'week' && (
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>W{weekNumber}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.viewToggle} accessible={false}>
          <TouchableOpacity
            style={[styles.segment, state.view === 'week' && styles.segmentActive]}
            onPress={() => setView('week')}
            testID="toggle-week"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.segmentText, state.view === 'week' && styles.segmentTextActive]}>{t('calendar.header.week')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, state.view === 'month' && styles.segmentActive]}
            onPress={() => setView('month')}
            testID="toggle-month"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.segmentText, state.view === 'month' && styles.segmentTextActive]}>{t('calendar.header.month')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.navigation} accessible={false}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePrev}
            accessibilityRole="button"
            accessibilityLabel={state.view === 'week'
              ? t('calendar.header.previousWeek')
              : t('calendar.header.previousMonth')}
            testID="calendar-prev"
          >
            <ChevronLeft size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={state.view === 'week'
              ? t('calendar.header.nextWeek')
              : t('calendar.header.nextMonth')}
            testID="calendar-next"
          >
            <ChevronRight size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {state.view === 'week' && (
          <View style={styles.gpsToggle}>
            <View style={[styles.gpsIndicator, state.reviewMode && styles.gpsIndicatorActive]}>
              {state.reviewMode ? (
                <Eye size={14} color={colors.error.main} />
              ) : (
                <EyeOff size={14} color={colors.grey[400]} />
              )}
              <Text style={[styles.gpsText, state.reviewMode && styles.gpsTextActive]}>GPS</Text>
            </View>
            <Switch
              value={state.reviewMode}
              onValueChange={handleReviewToggle}
              trackColor={{ false: colors.grey[300], true: colors.error.light }}
              thumbColor={state.reviewMode ? colors.error.main : colors.grey[100]}
              ios_backgroundColor={colors.grey[300]}
              testID="toggle-review"
            />
          </View>
        )}
      </View>

      {/* Slot priority: day-confirmation flash → finalized → week-complete prompt → submit hint */}
      {state.view === 'week' && state.reviewMode && (
        confirmationMessage ? (
          <Text
            style={styles.confirmationMessage}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            testID="calendar-header-confirmation"
          >
            {confirmationMessage}
          </Text>
        ) : weekComplete && weekIsFinalized ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Reports')}
            style={styles.weekCompleteRow}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.header.weekFinalized')}
            testID="calendar-header-week-finalized"
          >
            <Text
              style={styles.weekCompleteText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t('calendar.header.weekFinalized')}
            </Text>
          </TouchableOpacity>
        ) : weekComplete && weekState === 'confirmed' ? (
          // Only show the action prompt once we've *confirmed* the week isn't already
          // queued/sent — avoids briefly asking the user to finalize a week they
          // already finalized when reopening the app.
          <TouchableOpacity
            onPress={() => navigation.navigate('Reports')}
            style={styles.weekCompleteRow}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.header.weekComplete')}
            testID="calendar-header-week-complete"
          >
            <Text
              style={styles.weekCompleteText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t('calendar.header.weekComplete')}
            </Text>
            <ArrowRight size={14} color={colors.success.dark} />
          </TouchableOpacity>
        ) : (
          <Text
            style={styles.submitHint}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            testID="calendar-header-submit-hint"
          >
            {t('calendar.header.submitHint')}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleSide: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    fontSize: fontSize.xs,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.text.tertiary,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekBadge: {
    backgroundColor: colors.grey[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  weekBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.paper,
  },
  segmentActive: {
    backgroundColor: colors.primary[500],
  },
  segmentText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.grey[100],
  },
  gpsIndicatorActive: {
    backgroundColor: colors.error.light,
  },
  gpsText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.grey[500],
  },
  gpsTextActive: {
    color: colors.error.dark,
  },
  submitHint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success.dark,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  weekCompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  weekCompleteText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success.dark,
    flexShrink: 1,
  },
});
