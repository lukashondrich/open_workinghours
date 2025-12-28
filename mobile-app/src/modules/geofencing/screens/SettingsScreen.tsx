import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
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
} from 'lucide-react-native';

import { colors, spacing } from '@/theme';
import { ListItem } from '@/components/ui';
import { Button } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/lib/auth/auth-context';
import { reportIssue } from '@/lib/utils/reportIssue';

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
  signOutSection: {
    marginTop: spacing.md,
  },
});
