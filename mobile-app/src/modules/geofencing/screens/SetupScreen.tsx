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
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { v4 as uuidv4 } from 'uuid';
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

  useEffect(() => {
    requestPermissionsAndGetLocation();
  }, []);

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
        Alert.alert(
          'Background Permission Required',
          'Background location permission is required for automatic tracking. Please enable "Always Allow" in Settings.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      const location: UserLocation = {
        id: uuidv4(),
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

      // Register geofence
      await geofenceService.registerGeofence(location);

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
        provider={PROVIDER_GOOGLE}
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
