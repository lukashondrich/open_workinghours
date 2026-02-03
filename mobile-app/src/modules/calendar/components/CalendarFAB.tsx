import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { t } from '@/lib/i18n';
import ManualSessionForm from './ManualSessionForm';

export default function CalendarFAB() {
  const { state, dispatch } = useCalendar();
  const [menuVisible, setMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Calculate bottom offset to achieve equal margins from right edge and tab bar
  // The FAB container is inside SafeAreaView, so bottom: spacing.xl positions it
  // spacing.xl from the safe area boundary. To get spacing.xl from the actual tab bar
  // (which sits at the screen edge), we need to offset by the bottom safe area inset.
  // This makes the visual gap from tab bar equal to the right margin from screen edge.
  const fabBottomOffset = spacing.xl - insets.bottom;

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
  if (state.templatePanelOpen || state.manualSessionFormOpen || state.hideFAB || state.view === 'month') {
    return manualSessionForm;
  }

  return (
    <>
      {manualSessionForm}

      {/*
        Single absoluteFill View provides a full-screen positioning context
        for both the menu and FAB. This avoids Android's child clipping and
        Fragment positioning issues. box-none lets touches pass through the
        wrapper itself — only the FAB and menu children receive touches.
      */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dismiss overlay — only active when menu is open */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={menuVisible ? 'auto' : 'none'}
          accessibilityElementsHidden={!menuVisible}
        >
          <TouchableWithoutFeedback onPress={handleOverlayPress}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
        </View>

        {/* Menu — always rendered, hidden via opacity + pointerEvents */}
        <View
          style={[styles.menu, { bottom: fabBottomOffset + 56 + 8, opacity: menuVisible ? 1 : 0 }]}
          pointerEvents={menuVisible ? 'auto' : 'none'}
          accessibilityElementsHidden={!menuVisible}
          accessible={false}
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleOptionPress('absences')}
            activeOpacity={0.7}
            testID="fab-absences-option"
            accessible={true}
            accessibilityRole="button"
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
            accessibilityRole="button"
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
            accessibilityRole="button"
            accessibilityLabel={t('calendar.fab.logHours')}
          >
            <Text style={styles.menuItemText}>{t('calendar.fab.logHours')}</Text>
          </TouchableOpacity>
        </View>

        {/* FAB Button */}
        <TouchableOpacity
          style={[styles.fab, { bottom: fabBottomOffset }, menuVisible && styles.fabActive]}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    // bottom is applied dynamically via fabBottomOffset for equal margins
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
    // bottom is applied dynamically: fabBottomOffset + FAB height (56) + gap (8)
    right: spacing.xl,
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
