import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { ShiftInstance } from '@/lib/calendar/types';
import { t } from '@/lib/i18n';

interface Props {
  visible: boolean;
  instance: ShiftInstance | null;
  onClose: () => void;
  onSave: (changes: { id: string; name: string; startTime: string; duration: number }) => void;
}

export default function ShiftEditModal({ visible, instance, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);

  useEffect(() => {
    if (!instance) return;
    setName(instance.name);
    setStartTime(instance.startTime);
    setDurationHours(Math.floor(instance.duration / 60));
    setDurationMinutes(instance.duration % 60);
  }, [instance]);

  const handleSave = () => {
    if (!instance) return;
    const totalMinutes = durationHours * 60 + durationMinutes;
    onSave({ id: instance.id, name, startTime, duration: Math.max(5, totalMinutes) });
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('calendar.edit.title')}</Text>

          <Text style={styles.label}>{t('calendar.templates.name')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('calendar.templates.namePlaceholder')} />

          <Text style={styles.label}>{t('calendar.edit.startTimeLabel')}</Text>
          <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder={t('calendar.templates.startTimePlaceholder')} />

          <Text style={styles.label}>{t('calendar.templates.duration')}</Text>
          <View style={styles.durationRow}>
            <TextInput
              style={[styles.input, styles.durationInput]}
              keyboardType="number-pad"
              value={String(durationHours)}
              onChangeText={(value) => setDurationHours(Number(value) || 0)}
              placeholder={t('calendar.edit.durationHours')}
            />
            <TextInput
              style={[styles.input, styles.durationInput]}
              keyboardType="number-pad"
              value={String(durationMinutes)}
              onChangeText={(value) => setDurationMinutes(Math.min(59, Number(value) || 0))}
              placeholder={t('calendar.edit.durationMins')}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationInput: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryText: {
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
