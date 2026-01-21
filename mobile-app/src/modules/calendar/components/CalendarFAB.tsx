import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Plus, X } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { t } from '@/lib/i18n';
import ManualSessionForm from './ManualSessionForm';

export default function CalendarFAB() {
  const { state, dispatch } = useCalendar();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleFABPress = () => {
    setMenuVisible(!menuVisible);
  };

  const handleOptionPress = (tab: 'shifts' | 'absences') => {
    setMenuVisible(false);
    dispatch({ type: 'SET_TEMPLATE_PANEL_TAB', tab });
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
  };

  const handleLogHoursPress = () => {
    setMenuVisible(false);
    dispatch({ type: 'OPEN_MANUAL_SESSION_FORM' });
  };

  const handleCloseManualForm = () => {
    dispatch({ type: 'CLOSE_MANUAL_SESSION_FORM' });
  };

  const handleOverlayPress = () => {
    setMenuVisible(false);
  };

  // Always render the manual session form (it handles its own visibility)
  const manualSessionForm = (
    <ManualSessionForm
      visible={state.manualSessionFormOpen}
      defaultDate={state.manualSessionFormDate ?? undefined}
      onClose={handleCloseManualForm}
    />
  );

  // Hide FAB when overlays are open or in month view
  if (state.templatePanelOpen || state.hideFAB || state.view === 'month') {
    return manualSessionForm;
  }

  return (
    <>
      {manualSessionForm}

      {/* Overlay to close menu when tapping outside */}
      {menuVisible && (
        <TouchableWithoutFeedback onPress={handleOverlayPress}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.container}>
        {/* Popup Menu */}
        {menuVisible && (
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('absences')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>{t('calendar.fab.absences')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('shifts')}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>{t('calendar.fab.shifts')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogHoursPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>{t('calendar.fab.logHours')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FAB Button */}
        <TouchableOpacity
          style={[styles.fab, menuVisible && styles.fabActive]}
          onPress={handleFABPress}
          activeOpacity={0.8}
          testID="calendar-fab"
        >
          {menuVisible ? (
            <X size={28} color={colors.white} />
          ) : (
            <Plus size={28} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    alignItems: 'center',
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabActive: {
    backgroundColor: colors.primary[600],
  },
  menu: {
    position: 'absolute',
    bottom: 64, // Above the FAB
    right: 0,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    minWidth: 140,
    ...shadows.lg,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
});
