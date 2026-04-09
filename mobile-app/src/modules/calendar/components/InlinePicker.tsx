import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { AppTextInput as TextInput } from '@/components/ui/AppTextInput';
import { format } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t, getDateLocale } from '@/lib/i18n';
import { useCalendar } from '@/lib/calendar/calendar-context';
import {
  formatDuration,
  getColorPalette,
  findOverlappingShift,
} from '@/lib/calendar/calendar-utils';
import type { ShiftTemplate, ShiftColor, AbsenceTemplate, AbsenceInstance } from '@/lib/calendar/types';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { TreePalm, Thermometer, Clock, Plus, Pencil } from 'lucide-react-native';

interface InlinePickerProps {
  visible: boolean;
  targetDate: string | null;  // YYYY-MM-DD or null for arming mode
  onClose: () => void;
}

// Available colors for shift templates
const SHIFT_COLORS: ShiftColor[] = ['teal', 'blue', 'indigo', 'amber', 'purple'];

export default function InlinePicker({ visible, targetDate, onClose }: InlinePickerProps) {
  const { state, dispatch } = useCalendar();

  // Local tab state (synced from global state)
  const [pickerTab, setPickerTab] = useState<'shifts' | 'absences' | 'gps'>(state.inlinePickerTab);

  // Sync local tab state when global state changes (e.g., FAB opens with specific tab)
  useEffect(() => {
    setPickerTab(state.inlinePickerTab);
  }, [state.inlinePickerTab]);

  // Create new shift form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    startTime: '08:00',
    durationHours: 8,
    durationMinutes: 0,
    color: 'teal' as ShiftColor,
  });

  // Edit shift template state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    startTime: '08:00',
    durationHours: 8,
    durationMinutes: 0,
    color: 'teal' as ShiftColor,
    breakMinutes: 0,
  });

  // Edit absence template state
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [editAbsenceFormData, setEditAbsenceFormData] = useState({
    name: '',
    type: 'vacation' as 'vacation' | 'sick',
    isFullDay: true,
    startTime: '08:00',
    endTime: '17:00',
  });

  // Create new absence form state
  const [showCreateAbsenceForm, setShowCreateAbsenceForm] = useState(false);
  const [createAbsenceFormData, setCreateAbsenceFormData] = useState({
    name: '',
    type: 'vacation' as 'vacation' | 'sick',
    isFullDay: true,
    startTime: '08:00',
    endTime: '17:00',
  });

  // Pick next unused color for new template
  const getNextAvailableColor = (): ShiftColor => {
    const usedColors = new Set(Object.values(state.templates).map(t => t.color));
    return SHIFT_COLORS.find(c => !usedColors.has(c)) || SHIFT_COLORS[0];
  };

  // Format target date for display
  const targetDateDisplay = useMemo(() => {
    if (!targetDate) return null;
    try {
      const date = new Date(targetDate + 'T12:00:00');
      const locale = getDateLocale() === 'de' ? deLocale : undefined;
      return format(date, 'EEE, MMM d', { locale });
    } catch {
      return targetDate;
    }
  }, [targetDate]);

  // Reset forms and close
  const handleClose = () => {
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
    setEditingTemplateId(null);
    setEditingAbsenceId(null);
    onClose();
  };

  // Start editing a shift template
  const startEditTemplate = (template: ShiftTemplate) => {
    setEditingTemplateId(template.id);
    setEditFormData({
      name: template.name,
      startTime: template.startTime,
      durationHours: Math.floor(template.duration / 60),
      durationMinutes: template.duration % 60,
      color: template.color,
      breakMinutes: template.breakMinutes || 0,
    });
    // Close create form if open
    setShowCreateForm(false);
  };

  // Save edited shift template
  const handleSaveEditTemplate = async () => {
    if (!editingTemplateId) return;
    const template = state.templates[editingTemplateId];
    if (!template) return;

    const duration = editFormData.durationHours * 60 + editFormData.durationMinutes;
    const updatedTemplate = {
      ...template,
      name: editFormData.name.trim() || t('calendar.templates.newShift'),
      startTime: editFormData.startTime,
      duration,
      color: editFormData.color,
      breakMinutes: editFormData.breakMinutes,
    };

    try {
      const storage = await getCalendarStorage();
      await storage.saveShiftTemplate(updatedTemplate);
      dispatch({ type: 'UPDATE_TEMPLATE', id: editingTemplateId, template: updatedTemplate });
      setEditingTemplateId(null);
    } catch (error) {
      console.error('[InlinePicker] Failed to save template:', error);
      Alert.alert(t('common.error'), t('calendar.templates.saveError'));
    }
  };

  // Delete shift template
  const handleDeleteTemplate = () => {
    if (!editingTemplateId) return;

    Alert.alert(
      t('calendar.templates.deleteTitle'),
      t('calendar.templates.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_TEMPLATE', id: editingTemplateId });
            setEditingTemplateId(null);
          },
        },
      ]
    );
  };

  // Start editing an absence template
  const startEditAbsence = (template: AbsenceTemplate) => {
    setEditingAbsenceId(template.id);
    setEditAbsenceFormData({
      name: template.name,
      type: template.type,
      isFullDay: template.isFullDay,
      startTime: template.startTime || '08:00',
      endTime: template.endTime || '17:00',
    });
    setShowCreateAbsenceForm(false);
  };

  // Save edited absence template
  const handleSaveEditAbsence = async () => {
    if (!editingAbsenceId) return;
    const template = state.absenceTemplates[editingAbsenceId];
    if (!template) return;

    const updatedTemplate: AbsenceTemplate = {
      ...template,
      name: editAbsenceFormData.name.trim() || t('calendar.absences.newAbsence'),
      type: editAbsenceFormData.type,
      isFullDay: editAbsenceFormData.isFullDay,
      startTime: editAbsenceFormData.isFullDay ? null : editAbsenceFormData.startTime,
      endTime: editAbsenceFormData.isFullDay ? null : editAbsenceFormData.endTime,
      color: editAbsenceFormData.type === 'vacation' ? '#D1D5DB' : '#FED7AA',
    };

    try {
      const storage = await getCalendarStorage();
      await storage.updateAbsenceTemplate(editingAbsenceId, updatedTemplate);
      dispatch({ type: 'UPDATE_ABSENCE_TEMPLATE', id: editingAbsenceId, updates: updatedTemplate });
      setEditingAbsenceId(null);
    } catch (error) {
      console.error('[InlinePicker] Failed to save absence template:', error);
      Alert.alert(t('common.error'), t('calendar.absences.saveError'));
    }
  };

  // Delete absence template
  const handleDeleteAbsence = () => {
    if (!editingAbsenceId) return;

    Alert.alert(
      t('calendar.absences.deleteTitle'),
      t('calendar.absences.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_ABSENCE_TEMPLATE', id: editingAbsenceId });
            setEditingAbsenceId(null);
          },
        },
      ]
    );
  };

  // Template selected from picker
  const handleTemplateSelected = (templateId: string) => {
    const template = state.templates[templateId];
    if (!template) {
      handleClose();
      return;
    }

    if (targetDate) {
      // Direct placement mode - place immediately on targetDate
      const overlap = findOverlappingShift(
        targetDate,
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
        date: targetDate,
        timeSlot: template.startTime,
      });

      // Track as last used and disarm
      dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId });
      dispatch({ type: 'DISARM_SHIFT' });
    } else {
      // Arming mode - arm template for double-tap placement
      dispatch({ type: 'ARM_SHIFT', templateId });
      dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId });
    }

    handleClose();
  };

  // Absence template selected from picker
  const handleAbsenceTemplateSelected = async (templateId: string) => {
    const absenceTemplate = state.absenceTemplates[templateId];
    if (!absenceTemplate) {
      handleClose();
      return;
    }

    if (targetDate) {
      // Direct placement mode - create instance immediately
      const startTime = absenceTemplate.isFullDay ? '00:00' : (absenceTemplate.startTime || '00:00');
      const endTime = absenceTemplate.isFullDay ? '23:59' : (absenceTemplate.endTime || '23:59');

      const newInstance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'> = {
        templateId: absenceTemplate.id,
        type: absenceTemplate.type,
        date: targetDate,
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
        dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId });
      } catch (error) {
        console.error('[InlinePicker] Failed to create absence instance:', error);
      }
    } else {
      // Arming mode - arm template for double-tap placement
      dispatch({ type: 'ARM_ABSENCE', templateId });
      dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId });
    }

    handleClose();
  };


  // Open create form with auto-picked color
  const openCreateForm = () => {
    setCreateFormData(prev => ({ ...prev, color: getNextAvailableColor() }));
    setShowCreateForm(true);
  };

  // Handle creating a new shift template and optionally placing it
  const handleCreateAndPlace = async () => {
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

      // Add to state
      dispatch({ type: 'ADD_TEMPLATE', template: newTemplate });

      if (targetDate) {
        // Direct placement mode - arm and place
        dispatch({ type: 'ARM_SHIFT', templateId: newTemplate.id });

        const overlap = findOverlappingShift(
          targetDate,
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
          handleClose();
          return;
        }

        // Place the shift
        dispatch({
          type: 'PLACE_SHIFT',
          date: targetDate,
          timeSlot: newTemplate.startTime,
        });

        dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId: newTemplate.id });
        dispatch({ type: 'DISARM_SHIFT' });
      } else {
        // Arming mode - arm the new template
        dispatch({ type: 'ARM_SHIFT', templateId: newTemplate.id });
        dispatch({ type: 'SET_LAST_USED_TEMPLATE', templateId: newTemplate.id });
      }

      handleClose();
    } catch (error) {
      console.error('[InlinePicker] Failed to create template:', error);
      Alert.alert(t('common.error'), t('calendar.templates.createError'));
    }
  };

  // Handle creating a new absence template and optionally placing it
  const handleCreateAbsenceAndPlace = async () => {
    const name = createAbsenceFormData.name.trim() || t('calendar.absences.newAbsence');

    const newAbsenceTemplate: Omit<AbsenceTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      type: createAbsenceFormData.type,
      name,
      color: createAbsenceFormData.type === 'vacation' ? '#D1D5DB' : '#FED7AA',
      isFullDay: createAbsenceFormData.isFullDay,
      startTime: createAbsenceFormData.isFullDay ? null : createAbsenceFormData.startTime,
      endTime: createAbsenceFormData.isFullDay ? null : createAbsenceFormData.endTime,
    };

    try {
      const storage = await getCalendarStorage();
      const savedTemplate = await storage.createAbsenceTemplate(newAbsenceTemplate);

      dispatch({ type: 'ADD_ABSENCE_TEMPLATE', template: savedTemplate });

      if (targetDate) {
        // Direct placement mode - create instance
        const startTime = savedTemplate.isFullDay ? '00:00' : (savedTemplate.startTime || '00:00');
        const endTime = savedTemplate.isFullDay ? '23:59' : (savedTemplate.endTime || '23:59');

        const newInstance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'> = {
          templateId: savedTemplate.id,
          type: savedTemplate.type,
          date: targetDate,
          startTime,
          endTime,
          isFullDay: savedTemplate.isFullDay,
          name: savedTemplate.name,
          color: savedTemplate.color,
        };

        const createdInstance = await storage.createAbsenceInstance(newInstance);
        dispatch({ type: 'ADD_ABSENCE_INSTANCE', instance: createdInstance });
        dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId: savedTemplate.id });
      } else {
        // Arming mode - arm the new template
        dispatch({ type: 'ARM_ABSENCE', templateId: savedTemplate.id });
        dispatch({ type: 'SET_LAST_USED_ABSENCE_TEMPLATE', templateId: savedTemplate.id });
      }

      handleClose();
    } catch (error) {
      console.error('[InlinePicker] Failed to create absence template:', error);
      Alert.alert(t('common.error'), t('calendar.absences.createError'));
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'shifts' | 'absences' | 'gps') => {
    setPickerTab(tab);
    dispatch({ type: 'SET_INLINE_PICKER_TAB', tab });
  };

  // Handle GPS log hours button
  const handleLogHours = () => {
    handleClose();
    dispatch({ type: 'OPEN_MANUAL_SESSION_FORM', date: targetDate ?? undefined });
  };

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={handleClose} testID="template-panel-overlay" accessible={false}>
      <Pressable style={styles.container} onPress={(e) => e.stopPropagation()} testID="inline-picker-container" accessible={false}>
        {/* Header with optional target date */}
        <View style={styles.header} accessible={false}>
          <Text style={styles.title}>{t('calendar.templates.selectTemplate')}</Text>
          {targetDateDisplay && (
            <Text style={styles.targetDate} testID="inline-picker-target-date">
              {t('calendar.picker.addTo', { date: targetDateDisplay })}
            </Text>
          )}
        </View>

        {/* Tab bar for Shifts / Absences / GPS */}
        <View style={styles.tabBar} accessible={false}>
          <Pressable
            style={[styles.tab, pickerTab === 'shifts' && styles.tabActive]}
            onPress={() => handleTabChange('shifts')}
            testID="inline-picker-tab-shifts"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, pickerTab === 'shifts' && styles.tabTextActive]}>
              {t('calendar.templates.shiftsTab')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, pickerTab === 'absences' && styles.tabActive]}
            onPress={() => handleTabChange('absences')}
            testID="inline-picker-tab-absences"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, pickerTab === 'absences' && styles.tabTextActive]}>
              {t('calendar.templates.absencesTab')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, pickerTab === 'gps' && styles.tabActive]}
            onPress={() => handleTabChange('gps')}
            testID="inline-picker-tab-gps"
            accessible={true}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, pickerTab === 'gps' && styles.tabTextActive]}>
              {t('calendar.templates.gpsTab')}
            </Text>
          </Pressable>
        </View>

        {/* Shifts list */}
        {pickerTab === 'shifts' && (
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false} accessible={false}>
            {Object.values(state.templates).length === 0 && !showCreateForm && !editingTemplateId ? (
              <Text style={styles.emptyText}>{t('calendar.templates.empty')}</Text>
            ) : (
              [...Object.values(state.templates)]
                .sort((a, b) => {
                  // Last-used template goes first
                  if (a.id === state.lastUsedTemplateId) return -1;
                  if (b.id === state.lastUsedTemplateId) return 1;
                  return 0;
                })
                .map((template, index) => {
                  const palette = getColorPalette(template.color);
                  const isEditing = editingTemplateId === template.id;

                  // Show inline edit form for this template
                  if (isEditing) {
                    return (
                      <View key={template.id} style={styles.editForm} accessible={false}>
                        <TextInput
                          style={styles.createFormInput}
                          value={editFormData.name}
                          onChangeText={(name) => setEditFormData(prev => ({ ...prev, name }))}
                          placeholder={t('calendar.templates.namePlaceholder')}
                          placeholderTextColor={colors.text.tertiary}
                          autoFocus
                          testID="template-edit-name-input"
                        />
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.templates.startTime')}</Text>
                          <TextInput
                            style={styles.createFormTimeInput}
                            value={editFormData.startTime}
                            onChangeText={(startTime) => setEditFormData(prev => ({ ...prev, startTime }))}
                            placeholder="08:00"
                            placeholderTextColor={colors.text.tertiary}
                            keyboardType="numbers-and-punctuation"
                            testID="template-edit-start-time-input"
                          />
                        </View>
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.templates.duration')}</Text>
                          <View style={styles.createFormDurationInputs} accessible={false}>
                            <TextInput
                              style={styles.createFormSmallInput}
                              value={String(editFormData.durationHours)}
                              onChangeText={(h) => setEditFormData(prev => ({ ...prev, durationHours: parseInt(h) || 0 }))}
                              keyboardType="number-pad"
                              maxLength={2}
                              testID="template-edit-duration-hours-input"
                            />
                            <Text style={styles.createFormDurationLabel}>h</Text>
                            <TextInput
                              style={styles.createFormSmallInput}
                              value={String(editFormData.durationMinutes)}
                              onChangeText={(m) => setEditFormData(prev => ({ ...prev, durationMinutes: parseInt(m) || 0 }))}
                              keyboardType="number-pad"
                              maxLength={2}
                              testID="template-edit-duration-minutes-input"
                            />
                            <Text style={styles.createFormDurationLabel}>m</Text>
                          </View>
                        </View>
                        {/* Color picker */}
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.templates.color')}</Text>
                          <View style={styles.colorRow} accessible={false}>
                            {SHIFT_COLORS.map((color) => {
                              const paletteColor = getColorPalette(color);
                              const isSelected = editFormData.color === color;
                              return (
                                <Pressable
                                  key={color}
                                  style={[styles.colorDot, { backgroundColor: paletteColor.dot }, isSelected && styles.colorDotSelected]}
                                  onPress={() => setEditFormData(prev => ({ ...prev, color }))}
                                  testID={`template-edit-color-${color}`}
                                  accessible={true}
                                  accessibilityRole="button"
                                />
                              );
                            })}
                          </View>
                        </View>
                        {/* Break duration */}
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.templates.breakDuration')}</Text>
                          <View style={styles.breakRow} accessible={false}>
                            {[0, 15, 30, 45, 60].map((minutes) => (
                              <Pressable
                                key={minutes}
                                style={[styles.breakButton, editFormData.breakMinutes === minutes && styles.breakButtonSelected]}
                                onPress={() => setEditFormData(prev => ({ ...prev, breakMinutes: minutes }))}
                                testID={`template-edit-break-${minutes}`}
                                accessible={true}
                                accessibilityRole="button"
                              >
                                <Text style={[styles.breakButtonText, editFormData.breakMinutes === minutes && styles.breakButtonTextSelected]}>
                                  {minutes}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                        <View style={styles.editFormActions} accessible={false}>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={handleDeleteTemplate}
                            testID="template-delete"
                            accessible={true}
                            accessibilityRole="button"
                          >
                            <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
                          </Pressable>
                          <View style={styles.editFormRightActions}>
                            <Pressable
                              style={styles.createFormCancelBtn}
                              onPress={() => setEditingTemplateId(null)}
                              testID="template-edit-cancel"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                            </Pressable>
                            <Pressable
                              style={styles.createFormSubmitBtn}
                              onPress={handleSaveEditTemplate}
                              testID="template-edit-save"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <Text style={styles.createFormSubmitText}>{t('common.save')}</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  // Regular row with edit button on left
                  return (
                    <View key={template.id} style={styles.row} accessible={false}>
                      <Pressable
                        style={styles.editButtonLeft}
                        onPress={() => startEditTemplate(template)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID={`template-edit-${index}`}
                        accessible={true}
                        accessibilityRole="button"
                      >
                        <Pencil size={16} color={colors.text.tertiary} />
                      </Pressable>
                      <Pressable
                        style={styles.rowContent}
                        onPress={() => handleTemplateSelected(template.id)}
                        testID={`template-row-${index}`}
                        accessible={true}
                        accessibilityRole="button"
                      >
                        <View style={[styles.dot, { backgroundColor: palette.dot }]} />
                        <View style={styles.info}>
                          <Text style={styles.name}>{template.name}</Text>
                          <Text style={styles.time}>
                            {template.startTime} · {formatDuration(template.duration)}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })
            )}

            {/* Create new shift option */}
            {!showCreateForm ? (
              <Pressable
                style={styles.createRow}
                onPress={openCreateForm}
                testID="template-add"
                accessible={true}
                accessibilityRole="button"
              >
                <View style={styles.createIcon}>
                  <Plus size={16} color={colors.primary[500]} />
                </View>
                <Text style={styles.createText}>
                  {t('calendar.templates.createNew')}
                </Text>
              </Pressable>
            ) : (
              /* Inline create form */
              <View style={styles.createForm} accessible={false}>
                <TextInput
                  style={styles.createFormInput}
                  value={createFormData.name}
                  onChangeText={(name) => setCreateFormData(prev => ({ ...prev, name }))}
                  placeholder={t('calendar.templates.namePlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  autoFocus
                  testID="template-name-input"
                />
                <View style={styles.createFormRow} accessible={false}>
                  <Text style={styles.createFormLabel}>{t('calendar.templates.startTime')}</Text>
                  <TextInput
                    style={styles.createFormTimeInput}
                    value={createFormData.startTime}
                    onChangeText={(startTime) => setCreateFormData(prev => ({ ...prev, startTime }))}
                    placeholder="08:00"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="numbers-and-punctuation"
                    testID="template-start-time-input"
                  />
                </View>
                <View style={styles.createFormRow} accessible={false}>
                  <Text style={styles.createFormLabel}>{t('calendar.templates.duration')}</Text>
                  <View style={styles.createFormDurationInputs} accessible={false}>
                    <TextInput
                      style={styles.createFormSmallInput}
                      value={String(createFormData.durationHours)}
                      onChangeText={(h) => setCreateFormData(prev => ({ ...prev, durationHours: parseInt(h) || 0 }))}
                      keyboardType="number-pad"
                      maxLength={2}
                      testID="template-duration-hours-input"
                    />
                    <Text style={styles.createFormDurationLabel}>h</Text>
                    <TextInput
                      style={styles.createFormSmallInput}
                      value={String(createFormData.durationMinutes)}
                      onChangeText={(m) => setCreateFormData(prev => ({ ...prev, durationMinutes: parseInt(m) || 0 }))}
                      keyboardType="number-pad"
                      maxLength={2}
                      testID="template-duration-minutes-input"
                    />
                    <Text style={styles.createFormDurationLabel}>m</Text>
                  </View>
                </View>
                <View style={styles.createFormActions} accessible={false}>
                  <Pressable
                    style={styles.createFormCancelBtn}
                    onPress={() => setShowCreateForm(false)}
                    testID="template-cancel"
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.createFormSubmitBtn}
                    onPress={handleCreateAndPlace}
                    testID="template-save"
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={styles.createFormSubmitText}>
                      {targetDate ? t('calendar.templates.createAndAdd') : t('calendar.templates.createAndArm')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Absences list */}
        {pickerTab === 'absences' && (
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false} accessible={false}>
            {Object.values(state.absenceTemplates).length === 0 && !showCreateAbsenceForm && !editingAbsenceId ? (
              <Text style={styles.emptyText}>{t('calendar.absences.empty')}</Text>
            ) : (
              [...Object.values(state.absenceTemplates)]
                .sort((a, b) => {
                  // Last-used template goes first
                  if (a.id === state.lastUsedAbsenceTemplateId) return -1;
                  if (b.id === state.lastUsedAbsenceTemplateId) return 1;
                  return 0;
                })
                .map((template, index) => {
                  const isVacation = template.type === 'vacation';
                  const IconComponent = isVacation ? TreePalm : Thermometer;
                  const iconColor = isVacation ? '#6B7280' : '#92400E';
                  const isEditing = editingAbsenceId === template.id;

                  // Show inline edit form for this absence template
                  if (isEditing) {
                    return (
                      <View key={template.id} style={styles.editForm} accessible={false}>
                        <TextInput
                          style={styles.createFormInput}
                          value={editAbsenceFormData.name}
                          onChangeText={(name) => setEditAbsenceFormData(prev => ({ ...prev, name }))}
                          placeholder={t('calendar.absences.namePlaceholder')}
                          placeholderTextColor={colors.text.tertiary}
                          autoFocus
                          testID="absence-edit-name-input"
                        />
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.absences.typeLabel')}</Text>
                          <View style={styles.createFormTypeButtons} accessible={false}>
                            <Pressable
                              style={[
                                styles.createFormTypeBtn,
                                editAbsenceFormData.type === 'vacation' && styles.createFormTypeBtnActive,
                              ]}
                              onPress={() => setEditAbsenceFormData(prev => ({ ...prev, type: 'vacation' }))}
                              testID="absence-edit-type-vacation"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <TreePalm size={14} color={editAbsenceFormData.type === 'vacation' ? colors.primary[500] : colors.text.secondary} />
                              <Text style={[
                                styles.createFormTypeBtnText,
                                editAbsenceFormData.type === 'vacation' && styles.createFormTypeBtnTextActive,
                              ]}>{t('calendar.absences.vacation')}</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.createFormTypeBtn,
                                editAbsenceFormData.type === 'sick' && styles.createFormTypeBtnActive,
                              ]}
                              onPress={() => setEditAbsenceFormData(prev => ({ ...prev, type: 'sick' }))}
                              testID="absence-edit-type-sick"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <Thermometer size={14} color={editAbsenceFormData.type === 'sick' ? colors.primary[500] : colors.text.secondary} />
                              <Text style={[
                                styles.createFormTypeBtnText,
                                editAbsenceFormData.type === 'sick' && styles.createFormTypeBtnTextActive,
                              ]}>{t('calendar.absences.sick')}</Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.createFormRow} accessible={false}>
                          <Text style={styles.createFormLabel}>{t('calendar.absences.fullDay')}</Text>
                          <Pressable
                            style={[styles.createFormToggle, editAbsenceFormData.isFullDay && styles.createFormToggleActive]}
                            onPress={() => setEditAbsenceFormData(prev => ({ ...prev, isFullDay: !prev.isFullDay }))}
                            testID="absence-edit-fullday-toggle"
                            accessible={true}
                            accessibilityRole="switch"
                          >
                            <View style={[styles.createFormToggleThumb, editAbsenceFormData.isFullDay && styles.createFormToggleThumbActive]} />
                          </Pressable>
                        </View>
                        {!editAbsenceFormData.isFullDay && (
                          <>
                            <View style={styles.createFormRow} accessible={false}>
                              <Text style={styles.createFormLabel}>{t('calendar.absences.startTime')}</Text>
                              <TextInput
                                style={styles.createFormTimeInput}
                                value={editAbsenceFormData.startTime}
                                onChangeText={(startTime) => setEditAbsenceFormData(prev => ({ ...prev, startTime }))}
                                placeholder="08:00"
                                placeholderTextColor={colors.text.tertiary}
                                keyboardType="numbers-and-punctuation"
                                testID="absence-edit-start-time-input"
                              />
                            </View>
                            <View style={styles.createFormRow} accessible={false}>
                              <Text style={styles.createFormLabel}>{t('calendar.absences.endTime')}</Text>
                              <TextInput
                                style={styles.createFormTimeInput}
                                value={editAbsenceFormData.endTime}
                                onChangeText={(endTime) => setEditAbsenceFormData(prev => ({ ...prev, endTime }))}
                                placeholder="17:00"
                                placeholderTextColor={colors.text.tertiary}
                                keyboardType="numbers-and-punctuation"
                                testID="absence-edit-end-time-input"
                              />
                            </View>
                          </>
                        )}
                        <View style={styles.editFormActions} accessible={false}>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={handleDeleteAbsence}
                            testID="absence-delete"
                            accessible={true}
                            accessibilityRole="button"
                          >
                            <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
                          </Pressable>
                          <View style={styles.editFormRightActions}>
                            <Pressable
                              style={styles.createFormCancelBtn}
                              onPress={() => setEditingAbsenceId(null)}
                              testID="absence-edit-cancel"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                            </Pressable>
                            <Pressable
                              style={styles.createFormSubmitBtn}
                              onPress={handleSaveEditAbsence}
                              testID="absence-edit-save"
                              accessible={true}
                              accessibilityRole="button"
                            >
                              <Text style={styles.createFormSubmitText}>{t('common.save')}</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  // Regular row with edit button on left
                  return (
                    <View key={template.id} style={styles.row} accessible={false}>
                      <Pressable
                        style={styles.editButtonLeft}
                        onPress={() => startEditAbsence(template)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID={`absence-edit-${index}`}
                        accessible={true}
                        accessibilityRole="button"
                      >
                        <Pencil size={16} color={colors.text.tertiary} />
                      </Pressable>
                      <Pressable
                        style={styles.rowContent}
                        onPress={() => handleAbsenceTemplateSelected(template.id)}
                        testID={`absence-row-${template.type}-${index}`}
                        accessible={true}
                        accessibilityRole="button"
                      >
                        <View style={[styles.iconWrapper, { backgroundColor: template.color }]}>
                          <IconComponent size={14} color={iconColor} />
                        </View>
                        <View style={styles.info}>
                          <Text style={styles.name}>{template.name}</Text>
                          <Text style={styles.time}>
                            {template.isFullDay
                              ? t('calendar.absences.fullDay')
                              : `${template.startTime} - ${template.endTime}`}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })
            )}

            {/* Create new absence option */}
            {!showCreateAbsenceForm ? (
              <Pressable
                style={styles.createRow}
                onPress={() => setShowCreateAbsenceForm(true)}
                testID="absence-add"
                accessible={true}
                accessibilityRole="button"
              >
                <View style={styles.createIcon}>
                  <Plus size={16} color={colors.primary[500]} />
                </View>
                <Text style={styles.createText}>
                  {t('calendar.absences.createNew')}
                </Text>
              </Pressable>
            ) : (
              /* Inline create absence form */
              <View style={styles.createForm} accessible={false}>
                <TextInput
                  style={styles.createFormInput}
                  value={createAbsenceFormData.name}
                  onChangeText={(name) => setCreateAbsenceFormData(prev => ({ ...prev, name }))}
                  placeholder={t('calendar.absences.namePlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  autoFocus
                  testID="absence-name-input"
                />
                <View style={styles.createFormRow} accessible={false}>
                  <Text style={styles.createFormLabel}>{t('calendar.absences.typeLabel')}</Text>
                  <View style={styles.createFormTypeButtons} accessible={false}>
                    <Pressable
                      style={[
                        styles.createFormTypeBtn,
                        createAbsenceFormData.type === 'vacation' && styles.createFormTypeBtnActive,
                      ]}
                      onPress={() => setCreateAbsenceFormData(prev => ({ ...prev, type: 'vacation' }))}
                      testID="absence-type-vacation"
                      accessible={true}
                      accessibilityRole="button"
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
                      testID="absence-type-sick"
                      accessible={true}
                      accessibilityRole="button"
                    >
                      <Thermometer size={14} color={createAbsenceFormData.type === 'sick' ? colors.primary[500] : colors.text.secondary} />
                      <Text style={[
                        styles.createFormTypeBtnText,
                        createAbsenceFormData.type === 'sick' && styles.createFormTypeBtnTextActive,
                      ]}>{t('calendar.absences.sick')}</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.createFormRow} accessible={false}>
                  <Text style={styles.createFormLabel}>{t('calendar.absences.fullDay')}</Text>
                  <Pressable
                    style={[styles.createFormToggle, createAbsenceFormData.isFullDay && styles.createFormToggleActive]}
                    onPress={() => setCreateAbsenceFormData(prev => ({ ...prev, isFullDay: !prev.isFullDay }))}
                    testID="absence-fullday-toggle"
                    accessible={true}
                    accessibilityRole="switch"
                  >
                    <View style={[styles.createFormToggleThumb, createAbsenceFormData.isFullDay && styles.createFormToggleThumbActive]} />
                  </Pressable>
                </View>
                {!createAbsenceFormData.isFullDay && (
                  <>
                    <View style={styles.createFormRow} accessible={false}>
                      <Text style={styles.createFormLabel}>{t('calendar.absences.startTime')}</Text>
                      <TextInput
                        style={styles.createFormTimeInput}
                        value={createAbsenceFormData.startTime}
                        onChangeText={(startTime) => setCreateAbsenceFormData(prev => ({ ...prev, startTime }))}
                        placeholder="08:00"
                        placeholderTextColor={colors.text.tertiary}
                        keyboardType="numbers-and-punctuation"
                        testID="absence-start-time-input"
                      />
                    </View>
                    <View style={styles.createFormRow} accessible={false}>
                      <Text style={styles.createFormLabel}>{t('calendar.absences.endTime')}</Text>
                      <TextInput
                        style={styles.createFormTimeInput}
                        value={createAbsenceFormData.endTime}
                        onChangeText={(endTime) => setCreateAbsenceFormData(prev => ({ ...prev, endTime }))}
                        placeholder="17:00"
                        placeholderTextColor={colors.text.tertiary}
                        keyboardType="numbers-and-punctuation"
                        testID="absence-end-time-input"
                      />
                    </View>
                  </>
                )}
                <View style={styles.createFormActions} accessible={false}>
                  <Pressable
                    style={styles.createFormCancelBtn}
                    onPress={() => setShowCreateAbsenceForm(false)}
                    testID="absence-cancel"
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={styles.createFormCancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.createFormSubmitBtn}
                    onPress={handleCreateAbsenceAndPlace}
                    testID="absence-save"
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={styles.createFormSubmitText}>
                      {targetDate ? t('calendar.absences.createAndAdd') : t('calendar.absences.createAndArm')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* GPS tab - manual time entry */}
        {pickerTab === 'gps' && (
          <View style={styles.gpsContent} accessible={false}>
            <Text style={styles.gpsHint}>{t('calendar.gps.hint')}</Text>
            <Pressable
              style={styles.gpsLogButton}
              onPress={handleLogHours}
              testID="gps-log-hours-button"
              accessible={true}
              accessibilityRole="button"
            >
              <Clock size={20} color={colors.white} />
              <Text style={styles.gpsLogButtonText}>{t('calendar.gps.logHours')}</Text>
            </Pressable>
          </View>
        )}

        {/* Cancel button */}
        <Pressable
          style={styles.cancelButton}
          onPress={handleClose}
          testID="inline-picker-cancel"
          accessible={true}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 280,
    maxWidth: '85%',
    maxHeight: '80%',
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  targetDate: {
    fontSize: fontSize.sm,
    color: colors.primary[500],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.grey[100],
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md - 2,
  },
  tabActive: {
    backgroundColor: colors.background.paper,
    ...shadows.sm,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary[500],
  },
  listContainer: {
    maxHeight: 300,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonLeft: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  editForm: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.grey[50],
    marginBottom: spacing.sm,
  },
  editFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  editFormRightActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteBtnText: {
    fontSize: fontSize.sm,
    color: colors.error.main,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: colors.text.primary,
  },
  breakRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  breakButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  breakButtonSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  breakButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  breakButtonTextSelected: {
    color: colors.white,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  createIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  createText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
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
  gpsContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  gpsHint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  gpsLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  gpsLogButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    textAlign: 'center',
  },
});
