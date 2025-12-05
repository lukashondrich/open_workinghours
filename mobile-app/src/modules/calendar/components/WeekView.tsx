import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Vibration,
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
import ShiftEditModal from './ShiftEditModal';
import { persistDailyActualForDate } from '../services/DailyAggregator';

const HOUR_HEIGHT = 48;
const MIN_DRAG_STEP_MINUTES = 5;
const GRABBER_HIT_HEIGHT = 64;
const EDGE_LABEL_OFFSET = 18;

function minutesFromDrag(dy: number) {
  const minutes = (dy / HOUR_HEIGHT) * 60;
  const rounded = Math.round(minutes / MIN_DRAG_STEP_MINUTES) * MIN_DRAG_STEP_MINUTES;
  return rounded;
}

function formatTimeLabel(minutesTotal: number) {
  const normalized = ((minutesTotal % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function TrackingBadge({
  record,
  onAdjustStart,
  onAdjustEnd,
  onToggleActive,
  active,
  setDragging,
}: {
  record: TrackingRecord;
  onAdjustStart: (id: string, deltaMinutes: number) => void;
  onAdjustEnd: (id: string, deltaMinutes: number) => void;
  onToggleActive: () => void;
  active: boolean;
  setDragging: (dragging: boolean) => void;
}) {
  const { topOffset, height } = calculateShiftDisplay(record.startTime, record.duration, HOUR_HEIGHT);
  const startMinutes = timeToMinutes(record.startTime);
  const endLabel = formatTimeLabel(startMinutes + record.duration);
  const startPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onPanResponderGrant: () => {
          setDragging(true);
          Vibration.vibrate(15);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging(false);
          const delta = minutesFromDrag(gesture.dy);
          if (delta !== 0) {
            onAdjustStart(record.id, delta);
          }
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [record.id, onAdjustStart, active, setDragging],
  );

  const endPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onPanResponderGrant: () => {
          setDragging(true);
          Vibration.vibrate(15);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging(false);
          const delta = minutesFromDrag(gesture.dy);
          if (delta !== 0) {
            onAdjustEnd(record.id, delta);
          }
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [record.id, onAdjustEnd, active, setDragging],
  );

  return (
    <Pressable
      onLongPress={onToggleActive}
      style={{ position: 'absolute', left: 12, right: 12, top: topOffset, height }}
    >
      <View style={[styles.trackingBlock, { height }]}> 
        <View style={styles.trackingDurationContainer}>
          <Text style={styles.trackingDurationText}>{formatDuration(record.duration)}</Text>
        </View>
      </View>
      {active && (
        <View style={[styles.grabberContainer, styles.grabberTop]} {...startPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
      {active && (
        <View style={[styles.grabberContainer, styles.grabberBottom]} {...endPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
      <Text style={[styles.edgeLabel, styles.edgeLabelTop]}>{record.startTime}</Text>
      <Text style={[styles.edgeLabel, styles.edgeLabelBottom]}>{endLabel}</Text>
    </Pressable>
  );
}

function InstanceCard({ instance, onLongPress }: { instance: ShiftInstance; onLongPress: (instance: ShiftInstance) => void }) {
  const palette = getColorPalette(instance.color);
  const { topOffset, height } = calculateShiftDisplay(instance.startTime, instance.duration, HOUR_HEIGHT);
  return (
    <Pressable
      onLongPress={() => onLongPress(instance)}
      delayLongPress={400}
      style={[styles.shiftBlock, { top: topOffset, height, backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.shiftName, { color: palette.text }]} numberOfLines={1}>
        {instance.name}
      </Text>
      <Text style={styles.shiftTime}>
        {instance.startTime} - {instance.endTime}
      </Text>
    </Pressable>
  );
}

export default function WeekView() {
  const { state, dispatch } = useCalendar();
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<ShiftInstance | null>(null);
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const hourMarkers = useMemo(() => generateHourMarkers(), []);

  useEffect(() => {
    if (!state.reviewMode) {
      setActiveTrackingId(null);
    }
  }, [state.reviewMode]);

  const getTrackingForDate = (dateKey: string): TrackingRecord[] => {
    return Object.values(state.trackingRecords).filter((record) => record.date === dateKey);
  };

  const handleHourPress = (dateKey: string) => {
    if (!state.armedTemplateId) return;
    dispatch({ type: 'PLACE_SHIFT', date: dateKey });
  };

  const confirmDay = async (dateKey: string) => {
    try {
      const trackingRecords = getTrackingForDate(dateKey);
      const record = await persistDailyActualForDate(dateKey, state.instances, trackingRecords);
      dispatch({ type: 'CONFIRM_DAY', date: dateKey, confirmedAt: record.confirmedAt });
      const formatted = formatDate(new Date(dateKey), 'EEEE');
      setConfirmationMessage(`${formatted} confirmed`);
      setTimeout(() => setConfirmationMessage(null), 2000);
    } catch (error) {
      console.error('[WeekView] Failed to confirm day:', error);
      Alert.alert('Confirmation failed', 'Could not finalize this day. Please try again.');
    }
  };

  const handleAdjustTrackingEnd = (id: string, deltaMinutes: number) => {
    const record = state.trackingRecords[id];
    if (!record) return;
    const newDuration = Math.max(5, record.duration + deltaMinutes);
    const endMinutes = timeToMinutes(record.startTime) + newDuration;
    const hours = Math.floor(endMinutes / 60) % 24;
    const minutes = endMinutes % 60;
    const endTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    dispatch({ type: 'UPDATE_TRACKING_END', id, endTime });
  };

  const handleAdjustTrackingStart = (id: string, deltaMinutes: number) => {
    const record = state.trackingRecords[id];
    if (!record) return;
    const startMinutes = Math.max(0, timeToMinutes(record.startTime) + deltaMinutes);
    const hours = Math.floor(startMinutes / 60) % 24;
    const minutes = startMinutes % 60;
    const startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    dispatch({ type: 'UPDATE_TRACKING_START', id, startTime });
  };

  const handleInstanceLongPress = (instance: ShiftInstance) => {
    const showDeleteConfirm = () => {
      Alert.alert('Delete shift?', `Remove ${instance.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch({ type: 'DELETE_INSTANCE', id: instance.id }),
        },
      ]);
    };

    Alert.alert('Shift Options', instance.name, [
      { text: 'Edit', onPress: () => setEditingInstance(instance) },
      { text: 'Delete', style: 'destructive', onPress: showDeleteConfirm },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSaveInstance = (changes: { id: string; name: string; startTime: string; duration: number }) => {
    dispatch({
      type: 'UPDATE_INSTANCE',
      id: changes.id,
      instance: {
        name: changes.name,
        startTime: changes.startTime,
        duration: changes.duration,
      },
    });
    setEditingInstance(null);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!isDragging}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.timeColumnHeader} />
            {weekDays.map((day, index) => {
              const dateKey = formatDateKey(day);
              const isConfirmed = state.confirmedDates.has(dateKey);
              const trackingRecords = getTrackingForDate(dateKey);
              const needsReview = state.reviewMode && !isConfirmed;
              return (
                <View key={dateKey} style={styles.dayHeader} testID={`week-day-${dateKey}`}>
                  <Text style={styles.dayName}>{formatDate(day, 'EEE')}</Text>
                  <Text style={styles.dayNumber}>{formatDate(day, 'd')}</Text>
                  {state.reviewMode && (
                    <View style={[styles.reviewBadge, needsReview && styles.reviewBadgeNeedsReview, isConfirmed && styles.reviewBadgeConfirmed]}>
                      <Text style={styles.reviewBadgeText}>
                        {isConfirmed ? '✓' : needsReview ? '!' : ''}
                      </Text>
                    </View>
                  )}
                  {state.reviewMode && !isConfirmed && (
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => confirmDay(dateKey)}
                      testID={`confirm-day-${dateKey}`}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <ScrollView
            style={styles.gridScroll}
            contentContainerStyle={{ flexGrow: 1 }}
            scrollEnabled={!isDragging}
          >
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
                  <View key={dateKey} style={styles.dayColumn} testID={`week-day-column-${dateKey}`}>
                    {Array.from({ length: 24 }).map((_, hourIndex) => (
                      <Pressable
                        key={hourIndex}
                        style={[styles.hourCell, { height: HOUR_HEIGHT }]}
                        onPress={() => handleHourPress(dateKey)}
                      />
                    ))}
                    {current.map((instance) => (
                      <InstanceCard key={instance.id} instance={instance} onLongPress={handleInstanceLongPress} />
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
                      <TrackingBadge
                        key={record.id}
                        record={record}
                        onAdjustStart={handleAdjustTrackingStart}
                        onAdjustEnd={handleAdjustTrackingEnd}
                        onToggleActive={() =>
                          setActiveTrackingId((prev) => (prev === record.id ? null : record.id))
                        }
                        active={activeTrackingId === record.id}
                        setDragging={setIsDragging}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      <ShiftEditModal
        visible={!!editingInstance}
        instance={editingInstance}
        onClose={() => setEditingInstance(null)}
        onSave={handleSaveInstance}
      />
      {confirmationMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{confirmationMessage}</Text>
        </View>
      )}
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
    flex: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.6)',
    justifyContent: 'center',
  },
  trackingDurationContainer: {
    alignItems: 'center',
  },
  trackingDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B71C1C',
  },
  grabberContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: GRABBER_HIT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabberTop: {
    top: -GRABBER_HIT_HEIGHT / 2,
  },
  grabberBottom: {
    bottom: -GRABBER_HIT_HEIGHT / 2,
  },
  grabberBar: {
    width: '80%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#B71C1C',
  },
  edgeLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#B71C1C',
  },
  edgeLabelTop: {
    top: -EDGE_LABEL_OFFSET,
  },
  edgeLabelBottom: {
    bottom: -EDGE_LABEL_OFFSET,
  },
  toast: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,122,255,0.9)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
});
