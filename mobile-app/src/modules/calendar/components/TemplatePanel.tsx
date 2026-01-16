import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Plus, TreePalm, ThermometerIcon, Pencil, Check } from 'lucide-react-native';
import { format } from 'date-fns';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import type { ShiftColor, ShiftTemplate, AbsenceTemplate } from '@/lib/calendar/types';
import { getColorPalette } from '@/lib/calendar/calendar-utils';
import { t } from '@/lib/i18n';

// Include teal as the first/default color option (rose removed - conflicts with tracked time display)
const COLORS: ShiftColor[] = ['teal', 'blue', 'green', 'amber', 'purple'];

export default function TemplatePanel() {
  const { state, dispatch } = useCalendar();
  // Shift editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ShiftTemplate>>({});
  const [durationHours, setDurationHours] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(0);

  // Absence editing state
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [absenceFormData, setAbsenceFormData] = useState<Partial<AbsenceTemplate>>({});

  const templates = useMemo(() => Object.values(state.templates), [state.templates]);
  const absenceTemplates = useMemo(() => Object.values(state.absenceTemplates), [state.absenceTemplates]);

  // Separate vacation and sick templates
  const vacationTemplates = useMemo(
    () => absenceTemplates.filter((t) => t.type === 'vacation'),
    [absenceTemplates]
  );
  const sickTemplates = useMemo(
    () => absenceTemplates.filter((t) => t.type === 'sick'),
    [absenceTemplates]
  );

  const activeTab = state.templatePanelTab;

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
    setEditingId(null);
    setFormData({});
    setEditingAbsenceId(null);
    setAbsenceFormData({});
    // Note: Do NOT disarm shift or absence templates when closing.
    // The user expects the armed template to persist so they can tap on days.
  };

  const handleTabChange = (tab: 'shifts' | 'absences') => {
    dispatch({ type: 'SET_TEMPLATE_PANEL_TAB', tab });
    // Disarm any armed shift or absence when switching tabs
    if (state.armedTemplateId) {
      dispatch({ type: 'DISARM_SHIFT' });
    }
    if (state.armedAbsenceTemplateId) {
      dispatch({ type: 'DISARM_ABSENCE' });
    }
  };

  const handleCreate = () => {
    const newTemplate: ShiftTemplate = {
      id: `template-${Date.now()}`,
      name: t('calendar.templates.newShift'),
      startTime: '08:00',
      duration: 8 * 60,
      color: 'teal', // Default to brand color
      breakMinutes: 0,
    };
    dispatch({ type: 'ADD_TEMPLATE', template: newTemplate });
    setEditingId(newTemplate.id);
    setFormData(newTemplate);
    setDurationHours(8);
    setDurationMinutes(0);
    setBreakMinutes(0);
  };

  const handleSave = () => {
    if (!editingId) return;
    const totalDuration = durationHours * 60 + durationMinutes;

    // Count future instances that will be updated
    const today = format(new Date(), 'yyyy-MM-dd');
    const futureCount = Object.values(state.instances).filter(
      instance => instance.templateId === editingId && instance.date > today
    ).length;

    const doSave = () => {
      dispatch({ type: 'UPDATE_TEMPLATE', id: editingId, template: { ...formData, duration: totalDuration, breakMinutes } });
      setEditingId(null);
      setFormData({});
      handleClose();
    };

    if (futureCount > 0) {
      Alert.alert(
        t('calendar.templates.updateFutureTitle'),
        t('calendar.templates.updateFutureMessage', { count: futureCount }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('calendar.templates.update'), onPress: doSave },
        ]
      );
    } else {
      doSave();
    }
  };

  const handleArm = (id: string) => {
    if (state.armedTemplateId === id) {
      dispatch({ type: 'DISARM_SHIFT' });
    } else {
      // Disarm any armed absence first (mutually exclusive selection)
      if (state.armedAbsenceTemplateId) {
        dispatch({ type: 'DISARM_ABSENCE' });
      }
      dispatch({ type: 'ARM_SHIFT', templateId: id });
    }
  };

  const handleEdit = (template: ShiftTemplate) => {
    setEditingId(template.id);
    setFormData(template);
    setDurationHours(Math.floor(template.duration / 60));
    setDurationMinutes(template.duration % 60);
    setBreakMinutes(template.breakMinutes || 0);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (templateId: string, templateName: string) => {
    // Count future instances that will be deleted
    const today = format(new Date(), 'yyyy-MM-dd');
    const futureCount = Object.values(state.instances).filter(
      instance => instance.templateId === templateId && instance.date > today
    ).length;

    const message = futureCount > 0
      ? t('calendar.templates.deleteWithFuture', { count: futureCount })
      : t('calendar.templates.deleteEmpty');

    Alert.alert(
      t('calendar.templates.deleteTitle'),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_TEMPLATE', id: templateId });
            setEditingId(null);
            setFormData({});
          },
        },
      ]
    );
  };

  // ========================================
  // Absence Handlers
  // ========================================

  const handleArmAbsence = (templateId: string) => {
    if (state.armedAbsenceTemplateId === templateId) {
      dispatch({ type: 'DISARM_ABSENCE' });
    } else {
      // Disarm any armed shift first (mutually exclusive selection)
      if (state.armedTemplateId) {
        dispatch({ type: 'DISARM_SHIFT' });
      }
      dispatch({ type: 'ARM_ABSENCE', templateId });
    }
  };

  const handleCreateAbsence = () => {
    const newAbsence: Omit<AbsenceTemplate, 'createdAt' | 'updatedAt'> = {
      id: `absence-template-${Date.now()}`,
      type: 'vacation',
      name: t('calendar.absences.newAbsence'),
      color: '#D1D5DB',
      startTime: null,
      endTime: null,
      isFullDay: true,
    };
    dispatch({ type: 'ADD_ABSENCE_TEMPLATE', template: newAbsence as AbsenceTemplate });
    // Open edit form for the new absence
    setEditingAbsenceId(newAbsence.id);
    setAbsenceFormData(newAbsence);
  };

  const handleEditAbsence = (template: AbsenceTemplate) => {
    setEditingAbsenceId(template.id);
    setAbsenceFormData(template);
  };

  const handleSaveAbsence = () => {
    if (!editingAbsenceId) return;
    dispatch({
      type: 'UPDATE_ABSENCE_TEMPLATE',
      id: editingAbsenceId,
      updates: absenceFormData,
    });
    setEditingAbsenceId(null);
    setAbsenceFormData({});
  };

  const handleCancelAbsenceEdit = () => {
    setEditingAbsenceId(null);
    setAbsenceFormData({});
  };

  const handleDeleteAbsence = (templateId: string) => {
    Alert.alert(
      t('calendar.absences.deleteTitle'),
      t('calendar.absences.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_ABSENCE_TEMPLATE', id: templateId });
            setEditingAbsenceId(null);
            setAbsenceFormData({});
          },
        },
      ]
    );
  };

  return (
    <Modal animationType="slide" transparent visible={state.templatePanelOpen} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.panel}>
                {/* Tab Bar */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'shifts' && styles.tabActive]}
                    onPress={() => handleTabChange('shifts')}
                  >
                    <Text style={[styles.tabText, activeTab === 'shifts' && styles.tabTextActive]}>
                      {t('calendar.templates.shiftsTab')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'absences' && styles.tabActive]}
                    onPress={() => handleTabChange('absences')}
                  >
                    <Text style={[styles.tabText, activeTab === 'absences' && styles.tabTextActive]}>
                      {t('calendar.templates.absencesTab')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.header}>
                  <Text style={styles.headerTitle}>
                    {activeTab === 'shifts' ? t('calendar.templates.title') : t('calendar.absences.title')}
                  </Text>
                  {activeTab === 'shifts' ? (
                    <TouchableOpacity style={styles.addButton} onPress={handleCreate} testID="template-add">
                      <Plus size={16} color={colors.white} />
                      <Text style={styles.addButtonText}>{t('calendar.templates.new')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.addButton} onPress={handleCreateAbsence} testID="absence-add">
                      <Plus size={16} color={colors.white} />
                      <Text style={styles.addButtonText}>{t('calendar.templates.new')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  style={styles.content}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Shifts Tab */}
                  {activeTab === 'shifts' && (
                    <>
                      {templates.length === 0 && (
                        <Text style={styles.emptyText}>{t('calendar.templates.empty')}</Text>
                      )}

                      {/* Compact Radio List */}
                      <View style={styles.templateList}>
                        {templates.map((template, index) => {
                          const isEditing = editingId === template.id;
                          const palette = getColorPalette(template.color);
                          const isArmed = state.armedTemplateId === template.id;

                          if (isEditing) {
                            // Edit form
                            return (
                              <View key={template.id} style={styles.editCard} testID={`template-edit-${template.id}`}>
                                <TextInput
                                  style={styles.input}
                                  value={formData.name || ''}
                                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                                  placeholder={t('calendar.templates.name')}
                                  placeholderTextColor={colors.text.tertiary}
                                />
                                <View style={styles.row}>
                                  <View style={styles.flexItem}>
                                    <Text style={styles.label}>{t('calendar.templates.startTime')}</Text>
                                    <TextInput
                                      style={styles.input}
                                      value={formData.startTime || ''}
                                      onChangeText={(value) => setFormData({ ...formData, startTime: value })}
                                      placeholder={t('calendar.templates.startTimePlaceholder')}
                                      placeholderTextColor={colors.text.tertiary}
                                    />
                                  </View>
                                  <View style={[styles.flexItem, styles.durationGroup]}>
                                    <Text style={styles.label}>{t('calendar.templates.duration')}</Text>
                                    <View style={styles.durationInputs}>
                                      <TextInput
                                        style={[styles.input, styles.durationInput]}
                                        keyboardType="number-pad"
                                        value={String(durationHours)}
                                        onChangeText={(value) => setDurationHours(Number(value) || 0)}
                                        placeholder={t('calendar.templates.hoursPlaceholder')}
                                        placeholderTextColor={colors.text.tertiary}
                                      />
                                      <TextInput
                                        style={[styles.input, styles.durationInput]}
                                        keyboardType="number-pad"
                                        value={String(durationMinutes)}
                                        onChangeText={(value) =>
                                          setDurationMinutes(Math.min(55, Number(value) || 0))
                                        }
                                        placeholder={t('calendar.templates.minutesPlaceholder')}
                                        placeholderTextColor={colors.text.tertiary}
                                      />
                                    </View>
                                  </View>
                                </View>

                                <Text style={styles.label}>{t('calendar.templates.color')}</Text>
                                <View style={styles.colorRow}>
                                  {COLORS.map((color) => {
                                    const paletteColor = getColorPalette(color);
                                    const isSelected = formData.color === color;
                                    return (
                                      <TouchableOpacity
                                        key={color}
                                        style={[styles.colorDot, { backgroundColor: paletteColor.dot }, isSelected && styles.colorDotSelected]}
                                        onPress={() => setFormData({ ...formData, color })}
                                      />
                                    );
                                  })}
                                </View>

                                <Text style={styles.label}>{t('calendar.templates.breakDuration')}</Text>
                                <View style={styles.breakRow}>
                                  {[0, 5, 15, 30, 45, 60].map((minutes) => (
                                    <TouchableOpacity
                                      key={minutes}
                                      style={[styles.breakButton, breakMinutes === minutes && styles.breakButtonSelected]}
                                      onPress={() => setBreakMinutes(minutes)}
                                    >
                                      <Text style={[styles.breakButtonText, breakMinutes === minutes && styles.breakButtonTextSelected]}>
                                        {minutes}m
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>

                                <View style={styles.editActions}>
                                  <TouchableOpacity style={[styles.primaryButton, styles.saveButton]} onPress={handleSave} testID="template-save">
                                    <Text style={styles.primaryButtonText}>{t('common.save')}</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
                                    <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                                  </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                  style={styles.deleteButton}
                                  onPress={() => handleDelete(template.id, template.name)}
                                >
                                  <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          }

                          // Compact row: [Edit] [Info] [Color] [Radio]
                          return (
                            <TouchableOpacity
                              key={template.id}
                              style={styles.templateRow}
                              onPress={() => handleArm(template.id)}
                              activeOpacity={0.7}
                              testID={`template-row-${index}`}
                            >
                              {/* Edit button (left) */}
                              <TouchableOpacity
                                onPress={() => handleEdit(template)}
                                style={styles.editButtonLeft}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Pencil size={18} color={colors.grey[500]} />
                              </TouchableOpacity>

                              {/* Template info */}
                              <View style={styles.rowContent}>
                                <Text style={styles.rowName}>{template.name}</Text>
                                <Text style={styles.rowMeta}>
                                  {template.startTime} • {Math.floor(template.duration / 60)}h{template.duration % 60 > 0 ? ` ${template.duration % 60}m` : ''}
                                </Text>
                              </View>

                              {/* Color dot */}
                              <View style={[styles.colorDotSmall, { backgroundColor: palette.dot }]} />

                              {/* Radio indicator (right - easier thumb reach) */}
                              <View style={[styles.radioOuter, isArmed && styles.radioOuterSelected]}>
                                {isArmed && <View style={styles.radioInner} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {/* Absences Tab */}
                  {activeTab === 'absences' && (
                    <>
                      {/* Edit Form for Absence */}
                      {editingAbsenceId && (
                        <View style={styles.editCard}>
                          <TextInput
                            style={styles.input}
                            value={absenceFormData.name || ''}
                            onChangeText={(value) => setAbsenceFormData({ ...absenceFormData, name: value })}
                            placeholder={t('calendar.templates.name')}
                            placeholderTextColor={colors.text.tertiary}
                          />

                          <Text style={styles.label}>{t('calendar.absences.typeLabel')}</Text>
                          <View style={styles.typeRow}>
                            <TouchableOpacity
                              style={[styles.typeButton, absenceFormData.type === 'vacation' && styles.typeButtonSelected]}
                              onPress={() => setAbsenceFormData({ ...absenceFormData, type: 'vacation' })}
                            >
                              <TreePalm size={16} color={absenceFormData.type === 'vacation' ? colors.white : colors.grey[600]} />
                              <Text style={[styles.typeButtonText, absenceFormData.type === 'vacation' && styles.typeButtonTextSelected]}>
                                {t('calendar.absences.vacation')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.typeButton, absenceFormData.type === 'sick' && styles.typeButtonSelected]}
                              onPress={() => setAbsenceFormData({ ...absenceFormData, type: 'sick' })}
                            >
                              <ThermometerIcon size={16} color={absenceFormData.type === 'sick' ? colors.white : colors.grey[600]} />
                              <Text style={[styles.typeButtonText, absenceFormData.type === 'sick' && styles.typeButtonTextSelected]}>
                                {t('calendar.absences.sick')}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Full Day Toggle */}
                          <TouchableOpacity
                            style={styles.fullDayRow}
                            onPress={() => setAbsenceFormData({
                              ...absenceFormData,
                              isFullDay: !absenceFormData.isFullDay,
                              startTime: absenceFormData.isFullDay ? '09:00' : null,
                              endTime: absenceFormData.isFullDay ? '17:00' : null,
                            })}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.checkbox, absenceFormData.isFullDay && styles.checkboxChecked]}>
                              {absenceFormData.isFullDay && <Check size={14} color={colors.white} />}
                            </View>
                            <Text style={styles.fullDayLabel}>{t('calendar.absences.fullDay')}</Text>
                          </TouchableOpacity>

                          {/* Time Inputs (shown when not full day) */}
                          {!absenceFormData.isFullDay && (
                            <View style={styles.row}>
                              <View style={styles.flexItem}>
                                <Text style={styles.label}>{t('calendar.absences.startTime')}</Text>
                                <TextInput
                                  style={styles.input}
                                  value={absenceFormData.startTime || ''}
                                  onChangeText={(value) => setAbsenceFormData({ ...absenceFormData, startTime: value })}
                                  placeholder="09:00"
                                  placeholderTextColor={colors.text.tertiary}
                                />
                              </View>
                              <View style={styles.flexItem}>
                                <Text style={styles.label}>{t('calendar.absences.endTime')}</Text>
                                <TextInput
                                  style={styles.input}
                                  value={absenceFormData.endTime || ''}
                                  onChangeText={(value) => setAbsenceFormData({ ...absenceFormData, endTime: value })}
                                  placeholder="17:00"
                                  placeholderTextColor={colors.text.tertiary}
                                />
                              </View>
                            </View>
                          )}

                          <View style={styles.editActions}>
                            <TouchableOpacity style={[styles.primaryButton, styles.saveButton]} onPress={handleSaveAbsence}>
                              <Text style={styles.primaryButtonText}>{t('common.save')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelAbsenceEdit}>
                              <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteAbsence(editingAbsenceId)}
                          >
                            <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {!editingAbsenceId && absenceTemplates.length === 0 && (
                        <Text style={styles.emptyText}>{t('calendar.absences.hint')}</Text>
                      )}

                      {/* Vacation Section */}
                      {!editingAbsenceId && vacationTemplates.length > 0 && (
                        <>
                          <Text style={styles.sectionTitle}>{t('calendar.absences.vacation')}</Text>
                          <View style={styles.templateList}>
                            {vacationTemplates.map((template) => {
                              const isArmed = state.armedAbsenceTemplateId === template.id;
                              return (
                                <TouchableOpacity
                                  key={template.id}
                                  style={styles.templateRow}
                                  onPress={() => handleArmAbsence(template.id)}
                                  activeOpacity={0.7}
                                >
                                  {/* Edit button (left) */}
                                  <TouchableOpacity
                                    onPress={() => handleEditAbsence(template)}
                                    style={styles.editButtonLeft}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  >
                                    <Pencil size={18} color={colors.grey[500]} />
                                  </TouchableOpacity>

                                  {/* Icon */}
                                  <View style={[styles.absenceIconWrapper, { backgroundColor: template.color, marginRight: spacing.sm }]}>
                                    <TreePalm size={14} color="#6B7280" />
                                  </View>

                                  {/* Template info */}
                                  <View style={styles.rowContent}>
                                    <Text style={styles.rowName}>{template.name}</Text>
                                    <Text style={styles.rowMeta}>
                                      {template.isFullDay
                                        ? t('calendar.absences.fullDay')
                                        : `${template.startTime} - ${template.endTime}`}
                                    </Text>
                                  </View>

                                  {/* Radio indicator (right - easier thumb reach) */}
                                  <View style={[styles.radioOuter, isArmed && styles.radioOuterSelected]}>
                                    {isArmed && <View style={styles.radioInner} />}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      )}

                      {/* Sick Section */}
                      {!editingAbsenceId && sickTemplates.length > 0 && (
                        <>
                          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{t('calendar.absences.sick')}</Text>
                          <View style={styles.templateList}>
                            {sickTemplates.map((template) => {
                              const isArmed = state.armedAbsenceTemplateId === template.id;
                              return (
                                <TouchableOpacity
                                  key={template.id}
                                  style={styles.templateRow}
                                  onPress={() => handleArmAbsence(template.id)}
                                  activeOpacity={0.7}
                                >
                                  {/* Edit button (left) */}
                                  <TouchableOpacity
                                    onPress={() => handleEditAbsence(template)}
                                    style={styles.editButtonLeft}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  >
                                    <Pencil size={18} color={colors.grey[500]} />
                                  </TouchableOpacity>

                                  {/* Icon */}
                                  <View style={[styles.absenceIconWrapper, { backgroundColor: template.color, marginRight: spacing.sm }]}>
                                    <ThermometerIcon size={14} color="#92400E" />
                                  </View>

                                  {/* Template info */}
                                  <View style={styles.rowContent}>
                                    <Text style={styles.rowName}>{template.name}</Text>
                                    <Text style={styles.rowMeta}>
                                      {template.isFullDay
                                        ? t('calendar.absences.fullDay')
                                        : `${template.startTime} - ${template.endTime}`}
                                    </Text>
                                  </View>

                                  {/* Radio indicator (right - easier thumb reach) */}
                                  <View style={[styles.radioOuter, isArmed && styles.radioOuterSelected]}>
                                    {isArmed && <View style={styles.radioInner} />}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      )}

                      {!editingAbsenceId && (
                        <Text style={styles.absenceHint}>
                          {t('calendar.absences.hint')}
                        </Text>
                      )}
                    </>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  panel: {
    maxHeight: '80%',
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  addButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: fontWeight.medium,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.tertiary,
    marginTop: spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardArmed: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  templateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  templateName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  metaText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },
  editText: {
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonActive: {
    backgroundColor: colors.primary[600],
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    flex: 1,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flexItem: {
    flex: 1,
  },
  durationGroup: {
    flex: 1,
  },
  durationInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationInput: {
    flex: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  colorDotSelected: {
    borderColor: colors.text.primary,
  },
  breakRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  breakButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  breakButtonSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  breakButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  breakButtonTextSelected: {
    color: colors.white,
  },
  colorPreview: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  saveButton: {
    flex: 1,
  },
  deleteButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error.main,
  },
  deleteButtonText: {
    color: colors.error.main,
    fontWeight: fontWeight.medium,
  },
  // Tab styles
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary[500],
  },
  // Absence styles
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  absenceIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absenceHint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  // Compact radio list styles
  templateList: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.grey[400],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  radioOuterSelected: {
    borderColor: colors.primary[500],
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary[500],
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  colorDotSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: spacing.sm,
  },
  editButton: {
    padding: spacing.sm,
  },
  editButtonLeft: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  editCard: {
    padding: spacing.md,
    backgroundColor: colors.grey[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  // Absence type selector styles
  typeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  typeButtonSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  typeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  typeButtonTextSelected: {
    color: colors.white,
  },
  // Full day toggle styles
  fullDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.grey[400],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  fullDayLabel: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
});
