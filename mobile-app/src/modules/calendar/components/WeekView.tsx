import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { startOfWeek, subDays, format as formatDate } from 'date-fns';
import { useCalendar } from '@/lib/calendar/calendar-context';
import {
  calculateShiftDisplay,
  formatDateKey,
  formatDuration,
  generateHourMarkers,
  getInstancesForDate,
  getWeekDays,
  timeToMinutes,
  getColorPalette,
} from '@/lib/calendar/calendar-utils';
import type { ShiftInstance, TrackingRecord } from '@/lib/calendar/types';

const HOUR_HEIGHT = 48;

function TrackingBadge({ record }: { record: TrackingRecord }) {
  const { topOffset, height } = calculateShiftDisplay(record.startTime, record.duration);
  return (
    <View style={[styles.trackingBlock, { top: topOffset, height }]}> 
      <Text style={styles.trackingText}>{record.startTime}</Text>
      <Text style={styles.trackingTextSmall}>{formatDuration(record.duration)}</Text>
    </View>
  );
}

function InstanceCard({ instance }: { instance: ShiftInstance }) {
  const palette = getColorPalette(instance.color);
  const { topOffset, height } = calculateShiftDisplay(instance.startTime, instance.duration);
  return (
    <View
      style={[styles.shiftBlock, { top: topOffset, height, backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.shiftName, { color: palette.text }]} numberOfLines={1}>
        {instance.name}
      </Text>
      <Text style={styles.shiftTime}>
        {instance.startTime} - {instance.endTime}
      </Text>
    </View>
  );
}

export default function WeekView() {
  const { state, dispatch } = useCalendar();
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const hourMarkers = useMemo(() => generateHourMarkers(), []);

  const getTrackingForDate = (dateKey: string): TrackingRecord[] => {
    return Object.values(state.trackingRecords).filter((record) => record.date === dateKey);
  };

  const handleHourPress = (dateKey: string) => {
    if (!state.armedTemplateId) return;
    dispatch({ type: 'PLACE_SHIFT', date: dateKey });
  };

  const confirmDay = (dateKey: string) => {
    dispatch({ type: 'CONFIRM_DAY', date: dateKey });
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.timeColumnHeader} />
            {weekDays.map((day, index) => {
              const dateKey = formatDateKey(day);
              const isConfirmed = state.confirmedDates.has(dateKey);
              const trackingRecords = getTrackingForDate(dateKey);
              const needsReview = state.reviewMode && trackingRecords.length > 0 && !isConfirmed;
              return (
                <View key={dateKey} style={styles.dayHeader}>
                  <Text style={styles.dayName}>{formatDate(day, 'EEE')}</Text>
                  <Text style={styles.dayNumber}>{formatDate(day, 'd')}</Text>
                  {state.reviewMode && (
                    <View style={[styles.reviewBadge, needsReview && styles.reviewBadgeNeedsReview, isConfirmed && styles.reviewBadgeConfirmed]}>
                      <Text style={styles.reviewBadgeText}>
                        {isConfirmed ? '✓' : needsReview ? '!' : ''}
                      </Text>
                    </View>
                  )}
                  {state.reviewMode && trackingRecords.length > 0 && !isConfirmed && (
                    <TouchableOpacity style={styles.confirmButton} onPress={() => confirmDay(dateKey)}>
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <ScrollView style={styles.gridScroll} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.gridRow}>
              <View style={styles.timeColumn}>
                {hourMarkers.map((hour) => (
                  <View key={hour} style={[styles.timeCell, { height: HOUR_HEIGHT }]}>
                    <Text style={styles.timeCellText}>{hour}</Text>
                  </View>
                ))}
              </View>

              {weekDays.map((day, dayIndex) => {
                const dateKey = formatDateKey(day);
                const previousDateKey = dayIndex > 0 ? formatDateKey(weekDays[dayIndex - 1]) : formatDateKey(subDays(day, 1));
                const { current, fromPrevious } = getInstancesForDate(state.instances, dateKey, previousDateKey);
                const trackingRecords = getTrackingForDate(dateKey);
                return (
                  <View key={dateKey} style={styles.dayColumn}>
                    {Array.from({ length: 24 }).map((_, hourIndex) => (
                      <Pressable
                        key={hourIndex}
                        style={[styles.hourCell, { height: HOUR_HEIGHT }]}
                        onPress={() => handleHourPress(dateKey)}
                      />
                    ))}
                    {current.map((instance) => (
                      <InstanceCard key={instance.id} instance={instance} />
                    ))}
                    {fromPrevious.map((instance) => {
                      const startMinutes = timeToMinutes(instance.startTime);
                      const overflowMinutes = startMinutes + instance.duration - 24 * 60;
                      const height = Math.max(20, (overflowMinutes / 60) * HOUR_HEIGHT);
                      return (
                        <View
                          key={`${instance.id}-overflow`}
                          style={[
                            styles.shiftBlock,
                            { top: 0, height, backgroundColor: '#FFF3E0', borderColor: '#FFAB91' },
                          ]}
                        >
                          <Text style={styles.shiftName}>{instance.name}</Text>
                          <Text style={styles.shiftTime}>Continues…</Text>
                        </View>
                      );
                    })}
                    {state.reviewMode && trackingRecords.map((record) => (
                      <TrackingBadge key={record.id} record={record} />
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  timeColumnHeader: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
  },
  dayHeader: {
    width: 120,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 12,
    color: '#8E8E93',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  reviewBadge: {
    marginTop: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBadgeNeedsReview: {
    backgroundColor: '#FFE5E5',
  },
  reviewBadgeConfirmed: {
    backgroundColor: '#E0F7EC',
  },
  reviewBadgeText: {
    fontSize: 12,
    color: '#111',
  },
  confirmButton: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFCDD2',
  },
  confirmButtonText: {
    fontSize: 12,
    color: '#B71C1C',
    fontWeight: '600',
  },
  gridScroll: {
    maxHeight: 24 * HOUR_HEIGHT + 20,
  },
  gridRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
  },
  timeCell: {
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  timeCellText: {
    fontSize: 10,
    color: '#8E8E93',
  },
  dayColumn: {
    width: 120,
    borderRightWidth: 1,
    borderRightColor: '#F1F1F1',
    position: 'relative',
  },
  hourCell: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  shiftBlock: {
    position: 'absolute',
    left: 6,
    right: 6,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  shiftName: {
    fontSize: 12,
    fontWeight: '600',
  },
  shiftTime: {
    fontSize: 11,
    color: '#555',
  },
  trackingBlock: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.6)',
    padding: 4,
  },
  trackingText: {
    fontSize: 11,
    color: '#B71C1C',
    fontWeight: '600',
  },
  trackingTextSmall: {
    fontSize: 10,
    color: '#B71C1C',
  },
});
