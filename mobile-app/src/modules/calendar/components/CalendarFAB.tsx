import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
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

      {/* Menu Modal - Using Modal ensures elements are in accessibility tree */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleOverlayPress}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={handleOverlayPress} accessible={false}>
          <View style={styles.modalOverlay}>
            <View
              style={styles.menuContainer}
              accessible={false}
              // @ts-ignore - iOS: trap accessibility focus within modal
              accessibilityViewIsModal={true}
            >
              <View
                style={styles.menu}
                accessible={false}
                collapsable={false}
                accessibilityRole="menu"
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleOptionPress('absences')}
                  activeOpacity={0.7}
                  testID="fab-absences-option"
                  accessible={true}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t('calendar.fab.absences')}
                >
                  <Text style={styles.menuItemText}>{t('calendar.fab.absences')}</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleOptionPress('shifts')}
                  activeOpacity={0.7}
                  testID="fab-shifts-option"
                  accessible={true}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t('calendar.fab.shifts')}
                >
                  <Text style={styles.menuItemText}>{t('calendar.fab.shifts')}</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLogHoursPress}
                  activeOpacity={0.7}
                  testID="fab-log-hours-option"
                  accessible={true}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t('calendar.fab.logHours')}
                >
                  <Text style={styles.menuItemText}>{t('calendar.fab.logHours')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* FAB Button - Always visible, outside Modal */}
      <View style={styles.fabContainer} accessible={false}>
        <TouchableOpacity
          style={[styles.fab, menuVisible && styles.fabActive]}
          onPress={handleFABPress}
          activeOpacity={0.8}
          testID="calendar-fab"
          accessibilityRole="button"
          accessibilityLabel={menuVisible
            ? t('calendar.fab.closeMenu')
            : t('calendar.fab.openMenu')}
          accessibilityState={{ expanded: menuVisible }}
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
  // Modal overlay - full screen transparent background
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Container for menu positioning within modal
  menuContainer: {
    position: 'absolute',
    right: spacing.xl,
    // Position menu above where FAB sits (FAB is 56px + spacing.xl from bottom)
    bottom: spacing.xl + 56 + spacing.sm,
  },
  // FAB button container - always visible outside modal
  fabContainer: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
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
