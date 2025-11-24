import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';

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
    return (
      <View style={styles.permissionRow}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <View style={styles.statusContainer}>
          {status === 'granted' && (
            <>
              <Text style={styles.statusIconGranted}>✅</Text>
              <Text style={styles.statusTextGranted}>Granted</Text>
            </>
          )}
          {status === 'denied' && (
            <>
              <Text style={styles.statusIconDenied}>❌</Text>
              <Text style={styles.statusTextDenied}>Denied</Text>
            </>
          )}
          {status === 'unknown' && (
            <>
              <Text style={styles.statusIconUnknown}>❓</Text>
              <Text style={styles.statusTextUnknown}>Unknown</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderPermissionStatus('Location (Foreground)', permissions.foreground)}
        {renderPermissionStatus('Location (Background)', permissions.background)}

        {permissions.background === 'denied' && (
          <View style={styles.requestButtonContainer}>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleRequestPermission}
            >
              <Text style={styles.requestButtonText}>Request Permission</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={handleOpenSettings}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Background location is required for automatic tracking. Without it, you can only use
            manual check-in/out.
            {'\n\n'}
            To enable: Settings → [App] → Location → Always Allow
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  permissionRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconGranted: {
    fontSize: 20,
    marginRight: 8,
  },
  statusTextGranted: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
  },
  statusIconDenied: {
    fontSize: 20,
    marginRight: 8,
  },
  statusTextDenied: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F44336',
  },
  statusIconUnknown: {
    fontSize: 20,
    marginRight: 8,
  },
  statusTextUnknown: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  requestButtonContainer: {
    marginTop: 20,
  },
  requestButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  settingsButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});
