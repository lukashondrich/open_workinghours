import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { startOfWeek, subDays, format as formatDate, isBefore, startOfDay } from 'date-fns';
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
import { DailySubmissionService } from '@/modules/auth/services/DailySubmissionService';

const HOUR_HEIGHT = 48;
const MIN_DRAG_STEP_MINUTES = 5;
const GRABBER_HIT_AREA = 44; // Larger hit area for easier grabbing
const GRABBER_BAR_HEIGHT = 12;
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
  onDelete,
  onToggleActive,
  active,
  setDragging,
  clippedDuration,
  showStartGrabber = true,
  showEndGrabber = true,
  currentTime,
}: {
  record: TrackingRecord;
  onAdjustStart: (id: string, deltaMinutes: number) => void;
  onAdjustEnd: (id: string, deltaMinutes: number) => void;
  onDelete: (id: string) => void;
  onToggleActive: () => void;
  active: boolean;
  setDragging: (dragging: boolean) => void;
  clippedDuration?: number;
  showStartGrabber?: boolean;
  showEndGrabber?: boolean;
  currentTime: Date;
}) {
  // Pulsing animation for active sessions
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Local state for live drag preview
  const [dragStartDelta, setDragStartDelta] = useState(0);
  const [dragEndDelta, setDragEndDelta] = useState(0);

  useEffect(() => {
    if (record.isActive) {
      // Create pulsing animation (0.5Hz = 2 second cycle)
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      // Reset to full opacity for completed sessions
      pulseAnim.setValue(1);
    }
  }, [record.isActive, pulseAnim]);

  // Calculate duration based on current time for active sessions
  const startMinutes = timeToMinutes(record.startTime);
  let displayDuration = clippedDuration ?? record.duration;

  if (record.isActive) {
    // Include seconds for accurate duration matching the current time line
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;

    if (!clippedDuration) {
      // Main active session (not clipped/overflow)
      displayDuration = currentMinutes - startMinutes;
      // Handle overnight sessions (current time is next day)
      if (displayDuration < 0) {
        displayDuration = (24 * 60 - startMinutes) + currentMinutes;
      }
    } else if (record.startTime === '00:00') {
      // Overflow segment of active session (from previous day)
      // Extend from 00:00 to current time
      displayDuration = currentMinutes;
    }
    // Otherwise keep clippedDuration (for day 1 of overnight active session)
  }

  // Ensure minimum duration for rendering (only for completed sessions)
  // Active sessions should show exact duration to match current time line
  if (!record.isActive) {
    displayDuration = Math.max(1, displayDuration);
  } else {
    displayDuration = Math.max(0.1, displayDuration); // Very small minimum for active sessions
  }

  // Calculate base position and height
  let topOffset = (startMinutes / 60) * HOUR_HEIGHT;
  let height = (displayDuration / 60) * HOUR_HEIGHT;

  // Apply live drag preview deltas
  if (dragStartDelta !== 0) {
    // Start grabber moved: adjust position and height
    const deltaMinutes = minutesFromDrag(dragStartDelta);
    topOffset += dragStartDelta;
    height -= dragStartDelta; // Moving start changes duration
  }
  if (dragEndDelta !== 0) {
    // End grabber moved: only adjust height
    height += dragEndDelta;
  }

  // Show end time based on displayDuration (clipped if overflow, otherwise full)
  const endLabel = formatTimeLabel(startMinutes + displayDuration);

  const handleLongPress = () => {
    const showDeleteConfirm = () => {
      Alert.alert('Delete tracking?', 'Remove this time entry?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(record.id),
        },
      ]);
    };

    Alert.alert('Tracking Options', formatDuration(record.duration), [
      { text: 'Adjust', onPress: onToggleActive },
      { text: 'Delete', style: 'destructive', onPress: showDeleteConfirm },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const startPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onPanResponderGrant: () => {
          setDragging(true);
          Vibration.vibrate(15);
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          // Update local preview state during drag
          setDragStartDelta(gesture.dy);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging(false);
          setDragStartDelta(0); // Reset preview
          const delta = minutesFromDrag(gesture.dy);
          if (delta !== 0) {
            onAdjustStart(record.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragStartDelta(0); // Reset preview
        },
      }),
    [record.id, onAdjustStart, active, setDragging, setDragStartDelta],
  );

  const endPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onPanResponderGrant: () => {
          setDragging(true);
          Vibration.vibrate(15);
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          // Update local preview state during drag
          setDragEndDelta(gesture.dy);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging(false);
          setDragEndDelta(0); // Reset preview
          const delta = minutesFromDrag(gesture.dy);
          if (delta !== 0) {
            onAdjustEnd(record.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragEndDelta(0); // Reset preview
        },
      }),
    [record.id, onAdjustEnd, active, setDragging, setDragEndDelta],
  );

  return (
    <Pressable
      onLongPress={handleLongPress}
      style={{ position: 'absolute', left: 12, right: 12, top: topOffset, height, zIndex: active ? 100 : 1 }}
    >
      <Animated.View
        style={[
          styles.trackingBlock,
          { height, opacity: pulseAnim },
          record.isActive && styles.trackingBlockActive
        ]}
      >
        <View style={styles.trackingDurationContainer}>
          <Text style={styles.trackingDurationText}>
            {formatDuration(displayDuration)}
          </Text>
        </View>
      </Animated.View>
      {active && showStartGrabber && (
        <View style={[styles.grabberContainer, styles.grabberTop]} {...startPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
      {active && showEndGrabber && (
        <View style={[styles.grabberContainer, styles.grabberBottom]} {...endPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
      <Text style={[styles.edgeLabel, styles.edgeLabelTop]}>{record.startTime}</Text>
      {!record.isActive && (
        <Text style={[styles.edgeLabel, styles.edgeLabelBottom]}>{endLabel}</Text>
      )}
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

function CurrentTimeLine({ currentTime, reviewMode }: { currentTime: Date; reviewMode: boolean }) {
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  // Include seconds for more accurate positioning
  const totalMinutes = hours * 60 + minutes + seconds / 60;
  // Position line at bottom edge of active sessions
  const topOffset = (totalMinutes / 60) * HOUR_HEIGHT - 4;

  // Red in review mode, grey in planning mode
  const lineColor = reviewMode ? '#FF3B30' : '#8E8E93';

  return (
    <View style={[styles.currentTimeLine, { top: topOffset }]}>
      <View style={[styles.currentTimeCircle, { backgroundColor: lineColor }]} />
      <View style={[styles.currentTimeBar, { backgroundColor: lineColor }]} />
    </View>
  );
}

export default function WeekView() {
  const { state, dispatch } = useCalendar();
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<ShiftInstance | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const hourMarkers = useMemo(() => generateHourMarkers(), []);
  const todayKey = formatDateKey(new Date());

  useEffect(() => {
    if (!state.reviewMode) {
      setActiveTrackingId(null);
    }
  }, [state.reviewMode]);

  // Update current time and refresh tracking records every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      setCurrentTime(new Date());

      // Reload tracking records in review mode to catch status changes (active → completed)
      if (state.reviewMode) {
        try {
          const startDate = formatDateKey(weekDays[0]);
          const endDate = formatDateKey(weekDays[weekDays.length - 1]);
          const { loadRealTrackingRecords } = await import('@/lib/calendar/calendar-utils');
          const updatedRecords = await loadRealTrackingRecords(startDate, endDate);
          dispatch({ type: 'UPDATE_TRACKING_RECORDS', trackingRecords: updatedRecords });
        } catch (error) {
          console.error('[WeekView] Failed to refresh tracking records:', error);
        }
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [state.reviewMode, weekDays, dispatch]);

  const getTrackingForDate = (dateKey: string): TrackingRecord[] => {
    return Object.values(state.trackingRecords).filter((record) => record.date === dateKey);
  };

  const handleHourPress = (dateKey: string) => {
    // Clear active tracking selection when clicking elsewhere
    if (activeTrackingId) {
      setActiveTrackingId(null);
      return;
    }

    if (!state.armedTemplateId) return;
    dispatch({ type: 'PLACE_SHIFT', date: dateKey });
  };

  const confirmDay = async (dateKey: string) => {
    // Validation: Only allow confirming past days (not today, not future)
    const dayToConfirm = startOfDay(new Date(dateKey));
    const today = startOfDay(new Date());

    if (!isBefore(dayToConfirm, today)) {
      Alert.alert(
        'Cannot confirm future days',
        'You can only confirm days that are in the past. Please wait until tomorrow to confirm today.'
      );
      return;
    }

    try {
      const trackingRecords = getTrackingForDate(dateKey);
      const record = await persistDailyActualForDate(dateKey, state.instances, trackingRecords);
      dispatch({ type: 'CONFIRM_DAY', date: dateKey, confirmedAt: record.confirmedAt });

      // NEW: Enqueue daily submission (v2.0 - authenticated, no noise)
      try {
        await DailySubmissionService.enqueueDailySubmission(dateKey);
        await DailySubmissionService.processQueue();
        console.log('[WeekView] Daily submission enqueued and sent for', dateKey);
      } catch (submissionError) {
        console.warn('[WeekView] Daily submission failed (queued for retry):', submissionError);
        // Don't block confirmation on submission failure - it's queued for retry
      }

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

  const handleDeleteTracking = async (id: string) => {
    // Extract session ID from tracking record ID (format: "tracking-session-123")
    const sessionId = id.replace('tracking-session-', '');

    try {
      // Delete from database
      const { getDatabase } = await import('@/modules/geofencing/services/Database');
      const db = await getDatabase();
      await db.deleteSession(sessionId);

      // Delete from state
      dispatch({ type: 'DELETE_TRACKING_RECORD', id });
      if (activeTrackingId === id) {
        setActiveTrackingId(null);
      }
    } catch (error) {
      console.error('[WeekView] Failed to delete tracking session:', error);
      Alert.alert('Delete failed', 'Could not delete this session. Please try again.');
    }
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
              // Can only confirm past days (not today, not future)
              const today = startOfDay(new Date());
              const canConfirm = isBefore(startOfDay(day), today);
              return (
                <View key={dateKey} style={styles.dayHeader} testID={`week-day-${dateKey}`}>
                  <Text style={styles.dayName}>{formatDate(day, 'EEE')}</Text>
                  <View style={styles.dayNumberRow}>
                    <Text style={styles.dayNumber}>{formatDate(day, 'd')}</Text>
                    {state.reviewMode && (
                      <>
                        {isConfirmed ? (
                          <View style={styles.reviewBadgeConfirmed}>
                            <Text style={styles.reviewBadgeText}>✓</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
                            onPress={() => canConfirm && confirmDay(dateKey)}
                            disabled={!canConfirm}
                            testID={`confirm-day-${dateKey}`}
                          >
                            <Text style={[styles.confirmButtonText, !canConfirm && styles.confirmButtonTextDisabled]}>Confirm?</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
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
                    {state.reviewMode && trackingRecords.map((record) => {
                      const startMinutes = timeToMinutes(record.startTime);
                      const endMinutes = startMinutes + record.duration;
                      const spansNextDay = endMinutes > 24 * 60;

                      // Render badge for this day - clip at midnight if it spans to next day
                      return (
                        <TrackingBadge
                          key={record.id}
                          record={record}
                          onAdjustStart={handleAdjustTrackingStart}
                          onAdjustEnd={handleAdjustTrackingEnd}
                          onDelete={handleDeleteTracking}
                          onToggleActive={() =>
                            setActiveTrackingId((prev) => (prev === record.id ? null : record.id))
                          }
                          active={activeTrackingId === record.id}
                          setDragging={setIsDragging}
                          clippedDuration={spansNextDay ? (24 * 60 - startMinutes) : undefined}
                          showStartGrabber={true}
                          showEndGrabber={!spansNextDay}
                          currentTime={currentTime}
                        />
                      );
                    })}
                    {state.reviewMode && (() => {
                      // Render overflow tracking from previous day
                      const prevDayRecords = dayIndex > 0 ? getTrackingForDate(previousDateKey) : [];
                      return prevDayRecords.map((record) => {
                        const startMinutes = timeToMinutes(record.startTime);
                        const endMinutes = startMinutes + record.duration;
                        if (endMinutes <= 24 * 60) return null; // No overflow

                        const overflowMinutes = endMinutes - 24 * 60;

                        // Create modified record for overflow segment (starts at 00:00 on Day 2)
                        const overflowRecord = {
                          ...record,
                          startTime: '00:00',
                        };

                        return (
                          <TrackingBadge
                            key={`${record.id}-overflow`}
                            record={overflowRecord}
                            onAdjustStart={handleAdjustTrackingStart}
                            onAdjustEnd={handleAdjustTrackingEnd}
                            onDelete={handleDeleteTracking}
                            onToggleActive={() =>
                              setActiveTrackingId((prev) => (prev === record.id ? null : record.id))
                            }
                            active={activeTrackingId === record.id}
                            setDragging={setIsDragging}
                            clippedDuration={overflowMinutes}
                            showStartGrabber={false}
                            showEndGrabber={true}
                            currentTime={currentTime}
                          />
                        );
                      });
                    })()}
                    {dateKey === todayKey && <CurrentTimeLine currentTime={currentTime} reviewMode={state.reviewMode} />}
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
  dayNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    fontSize: 11,
    color: '#111',
  },
  confirmButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FFCDD2',
  },
  confirmButtonDisabled: {
    backgroundColor: '#E5E5EA',
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 10,
    color: '#B71C1C',
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#8E8E93',
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
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.6)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackingBlockActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  trackingActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    left: -1,
    right: -1,
    height: 2,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  trackingActiveDash: {
    width: 8,
    height: 2,
    backgroundColor: '#B71C1C',
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
    height: GRABBER_HIT_AREA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabberTop: {
    // Center the hit area on the visual bar position (2/3 outside the session)
    // Visual bar should be at: -43px from session edge
    // Hit area is 44px tall, so position its center at -43px
    top: -43 - GRABBER_HIT_AREA / 2,
  },
  grabberBottom: {
    bottom: -43 - GRABBER_HIT_AREA / 2,
  },
  grabberBar: {
    width: '80%',
    height: GRABBER_BAR_HEIGHT,
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
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  currentTimeCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
  },
});
