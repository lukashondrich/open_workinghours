import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
  Switch,
  Linking,
  Platform,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SettingsDetailLayout } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MapPin,
  Bell,
  Calendar,
  Lock,
  Trash2,
  Bug,
  LogOut,
  Database,
  FileText,
  Shield,
  Fingerprint,
  UserCircle,
} from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/theme';
import { t } from '@/lib/i18n';
import { ListItem } from '@/components/ui';
import { Button, Checkbox } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { BiometricService } from '@/lib/auth/BiometricService';
import { reportIssue } from '@/lib/utils/reportIssue';
import { openTermsUrl, openPrivacyUrl } from '@/lib/utils/legalUrls';
import { seedDashboardTestData, clearDashboardTestData } from '@/test-utils/seedDashboardData';
import { getCalendarExportManager } from '@/modules/calendar/services/CalendarExportManager';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingsItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  screen: keyof RootStackParamList;
}

const ICON_SIZE = 24;

function getSettingsItems(): SettingsItem[] {
  return [
    {
      id: '0',
      title: t('settings.profile'),
      icon: <UserCircle size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'Profile',
    },
    {
      id: '1',
      title: t('settings.workLocations'),
      icon: <MapPin size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'LocationsList',
    },
    {
      id: '2',
      title: t('settings.notifications'),
      icon: <Bell size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'Notifications',
    },
    {
      id: '3',
      title: t('settings.permissions'),
      icon: <Lock size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'Permissions',
    },
    {
      id: '4',
      title: t('settings.dataPrivacy'),
      icon: <Trash2 size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'DataPrivacy',
    },
    {
      id: '5',
      title: t('settings.calendarExport'),
      icon: <Calendar size={ICON_SIZE} color={colors.primary[500]} />,
      screen: 'CalendarExport',
    },
  ];
}

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { signOut, state } = useAuth();
  const [isReporting, setIsReporting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [includeLocationDiagnostics, setIncludeLocationDiagnostics] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricLoading, setBiometricLoading] = useState(true);

  // Check biometric availability on mount
  useEffect(() => {
    async function checkBiometrics() {
      try {
        const [available, enrolled, enabled, type] = await Promise.all([
          BiometricService.isAvailable(),
          BiometricService.isEnrolled(),
          BiometricService.isEnabled(),
          BiometricService.getBiometricType(),
        ]);

        setBiometricAvailable(available && enrolled);
        setBiometricEnabled(enabled);
        setBiometricType(type);
      } catch (error) {
        console.error('[SettingsScreen] Failed to check biometrics:', error);
      } finally {
        setBiometricLoading(false);
      }
    }

    checkBiometrics();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Enabling - require biometric authentication first
      const success = await BiometricService.authenticate(
        t('biometric.promptReason')
      );

      if (success) {
        try {
          await BiometricService.setEnabled(true);
          setBiometricEnabled(true);
        } catch (error) {
          Alert.alert(t('common.error'), t('biometric.enableFailed'));
        }
      }
    } else {
      // Disabling - no authentication required
      try {
        await BiometricService.setEnabled(false);
        setBiometricEnabled(false);
      } catch (error) {
        Alert.alert(t('common.error'), t('biometric.enableFailed'));
      }
    }
  };

  const handleItemPress = (screen: keyof RootStackParamList) => {
    // @ts-ignore - Navigation type checking is complex with mixed params
    navigation.navigate(screen);
  };

  const performSignOut = async (deleteExportedEvents: boolean) => {
    try {
      const manager = await getCalendarExportManager();

      if (deleteExportedEvents) {
        const result = await manager.deleteExportedCalendarData();
        if (result.status === 'blocked-permission') {
          Alert.alert(
            t('settings.calendarSyncDeleteBlockedTitle'),
            t('settings.calendarSyncDeleteBlockedMessage'),
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('settings.calendarSyncOpenSettings'),
                onPress: () => { void Linking.openSettings(); },
              },
              {
                text: t('settings.keepExportedEvents'),
                onPress: async () => {
                  await manager.markDisabledKeepingEvents();
                  await signOut();
                },
              },
            ],
          );
          return;
        }
      } else {
        await manager.markDisabledKeepingEvents();
      }

      await signOut();
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.signOutFailed'));
    }
  };

  const handleReportIssue = () => {
    setIncludeLocationDiagnostics(false);
    setReportDescription('');
    setShowReportDialog(true);
  };

  const handleSubmitReportIssue = async () => {
    console.log('[SettingsScreen] Starting bug report submission...');
    try {
      setShowReportDialog(false);
      setIsReporting(true);
      await reportIssue(state.user, {
        includeLocationDiagnostics,
        featureArea: 'settings',
        description: reportDescription.trim() || undefined,
      });
      console.log('[SettingsScreen] Bug report submitted successfully');
      // Use fallback strings in case translations fail
      const title = t('settings.reportSent') || 'Report Sent';
      const message = t('settings.reportSentMessage') || 'Thank you for your feedback!';
      Alert.alert(title, message, [{ text: t('common.ok') || 'OK' }]);
    } catch (error) {
      console.error('[SettingsScreen] Failed to report issue:', error);
      const title = t('settings.submissionFailed') || 'Submission Failed';
      const message = error instanceof Error ? error.message : title;
      Alert.alert(title, message, [{ text: t('common.ok') || 'OK' }]);
    } finally {
      console.log('[SettingsScreen] Resetting isReporting state');
      setIsReporting(false);
      setReportDescription('');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('settings.signOut'),
      t('settings.signOutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            let calendarExportEnabled = false;

            try {
              const manager = await getCalendarExportManager();
              const exportState = await manager.getState();
              calendarExportEnabled = exportState?.enabled === true;
            } catch (error) {
              console.error('[SettingsScreen] Failed to load calendar sync state for sign-out:', error);
            }

            if (!calendarExportEnabled) {
              await performSignOut(false);
              return;
            }

            Alert.alert(
              t('settings.signOutCalendarTitle'),
              t('settings.signOutCalendarMessage'),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                },
                {
                  text: t('settings.signOutKeepEvents'),
                  onPress: async () => {
                    await performSignOut(false);
                  },
                },
                {
                  text: t('settings.signOutRemoveEvents'),
                  style: 'destructive',
                  onPress: async () => {
                    await performSignOut(true);
                  },
                },
              ],
            );
          },
        },
      ]
    );
  };


  const handleSeedDemoData = () => {
    Alert.alert(
      t('settings.loadDemoData'),
      t('settings.loadDemoDataConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.loadDemoData'),
          onPress: async () => {
            try {
              setIsSeeding(true);
              await seedDashboardTestData();
              Alert.alert(t('common.success'), t('settings.loadDemoDataSuccess'));
            } catch (error) {
              console.error('[SettingsScreen] Failed to seed demo data:', error);
              Alert.alert(t('common.error'), t('settings.loadDemoDataFailed'));
            } finally {
              setIsSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleClearDemoData = () => {
    Alert.alert(
      t('settings.clearAllData'),
      t('settings.clearAllDataConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.clearAll'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSeeding(true);
              await clearDashboardTestData();
              Alert.alert(t('common.success'), t('settings.clearAllDataSuccess'));
            } catch (error) {
              console.error('[SettingsScreen] Failed to clear data:', error);
              Alert.alert(t('common.error'), t('settings.clearAllDataFailed'));
            } finally {
              setIsSeeding(false);
            }
          },
        },
      ]
    );
  };

  const settingsItems = getSettingsItems();

  return (
    <SettingsDetailLayout title={t('navigation.settings')}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
          {settingsItems.map((item) => (
            <ListItem
              key={item.id}
              title={item.title}
              icon={item.icon}
              onPress={() => handleItemPress(item.screen)}
              testID={item.id === '5' ? 'settings-calendar-export' : undefined}
            />
          ))}

          {/* Biometric Section - only show if available */}
          {!biometricLoading && biometricAvailable && (
            <View style={styles.biometricSection}>
              <Text style={styles.sectionTitle}>{t('biometric.sectionTitle')}</Text>
              <View style={styles.biometricRow}>
                <View style={styles.biometricInfo}>
                  <Fingerprint size={ICON_SIZE} color={colors.primary[500]} />
                  <View style={styles.biometricText}>
                    <Text style={styles.biometricTitle}>
                      {t('biometric.usePrefix')} {biometricType}
                    </Text>
                    <Text style={styles.biometricDescription}>
                      {t('biometric.description')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.grey[300], true: colors.primary[300] }}
                  thumbColor={biometricEnabled ? colors.primary[500] : colors.grey[100]}
                />
              </View>
            </View>
          )}

          {/* Legal Section */}
          <View style={styles.legalSection}>
            <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
            <ListItem
              title={t('settings.termsOfService')}
              icon={<FileText size={ICON_SIZE} color={colors.primary[500]} />}
              onPress={openTermsUrl}
            />
            <ListItem
              title={t('settings.privacyPolicy')}
              icon={<Shield size={ICON_SIZE} color={colors.primary[500]} />}
              onPress={openPrivacyUrl}
            />
          </View>

          {/* Report Issue Button */}
          <View style={styles.actionSection}>
            {isReporting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary[500]} size="small" />
              </View>
            ) : (
              <Button
                variant="secondary"
                onPress={handleReportIssue}
                icon={<Bug size={20} color={colors.text.primary} />}
                fullWidth
              >
                {t('settings.reportIssue')}
              </Button>
            )}
          </View>

          {/* Demo Data Section - hidden for production
          <View style={styles.demoSection}>
            <Text style={styles.sectionTitle}>{t('settings.demoData')}</Text>
            {isSeeding ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary[500]} size="small" />
              </View>
            ) : (
              <View style={styles.demoButtons}>
                <Button
                  variant="secondary"
                  onPress={handleSeedDemoData}
                  icon={<Database size={20} color={colors.primary[500]} />}
                  fullWidth
                >
                  {t('settings.loadDemoData')}
                </Button>
                <Button
                  variant="secondary"
                  onPress={handleClearDemoData}
                  icon={<Trash2 size={20} color={colors.error.main} />}
                  fullWidth
                  style={styles.clearButton}
                >
                  {t('settings.clearAllData')}
                </Button>
              </View>
            )}
          </View>
          */}

          {/* Sign Out Button */}
          <View style={styles.signOutSection}>
            <Button
              variant="danger"
              onPress={handleSignOut}
              icon={<LogOut size={20} color={colors.white} />}
              fullWidth
              testID="sign-out-button"
            >
              {t('settings.signOut')}
            </Button>
          </View>
        </ScrollView>
      <Modal
        visible={showReportDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportDialog}>
            <ScrollView
              contentContainerStyle={styles.reportDialogContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.reportTitle}>{t('settings.reportIssueTitle')}</Text>
              <Text style={styles.reportIntro}>{t('settings.reportIssueIntro')}</Text>

              <TextInput
                style={styles.reportDescriptionInput}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder={t('settings.reportIssueDescriptionPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                multiline
                maxLength={1000}
                textAlignVertical="top"
                testID="report-description-input"
              />

              <View style={styles.reportInfoBox}>
                <Text style={styles.reportInfoTitle}>
                  {t('settings.reportIssueDefaultDataTitle')}
                </Text>
                <Text style={styles.reportInfoBody}>
                  {t('settings.reportIssueDefaultDataBody')}
                </Text>
              </View>

              <View
                style={styles.reportCheckboxRow}
                testID="report-location-diagnostics-row"
              >
                <Checkbox
                  checked={includeLocationDiagnostics}
                  onPress={() => setIncludeLocationDiagnostics(value => !value)}
                  testID="report-location-diagnostics-checkbox"
                />
                <TouchableOpacity
                  style={styles.reportCheckboxText}
                  onPress={() => setIncludeLocationDiagnostics(value => !value)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: includeLocationDiagnostics }}
                >
                  <Text style={styles.reportCheckboxTitle}>
                    {t('settings.reportIssueLocationDiagnostics')}
                  </Text>
                  <Text style={styles.reportCheckboxBody}>
                    {t('settings.reportIssueLocationDiagnosticsBody')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.reportRetention}>
                {t('settings.reportIssueRetention')}
              </Text>

              <View style={styles.reportActions}>
                <Button
                  variant="ghost"
                  onPress={() => setShowReportDialog(false)}
                  fullWidth
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onPress={handleSubmitReportIssue}
                  fullWidth
                  testID="report-send-button"
                >
                  {t('settings.reportIssueSend')}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SettingsDetailLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  legalSection: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  actionSection: {
    marginTop: spacing.xxl,
  },
  loadingContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoSection: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  demoButtons: {
    gap: spacing.sm,
  },
  clearButton: {
    borderColor: colors.error.main,
  },
  signOutSection: {
    marginTop: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  reportDialog: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
  },
  reportDialogContent: {
    padding: spacing.xl,
  },
  reportTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  reportIntro: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  reportDescriptionInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.background.paper,
  },
  reportInfoBox: {
    backgroundColor: colors.grey[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  reportInfoTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reportInfoBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  reportCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  reportCheckboxText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reportCheckboxTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reportCheckboxBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  reportRetention: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  reportActions: {
    gap: spacing.sm,
  },
  biometricSection: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  biometricInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  biometricText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  biometricTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  biometricDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
