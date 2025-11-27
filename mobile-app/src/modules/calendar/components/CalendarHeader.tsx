import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { addDays, addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { useCalendar } from '@/lib/calendar/calendar-context';

export default function CalendarHeader() {
  const { state, dispatch } = useCalendar();
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;

  const handlePrev = () => {
    dispatch({ type: 'SET_WEEK', date: subWeeks(state.currentWeekStart, 1) });
  };

  const handleNext = () => {
    dispatch({ type: 'SET_WEEK', date: addWeeks(state.currentWeekStart, 1) });
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
        <View>
          <Text style={styles.label}>Planning Calendar</Text>
          <Text style={styles.title}>{rangeLabel}</Text>
        </View>
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
            <Text style={styles.navButtonText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
            <Text style={styles.navButtonText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, state.reviewMode && styles.actionButtonActive]}
            onPress={toggleReview}
          >
            <Text style={[styles.actionButtonText, state.reviewMode && styles.actionButtonTextActive]}>
              {state.reviewMode ? 'Exit Review' : 'Enter Review'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={toggleTemplatePanel}>
            <Text style={styles.primaryButtonText}>Templates</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 24,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  segmentActive: {
    backgroundColor: '#111',
  },
  segmentText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 18,
    color: '#111',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionButtonActive: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FF5A5F',
  },
  actionButtonText: {
    color: '#111',
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#B71C1C',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
