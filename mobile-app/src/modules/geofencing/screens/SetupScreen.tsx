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
import * as Crypto from 'expo-crypto';
import type { UserLocation } from '@/modules/geofencing/types';

type SetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Setup'>;

interface Props {
  navigation: SetupScreenNavigationProp;
}

export default function SetupScreen({ navigation }: Props) {
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
  const [existingLocations, setExistingLocations] = useState<UserLocation[]>([]);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    // First check for existing locations
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();
      setExistingLocations(locations);
      console.log('[SetupScreen] Found existing locations:', locations.length);
    } catch (error) {
      console.error('[SetupScreen] Error loading existing locations:', error);
    }

    // Then request permissions and get location
    await requestPermissionsAndGetLocation();
  };

  const requestPermissionsAndGetLocation = async () => {
    try {
      const geofenceService = getGeofenceService();

      // Request foreground permission first
      const foregroundGranted = await geofenceService.requestForegroundPermissions();

      if (!foregroundGranted) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to set up geofencing.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location');
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

      // Register geofence (may fail in simulator without background permission)
      try {
        await geofenceService.registerGeofence(location);
        console.log('[SetupScreen] Geofence registered successfully');
      } catch (error) {
        console.warn('[SetupScreen] Failed to register geofence (expected in simulator):', error);
      }

      setSaving(false);

      // Navigate to tracking screen
      navigation.navigate('Tracking', { locationId: location.id });
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
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

      <View style={styles.controls}>
        {/* Debug Panel: Show existing locations */}
        {existingLocations.length > 0 && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>
              ✅ Database Working! Found {existingLocations.length} location(s):
            </Text>
            {existingLocations.map((loc) => (
              <View key={loc.id} style={styles.locationItem}>
                <Text style={styles.locationName}>📍 {loc.name}</Text>
                <Text style={styles.locationDetails}>
                  Radius: {loc.radiusMeters}m | Created: {new Date(loc.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => navigation.navigate('Tracking', { locationId: existingLocations[0].id })}
            >
              <Text style={styles.continueButtonText}>Continue to Tracking</Text>
            </TouchableOpacity>
          </View>
        )}

        {existingLocations.length === 0 && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugWarning}>⚠️ No saved locations found in database</Text>
            <Text style={styles.debugSubtext}>This is normal for first launch, or if data didn't persist</Text>
          </View>
        )}

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
  debugPanel: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d7a2d',
    marginBottom: 8,
  },
  debugWarning: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#d97706',
    marginBottom: 4,
  },
  debugSubtext: {
    fontSize: 12,
    color: '#666',
  },
  locationItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationDetails: {
    fontSize: 11,
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#2d7a2d',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
