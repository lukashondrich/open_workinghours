import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  Platform,
  TextInput,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { startOfWeek, subDays, format as formatDate, isBefore, startOfDay, parse } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t, getDateLocale } from '@/lib/i18n';
import { useCalendar } from '@/lib/calendar/calendar-context';
import {
  useZoom,
  BASE_HOUR_HEIGHT,
  BASE_DAY_WIDTH,
  getHourMarkerInterval,
  getDisclosureLevel,
  calculateMinZoom,
  HEADER_HEIGHT,
} from '@/lib/calendar/zoom-context';
import {
  calculateShiftDisplay,
  formatDateKey,
  formatDuration,
  generateHourMarkers,
  getInstancesForDate,
  getWeekDays,
  timeToMinutes,
  getColorPalette,
  findOverlappingShift,
  getAbsencesForDate,
  shiftHasAbsenceOverlap,
} from '@/lib/calendar/calendar-utils';
import type { ShiftInstance, TrackingRecord, AbsenceInstance, ShiftColor, ShiftTemplate, AbsenceTemplate } from '@/lib/calendar/types';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { TreePalm, Thermometer, Clock, Star, Plus, X, Settings } from 'lucide-react-native';
// ShiftEditModal removed - using native time picker for start time only
import { persistDailyActualForDate } from '../services/DailyAggregator';
import { DailySubmissionService } from '@/modules/auth/services/DailySubmissionService';

// Base dimensions (now imported from zoom-context, kept here for reference)
const DEFAULT_HOUR_HEIGHT = BASE_HOUR_HEIGHT; // 48
const DEFAULT_DAY_WIDTH = BASE_DAY_WIDTH; // 120

// Short session threshold - sessions below this are displayed with a warning indicator
const SHORT_SESSION_THRESHOLD_MINUTES = 5;
const MIN_DRAG_STEP_MINUTES = 5;

// Progressive disclosure thresholds based on hourHeight (in pixels)
// These control when text elements hide at low zoom levels
const DISCLOSURE_FULL_HEIGHT = 56;     // >= 56px: show everything (times, names, duration, edge labels)
const DISCLOSURE_REDUCED_HEIGHT = 32;  // >= 32px: reduced (names only for shifts, duration only for tracking)
                                       // < 32px: minimal (color blocks only, no text)
const GRABBER_HIT_AREA = 44; // Larger hit area for easier grabbing
const GRABBER_BAR_HEIGHT = 12;
const MIN_TRACKING_HEIGHT = 8; // Minimum visual height (smaller, less clunky)
const MIN_TRACKING_HIT_SLOP = 20; // Expand tap target for small sessions
const EDGE_LABEL_OFFSET = 18;

function minutesFromDrag(dy: number, hourHeight: number = DEFAULT_HOUR_HEIGHT) {
  const minutes = (dy / hourHeight) * 60;
  const rounded = Math.round(minutes / MIN_DRAG_STEP_MINUTES) * MIN_DRAG_STEP_MINUTES;
  return rounded;
}

