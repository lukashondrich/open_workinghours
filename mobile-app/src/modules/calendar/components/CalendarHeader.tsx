import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { addDays, addWeeks, format, startOfWeek, subWeeks, addMonths, subMonths, getISOWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';

export default function CalendarHeader() {
  const { state, dispatch } = useCalendar();
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);
  const weekRangeLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  const monthLabel = format(state.currentMonth, 'LLLL yyyy');
  const title = state.view === 'week' ? weekRangeLabel : monthLabel;

  const weekDateKeys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  }, [weekStart]);

  const allConfirmed = weekDateKeys.every((date) => state.confirmedDayStatus[date]?.status === 'confirmed');
  const confirmedCount = weekDateKeys.filter((date) => state.confirmedDayStatus[date]?.status === 'confirmed').length;

  const handlePrev = () => {
    if (state.view === 'week') {
      dispatch({ type: 'SET_WEEK', date: subWeeks(state.currentWeekStart, 1) });
    } else {
      dispatch({ type: 'SET_MONTH', date: subMonths(state.currentMonth, 1) });
    }
  };

  const handleNext = () => {
    if (state.view === 'week') {
      dispatch({ type: 'SET_WEEK', date: addWeeks(state.currentWeekStart, 1) });
    } else {
      dispatch({ type: 'SET_MONTH', date: addMonths(state.currentMonth, 1) });
    }
  };

  const handleToday = () => {
    dispatch({ type: 'SET_WEEK', date: startOfWeek(new Date(), { weekStartsOn: 1 }) });
  };

  const toggleTemplatePanel = () => {
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
  };

  const toggleReview = () => {
    dispatch({ type: 'TOGGLE_REVIEW_MODE' });
  };

  const setView = (view: 'week' | 'month') => {
    dispatch({ type: 'SET_VIEW', view });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={handleToday} activeOpacity={0.7}>
          <Text style={styles.label}>Planning Calendar</Text>
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
            <Text style={[styles.segmentText, state.view === 'week' && styles.segmentTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, state.view === 'month' && styles.segmentActive]}
            onPress={() => setView('month')}
          >
            <Text style={[styles.segmentText, state.view === 'month' && styles.segmentTextActive]}>Month</Text>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, state.reviewMode && styles.actionButtonActive]}
            onPress={toggleReview}
            testID="toggle-review"
          >
            <Text style={[styles.actionButtonText, state.reviewMode && styles.actionButtonTextActive]}>
              {state.reviewMode ? 'Exit Review' : 'Enter Review'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={toggleTemplatePanel} testID="toggle-templates">
            <Text style={styles.primaryButtonText}>Templates</Text>
          </TouchableOpacity>
        </View>
      </View>

      {state.view === 'week' && (
        <View style={styles.submissionContainer} testID="week-status-card">
          <View style={styles.submissionInfo}>
            <Text style={styles.submissionLabel}>Daily Submissions</Text>
            <Text style={styles.submissionStatus} testID="week-status">
              {allConfirmed
                ? 'All days confirmed & submitted'
                : `${confirmedCount}/7 days confirmed`}
            </Text>
            <Text style={styles.submissionHint}>
              {allConfirmed
                ? 'Submissions are sent automatically when you confirm each day.'
                : 'Enter Review mode to confirm days. Each confirmed day is submitted immediately.'}
            </Text>
          </View>
        </View>
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionButtonActive: {
    backgroundColor: colors.error.light,
    borderColor: colors.error.main,
  },
  actionButtonText: {
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  actionButtonTextActive: {
    color: colors.error.dark,
  },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  submissionContainer: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
  },
  submissionInfo: {
    flex: 1,
  },
  submissionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
    textTransform: 'uppercase',
  },
  submissionStatus: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  submissionHint: {
    marginTop: spacing.xs,
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});
