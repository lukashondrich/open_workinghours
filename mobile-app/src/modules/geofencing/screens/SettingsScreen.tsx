import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
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
} from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { ListItem } from '@/components/ui';
import { Button } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { reportIssue } from '@/lib/utils/reportIssue';
import { seedDashboardTestData, clearDashboardTestData } from '@/test-utils/seedDashboardData';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingsItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  screen: keyof RootStackParamList;
}

const ICON_SIZE = 24;

const settingsItems: SettingsItem[] = [
  {
    id: '1',
    title: 'Work Locations',
    icon: <MapPin size={ICON_SIZE} color={colors.primary[500]} />,
    screen: 'LocationsList',
  },
  {
    id: '2',
    title: 'Notifications',
    icon: <Bell size={ICON_SIZE} color={colors.primary[500]} />,
    screen: 'Notifications',
  },
  {
    id: '3',
    title: 'Permissions',
    icon: <Lock size={ICON_SIZE} color={colors.primary[500]} />,
    screen: 'Permissions',
  },
  {
    id: '4',
    title: 'Data & Privacy',
    icon: <Trash2 size={ICON_SIZE} color={colors.primary[500]} />,
    screen: 'DataPrivacy',
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { signOut, state } = useAuth();
  const [isReporting, setIsReporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleItemPress = (screen: keyof RootStackParamList) => {
    // @ts-ignore - Navigation type checking is complex with mixed params
    navigation.navigate(screen);
  };

  const handleReportIssue = async () => {
    try {
      setIsReporting(true);
      await reportIssue(state.user);
      Alert.alert(
        'Report Sent',
        'Thank you! Your bug report has been submitted.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[SettingsScreen] Failed to report issue:', error);
      Alert.alert(
        'Submission Failed',
        error instanceof Error ? error.message : 'Failed to submit bug report. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsReporting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSeedDemoData = () => {
    Alert.alert(
      'Load Demo Data',
      'This will replace all existing data with demo data for screenshots. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Load Demo Data',
          onPress: async () => {
            try {
              setIsSeeding(true);
              await seedDashboardTestData();
              Alert.alert('Success', 'Demo data loaded. Go to Status screen to see the result.');
            } catch (error) {
              console.error('[SettingsScreen] Failed to seed demo data:', error);
              Alert.alert('Error', 'Failed to load demo data.');
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
      'Clear All Data',
      'This will delete all locations, sessions, and calendar data. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSeeding(true);
              await clearDashboardTestData();
              Alert.alert('Success', 'All data cleared.');
            } catch (error) {
              console.error('[SettingsScreen] Failed to clear data:', error);
              Alert.alert('Error', 'Failed to clear data.');
            } finally {
              setIsSeeding(false);
            }
          },
        },
      ]
    );
  };

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

          {/* Report Issue Button */}
          <View style={styles.actionSection}>
            {isReporting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary[500]} size="small" />
              </View>
            ) : (
              <Button
                variant="outline"
                onPress={handleReportIssue}
                icon={<Bug size={20} color={colors.primary[500]} />}
                fullWidth
              >
                Report Issue
              </Button>
            )}
          </View>

          {/* Demo Data Section - hidden for screenshots
          <View style={styles.demoSection}>
            <Text style={styles.sectionTitle}>Demo Data (Screenshots)</Text>
            {isSeeding ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary[500]} size="small" />
              </View>
            ) : (
              <View style={styles.demoButtons}>
                <Button
                  variant="outline"
                  onPress={handleSeedDemoData}
                  icon={<Database size={20} color={colors.primary[500]} />}
                  fullWidth
                >
                  Load Demo Data
                </Button>
                <Button
                  variant="outline"
                  onPress={handleClearDemoData}
                  icon={<Trash2 size={20} color={colors.error.main} />}
                  fullWidth
                  style={styles.clearButton}
                >
                  Clear All Data
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
              Sign Out
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
});
