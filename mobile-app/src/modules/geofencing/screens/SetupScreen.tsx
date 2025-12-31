import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { Minus, Plus } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { Button, Input } from '@/components/ui';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import MapControls from '@/modules/geofencing/components/MapControls';
import type { UserLocation } from '@/modules/geofencing/types';

type SetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Setup'>;

interface Props {
  navigation: SetupScreenNavigationProp;
}

// Map circle colors using primary theme color
const MAP_CIRCLE_STROKE = 'rgba(46, 139, 107, 0.6)';
const MAP_CIRCLE_FILL = 'rgba(46, 139, 107, 0.2)';

export default function SetupScreen({ navigation }: Props) {
  const mapRef = React.useRef<MapView>(null);

  const [name, setName] = useState('');
  const [radius, setRadius] = useState(200);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestPermissionsAndGetLocation();
  }, []);

  const requestPermissionsAndGetLocation = async () => {
    try {
      console.log('[SetupScreen] Starting location permission request...');
      const geofenceService = getGeofenceService();

      // Request foreground permission first
      const foregroundGranted = await geofenceService.requestForegroundPermissions();

      if (!foregroundGranted) {
        console.log('[SetupScreen] Foreground permission denied');
        Alert.alert(
          t('setup.permissionRequiredTitle'),
          t('setup.permissionRequiredMessage'),
          [{ text: t('common.ok') }]
        );
        setLoading(false);
        return;
      }

      console.log('[SetupScreen] Getting current location...');

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location timeout')), 10000)
      );

      try {
        const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
        console.log('[SetupScreen] Got location:', location.coords);

        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (locationError) {
        console.warn('[SetupScreen] Failed to get location, using default:', locationError);
        // Use default location (San Francisco) if GPS fails
        Alert.alert(
          t('setup.locationUnavailableTitle'),
          t('setup.locationUnavailableMessage'),
          [{ text: t('common.ok') }]
        );
      }

      setLoading(false);
    } catch (error) {
      console.error('[SetupScreen] Error in permission/location request:', error);
      Alert.alert(t('common.error'), t('setup.initializationFailed'));
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('setup.missingInfoTitle'), t('setup.missingInfoMessage'));
      return;
    }

    setSaving(true);

    try {
      const geofenceService = getGeofenceService();

      // Request background permission
      const backgroundGranted = await geofenceService.requestBackgroundPermissions();

      if (!backgroundGranted) {
        // Show alert with option to continue anyway (useful for simulator testing)
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('setup.backgroundPermissionTitle'),
            t('setup.backgroundPermissionMessage'),
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: t('setup.continueAnyway'),
                onPress: () => resolve(true),
              },
            ]
          );
        });

        if (!shouldContinue) {
          setSaving(false);
          return;
        }
      }

      const location: UserLocation = {
        id: Crypto.randomUUID(),
        name: name.trim(),
        latitude: region.latitude,
        longitude: region.longitude,
        radiusMeters: radius,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      const db = await getDatabase();
      await db.insertLocation(location);

      // Register geofence ONLY if background permission granted
      if (backgroundGranted) {
        try {
          await geofenceService.registerGeofence(location);
          console.log('[SetupScreen] Geofence registered successfully');
        } catch (error) {
          console.warn('[SetupScreen] Failed to register geofence:', error);
        }
      } else {
        console.log('[SetupScreen] Skipping geofence registration (no background permission)');
      }

      setSaving(false);

      // Check if there are other locations - navigate accordingly
      const locations = await db.getActiveLocations();
      if (locations.length > 1) {
        // Multiple locations exist, go back to LocationsList
        navigation.navigate('LocationsList');
      } else {
        // First location, go to MainTabs (StatusScreen)
        navigation.navigate('MainTabs');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(t('common.error'), t('setup.saveFailed'));
      setSaving(false);
    }
  };

  const increaseRadius = () => {
    setRadius((prev) => Math.min(prev + 50, 1000));
  };

  const decreaseRadius = () => {
    setRadius((prev) => Math.max(prev - 50, 100));
  };

  const handleZoomIn = () => {
    const newRegion = {
      ...region,
      latitudeDelta: region.latitudeDelta / 2,
      longitudeDelta: region.longitudeDelta / 2,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  const handleZoomOut = () => {
    const newRegion = {
      ...region,
      latitudeDelta: region.latitudeDelta * 2,
      longitudeDelta: region.longitudeDelta * 2,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  const handleMyLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch (error) {
      console.error('[SetupScreen] Failed to get current location:', error);
      Alert.alert(t('common.error'), t('setup.getLocationFailed'));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>{t('setup.gettingLocation')}</Text>
        <Text style={styles.loadingHint}>{t('setup.gettingLocationHint')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation
          showsMyLocationButton={false}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Marker coordinate={region} draggable />
          <Circle
            center={region}
            radius={radius}
            strokeColor={MAP_CIRCLE_STROKE}
            fillColor={MAP_CIRCLE_FILL}
            strokeWidth={2}
          />
        </MapView>
      </View>

      {/* Map Controls */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMyLocation={handleMyLocation}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.controlsScroll}
          contentContainerStyle={styles.controls}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Input
            label={t('setup.locationName')}
            placeholder={t('setup.locationNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            testID="input-location-name"
            containerStyle={styles.inputContainer}
          />

          <Text style={styles.label}>{t('setup.geofenceRadius', { radius })}</Text>
          <View style={styles.radiusControls}>
            <Button
              variant="secondary"
              onPress={decreaseRadius}
              disabled={radius <= 100}
              icon={<Minus size={20} color={colors.text.primary} />}
              style={styles.radiusButton}
              testID="radius-decrease"
            >
              {''}
            </Button>

            <View style={styles.radiusDisplay}>
              <Text style={styles.radiusText}>{radius}m</Text>
            </View>

            <Button
              variant="secondary"
              onPress={increaseRadius}
              disabled={radius >= 1000}
              icon={<Plus size={20} color={colors.text.primary} />}
              style={styles.radiusButton}
              testID="radius-increase"
            >
              {''}
            </Button>
          </View>

          <Text style={styles.hint}>
            {t('setup.mapHint')}
          </Text>

          <Button
            onPress={handleSave}
            loading={saving}
            disabled={saving || !name.trim()}
            fullWidth
            testID="save-location-button"
          >
            {t('setup.saveLocation')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  loadingHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  map: {
    flex: 1,
  },
  keyboardAvoidingView: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  controlsScroll: {
    maxHeight: 320,
  },
  controls: {
    padding: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  radiusControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  radiusButton: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    paddingHorizontal: 0,
  },
  radiusDisplay: {
    marginHorizontal: spacing.xxxl,
  },
  radiusText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
});
