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
} from 'react-native';
import { Plus } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import type { ShiftColor, ShiftTemplate } from '@/lib/calendar/types';
import { getColorPalette } from '@/lib/calendar/calendar-utils';

// Include teal as the first/default color option
const COLORS: ShiftColor[] = ['teal', 'blue', 'green', 'amber', 'rose', 'purple'];

export default function TemplatePanel() {
  const { state, dispatch } = useCalendar();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ShiftTemplate>>({});
  const [durationHours, setDurationHours] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(0);

  const templates = useMemo(() => Object.values(state.templates), [state.templates]);

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
    setEditingId(null);
    setFormData({});
  };

  const handleCreate = () => {
    const newTemplate: ShiftTemplate = {
      id: `template-${Date.now()}`,
      name: 'New Shift',
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
    dispatch({ type: 'UPDATE_TEMPLATE', id: editingId, template: { ...formData, duration: totalDuration, breakMinutes } });
    setEditingId(null);
    setFormData({});
    handleClose();
  };

  const handleArm = (id: string) => {
    if (state.armedTemplateId === id) {
      dispatch({ type: 'DISARM_SHIFT' });
    } else {
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

  return (
    <Modal animationType="slide" transparent visible={state.templatePanelOpen} onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Shift Templates</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleCreate} testID="template-add">
              <Plus size={16} color={colors.white} />
              <Text style={styles.addButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {templates.length === 0 && (
              <Text style={styles.emptyText}>No templates yet. Tap "New" to create one.</Text>
            )}

            {templates.map((template, index) => {
              const isEditing = editingId === template.id;
              const palette = getColorPalette(template.color);
              const isArmed = state.armedTemplateId === template.id;

              return (
                <View key={template.id} style={[styles.card, isArmed && styles.cardArmed]} testID={`template-card-${template.id}`}>
                  {isEditing ? (
                    <View>
                      <TextInput
                        style={styles.input}
                        value={formData.name || ''}
                        onChangeText={(value) => setFormData({ ...formData, name: value })}
                        placeholder="Name"
                        placeholderTextColor={colors.text.tertiary}
                      />
                      <View style={styles.row}>
                        <View style={styles.flexItem}>
                          <Text style={styles.label}>Start Time</Text>
                          <TextInput
                            style={styles.input}
                            value={formData.startTime || ''}
                            onChangeText={(value) => setFormData({ ...formData, startTime: value })}
                            placeholder="08:00"
                            placeholderTextColor={colors.text.tertiary}
                          />
                        </View>
                        <View style={[styles.flexItem, styles.durationGroup]}>
                          <Text style={styles.label}>Duration</Text>
                          <View style={styles.durationInputs}>
                            <TextInput
                              style={[styles.input, styles.durationInput]}
                              keyboardType="number-pad"
                              value={String(durationHours)}
                              onChangeText={(value) => setDurationHours(Number(value) || 0)}
                              placeholder="h"
                              placeholderTextColor={colors.text.tertiary}
                            />
                            <TextInput
                              style={[styles.input, styles.durationInput]}
                              keyboardType="number-pad"
                              value={String(durationMinutes)}
                              onChangeText={(value) =>
                                setDurationMinutes(Math.min(55, Number(value) || 0))
                              }
                              placeholder="m"
                              placeholderTextColor={colors.text.tertiary}
                            />
                          </View>
                        </View>
                      </View>

                      <Text style={styles.label}>Color</Text>
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

                      <Text style={styles.label}>Break Duration</Text>
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
                        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} testID="template-save">
                          <Text style={styles.primaryButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <View style={styles.cardHeader}>
                        <View style={styles.templateLabel}>
                          <View style={[styles.colorPreview, { backgroundColor: palette.dot }]} />
                          <View>
                            <Text style={styles.templateName}>{template.name}</Text>
                            <Text style={styles.metaText}>
                              {template.startTime} • {Math.floor(template.duration / 60)}h {template.duration % 60}m
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleEdit(template)}>
                          <Text style={styles.editText}>Edit</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.primaryButton, isArmed && styles.primaryButtonActive]}
                        onPress={() => handleArm(template.id)}
                        testID={`template-arm-${index}`}
                        accessibilityLabel={`template-arm-${template.id}`}
                      >
                        <Text style={styles.primaryButtonText}>{isArmed ? 'Armed' : 'Arm Template'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