function formatTimeLabel(minutesTotal: number) {
  const normalized = ((minutesTotal % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Convert hex color to rgba with opacity for semi-transparent overlays
function hexToRgba(hex: string, opacity: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function TrackingBadge({
  record,
  onAdjustStart,
  onAdjustEnd,
  onDelete,
  onToggleActive,
  onPress,
  onAddBreak,
  onClearBreak,
  editMode,
  setDragging,
  clippedDuration,
  showStartGrabber = true,
  showEndGrabber = true,
  showBreakPanel = false,
  currentTime,
  hourHeight = DEFAULT_HOUR_HEIGHT,
}: {
  record: TrackingRecord;
  onAdjustStart: (id: string, deltaMinutes: number) => void;
  onAdjustEnd: (id: string, deltaMinutes: number) => void;
  onDelete: (id: string) => void;
  onToggleActive: (mode: 'times' | 'breaks') => void;
  onPress: () => void;
  onAddBreak: (id: string, minutes: number) => void;
  onClearBreak: (id: string) => void;
  editMode: 'times' | 'breaks' | null;
  setDragging: (dragging: boolean) => void;
  clippedDuration?: number;
  showStartGrabber?: boolean;
  showEndGrabber?: boolean;
  showBreakPanel?: boolean;
  currentTime: Date;
  hourHeight?: number;
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

  // Detect short sessions (< 5 minutes) - show faded with icon
  const isShortSession = !record.isActive && record.duration < SHORT_SESSION_THRESHOLD_MINUTES;

  // Calculate base position and height
  let topOffset = (startMinutes / 60) * hourHeight;
  let height = (displayDuration / 60) * hourHeight;

  // Apply live drag preview deltas
  if (dragStartDelta !== 0) {
    // Start grabber moved: adjust position and height
    const deltaMinutes = minutesFromDrag(dragStartDelta, hourHeight);
    topOffset += dragStartDelta;
    height -= dragStartDelta; // Moving start changes duration
  }
  if (dragEndDelta !== 0) {
    // End grabber moved: only adjust height
    height += dragEndDelta;
  }

  // Enforce minimum height for tappability (only for display, not during active drag)
  if (dragStartDelta === 0 && dragEndDelta === 0) {
    height = Math.max(MIN_TRACKING_HEIGHT, height);
  }

  // Calculate safe grabber positions (clamp to stay within day column)
  const DAY_HEIGHT = 24 * hourHeight;
  const GRABBER_OFFSET = 43 + GRABBER_HIT_AREA / 2; // 65px - normal offset from session edge
  const MIN_EDGE_DISTANCE = 12; // ~15 minutes (0.25h * 48px) - minimum distance from day edges

  // Top grabber: should be at (topOffset - GRABBER_OFFSET), but clamped to MIN_EDGE_DISTANCE
  const idealTopGrabberPos = topOffset - GRABBER_OFFSET;
  const clampedTopGrabberPos = Math.max(MIN_EDGE_DISTANCE, idealTopGrabberPos);
  const topGrabberStyle = {
    top: clampedTopGrabberPos - topOffset, // Convert back to relative offset
  };

  // Bottom grabber: should be at (topOffset + height + GRABBER_OFFSET), but clamped to (DAY_HEIGHT - MIN_EDGE_DISTANCE)
  const idealBottomGrabberPos = topOffset + height + GRABBER_OFFSET;
  const clampedBottomGrabberPos = Math.min(DAY_HEIGHT - MIN_EDGE_DISTANCE, idealBottomGrabberPos);
  const bottomGrabberStyle = {
    bottom: -(clampedBottomGrabberPos - (topOffset + height)), // Convert to bottom offset from session bottom
  };

  // Break panel: clamp to stay within day bounds (max height = 300px)
  const BREAK_PANEL_MAX_HEIGHT = 300;
  const breakPanelBottom = topOffset + BREAK_PANEL_MAX_HEIGHT;
  const overflow = breakPanelBottom - DAY_HEIGHT;
  const breakPanelTop = overflow > 0 ? -overflow : 0; // Shift up if overflowing
  const breakPanelStyle = {
    top: breakPanelTop,
  };

  // Show end time based on displayDuration (clipped if overflow, otherwise full)
  const endLabel = formatTimeLabel(startMinutes + displayDuration);

  // Progressive disclosure based on hourHeight
  const showDuration = hourHeight >= DISCLOSURE_REDUCED_HEIGHT;  // >= 24px
  const showEdgeLabels = hourHeight >= DISCLOSURE_FULL_HEIGHT;   // >= 48px

  const handleLongPress = () => {
    const showDeleteConfirm = () => {
      Alert.alert(t('calendar.week.deleteTrackingTitle'), t('calendar.week.deleteTrackingMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => onDelete(record.id),
        },
      ]);
    };

    Alert.alert(t('calendar.week.trackingOptions'), formatDuration(record.duration), [
      { text: t('calendar.week.adjustTimes'), onPress: () => onToggleActive('times') },
      { text: t('calendar.week.adjustBreaks'), onPress: () => onToggleActive('breaks') },
      { text: t('common.delete'), style: 'destructive', onPress: showDeleteConfirm },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };
  const isTimesMode = editMode === 'times';

  const startPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isTimesMode,
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
          const delta = minutesFromDrag(gesture.dy, hourHeight);
          if (delta !== 0) {
            onAdjustStart(record.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragStartDelta(0); // Reset preview
        },
      }),
    [record.id, onAdjustStart, isTimesMode, setDragging, setDragStartDelta, hourHeight],
  );

  const endPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isTimesMode,
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
          const delta = minutesFromDrag(gesture.dy, hourHeight);
          if (delta !== 0) {
            onAdjustEnd(record.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragEndDelta(0); // Reset preview
        },
      }),
    [record.id, onAdjustEnd, isTimesMode, setDragging, setDragEndDelta, hourHeight],
  );

  return (
    <View style={{ position: 'absolute', left: 12, right: 12, top: topOffset, zIndex: editMode ? 100 : 1 }}>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        style={{ height }}
        hitSlop={{
          top: Math.max(0, (MIN_TRACKING_HIT_SLOP - height) / 2),
          bottom: Math.max(0, (MIN_TRACKING_HIT_SLOP - height) / 2),
        }}
      >
        <Animated.View
          style={[
            styles.trackingBlock,
            { height, opacity: isShortSession ? 0.5 : pulseAnim },
            record.isActive && styles.trackingBlockActive,
            isShortSession && styles.trackingBlockShort
          ]}
        >
          {showDuration && (
            <View style={styles.trackingDurationContainer}>
              <Text style={[styles.trackingDurationText, isShortSession && styles.shortSessionText]}>
                {formatDuration(Math.max(0, displayDuration - (record.breakMinutes || 0)))}
              </Text>
            </View>
          )}
          {isShortSession && (
            <View style={styles.shortSessionIcon}>
              <Clock size={10} color="rgba(211, 47, 47, 0.7)" />
            </View>
          )}
        </Animated.View>
        {isTimesMode && showStartGrabber && (
          <View style={[styles.grabberContainer, topGrabberStyle]} {...startPan.panHandlers}>
            <View style={styles.grabberBar} />
          </View>
        )}
        {isTimesMode && showEndGrabber && (
          <View style={[styles.grabberContainer, bottomGrabberStyle]} {...endPan.panHandlers}>
            <View style={styles.grabberBar} />
          </View>
        )}
        {showEdgeLabels && (
          <Text style={[styles.edgeLabel, styles.edgeLabelTop]}>{record.startTime}</Text>
        )}
        {showEdgeLabels && !record.isActive && (
          <Text style={[styles.edgeLabel, styles.edgeLabelBottom]}>{endLabel}</Text>
        )}
      </Pressable>
      {editMode === 'breaks' && showBreakPanel && (
        <View style={[styles.breakPanel, breakPanelStyle]}>
          <Text style={styles.breakTitle}>{t('calendar.week.breakTitle')}</Text>
          {[5, 15, 30, 45, 60].map((min) => (
            <TouchableOpacity
              key={min}
              style={styles.breakOption}
              onPress={() => onAddBreak(record.id, min)}
            >
              <Text style={styles.breakOptionText}>+ {min}</Text>
            </TouchableOpacity>
          ))}
          {(record.breakMinutes || 0) > 0 && (
            <>
              <View style={styles.breakDivider} />
              <Text style={styles.breakTotal}>
                {t('calendar.week.breakTotal', { duration: formatDuration(record.breakMinutes || 0) })}
              </Text>
              <TouchableOpacity style={styles.breakClearBtn} onPress={() => onClearBreak(record.id)}>
                <Text style={styles.breakClearText}>{t('common.clear')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// Orphaned instance colors (when template is deleted)
const ORPHAN_PALETTE = {
  bg: '#F5F5F5',
  border: '#BDBDBD',
  text: '#757575',
  dot: '#9E9E9E',
};

function InstanceCard({
  instance,
  onPress,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  isOrphaned = false,
  isDimmed = false,
}: {
  instance: ShiftInstance;
  onPress: (instance: ShiftInstance) => void;
  hourHeight?: number;
  isOrphaned?: boolean;
  isDimmed?: boolean;
}) {
  const palette = isOrphaned ? ORPHAN_PALETTE : getColorPalette(instance.color);
  const { topOffset, height } = calculateShiftDisplay(instance.startTime, instance.duration, hourHeight);

  // Progressive disclosure based on hourHeight
  const showName = hourHeight >= DISCLOSURE_REDUCED_HEIGHT;  // >= 24px
  const showTimes = hourHeight >= DISCLOSURE_FULL_HEIGHT;    // >= 48px

  return (
    <Pressable
      onPress={() => onPress(instance)}
      style={[
        styles.shiftBlock,
        { top: topOffset, height, backgroundColor: palette.bg, borderColor: palette.border },
        isDimmed && styles.shiftBlockDimmed,
      ]}
    >
      {showName && (
        <Text style={[styles.shiftName, { color: palette.text }, isDimmed && styles.textDimmed]} numberOfLines={1}>
          {instance.name}
        </Text>
      )}
      {showTimes && (
        <Text style={[styles.shiftTime, isOrphaned && { color: palette.text }, isDimmed && styles.textDimmed]}>
          {instance.startTime} - {instance.endTime}
        </Text>
      )}
    </Pressable>
  );
}

function AbsenceCard({
  absence,
  onPress,
  onLongPress,
  onAdjustStart,
  onAdjustEnd,
  active,
  setDragging,
  hourHeight = DEFAULT_HOUR_HEIGHT,
}: {
  absence: AbsenceInstance;
  onPress: (absence: AbsenceInstance) => void;
  onLongPress: (absence: AbsenceInstance) => void;
  onAdjustStart?: (id: string, deltaMinutes: number) => void;
  onAdjustEnd?: (id: string, deltaMinutes: number) => void;
  active?: boolean;
  setDragging?: (dragging: boolean) => void;
  hourHeight?: number;
}) {
  // Local state for live drag preview
  const [dragStartDelta, setDragStartDelta] = useState(0);
  const [dragEndDelta, setDragEndDelta] = useState(0);

  // Calculate position based on start/end time
  const startMinutes = timeToMinutes(absence.startTime);
  const endMinutes = timeToMinutes(absence.endTime);
  const durationMinutes = absence.isFullDay ? 24 * 60 : (endMinutes - startMinutes);

  let topOffset = (startMinutes / 60) * hourHeight;
  let height = Math.max(40, (durationMinutes / 60) * hourHeight);

  // Apply live drag preview deltas
  if (dragStartDelta !== 0) {
    topOffset += dragStartDelta;
    height -= dragStartDelta;
  }
  if (dragEndDelta !== 0) {
    height += dragEndDelta;
  }

  // Progressive disclosure based on hourHeight
  const showName = hourHeight >= DISCLOSURE_REDUCED_HEIGHT;  // >= 24px
  const showTimes = hourHeight >= DISCLOSURE_FULL_HEIGHT;    // >= 48px

  const IconComponent = absence.type === 'vacation' ? TreePalm : Thermometer;
  const iconColor = absence.type === 'vacation' ? '#6B7280' : '#92400E';

  // Calculate grabber positions
  const DAY_HEIGHT = 24 * hourHeight;
  const GRABBER_OFFSET = 43 + GRABBER_HIT_AREA / 2;
  const MIN_EDGE_DISTANCE = 12;

  const idealTopGrabberPos = topOffset - GRABBER_OFFSET;
  const clampedTopGrabberPos = Math.max(MIN_EDGE_DISTANCE, idealTopGrabberPos);
  const topGrabberStyle = { top: clampedTopGrabberPos - topOffset };

  const idealBottomGrabberPos = topOffset + height + GRABBER_OFFSET;
  const clampedBottomGrabberPos = Math.min(DAY_HEIGHT - MIN_EDGE_DISTANCE, idealBottomGrabberPos);
  const bottomGrabberStyle = { bottom: -(clampedBottomGrabberPos - (topOffset + height)) };

  const startPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!active,
        onPanResponderGrant: () => {
          setDragging?.(true);
          Vibration.vibrate(15);
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragStartDelta(gesture.dy);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging?.(false);
          setDragStartDelta(0);
          const delta = minutesFromDrag(gesture.dy, hourHeight);
          if (delta !== 0) {
            onAdjustStart?.(absence.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging?.(false);
          setDragStartDelta(0);
        },
      }),
    [absence.id, onAdjustStart, active, setDragging, hourHeight],
  );

  const endPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!active,
        onPanResponderGrant: () => {
          setDragging?.(true);
          Vibration.vibrate(15);
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragEndDelta(gesture.dy);
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          setDragging?.(false);
          setDragEndDelta(0);
          const delta = minutesFromDrag(gesture.dy, hourHeight);
          if (delta !== 0) {
            onAdjustEnd?.(absence.id, delta);
          }
        },
        onPanResponderTerminate: () => {
          setDragging?.(false);
          setDragEndDelta(0);
        },
      }),
    [absence.id, onAdjustEnd, active, setDragging, hourHeight],
  );

  return (
    <View style={{ position: 'absolute', left: 4, right: 4, top: topOffset, zIndex: active ? 100 : 1 }}>
      <Pressable
        onPress={() => onPress(absence)}
        onLongPress={() => onLongPress(absence)}
        delayLongPress={500}
        style={{ height }}
      >
        <View
          style={[
            styles.absenceBlock,
            {
              height,
              // Semi-transparent background so shifts underneath are visible
              backgroundColor: hexToRgba(absence.color, 0.5),
              top: 0,
            },
            active && styles.absenceBlockActive,
          ]}
        >
          <View style={styles.absenceContent}>
            <IconComponent size={14} color={iconColor} />
            {showName && (
              <Text style={styles.absenceName} numberOfLines={1}>
                {absence.name}
              </Text>
            )}
          </View>
          {showTimes && (
            <Text style={styles.absenceTime}>
              {absence.startTime} - {absence.endTime}
            </Text>
          )}
        </View>
      </Pressable>
      {active && (
        <View style={[styles.grabberContainer, topGrabberStyle]} {...startPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
      {active && (
        <View style={[styles.grabberContainer, bottomGrabberStyle]} {...endPan.panHandlers}>
          <View style={styles.grabberBar} />
        </View>
      )}
    </View>
  );
}

function CurrentTimeLine({
  currentTime,
  reviewMode,
  hourHeight = DEFAULT_HOUR_HEIGHT,
}: {
  currentTime: Date;
  reviewMode: boolean;
  hourHeight?: number;
}) {
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  // Include seconds for more accurate positioning
  const totalMinutes = hours * 60 + minutes + seconds / 60;
  // Position line at bottom edge of active sessions
  const topOffset = (totalMinutes / 60) * hourHeight - 4;

  // Red in review mode, grey in planning mode
  const lineColor = reviewMode ? colors.error.main : colors.text.tertiary;

  return (
    <View style={[styles.currentTimeLine, { top: topOffset }]}>
      <View style={[styles.currentTimeCircle, { backgroundColor: lineColor }]} />
      <View style={[styles.currentTimeBar, { backgroundColor: lineColor }]} />
    </View>
  );
}

export default function WeekView() {
  const { state, dispatch } = useCalendar();
  const { currentScale, setCurrentScale, previousScale, hourHeight, dayWidth } = useZoom();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Track measured container height for accurate min zoom calculation
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  // Calculate dynamic minimum zoom to fit calendar in viewport
  // Use measured height if available, otherwise estimate with CHROME_HEIGHT fallback
  const CHROME_HEIGHT_FALLBACK = 200;
  const availableHeight = containerHeight !== null
    ? containerHeight - HEADER_HEIGHT  // Use actual measured height
    : screenHeight - CHROME_HEIGHT_FALLBACK - HEADER_HEIGHT;  // Fallback estimate

  const minZoom = useMemo(
    () => calculateMinZoom(screenWidth, availableHeight),
    [screenWidth, availableHeight]
  );

  const [activeTracking, setActiveTracking] = useState<{
    id: string;
    mode: 'times' | 'breaks';
    clickedDateKey: string;
  } | null>(null);
  const [activeAbsenceId, setActiveAbsenceId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time picker state for editing shift start time
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerInstance, setTimePickerInstance] = useState<ShiftInstance | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null); // For iOS picker

  // Template picker state (for long-press on empty space)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingPlacementDate, setPendingPlacementDate] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<'shifts' | 'absences'>('shifts');

  // Create new shift form state (inline in picker)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    startTime: '08:00',
    durationHours: 8,
    durationMinutes: 0,
    color: 'teal' as ShiftColor,
  });

  // Create new absence form state (inline in picker)
  const [showCreateAbsenceForm, setShowCreateAbsenceForm] = useState(false);
  const [createAbsenceFormData, setCreateAbsenceFormData] = useState({
    name: '',
    type: 'vacation' as 'vacation' | 'sick',
    isFullDay: true,
    startTime: '08:00',
    endTime: '17:00',
  });

  // Hide FAB when overlays are open
  useEffect(() => {
    dispatch({ type: 'SET_HIDE_FAB', hide: showTimePicker || showTemplatePicker });
  }, [showTimePicker, showTemplatePicker, dispatch]);

  // ScrollView refs for focal point zooming
  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);

  // Track scroll positions for focal point calculation
  const scrollX = useRef(0);
  const scrollY = useRef(0);

  // Base scale for gesture calculations
  const baseScale = useRef(1);

  // Track the last applied scale during pinch (to avoid stale closure in onEnd)
  const lastAppliedScale = useRef(currentScale);

  // Track if we already triggered haptic for zoom limit (avoid continuous feedback)
  const hitZoomLimit = useRef(false);

  // Track zoom direction to lock once committed ('in' | 'out' | null)
  const zoomDirection = useRef<'in' | 'out' | null>(null);

  // Track viewport width for swipe navigation
  const [viewportWidth, setViewportWidth] = useState(screenWidth);

  // Swipe navigation threshold (pixels of overscroll to trigger)
  const SWIPE_THRESHOLD = 60;

  // Animation for week transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animated week navigation
  const animateToWeek = useCallback((direction: 'prev' | 'next') => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Slide out: positive = slide right (prev week), negative = slide left (next week)
    const slideOutValue = direction === 'prev' ? viewportWidth : -viewportWidth;

    Animated.timing(slideAnim, {
      toValue: slideOutValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Dispatch week change
      dispatch({ type: direction === 'prev' ? 'PREV_WEEK' : 'NEXT_WEEK' });

      // Reset scroll position
      if (direction === 'prev') {
        horizontalScrollRef.current?.scrollToEnd({ animated: false });
      } else {
        horizontalScrollRef.current?.scrollTo({ x: 0, animated: false });
      }

      // Slide in from opposite side
      slideAnim.setValue(direction === 'prev' ? -viewportWidth : viewportWidth);

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  }, [isTransitioning, viewportWidth, slideAnim, dispatch]);

  // Measure container on layout
  const handleContainerLayout = useCallback((event: { nativeEvent: { layout: { height: number; width: number } } }) => {
    const { height: measuredHeight, width: measuredWidth } = event.nativeEvent.layout;
    if (containerHeight === null || Math.abs(measuredHeight - containerHeight) > 5) {
      setContainerHeight(measuredHeight);
    }
    if (Math.abs(measuredWidth - viewportWidth) > 5) {
      setViewportWidth(measuredWidth);
    }
  }, [containerHeight, viewportWidth]);

  // Handle swipe navigation on horizontal scroll end
  // Triggers on: (1) overscroll past threshold, OR (2) fast flick at edge
  const VELOCITY_THRESHOLD = 1.5; // points per ms

  const handleHorizontalScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isTransitioning) return;

    const { contentOffset, contentSize, layoutMeasurement, velocity } = event.nativeEvent;
    const currentScrollX = contentOffset.x;
    const maxScrollX = contentSize.width - layoutMeasurement.width;
    const velocityX = velocity?.x ?? 0;

    // Check for previous week: overscroll OR fast flick left at left edge
    const atLeftEdge = currentScrollX <= 0;
    const overscrolledLeft = currentScrollX < -SWIPE_THRESHOLD;
    const fastFlickLeft = atLeftEdge && velocityX < -VELOCITY_THRESHOLD;

    if (overscrolledLeft || fastFlickLeft) {
      animateToWeek('prev');
      return;
    }

    // Check for next week: overscroll OR fast flick right at right edge
    const atRightEdge = currentScrollX >= maxScrollX - 1; // -1 for float precision
    const overscrolledRight = currentScrollX > maxScrollX + SWIPE_THRESHOLD;
    const fastFlickRight = atRightEdge && velocityX > VELOCITY_THRESHOLD;

    if (overscrolledRight || fastFlickRight) {
      animateToWeek('next');
    }
  }, [isTransitioning, animateToWeek]);


  // Animated zoom transition helper (for double-tap)
  const animateZoomTo = useCallback((targetScale: number, duration: number = 200) => {
    const startScale = currentScale;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const newScale = startScale + (targetScale - startScale) * eased;
      setCurrentScale(newScale);
      baseScale.current = newScale;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [currentScale, setCurrentScale]);
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const hourMarkers = useMemo(() => generateHourMarkers(), []);
  const todayKey = formatDateKey(new Date());

  // Pre-compute disclosure level for header (avoid recalculating in loop)
  const disclosureLevel = getDisclosureLevel(currentScale);
  const isCompactHeader = disclosureLevel === 'minimal' || disclosureLevel === 'compact';

  // Double-tap tracking for shift/absence placement
  // (Double-tap zoom removed - pinch is sufficient for zooming)
  const lastTapRef = useRef<{ dateKey: string; time: number }>({ dateKey: '', time: 0 });
  const DOUBLE_TAP_DELAY = 300; // ms


  // Pinch gesture for zooming (non-reanimated, uses refs to avoid stale closures)
  // NOTE: currentScale intentionally NOT in deps - prevents gesture recreation mid-pinch
  // baseScale.current persists between gestures (set in onEnd)
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart(() => {
        setIsPinching(true);
        // Don't read from currentScale closure - baseScale.current already has correct value
        hitZoomLimit.current = false;
        zoomDirection.current = null; // Reset direction lock for new gesture
      })
      .onUpdate((event) => {
        const rawScale = baseScale.current * event.scale;
        const newScale = Math.min(1.5, Math.max(minZoom, rawScale));

        // Haptic feedback when hitting zoom limits
        const isAtLimit = rawScale !== newScale;
        if (isAtLimit && !hitZoomLimit.current) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          hitZoomLimit.current = true;
        } else if (!isAtLimit) {
          hitZoomLimit.current = false;
        }

        // Skip if scale hasn't changed meaningfully (prevents micro-jitter)
        if (Math.abs(newScale - lastAppliedScale.current) < 0.01) return;

        // Direction locking: once committed to zoom in/out, lock that direction
        // This prevents jittery oscillation and accidental reversals
        if (zoomDirection.current === null && Math.abs(newScale - baseScale.current) > 0.03) {
          // Commit to a direction once we've moved 3% from starting scale
          zoomDirection.current = newScale > baseScale.current ? 'in' : 'out';
        }

        // Ignore scale changes in the opposite direction
        if (zoomDirection.current === 'in' && newScale < lastAppliedScale.current) return;
        if (zoomDirection.current === 'out' && newScale > lastAppliedScale.current) return;

        // Update scale
        setCurrentScale(newScale);
        lastAppliedScale.current = newScale;
      })
      .onEnd(() => {
        baseScale.current = lastAppliedScale.current;
        zoomDirection.current = null; // Reset for next gesture
        setIsPinching(false);
      }),
    [setCurrentScale, minZoom]  // currentScale removed - prevents gesture recreation mid-pinch
  );

  // Pinch gesture only (double-tap zoom removed, now used for shift placement)
  const composedGesture = useMemo(() => pinchGesture, [pinchGesture]);

  useEffect(() => {
    if (!state.reviewMode) {
      setActiveTracking(null);
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

  // Track previous week to detect actual week changes
  const prevWeekStartRef = useRef<string | null>(null);

  // Reload tracking records when week changes while in review mode
  useEffect(() => {
    if (!state.reviewMode) return;

    const currentWeekStart = formatDateKey(weekDays[0]);

    // Only reload if the week actually changed (not just a re-render)
    if (prevWeekStartRef.current === currentWeekStart) {
      return;
    }
    prevWeekStartRef.current = currentWeekStart;

    const loadRecordsForWeek = async () => {
      try {
        const startDate = formatDateKey(weekDays[0]);
        const endDate = formatDateKey(weekDays[weekDays.length - 1]);
        const { loadRealTrackingRecords } = await import('@/lib/calendar/calendar-utils');
        const updatedRecords = await loadRealTrackingRecords(startDate, endDate);
        dispatch({ type: 'UPDATE_TRACKING_RECORDS', trackingRecords: updatedRecords });
      } catch (error) {
        console.error('[WeekView] Failed to load tracking records for week:', error);
      }
    };

    loadRecordsForWeek();
  }, [weekDays, state.reviewMode, dispatch]);

  const getTrackingForDate = (dateKey: string): TrackingRecord[] => {
    return Object.values(state.trackingRecords).filter((record) => record.date === dateKey);
  };

  const handleHourPress = async (dateKey: string) => {
    // Clear active tracking selection when clicking elsewhere
    if (activeTracking) {
      setActiveTracking(null);
      return;
    }

    // Clear active absence selection when clicking elsewhere
    if (activeAbsenceId) {
      setActiveAbsenceId(null);
      return;
    }

    // Check for double-tap (only used for batch mode placement)
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap = lastTap.dateKey === dateKey && (now - lastTap.time) < DOUBLE_TAP_DELAY;

    // Update last tap tracking
    lastTapRef.current = { dateKey, time: now };

    // Double-tap with armed template: place shift/absence (batch mode)
    if (isDoubleTap && (state.armedTemplateId || state.armedAbsenceTemplateId)) {
      // Reset tap tracking to prevent triple-tap from placing again
      lastTapRef.current = { dateKey: '', time: 0 };

      // Handle absence placement if an absence template is armed
      if (state.armedAbsenceTemplateId) {
        const absenceTemplate = state.absenceTemplates[state.armedAbsenceTemplateId];
        if (absenceTemplate) {
          // Haptic feedback for placement
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
          } catch (error) {
            console.error('[WeekView] Failed to create absence instance:', error);
          }
        }
        return;
      }

      // Handle shift placement if a shift template is armed
      if (state.armedTemplateId) {
        // Haptic feedback for placement
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Check for overlap before placing shift
        const template = state.templates[state.armedTemplateId];
        if (template) {
          const overlap = findOverlappingShift(
            dateKey,
            template.startTime,
            template.duration,
            state.instances
          );

          if (overlap) {
            Alert.alert(
              t('calendar.week.overlapTitle'),
              t('calendar.week.overlapMessage', { name: overlap.name })
            );
            return;
          }
        }

        dispatch({ type: 'PLACE_SHIFT', date: dateKey });
        return;
      }
    }

    // Single tap behavior depends on batch mode
    if (!isDoubleTap) {
      if (state.armedTemplateId || state.armedAbsenceTemplateId) {
        // In batch mode: delay picker to allow time for potential double-tap
        // Store current tap info to check later
        const tapTime = now;
        const tapDateKey = dateKey;

        setTimeout(() => {
          // Check if this tap is still the most recent (no second tap came)
          const current = lastTapRef.current;
          if (current.dateKey === tapDateKey && current.time === tapTime) {
            // No second tap came within the delay, open picker
            handleHourLongPress(dateKey);
          }
          // If a second tap came, it would have been handled as a double-tap
        }, DOUBLE_TAP_DELAY + 50); // Small buffer to ensure double-tap is processed first
      } else {
        // Not in batch mode: open picker immediately
        handleHourLongPress(dateKey);
      }
      return;
    }

    // Double-tap without armed template: open picker
    handleHourLongPress(dateKey);
  };

  const handleAbsencePress = (absence: AbsenceInstance) => {
    // Toggle active state for drag handles
    if (activeAbsenceId === absence.id) {
      setActiveAbsenceId(null);
    } else {
      setActiveAbsenceId(absence.id);
      // Deselect tracking if any
      setActiveTracking(null);
    }
  };

  const handleAbsenceLongPress = (absence: AbsenceInstance) => {
    Alert.alert(
      t('calendar.absences.deleteTitle') || 'Delete Absence?',
      t('calendar.absences.deleteMessage') || 'Remove this absence?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const storage = await getCalendarStorage();
              await storage.deleteAbsenceInstance(absence.id);
              dispatch({ type: 'DELETE_ABSENCE_INSTANCE', id: absence.id });
            } catch (error) {
              console.error('[WeekView] Failed to delete absence:', error);
            }
          },
        },
      ]
    );
  };

  // Helper to get absences for a date
  const getAbsencesForDateKey = (dateKey: string): AbsenceInstance[] => {
    return getAbsencesForDate(state.absenceInstances, dateKey);
  };

  const confirmDay = async (dateKey: string) => {
    // Validation: Only allow confirming past days (not today, not future)
    const dayToConfirm = startOfDay(new Date(dateKey));
    const today = startOfDay(new Date());

    if (!isBefore(dayToConfirm, today)) {
      Alert.alert(
        t('calendar.week.cannotConfirmFutureTitle'),
        t('calendar.week.cannotConfirmFutureMessage')
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

      const locale = getDateLocale() === 'de' ? deLocale : undefined;
      const formatted = formatDate(new Date(dateKey), 'EEEE', { locale });
      setConfirmationMessage(t('calendar.week.dayConfirmed', { day: formatted }));
      setTimeout(() => setConfirmationMessage(null), 2000);
    } catch (error) {
      console.error('[WeekView] Failed to confirm day:', error);
      Alert.alert(t('calendar.week.confirmationFailed'), t('calendar.week.confirmationFailedMessage'));
    }
  };

  const handleAdjustTrackingEnd = async (id: string, deltaMinutes: number) => {
    const record = state.trackingRecords[id];
    if (!record) return;
    const newDuration = Math.max(5, record.duration + deltaMinutes);
    dispatch({ type: 'UPDATE_TRACKING_END', id, newDuration });

    // Sync to sessions table (only for real sessions, not simulated)
    if (id.startsWith('tracking-session-')) {
      const sessionId = id.replace('tracking-session-', '');
      try {
        const { getDatabase } = await import('@/modules/geofencing/services/Database');
        const db = await getDatabase();

        // Calculate clock out time from start date/time + new duration
        const [year, month, day] = record.date.split('-').map(Number);
        const [startH, startM] = record.startTime.split(':').map(Number);
        const clockInDate = new Date(year, month - 1, day, startH, startM, 0, 0);
        const clockOutDate = new Date(clockInDate.getTime() + newDuration * 60 * 1000);
        await db.updateSession(sessionId, { clockOut: clockOutDate.toISOString() });
      } catch (error) {
        console.error('[WeekView] Failed to sync tracking end to session:', error);
      }
    }
  };

  const handleAdjustTrackingStart = async (id: string, deltaMinutes: number) => {
    const record = state.trackingRecords[id];
    if (!record) return;
    const startMinutes = Math.max(0, timeToMinutes(record.startTime) + deltaMinutes);
    const hours = Math.floor(startMinutes / 60) % 24;
    const minutes = startMinutes % 60;
    const startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    dispatch({ type: 'UPDATE_TRACKING_START', id, startTime });

    // Sync to sessions table (only for real sessions, not simulated)
    if (id.startsWith('tracking-session-')) {
      const sessionId = id.replace('tracking-session-', '');
      try {
        const { getDatabase } = await import('@/modules/geofencing/services/Database');
        const db = await getDatabase();

        // Convert date + new time to local Date, then to ISO string
        const [year, month, day] = record.date.split('-').map(Number);
        const newClockIn = new Date(year, month - 1, day, hours, minutes, 0, 0);
        await db.updateSession(sessionId, { clockIn: newClockIn.toISOString() });
      } catch (error) {
        console.error('[WeekView] Failed to sync tracking start to session:', error);
      }
    }
  };

  // Absence adjustment handlers
  const handleAdjustAbsenceStart = async (id: string, deltaMinutes: number) => {
    const absence = state.absenceInstances[id];
    if (!absence) return;

    const startMinutes = Math.max(0, timeToMinutes(absence.startTime) + deltaMinutes);
    const endMinutes = timeToMinutes(absence.endTime);

    // Don't allow start to go past end
    if (startMinutes >= endMinutes) return;

    const hours = Math.floor(startMinutes / 60) % 24;
    const minutes = startMinutes % 60;
    const newStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Update state and persist
    dispatch({ type: 'UPDATE_ABSENCE_INSTANCE', id, updates: { startTime: newStartTime, isFullDay: false } });

    try {
      const storage = await getCalendarStorage();
      await storage.updateAbsenceInstance(id, { startTime: newStartTime, isFullDay: false });
    } catch (error) {
      console.error('[WeekView] Failed to update absence start time:', error);
    }
  };

  const handleAdjustAbsenceEnd = async (id: string, deltaMinutes: number) => {
    const absence = state.absenceInstances[id];
    if (!absence) return;

    const startMinutes = timeToMinutes(absence.startTime);
    let endMinutes = timeToMinutes(absence.endTime) + deltaMinutes;

    // Clamp to valid range (after start, before midnight)
    endMinutes = Math.max(startMinutes + 5, Math.min(24 * 60 - 1, endMinutes));

    const hours = Math.floor(endMinutes / 60) % 24;
    const minutes = endMinutes % 60;
    const newEndTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Update state and persist
    dispatch({ type: 'UPDATE_ABSENCE_INSTANCE', id, updates: { endTime: newEndTime, isFullDay: false } });

    try {
      const storage = await getCalendarStorage();
      await storage.updateAbsenceInstance(id, { endTime: newEndTime, isFullDay: false });
    } catch (error) {
      console.error('[WeekView] Failed to update absence end time:', error);
    }
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
      if (activeTracking?.id === id) {
        setActiveTracking(null);
      }
    } catch (error) {
      console.error('[WeekView] Failed to delete tracking session:', error);
      Alert.alert(t('common.error'), t('calendar.week.deleteError'));
    }
  };

  const handleAddBreak = async (id: string, additionalMinutes: number) => {
    const record = state.trackingRecords[id];
    if (!record) return;

    const currentBreak = record.breakMinutes || 0;
    const newBreak = currentBreak + additionalMinutes;

    // Warn if break exceeds session duration
    if (newBreak > record.duration) {
      Alert.alert(
        t('calendar.week.breakExceedsTitle'),
        t('calendar.week.breakExceedsMessage', { breakDuration: formatDuration(newBreak), sessionDuration: formatDuration(record.duration) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.addAnyway'),
            onPress: async () => {
              try {
                const { getCalendarStorage } = await import('@/modules/calendar/services/CalendarStorage');
                const storage = await getCalendarStorage();
                await storage.updateTrackingBreak(id, newBreak);
                dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: newBreak });
              } catch (error) {
                console.error('[WeekView] Failed to add break:', error);
                Alert.alert(t('common.error'), t('calendar.week.breakAddError'));
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const { getCalendarStorage } = await import('@/modules/calendar/services/CalendarStorage');
      const storage = await getCalendarStorage();
      await storage.updateTrackingBreak(id, newBreak);
      dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: newBreak });
    } catch (error) {
      console.error('[WeekView] Failed to add break:', error);
      Alert.alert(t('common.error'), t('calendar.week.breakAddError'));
    }
  };

  const handleClearBreak = async (id: string) => {
    try {
      const { getCalendarStorage } = await import('@/modules/calendar/services/CalendarStorage');
      const storage = await getCalendarStorage();
      await storage.updateTrackingBreak(id, 0);
      dispatch({ type: 'UPDATE_TRACKING_BREAK', id, breakMinutes: 0 });
    } catch (error) {
      console.error('[WeekView] Failed to clear break:', error);
      Alert.alert(t('common.error'), t('calendar.week.breakClearError'));
    }
  };

  const handleInstancePress = (instance: ShiftInstance) => {
    // Exit batch mode when tapping an existing shift
    if (state.armedTemplateId) {
      dispatch({ type: 'DISARM_SHIFT' });
    }
    if (state.armedAbsenceTemplateId) {
      dispatch({ type: 'DISARM_ABSENCE' });
    }

    const showDeleteConfirm = () => {
      Alert.alert(t('calendar.week.deleteShiftTitle'), t('calendar.week.deleteShiftMessage', { name: instance.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => dispatch({ type: 'DELETE_INSTANCE', id: instance.id }),
        },
      ]);
    };

    const openTimePicker = () => {
      setTimePickerInstance(instance);
      setSelectedTime(parse(instance.startTime, 'HH:mm', new Date()));
      setShowTimePicker(true);
    };

    Alert.alert(t('calendar.week.shiftOptions'), instance.name, [
      { text: t('calendar.week.editStartTime'), onPress: openTimePicker },
      { text: t('common.delete'), style: 'destructive', onPress: showDeleteConfirm },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleTimePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      // Android: picker is dismissed automatically
      setShowTimePicker(false);

      if (event.type === 'set' && selectedDate && timePickerInstance) {
        const newStartTime = formatDate(selectedDate, 'HH:mm');

        // Check for overlap before updating
        const overlap = findOverlappingShift(
          timePickerInstance.date,
          newStartTime,
          timePickerInstance.duration,
          state.instances,
          timePickerInstance.id // Exclude self
        );

        if (overlap) {
          Alert.alert(
            t('calendar.week.overlapTitle'),
            t('calendar.week.overlapMessage', { name: overlap.name })
          );
        } else {
          dispatch({
            type: 'UPDATE_INSTANCE_START_TIME',
            id: timePickerInstance.id,
            startTime: newStartTime,
          });
        }
      }

      setTimePickerInstance(null);
      setSelectedTime(null);
    } else {
      // iOS: just update the selected time, don't dismiss
      if (selectedDate) {
        setSelectedTime(selectedDate);
      }
    }
  };

  const saveTimePicker = () => {
    if (timePickerInstance && selectedTime) {
      const newStartTime = formatDate(selectedTime, 'HH:mm');

      // Check for overlap before updating
      const overlap = findOverlappingShift(
        timePickerInstance.date,
        newStartTime,
        timePickerInstance.duration,
        state.instances,
        timePickerInstance.id // Exclude self
      );

      if (overlap) {
        Alert.alert(
          t('calendar.week.overlapTitle'),
          t('calendar.week.overlapMessage', { name: overlap.name })
        );
        return; // Don't close picker, let user choose different time
      }

      dispatch({
        type: 'UPDATE_INSTANCE_START_TIME',
        id: timePickerInstance.id,
        startTime: newStartTime,
      });
    }
    setShowTimePicker(false);
    setTimePickerInstance(null);
    setSelectedTime(null);
  };

  const dismissTimePicker = () => {
    setShowTimePicker(false);
    setTimePickerInstance(null);
    setSelectedTime(null);
  };

  // Long-press or single-tap on empty hour cell → show template picker
  const handleHourLongPress = (dateKey: string) => {
    // Always show picker - user can create new templates from it
    setPickerTab('shifts');
    setPendingPlacementDate(dateKey);
    setShowTemplatePicker(true);
  };

  // Template selected from picker → place shift
  const handleTemplateSelected = (templateId: string) => {
    if (!pendingPlacementDate) {
      setShowTemplatePicker(false);
      return;
    }

    const template = state.templates[templateId];
    if (!template) {
      setShowTemplatePicker(false);
      setPendingPlacementDate(null);
      return;
    }

    // Check for overlap (uses template's default start time)
    const overlap = findOverlappingShift(
      pendingPlacementDate,
      template.startTime,
      template.duration,
      state.instances
    );

    if (overlap) {
      Alert.alert(
        t('calendar.week.overlapTitle'),
        t('calendar.week.overlapMessage', { name: overlap.name })
      );
      // Don't close picker, let user choose different template
      return;
    }

    // Arm template (required for PLACE_SHIFT)
    dispatch({ type: 'ARM_SHIFT', templateId });

    // Place the shift
    dispatch({
      type: 'PLACE_SHIFT',
      date: pendingPlacementDate,
      timeSlot: template.startTime,
    });

    // Track as last used and disarm (not entering batch mode from picker)
    dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId });
    dispatch({ type: 'DISARM_SHIFT' });

    setShowTemplatePicker(false);
    setPendingPlacementDate(null);
  };

  // Absence template selected from picker → place absence
  const handleAbsenceTemplateSelected = async (templateId: string) => {
    if (!pendingPlacementDate) {
      setShowTemplatePicker(false);
      return;
    }

    const absenceTemplate = state.absenceTemplates[templateId];
    if (!absenceTemplate) {
      setShowTemplatePicker(false);
      setPendingPlacementDate(null);
      return;
    }

    const startTime = absenceTemplate.isFullDay ? '00:00' : (absenceTemplate.startTime || '00:00');
    const endTime = absenceTemplate.isFullDay ? '23:59' : (absenceTemplate.endTime || '23:59');

    const newInstance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'> = {
      templateId: absenceTemplate.id,
      type: absenceTemplate.type,
      date: pendingPlacementDate,
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

      // Track as last used (shows at top of picker next time)
      dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId });
    } catch (error) {
      console.error('[WeekView] Failed to create absence instance:', error);
    }

    setShowTemplatePicker(false);
    setPendingPlacementDate(null);
  };

  const dismissTemplatePicker = () => {
    setShowTemplatePicker(false);
    setPendingPlacementDate(null);
    setShowCreateForm(false);
    setCreateFormData({
      name: '',
      startTime: '08:00',
      durationHours: 8,
      durationMinutes: 0,
      color: 'teal',
    });
    setShowCreateAbsenceForm(false);
    setCreateAbsenceFormData({
      name: '',
      type: 'vacation',
      isFullDay: true,
      startTime: '08:00',
      endTime: '17:00',
    });
  };

  // Exit batch mode (disarm any armed template)
  const handleExitBatchMode = () => {
    if (state.armedTemplateId) {
      dispatch({ type: 'DISARM_SHIFT' });
    }
    if (state.armedAbsenceTemplateId) {
      dispatch({ type: 'DISARM_ABSENCE' });
    }
  };

  // Get armed template info for batch indicator
  const armedTemplate = state.armedTemplateId
    ? state.templates[state.armedTemplateId]
    : null;
  const armedAbsenceTemplate = state.armedAbsenceTemplateId
    ? state.absenceTemplates[state.armedAbsenceTemplateId]
    : null;

  // Open create form in picker
  const openCreateForm = () => {
    setShowCreateForm(true);
  };

  // Open TemplatePanel for editing templates
  const openTemplatePanel = (tab: 'shifts' | 'absences') => {
    dismissTemplatePicker();
    dispatch({ type: 'SET_TEMPLATE_PANEL_TAB', tab });
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
  };

  // Handle creating a new shift template and placing it
  const handleCreateAndPlace = async () => {
    if (!pendingPlacementDate) return;

    const duration = createFormData.durationHours * 60 + createFormData.durationMinutes;
    const name = createFormData.name.trim() || t('calendar.templates.newShift');

    // Create new template
    const newTemplate: ShiftTemplate = {
      id: `template-${Date.now()}`,
      name,
      startTime: createFormData.startTime,
      duration,
      color: createFormData.color,
      breakMinutes: 0,
    };

    try {
      // Save template to storage
      const storage = await getCalendarStorage();
      await storage.saveShiftTemplate(newTemplate);

      // Add to state and arm for placement
      dispatch({ type: 'ADD_TEMPLATE', template: newTemplate });
      dispatch({ type: 'ARM_SHIFT', templateId: newTemplate.id });

      // Check for overlap before placing
      const overlap = findOverlappingShift(
        pendingPlacementDate,
        newTemplate.startTime,
        newTemplate.duration,
        state.instances
      );

      if (overlap) {
        Alert.alert(
          t('calendar.week.overlapTitle'),
          t('calendar.week.overlapMessage', { name: overlap.name })
        );
        // Still close picker - template was created
        dismissTemplatePicker();
        return;
      }

      // Place the shift
      dispatch({
        type: 'PLACE_SHIFT',
        date: pendingPlacementDate,
        timeSlot: newTemplate.startTime,
      });

      // Track as last used and disarm (not entering batch mode)
      dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId: newTemplate.id });
      dispatch({ type: 'DISARM_SHIFT' });

      dismissTemplatePicker();
    } catch (error) {
      console.error('[WeekView] Failed to create template:', error);
      Alert.alert(t('common.error'), t('calendar.templates.createError'));
    }
  };

  // Open create absence form in picker
  const openCreateAbsenceForm = () => {
    setShowCreateAbsenceForm(true);
  };

  // Handle creating a new absence template and placing it
  const handleCreateAbsenceAndPlace = async () => {
    if (!pendingPlacementDate) return;

    const name = createAbsenceFormData.name.trim() || t('calendar.absences.newAbsence');

    // Note: createAbsenceTemplate generates id, createdAt, updatedAt automatically
    const newAbsenceTemplate: Omit<AbsenceTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      type: createAbsenceFormData.type,
      name,
      color: createAbsenceFormData.type === 'vacation' ? '#D1D5DB' : '#FED7AA',
      isFullDay: createAbsenceFormData.isFullDay,
      startTime: createAbsenceFormData.isFullDay ? null : createAbsenceFormData.startTime,
      endTime: createAbsenceFormData.isFullDay ? null : createAbsenceFormData.endTime,
    };

    try {
      // Save template to storage (this generates the ID)
      const storage = await getCalendarStorage();
      const savedTemplate = await storage.createAbsenceTemplate(newAbsenceTemplate);

      // Add to state
      dispatch({ type: 'ADD_ABSENCE_TEMPLATE', template: savedTemplate });

      // Create instance
      const startTime = savedTemplate.isFullDay ? '00:00' : (savedTemplate.startTime || '00:00');
      const endTime = savedTemplate.isFullDay ? '23:59' : (savedTemplate.endTime || '23:59');

      const newInstance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'> = {
        templateId: savedTemplate.id,
        type: savedTemplate.type,
        date: pendingPlacementDate,
        startTime,
        endTime,
        isFullDay: savedTemplate.isFullDay,
        name: savedTemplate.name,
        color: savedTemplate.color,
      };

      const createdInstance = await storage.createAbsenceInstance(newInstance);
      dispatch({ type: 'ADD_ABSENCE_INSTANCE', instance: createdInstance });

      // Track as last used
      dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId: savedTemplate.id });

      dismissTemplatePicker();
    } catch (error) {
      console.error('[WeekView] Failed to create absence template:', error);
      Alert.alert(t('common.error'), t('calendar.absences.createError'));
    }
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.wrapper} onLayout={handleContainerLayout}>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isDragging && !isPinching}
          onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
          onScrollEndDrag={handleHorizontalScrollEndDrag}
          scrollEventThrottle={16}
          bounces={true}
          decelerationRate="fast"
        >
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
                <View key={dateKey} style={[styles.dayHeader, { width: dayWidth }]} testID={`week-day-${dateKey}`}>
                  {!isCompactHeader && <Text style={styles.dayName}>{formatDate(day, 'EEE', { locale: getDateLocale() === 'de' ? deLocale : undefined })}</Text>}
                  <View style={styles.dayNumberRow}>
                    <Text style={[styles.dayNumber, isCompactHeader && styles.dayNumberCompact]}>{formatDate(day, 'd')}</Text>
                    {state.reviewMode && (
                      <>
                        {isConfirmed ? (
                          <View style={[styles.reviewBadgeConfirmed, isCompactHeader && styles.reviewBadgeCompact]}>
                            <Text style={[styles.reviewBadgeText, isCompactHeader && styles.reviewBadgeTextCompact]}>✓</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.confirmButton,
                              !canConfirm && styles.confirmButtonDisabled,
                              isCompactHeader && styles.confirmButtonCompact,
                            ]}
                            onPress={() => canConfirm && confirmDay(dateKey)}
                            disabled={!canConfirm}
                            testID={`confirm-day-${dateKey}`}
                          >
                            <Text style={[
                              styles.confirmButtonText,
                              !canConfirm && styles.confirmButtonTextDisabled,
                              isCompactHeader && styles.confirmButtonTextCompact,
                            ]}>
                              {isCompactHeader ? t('calendar.week.confirmShort') : t('calendar.week.confirm')}
                            </Text>
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
            ref={verticalScrollRef}
            style={[styles.gridScroll, { maxHeight: 24 * hourHeight + 20 }]}
            contentContainerStyle={{ flexGrow: 1 }}
            scrollEnabled={!isDragging && !isPinching}
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            <View style={styles.gridRow}>
              <View style={styles.timeColumn}>
                {hourMarkers.map((hour, index) => {
                  const interval = getHourMarkerInterval(currentScale);
                  const showLabel = index % interval === 0;
                  return (
                    <View key={hour} style={[styles.timeCell, { height: hourHeight }]}>
                      {showLabel && <Text style={styles.timeCellText}>{hour}</Text>}
                    </View>
                  );
                })}
              </View>

              {weekDays.map((day, dayIndex) => {
                const dateKey = formatDateKey(day);
                const previousDateKey = dayIndex > 0 ? formatDateKey(weekDays[dayIndex - 1]) : formatDateKey(subDays(day, 1));
                const { current, fromPrevious } = getInstancesForDate(state.instances, dateKey, previousDateKey);
                const trackingRecords = getTrackingForDate(dateKey);
                const absences = getAbsencesForDateKey(dateKey);
                return (
                  <View key={dateKey} style={[styles.dayColumn, { width: dayWidth }]} testID={`week-day-column-${dateKey}`}>
                    {Array.from({ length: 24 }).map((_, hourIndex) => (
                      <Pressable
                        key={hourIndex}
                        style={[styles.hourCell, { height: hourHeight }]}
                        onPress={() => handleHourPress(dateKey)}
                        onLongPress={() => handleHourLongPress(dateKey)}
                        delayLongPress={400}
                      />
                    ))}
                    {/* Render absences first (behind shifts) */}
                    {absences.map((absence) => (
                      <AbsenceCard
                        key={absence.id}
                        absence={absence}
                        onPress={handleAbsencePress}
                        onLongPress={handleAbsenceLongPress}
                        onAdjustStart={handleAdjustAbsenceStart}
                        onAdjustEnd={handleAdjustAbsenceEnd}
                        active={activeAbsenceId === absence.id}
                        setDragging={setIsDragging}
                        hourHeight={hourHeight}
                      />
                    ))}
                    {/* Render shifts with dimming if overlapped by absence */}
                    {current.map((instance) => {
                      const isDimmed = shiftHasAbsenceOverlap(instance, state.absenceInstances);
                      return (
                        <InstanceCard
                          key={instance.id}
                          instance={instance}
                          onPress={handleInstancePress}
                          hourHeight={hourHeight}
                          isOrphaned={!state.templates[instance.templateId]}
                          isDimmed={isDimmed}
                        />
                      );
                    })}
                    {fromPrevious.map((instance) => {
                      const startMinutes = timeToMinutes(instance.startTime);
                      const overflowMinutes = startMinutes + instance.duration - 24 * 60;
                      const height = Math.max(20, (overflowMinutes / 60) * hourHeight);
                      // Progressive disclosure for overflow shifts
                      const showName = hourHeight >= DISCLOSURE_REDUCED_HEIGHT;
                      const showTimes = hourHeight >= DISCLOSURE_FULL_HEIGHT;
                      const isOrphaned = !state.templates[instance.templateId];
                      // Use the instance's actual color for continuations
                      const palette = getColorPalette(instance.color);
                      return (
                        <View
                          key={`${instance.id}-overflow`}
                          style={[
                            styles.shiftBlock,
                            {
                              top: 0,
                              height,
                              backgroundColor: isOrphaned ? ORPHAN_PALETTE.bg : palette.bg,
                              borderColor: isOrphaned ? ORPHAN_PALETTE.border : palette.border,
                            },
                          ]}
                        >
                          {showName && (
                            <Text style={[styles.shiftName, isOrphaned && { color: ORPHAN_PALETTE.text }, !isOrphaned && { color: palette.text }]}>
                              {instance.name}
                            </Text>
                          )}
                          {showTimes && (
                            <Text style={[styles.shiftTime, isOrphaned && { color: ORPHAN_PALETTE.text }]}>
                              {t('calendar.week.continues')}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    {state.reviewMode && trackingRecords.map((record) => {
                      const startMinutes = timeToMinutes(record.startTime);
                      const endMinutes = startMinutes + record.duration;
                      const spansNextDay = endMinutes > 24 * 60;
                      const daysSpanned = Math.ceil(endMinutes / (24 * 60));
                      const isLastDay = daysSpanned === 1;
                      const isActive = activeTracking?.id === record.id;
                      const isThisDateClicked = activeTracking?.clickedDateKey === dateKey;

                      // Render badge for this day - clip at midnight if it spans to next day
                      return (
                        <TrackingBadge
                          key={record.id}
                          record={record}
                          onAdjustStart={handleAdjustTrackingStart}
                          onAdjustEnd={handleAdjustTrackingEnd}
                          onDelete={handleDeleteTracking}
                          onToggleActive={(mode) =>
                            setActiveTracking(isActive && activeTracking?.mode === mode
                              ? null
                              : { id: record.id, mode, clickedDateKey: dateKey })
                          }
                          onPress={() =>
                            setActiveTracking(isActive
                              ? null
                              : { id: record.id, mode: 'times', clickedDateKey: dateKey })
                          }
                          onAddBreak={handleAddBreak}
                          onClearBreak={handleClearBreak}
                          editMode={isActive ? activeTracking.mode : null}
                          setDragging={setIsDragging}
                          clippedDuration={spansNextDay ? (24 * 60 - startMinutes) : undefined}
                          showStartGrabber={true}
                          showEndGrabber={isLastDay}
                          showBreakPanel={isThisDateClicked}
                          currentTime={currentTime}
                          hourHeight={hourHeight}
                        />
                      );
                    })}
                    {state.reviewMode && (() => {
                      // Render overflow tracking from previous days (supports multi-day spanning)
                      const overflowBadges: React.ReactNode[] = [];

                      // Look back up to 7 days for sessions that might overflow into current day
                      for (let lookback = 1; lookback <= 7; lookback++) {
                        const prevDay = subDays(day, lookback);
                        const prevDateKey = formatDateKey(prevDay);
                        const prevDayRecords = getTrackingForDate(prevDateKey);

                        for (const record of prevDayRecords) {
                          const startMinutes = timeToMinutes(record.startTime);
                          const totalEndMinutes = startMinutes + record.duration;
                          const daysSpanned = Math.ceil(totalEndMinutes / (24 * 60));

                          // Check if this record spans into the current day
                          if (daysSpanned <= lookback) continue; // Doesn't reach this day

                          // Calculate which day segment this is (day 1 = original, day 2 = 1st overflow, etc.)
                          const dayInSpan = lookback + 1;
                          const isLastDay = dayInSpan === daysSpanned;

                          // Calculate minutes for this day's segment
                          const dayStartMinutes = lookback * 24 * 60; // Minutes from original start to this day's 00:00
                          const dayEndMinutes = Math.min((lookback + 1) * 24 * 60, totalEndMinutes);
                          const segmentMinutes = dayEndMinutes - dayStartMinutes;

                          if (segmentMinutes <= 0) continue;

                          // Create modified record for overflow segment (starts at 00:00)
                          const overflowRecord = {
                            ...record,
                            startTime: '00:00',
                          };

                          const isActive = activeTracking?.id === record.id;
                          const isThisDateClicked = activeTracking?.clickedDateKey === dateKey;

                          overflowBadges.push(
                            <TrackingBadge
                              key={`${record.id}-overflow-${lookback}`}
                              record={overflowRecord}
                              onAdjustStart={handleAdjustTrackingStart}
                              onAdjustEnd={handleAdjustTrackingEnd}
                              onDelete={handleDeleteTracking}
                              onToggleActive={(mode) =>
                                setActiveTracking(isActive && activeTracking?.mode === mode
                                  ? null
                                  : { id: record.id, mode, clickedDateKey: dateKey })
                              }
                              onPress={() =>
                                setActiveTracking(isActive
                                  ? null
                                  : { id: record.id, mode: 'times', clickedDateKey: dateKey })
                              }
                              onAddBreak={handleAddBreak}
                              onClearBreak={handleClearBreak}
                              editMode={isActive ? activeTracking.mode : null}
                              setDragging={setIsDragging}
                              clippedDuration={segmentMinutes}
                              showStartGrabber={false}
                              showEndGrabber={isLastDay}
                              showBreakPanel={isThisDateClicked}
                              currentTime={currentTime}
                              hourHeight={hourHeight}
                            />
                          );
                        }
                      }

                      return overflowBadges;
                    })()}
                    {dateKey === todayKey && <CurrentTimeLine currentTime={currentTime} reviewMode={state.reviewMode} hourHeight={hourHeight} />}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      </Animated.View>

      {/* Time picker for editing shift start time */}
      {showTimePicker && timePickerInstance && (
        Platform.OS === 'ios' ? (
          <View style={styles.timePickerOverlay}>
            <View style={styles.timePickerContainer}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity onPress={dismissTimePicker}>
                  <Text style={styles.timePickerCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.timePickerTitle}>{timePickerInstance.name}</Text>
                <TouchableOpacity onPress={saveTimePicker}>
                  <Text style={styles.timePickerDone}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime || parse(timePickerInstance.startTime, 'HH:mm', new Date())}
                mode="time"
                display="spinner"
                onChange={handleTimePickerChange}
                minuteInterval={5}
              />
            </View>
          </View>
        ) : (
          <DateTimePicker
            value={selectedTime || parse(timePickerInstance.startTime, 'HH:mm', new Date())}
            mode="time"
            display="default"
            onChange={handleTimePickerChange}
            minuteInterval={5}
          />
        )
      )}

      {/* Template picker modal (for long-press on empty space) */}
      {showTemplatePicker && (
        <Pressable style={styles.templatePickerOverlay} onPress={dismissTemplatePicker}>
          <Pressable style={styles.templatePickerContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.templatePickerTitle}>{t('calendar.templates.selectTemplate')}</Text>

            {/* Tab bar for Shifts / Absences */}
            <View style={styles.pickerTabBar}>
              <Pressable
                style={[styles.pickerTab, pickerTab === 'shifts' && styles.pickerTabActive]}
                onPress={() => setPickerTab('shifts')}
              >
                <Text style={[styles.pickerTabText, pickerTab === 'shifts' && styles.pickerTabTextActive]}>
                  {t('calendar.templates.shiftsTab')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.pickerTab, pickerTab === 'absences' && styles.pickerTabActive]}
                onPress={() => setPickerTab('absences')}
              >
                <Text style={[styles.pickerTabText, pickerTab === 'absences' && styles.pickerTabTextActive]}>
                  {t('calendar.templates.absencesTab')}
                </Text>
              </Pressable>
            </View>

            {/* Shifts list - sorted with last-used at top */}
            {pickerTab === 'shifts' && (
              <>
                {Object.values(state.templates).length === 0 && !showCreateForm ? (
                  <Text style={styles.templatePickerEmpty}>{t('calendar.templates.empty')}</Text>
                ) : (
                  [...Object.values(state.templates)]
                    .sort((a, b) => {
                      // Last-used template goes first
                      if (a.id === state.lastUsedTemplateId) return -1;
                      if (b.id === state.lastUsedTemplateId) return 1;
                      return 0;
                    })
                    .map(template => {
                      const palette = getColorPalette(template.color);
                      const isLastUsed = template.id === state.lastUsedTemplateId;
                      return (
                        <Pressable
                          key={template.id}
                          style={styles.templatePickerRow}
                          onPress={() => handleTemplateSelected(template.id)}
                        >
                          {isLastUsed && (
                            <Star size={14} color={colors.primary[500]} fill={colors.primary[500]} style={{ marginRight: spacing.xs }} />
                          )}
                          <View style={[styles.templatePickerDot, { backgroundColor: palette.dot }]} />
                          <View style={styles.templatePickerInfo}>
                            <Text style={styles.templatePickerName}>{template.name}</Text>
                            <Text style={styles.templatePickerTime}>
                              {template.startTime} · {formatDuration(template.duration)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                )}

                {/* Create new shift option */}
                {!showCreateForm ? (
                  <>
                    <Pressable style={styles.templatePickerCreateRow} onPress={openCreateForm}>
                      <View style={styles.templatePickerCreateIcon}>
                        <Plus size={16} color={colors.primary[500]} />
                      </View>
                      <Text style={styles.templatePickerCreateText}>
                        {t('calendar.templates.createNew')}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.templatePickerManageRow} onPress={() => openTemplatePanel('shifts')}>
                      <Settings size={16} color={colors.text.tertiary} />
                      <Text style={styles.templatePickerManageText}>
                        {t('calendar.templates.manage')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  /* Inline create form */
                  <View style={styles.createForm}>
                    <TextInput
                      style={styles.createFormInput}
                      value={createFormData.name}
                      onChangeText={(name) => setCreateFormData(prev => ({ ...prev, name }))}
                      placeholder={t('calendar.templates.namePlaceholder')}
                      placeholderTextColor={colors.text.tertiary}
                      autoFocus
                    />
                    <View style={styles.createFormRow}>
                      <Text style={styles.createFormLabel}>{t('calendar.templates.startTime')}</Text>
                      <TextInput
                        style={styles.createFormTimeInput}
                        value={createFormData.startTime}
                        onChangeText={(startTime) => setCreateFormData(prev => ({ ...prev, startTime }))}
                        placeholder="08:00"
                        placeholderTextColor={colors.text.tertiary}
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                    <View style={styles.createFormRow}>
                      <Text style={styles.createFormLabel}>{t('calendar.templates.duration')}</Text>
                      <View style={styles.createFormDurationInputs}>
                        <TextInput
                          style={styles.createFormSmallInput}
                          value={String(createFormData.durationHours)}
                          onChangeText={(h) => setCreateFormData(prev => ({ ...prev, durationHours: parseInt(h) || 0 }))}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                        <Text style={styles.createFormDurationLabel}>h</Text>
                        <TextInput
                          style={styles.createFormSmallInput}
                          value={String(createFormData.durationMinutes)}
                          onChangeText={(m) => setCreateFormData(prev => ({ ...prev, durationMinutes: parseInt(m) || 0 }))}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                        <Text style={styles.createFormDurationLabel}>m</Text>
                      </View>
                    </View>
                    <View style={styles.createFormActions}>
                      <Pressable style={styles.createFormCancelBtn} onPress={() => setShowCreateForm(false)}>
                        <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                      </Pressable>
                      <Pressable style={styles.createFormSubmitBtn} onPress={handleCreateAndPlace}>
                        <Text style={styles.createFormSubmitText}>
                          {t('calendar.templates.createAndAdd')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Absences list - sorted with last-used at top */}
            {pickerTab === 'absences' && (
              <>
                {Object.values(state.absenceTemplates).length === 0 && !showCreateAbsenceForm ? (
                  <Text style={styles.templatePickerEmpty}>{t('calendar.absences.empty')}</Text>
                ) : (
                  [...Object.values(state.absenceTemplates)]
                    .sort((a, b) => {
                      // Last-used template goes first
                      if (a.id === state.lastUsedAbsenceTemplateId) return -1;
                      if (b.id === state.lastUsedAbsenceTemplateId) return 1;
                      return 0;
                    })
                    .map(template => {
                      const isVacation = template.type === 'vacation';
                      const IconComponent = isVacation ? TreePalm : Thermometer;
                      const iconColor = isVacation ? '#6B7280' : '#92400E';
                      const isLastUsed = template.id === state.lastUsedAbsenceTemplateId;
                      return (
                        <Pressable
                          key={template.id}
                          style={styles.templatePickerRow}
                          onPress={() => handleAbsenceTemplateSelected(template.id)}
                        >
                          {isLastUsed && (
                            <Star size={14} color={colors.primary[500]} fill={colors.primary[500]} style={{ marginRight: spacing.xs }} />
                          )}
                          <View style={[styles.templatePickerIconWrapper, { backgroundColor: template.color }]}>
                            <IconComponent size={14} color={iconColor} />
                          </View>
                          <View style={styles.templatePickerInfo}>
                            <Text style={styles.templatePickerName}>{template.name}</Text>
                            <Text style={styles.templatePickerTime}>
                              {template.isFullDay
                                ? t('calendar.absences.fullDay')
                                : `${template.startTime} - ${template.endTime}`}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                )}

                {/* Create new absence option */}
                {!showCreateAbsenceForm ? (
                  <>
                    <Pressable style={styles.templatePickerCreateRow} onPress={openCreateAbsenceForm}>
                      <View style={styles.templatePickerCreateIcon}>
                        <Plus size={16} color={colors.primary[500]} />
                      </View>
                      <Text style={styles.templatePickerCreateText}>
                        {t('calendar.absences.createNew')}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.templatePickerManageRow} onPress={() => openTemplatePanel('absences')}>
                      <Settings size={16} color={colors.text.tertiary} />
                      <Text style={styles.templatePickerManageText}>
                        {t('calendar.absences.manage')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  /* Inline create absence form */
                  <View style={styles.createForm}>
                    <TextInput
                      style={styles.createFormInput}
                      value={createAbsenceFormData.name}
                      onChangeText={(name) => setCreateAbsenceFormData(prev => ({ ...prev, name }))}
                      placeholder={t('calendar.absences.namePlaceholder')}
                      placeholderTextColor={colors.text.tertiary}
                      autoFocus
                    />
                    <View style={styles.createFormRow}>
                      <Text style={styles.createFormLabel}>{t('calendar.absences.typeLabel')}</Text>
                      <View style={styles.createFormTypeButtons}>
                        <Pressable
                          style={[
                            styles.createFormTypeBtn,
                            createAbsenceFormData.type === 'vacation' && styles.createFormTypeBtnActive,
                          ]}
                          onPress={() => setCreateAbsenceFormData(prev => ({ ...prev, type: 'vacation' }))}
                        >
                          <TreePalm size={14} color={createAbsenceFormData.type === 'vacation' ? colors.primary[500] : colors.text.secondary} />
                          <Text style={[
                            styles.createFormTypeBtnText,
                            createAbsenceFormData.type === 'vacation' && styles.createFormTypeBtnTextActive,
                          ]}>{t('calendar.absences.vacation')}</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.createFormTypeBtn,
                            createAbsenceFormData.type === 'sick' && styles.createFormTypeBtnActive,
                          ]}
                          onPress={() => setCreateAbsenceFormData(prev => ({ ...prev, type: 'sick' }))}
                        >
                          <Thermometer size={14} color={createAbsenceFormData.type === 'sick' ? colors.primary[500] : colors.text.secondary} />
                          <Text style={[
                            styles.createFormTypeBtnText,
                            createAbsenceFormData.type === 'sick' && styles.createFormTypeBtnTextActive,
                          ]}>{t('calendar.absences.sick')}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.createFormRow}>
                      <Text style={styles.createFormLabel}>{t('calendar.absences.fullDay')}</Text>
                      <Pressable
                        style={[styles.createFormToggle, createAbsenceFormData.isFullDay && styles.createFormToggleActive]}
                        onPress={() => setCreateAbsenceFormData(prev => ({ ...prev, isFullDay: !prev.isFullDay }))}
                      >
                        <View style={[styles.createFormToggleThumb, createAbsenceFormData.isFullDay && styles.createFormToggleThumbActive]} />
                      </Pressable>
                    </View>
                    {!createAbsenceFormData.isFullDay && (
                      <>
                        <View style={styles.createFormRow}>
                          <Text style={styles.createFormLabel}>{t('calendar.absences.startTime')}</Text>
                          <TextInput
                            style={styles.createFormTimeInput}
                            value={createAbsenceFormData.startTime}
                            onChangeText={(startTime) => setCreateAbsenceFormData(prev => ({ ...prev, startTime }))}
                            placeholder="08:00"
                            placeholderTextColor={colors.text.tertiary}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.createFormRow}>
                          <Text style={styles.createFormLabel}>{t('calendar.absences.endTime')}</Text>
                          <TextInput
                            style={styles.createFormTimeInput}
                            value={createAbsenceFormData.endTime}
                            onChangeText={(endTime) => setCreateAbsenceFormData(prev => ({ ...prev, endTime }))}
                            placeholder="17:00"
                            placeholderTextColor={colors.text.tertiary}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </>
                    )}
                    <View style={styles.createFormActions}>
                      <Pressable style={styles.createFormCancelBtn} onPress={() => setShowCreateAbsenceForm(false)}>
                        <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                      </Pressable>
                      <Pressable style={styles.createFormSubmitBtn} onPress={handleCreateAbsenceAndPlace}>
                        <Text style={styles.createFormSubmitText}>
                          {t('calendar.absences.createAndAdd')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            <Pressable style={styles.templatePickerCancel} onPress={dismissTemplatePicker}>
              <Text style={styles.templatePickerCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Batch mode indicator - shows when a template is armed */}
      {(armedTemplate || armedAbsenceTemplate) && !showTemplatePicker && (
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
              {t('calendar.batch.doubleTapHint')}
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

      {confirmationMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{confirmationMessage}</Text>
        </View>
      )}
    </View>
  </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  timeColumnHeader: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
  },
  dayHeader: {
    width: 120,
    paddingVertical: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    alignItems: 'center',
  },
  dayName: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  dayNumber: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  dayNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.grey[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBadgeNeedsReview: {
    backgroundColor: colors.error.light,
  },
  reviewBadgeConfirmed: {
    backgroundColor: colors.primary[50],
  },
  reviewBadgeText: {
    fontSize: 11,
    color: colors.text.primary,
  },
  confirmButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error.light,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.grey[200],
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 10,
    color: colors.error.dark,
    fontWeight: fontWeight.semibold,
  },
  confirmButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  // Compact styles for low zoom levels
  dayNumberCompact: {
    fontSize: fontSize.sm,
  },
  reviewBadgeCompact: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  reviewBadgeTextCompact: {
    fontSize: 9,
  },
  confirmButtonCompact: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  confirmButtonTextCompact: {
    fontSize: 9,
  },
  gridScroll: {
    // maxHeight is set dynamically based on zoom level
  },
  gridRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    backgroundColor: colors.grey[50],
  },
  timeCell: {
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  timeCellText: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  dayColumn: {
    width: 120,
    borderRightWidth: 1,
    borderRightColor: colors.grey[100],
    position: 'relative',
  },
  hourCell: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grey[100],
  },
  shiftBlock: {
    position: 'absolute',
    left: 6,
    right: 6,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  shiftName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  shiftTime: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  shiftBlockDimmed: {
    // Reduced dimming since absences are now semi-transparent
    // Shifts remain clearly visible underneath absence overlay
    opacity: 0.85,
  },
  textDimmed: {
    opacity: 0.85,
  },
  // Absence styles
  absenceBlock: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  absenceBlockActive: {
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  absenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  absenceName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    flex: 1,
  },
  absenceTime: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  trackingBlock: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(211, 47, 47, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.5)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackingBlockShort: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
  },
  shortSessionText: {
    fontStyle: 'italic',
  },
  shortSessionIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 3,
    padding: 2,
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
    backgroundColor: colors.error.dark,
  },
  trackingDurationContainer: {
    alignItems: 'center',
  },
  trackingDurationText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.error.dark,
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
    borderRadius: borderRadius.md,
    backgroundColor: colors.error.dark,
  },
  edgeLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.error.dark,
  },
  edgeLabelTop: {
    top: -EDGE_LABEL_OFFSET,
  },
  edgeLabelBottom: {
    bottom: -EDGE_LABEL_OFFSET,
  },
  breakPanel: {
    position: 'absolute',
    left: '105%',
    top: 0,
    width: 100,
    backgroundColor: colors.background.paper,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.md,
    zIndex: 300,
  },
  breakTitle: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  breakOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.grey[50],
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  breakOptionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  breakDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  breakTotal: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  breakClearBtn: {
    paddingVertical: 5,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error.main,
    alignItems: 'center',
    marginTop: 2,
  },
  breakClearText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.error.main,
  },
  toast: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.xl,
    right: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    ...shadows.md,
  },
  toastText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
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
    marginLeft: spacing.xs,
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
  },
  // Time picker styles (iOS)
  timePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  timePickerContainer: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  timePickerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  timePickerCancel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  timePickerDone: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },
  // Template picker styles
  templatePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templatePickerContainer: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 280,
    maxWidth: '85%',
  },
  templatePickerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  templatePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  templatePickerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  templatePickerInfo: {
    flex: 1,
  },
  templatePickerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  templatePickerTime: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  templatePickerCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  templatePickerCancelText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    textAlign: 'center',
  },
  templatePickerEmpty: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  templatePickerIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  // Create new option styles
  templatePickerCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  templatePickerCreateIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  templatePickerCreateText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  templatePickerManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  templatePickerManageText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  // Inline create form styles
  createForm: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  createFormInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  createFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  createFormLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  createFormTimeInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    width: 70,
    textAlign: 'center',
  },
  createFormDurationInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createFormSmallInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    width: 45,
    textAlign: 'center',
  },
  createFormDurationLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginHorizontal: spacing.xs,
  },
  createFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  createFormCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  createFormCancelText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  createFormSubmitBtn: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  createFormSubmitText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.medium,
  },
  // Absence form specific styles
  createFormTypeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  createFormTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  createFormTypeBtnActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  createFormTypeBtnText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  createFormTypeBtnTextActive: {
    color: colors.primary[500],
  },
  createFormToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.grey[300],
    padding: 2,
    justifyContent: 'center',
  },
  createFormToggleActive: {
    backgroundColor: colors.primary[500],
  },
  createFormToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  createFormToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  // Batch mode indicator styles
  batchIndicator: {
    position: 'absolute',
    bottom: 90, // Above FAB
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.md,
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
  // Picker tab bar styles
  pickerTabBar: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.grey[100],
    padding: 2,
  },
  pickerTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md - 2,
  },
  pickerTabActive: {
    backgroundColor: colors.background.paper,
    ...shadows.sm,
  },
  pickerTabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  pickerTabTextActive: {
    color: colors.primary[500],
  },
});
