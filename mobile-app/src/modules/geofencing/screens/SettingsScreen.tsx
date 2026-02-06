import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MapPin,
  Bell,
  Lock,
  Trash2,
  Bug,
  LogOut,
  Database,
  FileText,
  Shield,
  Fingerprint,
} from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { t } from '@/lib/i18n';
import { ListItem } from '@/components/ui';
import { Button } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { BiometricService } from '@/lib/auth/BiometricService';
import { reportIssue } from '@/lib/utils/reportIssue';
import { openTermsUrl, openPrivacyUrl } from '@/lib/utils/legalUrls';
import { seedDashboardTestData, clearDashboardTestData } from '@/test-utils/seedDashboardData';

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
  ];
}

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { signOut, state } = useAuth();
  const [isReporting, setIsReporting] = useState(false);
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

  const handleReportIssue = async () => {
    console.log('[SettingsScreen] Starting bug report submission...');
    try {
      setIsReporting(true);
      await reportIssue(state.user);
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
            try {
              await signOut();
            } catch (error) {
              Alert.alert(t('common.error'), t('settings.signOutFailed'));
            }
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {settingsItems.map((item) => (
            <ListItem
              key={item.id}
              title={item.title}
              icon={item.icon}
              onPress={() => handleItemPress(item.screen)}
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
            >
              {t('settings.signOut')}
            </Button>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
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
