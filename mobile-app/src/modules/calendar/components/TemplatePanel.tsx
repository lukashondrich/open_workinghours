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
import { useCalendar } from '@/lib/calendar/calendar-context';
import type { ShiftColor, ShiftTemplate } from '@/lib/calendar/types';
import { getColorPalette } from '@/lib/calendar/calendar-utils';

const COLORS: ShiftColor[] = ['blue', 'green', 'amber', 'rose', 'purple', 'cyan'];

export default function TemplatePanel() {
  const { state, dispatch } = useCalendar();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ShiftTemplate>>({});
  const [durationHours, setDurationHours] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(0);

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
      color: 'blue',
    };
    dispatch({ type: 'ADD_TEMPLATE', template: newTemplate });
    setEditingId(newTemplate.id);
    setFormData(newTemplate);
    setDurationHours(8);
    setDurationMinutes(0);
  };

  const handleSave = () => {
    if (!editingId) return;
    const totalDuration = durationHours * 60 + durationMinutes;
    dispatch({ type: 'UPDATE_TEMPLATE', id: editingId, template: { ...formData, duration: totalDuration } });
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
              <Text style={styles.addButtonText}>+ New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {templates.length === 0 && (
              <Text style={styles.emptyText}>No templates yet. Tap “New” to create one.</Text>
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
                      />
                      <View style={styles.row}>
                        <View style={styles.flexItem}>
                          <Text style={styles.label}>Start Time</Text>
                          <TextInput
                            style={styles.input}
                            value={formData.startTime || ''}
                            onChangeText={(value) => setFormData({ ...formData, startTime: value })}
                            placeholder="08:00"
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
                            />
                            <TextInput
                              style={[styles.input, styles.durationInput]}
                              keyboardType="number-pad"
                              value={String(durationMinutes)}
                              onChangeText={(value) =>
                                setDurationMinutes(Math.min(55, Number(value) || 0))
                              }
                              placeholder="m"
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardArmed: {
    borderColor: '#007AFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  editText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonActive: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  secondaryButtonText: {
    color: '#111',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexItem: {
    flex: 1,
  },
  durationGroup: {
    flex: 1,
  },
  durationInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  durationInput: {
    flex: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#111',
  },
  colorPreview: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
