import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { addDays, format, startOfWeek, startOfMonth, addMonths, subMonths, getISOWeek } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { t, getDateLocale } from '@/lib/i18n';

export default function CalendarHeader() {
  const { state, dispatch } = useCalendar();
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);
  const locale = getDateLocale() === 'de' ? deLocale : undefined;
  const weekRangeLabel = `${format(weekStart, 'MMM d', { locale })} - ${format(weekEnd, 'MMM d', { locale })}`;
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
        <TouchableOpacity onPress={handleToday} activeOpacity={0.7}>
          <Text style={styles.label}>{t('calendar.header.title')}</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {state.view === 'week' && (
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>W{weekNumber}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.segment, state.view === 'week' && styles.segmentActive]}
            onPress={() => setView('week')}
          >
            <Text style={[styles.segmentText, state.view === 'week' && styles.segmentTextActive]}>{t('calendar.header.week')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, state.view === 'month' && styles.segmentActive]}
            onPress={() => setView('month')}
          >
            <Text style={[styles.segmentText, state.view === 'month' && styles.segmentTextActive]}>{t('calendar.header.month')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.navigation}>
          <TouchableOpacity style={styles.navButton} onPress={handlePrev}>
            <ChevronLeft size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
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

      {/* Submit hint when GPS mode is active */}
      {state.view === 'week' && state.reviewMode && (
        <Text style={styles.submitHint}>{t('calendar.header.submitHint')}</Text>
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
  label: {
    fontSize: fontSize.xs,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.text.tertiary,
  },
  title: {
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
});
