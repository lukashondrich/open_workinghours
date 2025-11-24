import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import MapControls from '@/modules/geofencing/components/MapControls';
import * as Crypto from 'expo-crypto';
import type { UserLocation } from '@/modules/geofencing/types';

type SetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Setup'>;

interface Props {
  navigation: SetupScreenNavigationProp;
}

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
          'Permission Required',
          'Location permission is required to set up geofencing.',
          [{ text: 'OK' }]
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
          'Location Unavailable',
          'Could not get your current location. You can manually position the map.',
          [{ text: 'OK' }]
        );
      }

      setLoading(false);
    } catch (error) {
      console.error('[SetupScreen] Error in permission/location request:', error);
      Alert.alert('Error', 'Failed to initialize location services');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter a location name');
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
            'Background Permission Required',
            'Background location permission is required for automatic tracking. You can continue anyway, but automatic clock-in/out will not work.\n\nTo enable: Settings → [App] → Location → Always Allow',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Continue Anyway',
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
      Alert.alert('Error', 'Failed to save location. Please try again.');
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
      Alert.alert('Error', 'Failed to get your location');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
        <Text style={styles.loadingHint}>This may take a few seconds</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker coordinate={region} draggable />
        <Circle
          center={region}
          radius={radius}
          strokeColor="rgba(0, 122, 255, 0.5)"
          fillColor="rgba(0, 122, 255, 0.2)"
          strokeWidth={2}
        />
      </MapView>

      {/* Map Controls */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMyLocation={handleMyLocation}
      />

      <View style={styles.controls}>
        <Text style={styles.label}>Location Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., UCSF Medical Center"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Geofence Radius: {radius}m</Text>
        <View style={styles.radiusControls}>
          <TouchableOpacity
            style={styles.radiusButton}
            onPress={decreaseRadius}
            disabled={radius <= 100}
          >
            <Text style={styles.radiusButtonText}>−</Text>
          </TouchableOpacity>

          <View style={styles.radiusDisplay}>
            <Text style={styles.radiusText}>{radius}m</Text>
          </View>

          <TouchableOpacity
            style={styles.radiusButton}
            onPress={increaseRadius}
            disabled={radius >= 1000}
          >
            <Text style={styles.radiusButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Drag the map to position the marker at your workplace. The circle shows
          the automatic tracking zone.
        </Text>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  loadingHint: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  map: {
    flex: 1,
  },
  controls: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  radiusControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  radiusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  radiusDisplay: {
    marginHorizontal: 30,
  },
  radiusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
