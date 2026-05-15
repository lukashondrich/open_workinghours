import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  BackHandler,
  KeyboardAvoidingView,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { AppText as Text } from '@/components/ui/AppText';
import { X, Pencil } from 'lucide-react-native';
import { format } from 'date-fns';
import { de as deLocale } from 'date-fns/locale/de';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t, getDateLocale } from '@/lib/i18n';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { isTestMode } from '@/lib/testing/mockApi';

interface Props {
  visible: boolean;
  date: string | null; // YYYY-MM-DD
  onClose: () => void;
}

export default function NoteEditor({ visible, date, onClose }: Props) {
  const { state, dispatch } = useCalendar();
  const animValue = useRef(new Animated.Value(0)).current;

  // Local text state
  const existingNote = date ? state.dayNotes[date] : null;
  const [text, setText] = useState(existingNote?.content ?? '');
  const [isEditing, setIsEditing] = useState(false);

  // Sync text and reset editing mode when date changes or note editor opens
  useEffect(() => {
    if (visible && date) {
      const note = state.dayNotes[date];
      setText(note?.content ?? '');
      // Start in read mode if note exists, edit mode if creating new
      setIsEditing(!note);
    }
  }, [visible, date]);

  // Reset editing mode when closing
  useEffect(() => {
    if (!visible) {
      setIsEditing(false);
    }
  }, [visible]);

  // Animation
  useEffect(() => {
    if (isTestMode()) {
      animValue.setValue(visible ? 1 : 0);
      return;
    }
    if (visible) {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      animValue.setValue(0);
    }
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

  const formattedDate = date
    ? format(new Date(date + 'T00:00:00'), 'EEE, MMM d', {
        locale: getDateLocale() === 'de' ? deLocale : undefined,
      })
    : '';

  const handleSave = async () => {
    if (!date) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const existing = state.dayNotes[date];

    if (existing) {
      const updated = {
        ...existing,
        content: trimmed,
        updatedAt: now,
      };
      dispatch({ type: 'ADD_NOTE', note: updated });
    } else {
      const newNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date,
        content: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: 'ADD_NOTE', note: newNote });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!date) return;

    Alert.alert(
      t('calendar.notes.deleteTitle'),
      t('calendar.notes.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'DELETE_NOTE', date });
            onClose();
          },
        },
      ]
    );
  };

  const hasContent = text.trim().length > 0;
  const hasChanges = text.trim() !== (existingNote?.content ?? '');

  if (!visible) return null;

  // Read mode — speech bubble tooltip
  if (!isEditing && existingNote) {
    return (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="auto"
        accessible={false}
        collapsable={false}
      >
        {/* Dismiss backdrop — tap anywhere to close */}
        <TouchableWithoutFeedback accessible={false} onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: animValue }]} />
        </TouchableWithoutFeedback>

        {/* Speech bubble card */}
        <Animated.View
          style={[styles.bubbleCard, { opacity: animValue, transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}
          accessible={false}
          collapsable={false}
        >
          {/* Header: date + actions */}
          <View style={styles.bubbleHeader}>
            <Text style={styles.bubbleDate}>{formattedDate}</Text>
            <View style={styles.bubbleActions}>
              <TouchableOpacity
                testID="note-editor-edit"
                onPress={() => setIsEditing(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
              >
                <Pencil size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="note-editor-close"
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Note content */}
          <ScrollView style={styles.bubbleContent} showsVerticalScrollIndicator={false}>
            <Text testID="note-editor-content" style={styles.bubbleText}>
              {existingNote.content}
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    );
  }

  // Edit mode — bottom sheet panel
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const wrapperProps = Platform.OS === 'ios'
    ? { behavior: 'padding' as const, style: styles.flexWrapper, keyboardVerticalOffset: 80 }
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
                <Text style={styles.title}>{formattedDate}</Text>
                <TouchableOpacity
                  testID="note-editor-cancel"
                  onPress={onClose}
                  style={styles.closeButton}
                  accessible={true}
                  accessibilityRole="button"
                >
                  <Text style={styles.closeText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                testID="note-editor-input"
                style={styles.textInput}
                multiline
                placeholder={t('calendar.notes.placeholder')}
                placeholderTextColor={colors.text.tertiary}
                value={text}
                onChangeText={setText}
                autoFocus={visible}
                textAlignVertical="top"
              />

              <View style={styles.footer}>
                <View style={styles.footerActions}>
                  {existingNote && (
                    <TouchableOpacity
                      testID="note-editor-delete"
                      onPress={handleDelete}
                      style={styles.deleteButton}
                      accessible={true}
                      accessibilityRole="button"
                    >
                      <Text style={styles.deleteText}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    testID="note-editor-save"
                    onPress={handleSave}
                    style={[styles.saveButton, (!hasContent || !hasChanges) && styles.saveButtonDisabled]}
                    disabled={!hasContent || !hasChanges}
                    accessible={true}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.saveText, (!hasContent || !hasChanges) && styles.saveTextDisabled]}>
                      {t('common.save')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Read mode (speech bubble) ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.3)',
  },
  bubbleCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '20%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.paper,
    ...shadows.lg,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bubbleDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  bubbleActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  bubbleContent: {
    maxHeight: 200,
  },
  bubbleText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
  },

  // ── Edit mode (bottom sheet) ──
  flexWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panelWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    fontSize: fontSize.md,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  textInput: {
    minHeight: 100,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteText: {
    fontSize: fontSize.md,
    color: colors.error.main,
    fontWeight: fontWeight.medium,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  saveButtonDisabled: {
    backgroundColor: colors.grey[200],
  },
  saveText: {
    fontSize: fontSize.md,
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  saveTextDisabled: {
    color: colors.grey[400],
  },
});
