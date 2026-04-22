import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronDown, Clock, MapPin, Calendar } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { trackingEvents } from '@/lib/events/trackingEvents';
import type { UserLocation } from '@/modules/geofencing/types';
import { isTestMode } from '@/lib/testing/mockApi';

interface Props {
  visible: boolean;
  defaultDate?: string; // YYYY-MM-DD format, pre-filled when coming from long-press
  onClose: () => void;
}

type PickerMode = 'date' | 'startTime' | 'endTime' | null;

export default function ManualSessionForm({ visible, defaultDate, onClose }: Props) {
  // Animation
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // TEST_MODE: Skip animation for instant E2E test interaction
    if (isTestMode()) {
      animValue.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(animValue, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Android back button
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  // Form state
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(16, 0, 0, 0);
    return d;
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  // For iOS: track which picker value we're editing
  const [tempPickerValue, setTempPickerValue] = useState<Date | null>(null);

  // Refs mirroring form state — used by openPicker to avoid nested state setters
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const startTimeRef = useRef(startTime);
  startTimeRef.current = startTime;
  const endTimeRef = useRef(endTime);
  endTimeRef.current = endTime;

  // Load locations on mount
  useEffect(() => {
    if (visible) {
      loadLocations();
      // Set default date if provided
      if (defaultDate) {
        const [year, month, day] = defaultDate.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, day));
      } else {
        setSelectedDate(new Date());
      }
      setError(null);
    }
  }, [visible, defaultDate]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const locs = await db.getActiveLocations();
      setLocations(locs);
      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locs[0].id);
      }
    } catch (err) {
      console.error('[ManualSessionForm] Failed to load locations:', err);
      setError(t('manualSession.errorNoLocation'));
    } finally {
      setLoading(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  // Compute duration
  const durationMinutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60));
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;
  const durationText =
    durationMinutes > 0
      ? `${durationHours}h ${durationMins}m`
      : t('manualSession.errorTimes');

  // Validate
  const isValidTimes = endTime.getTime() > startTime.getTime();
  const isNotFuture = (() => {
    const now = new Date();
    const sessionEnd = new Date(selectedDate);
    sessionEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    return sessionEnd <= now;
  })();
  const canSave = selectedLocationId && isValidTimes && isNotFuture && !saving;

  const handleSave = async () => {
    if (!selectedLocationId) return;

    setSaving(true);
    setError(null);

    try {
      // Build ISO timestamps
      const clockIn = new Date(selectedDate);
      clockIn.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

      const clockOut = new Date(selectedDate);
      clockOut.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

      const db = await getDatabase();
      await db.createManualSession(selectedLocationId, clockIn.toISOString(), clockOut.toISOString());

      // Emit event to refresh calendar
      trackingEvents.emit('tracking-changed');

      onClose();
    } catch (err: any) {
      console.error('[ManualSessionForm] Save failed:', err);
      // Use the error message from database validation if available
      if (err.message?.includes('Overlaps')) {
        setError(t('manualSession.errorOverlap'));
      } else if (err.message?.includes('End time')) {
        setError(t('manualSession.errorTimes'));
      } else {
        setError(err.message || t('common.error'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Date/Time picker handlers (stable callbacks via useCallback)
  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode(null);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
      }
    } else {
      if (date) setTempPickerValue(date);
    }
  }, []);

  const handleTimeChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode((currentMode) => {
        if (event.type === 'set' && date) {
          if (currentMode === 'startTime') setStartTime(date);
          else if (currentMode === 'endTime') setEndTime(date);
        }
        return null;
      });
    } else {
      if (date) setTempPickerValue(date);
    }
  }, []);

  const confirmIOSPicker = useCallback(() => {
    setTempPickerValue((tempVal) => {
      if (tempVal) {
        setPickerMode((currentMode) => {
          if (currentMode === 'date') setSelectedDate(tempVal);
          else if (currentMode === 'startTime') setStartTime(tempVal);
          else if (currentMode === 'endTime') setEndTime(tempVal);
          return null;
        });
      } else {
        setPickerMode(null);
      }
      return null;
    });
  }, []);

  const cancelIOSPicker = useCallback(() => {
    setTempPickerValue(null);
    setPickerMode(null);
  }, []);

  const openPicker = useCallback((mode: PickerMode) => {
    setPickerMode(mode);
    if (mode === 'date') setTempPickerValue(selectedDateRef.current);
    else if (mode === 'startTime') setTempPickerValue(startTimeRef.current);
    else if (mode === 'endTime') setTempPickerValue(endTimeRef.current);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Slide up from bottom
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  // KeyboardAvoidingView: iOS uses 'padding', Android uses 'height'
  // (Android 'height' tested working on SDK 54/RN 0.81.5/Fabric)
  const wrapperProps = Platform.OS === 'ios'
    ? { behavior: 'padding' as const, style: styles.flexWrapper }
    : { behavior: 'height' as const, style: styles.flexWrapper };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
    >
      <KeyboardAvoidingView {...wrapperProps}>
        {/* Overlay */}
        <TouchableWithoutFeedback accessible={false} onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: animValue }]} />
        </TouchableWithoutFeedback>

        {/* Panel */}
        <Animated.View style={[styles.panelWrapper, { transform: [{ translateY }] }]}>
          <TouchableWithoutFeedback accessible={false} onPress={() => {}}>
            <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('manualSession.title')}</Text>
              <TouchableOpacity testID="manual-session-cancel" onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
              </View>
            ) : locations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MapPin size={48} color={colors.grey[400]} />
                <Text style={styles.emptyText}>{t('manualSession.errorNoLocation')}</Text>
              </View>
            ) : (
              <ScrollView accessible={false} style={styles.form} showsVerticalScrollIndicator={false}>
                {/* Location Selector */}
                <Text style={styles.label}>{t('manualSession.location')}</Text>
                <TouchableOpacity
                  testID="manual-session-location"
                  style={styles.selector}
                  onPress={() => setShowLocationPicker(!showLocationPicker)}
                >
                  <MapPin size={20} color={colors.text.secondary} />
                  <Text style={styles.selectorText}>
                    {selectedLocation?.name || t('manualSession.selectLocation')}
                  </Text>
                  <ChevronDown size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                {/* Location Dropdown */}
                {showLocationPicker && (
                  <View style={styles.dropdown}>
                    {locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          styles.dropdownItem,
                          loc.id === selectedLocationId && styles.dropdownItemActive,
                        ]}
                        onPress={() => {
                          setSelectedLocationId(loc.id);
                          setShowLocationPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            loc.id === selectedLocationId && styles.dropdownItemTextActive,
                          ]}
                        >
                          {loc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Date Selector */}
                <Text style={styles.label}>{t('manualSession.date')}</Text>
                <TouchableOpacity testID="manual-session-date" style={styles.selector} onPress={() => openPicker('date')}>
                  <Calendar size={20} color={colors.text.secondary} />
                  <Text style={styles.selectorText}>{formatDate(selectedDate)}</Text>
                  <ChevronDown size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                {/* Time Selectors */}
                <View style={styles.timeRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.label}>{t('manualSession.start')}</Text>
                    <TouchableOpacity testID="manual-session-start" style={styles.selector} onPress={() => openPicker('startTime')}>
                      <Clock size={20} color={colors.text.secondary} />
                      <Text style={styles.selectorText}>{formatTime(startTime)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeColumn}>
                    <Text style={styles.label}>{t('manualSession.end')}</Text>
                    <TouchableOpacity testID="manual-session-end" style={styles.selector} onPress={() => openPicker('endTime')}>
                      <Clock size={20} color={colors.text.secondary} />
                      <Text style={styles.selectorText}>{formatTime(endTime)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Duration Display */}
                <View style={styles.durationContainer}>
                  <Text style={styles.durationLabel}>{t('manualSession.duration')}</Text>
                  <Text style={[styles.durationValue, !isValidTimes && styles.durationError]}>
                    {durationText}
                  </Text>
                </View>

                {/* Validation Errors */}
                {error && <Text style={styles.error}>{error}</Text>}
                {!isNotFuture && !error && (
                  <Text style={styles.error}>{t('manualSession.errorFuture')}</Text>
                )}
              </ScrollView>
            )}

            {/* Actions */}
            {!loading && locations.length > 0 && (
              <View style={styles.actions}>
                <TouchableOpacity
                  testID="manual-session-save"
                  style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveText}>{t('manualSession.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* iOS Date/Time Picker — on top of everything */}
      {/* Separate picker blocks for date vs time to prevent maximumDate leaking
          from the date picker into the time picker (causes grayed-out hours). */}
      {pickerMode && Platform.OS === 'ios' && (
        <View style={styles.pickerOverlay}>
          <TouchableWithoutFeedback onPress={cancelIOSPicker}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={cancelIOSPicker}>
                <Text style={styles.pickerCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmIOSPicker}>
                <Text style={styles.pickerDone}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
            {pickerMode === 'date' && (
              <DateTimePicker
                key="ios-date-picker"
                value={tempPickerValue || selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
            {pickerMode === 'startTime' && (
              <DateTimePicker
                key="ios-start-picker"
                value={tempPickerValue || startTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                minuteInterval={5}
              />
            )}
            {pickerMode === 'endTime' && (
              <DateTimePicker
                key="ios-end-picker"
                value={tempPickerValue || endTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                minuteInterval={5}
              />
            )}
          </View>
        </View>
      )}

      {/* Android pickers render inline */}
      {pickerMode === 'date' && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
      {(pickerMode === 'startTime' || pickerMode === 'endTime') && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerMode === 'startTime' ? startTime : endTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
          minuteInterval={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flexWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panelWrapper: {
    maxHeight: '80%',
  },
  card: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  form: {
    padding: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey[50],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  dropdown: {
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dropdownItemActive: {
    backgroundColor: colors.primary[50],
  },
  dropdownItemText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  dropdownItemTextActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.medium,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeColumn: {
    flex: 1,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  durationLabel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  durationValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  durationError: {
    color: colors.error.main,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error.main,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  actions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  saveButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.grey[300],
  },
  saveText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  // iOS picker
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerCancel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  pickerDone: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },
});
