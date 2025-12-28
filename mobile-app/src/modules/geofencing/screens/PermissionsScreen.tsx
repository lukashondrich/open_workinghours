import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { Button, Card, InfoBox } from '@/components/ui';

interface PermissionStatus {
  foreground: 'granted' | 'denied' | 'unknown';
  background: 'granted' | 'denied' | 'unknown';
}

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    foreground: 'unknown',
    background: 'unknown',
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      const background = await Location.getBackgroundPermissionsAsync();

      setPermissions({
        foreground: foreground.granted ? 'granted' : 'denied',
        background: background.granted ? 'granted' : 'denied',
      });
    } catch (error) {
      console.error('[PermissionsScreen] Failed to check permissions:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      // First request foreground
      const foreground = await Location.requestForegroundPermissionsAsync();

      if (foreground.granted) {
        // Then request background
        const background = await Location.requestBackgroundPermissionsAsync();
        checkPermissions();

        if (background.granted) {
          Alert.alert('Success', 'Background location permission granted!');
        } else {
          Alert.alert(
            'Background Permission Required',
            'Please go to Settings → [App] → Location → Always Allow to enable automatic tracking.'
          );
        }
      } else {
        Alert.alert(
          'Foreground Permission Required',
          'Location permission is required for this app to function.'
        );
      }
    } catch (error) {
      console.error('[PermissionsScreen] Failed to request permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const renderPermissionStatus = (label: string, status: 'granted' | 'denied' | 'unknown') => {
    const getStatusIcon = () => {
      switch (status) {
        case 'granted':
          return <CheckCircle2 size={24} color={colors.primary[500]} />;
        case 'denied':
          return <XCircle size={24} color={colors.error.main} />;
        default:
          return <HelpCircle size={24} color={colors.text.tertiary} />;
      }
    };

    const getStatusText = () => {
      switch (status) {
        case 'granted':
          return { text: 'Granted', color: colors.primary[500] };
        case 'denied':
          return { text: 'Denied', color: colors.error.main };
        default:
          return { text: 'Unknown', color: colors.text.tertiary };
      }
    };

    const statusInfo = getStatusText();

    return (
      <Card style={styles.permissionCard}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <View style={styles.statusContainer}>
          {getStatusIcon()}
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderPermissionStatus('Location (Foreground)', permissions.foreground)}
        {renderPermissionStatus('Location (Background)', permissions.background)}

        {permissions.background === 'denied' && (
          <View style={styles.requestButtonContainer}>
            <Button onPress={handleRequestPermission} fullWidth>
              Request Permission
            </Button>

            <Button variant="outline" onPress={handleOpenSettings} fullWidth>
              Open Settings
            </Button>
          </View>
        )}

        <InfoBox variant="info" style={styles.infoBox}>
          Background location is required for automatic tracking. Without it, you can only use
          manual check-in/out.
          {'\n\n'}
          To enable: Settings → [App] → Location → Always Allow
        </InfoBox>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  permissionCard: {
    marginBottom: spacing.md,
  },
  permissionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  requestButtonContainer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  infoBox: {
    marginTop: spacing.xl,
  },
});
