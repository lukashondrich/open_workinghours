import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import MapControls from '@/modules/geofencing/components/MapControls';
import type { UserLocation } from '@/modules/geofencing/types';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MAX_LOCATIONS = 5;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const bottomSheetRef = useRef<RBSheet>(null);
  const mapRef = useRef<MapView>(null);

  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<UserLocation | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    loadLocations();
    getCurrentLocation();

    // Open bottom sheet after short delay
    const timer = setTimeout(() => {
      bottomSheetRef.current?.open();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const loadLocations = async () => {
    try {
      const db = await getDatabase();
      const locs = await db.getActiveLocations();
      setLocations(locs);

      // Set first location as selected if none selected
      if (locs.length > 0 && !selectedLocation) {
        setSelectedLocation(locs[0]);
        setRegion({
          latitude: locs[0].latitude,
          longitude: locs[0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to load locations:', error);
      Alert.alert('Error', 'Failed to load locations');
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});

        // Only update region if no locations exist yet
        if (locations.length === 0) {
          setRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to get current location:', error);
    }
  };

  const handleLocationTap = (location: UserLocation) => {
    setSelectedLocation(location);

    // Animate map to location
    setRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    // Navigate to tracking screen
    navigation.navigate('Tracking', { locationId: location.id });
  };

  const handleAddLocation = () => {
    if (locations.length >= MAX_LOCATIONS) {
      Alert.alert(
        'Maximum Locations Reached',
        `You can only save up to ${MAX_LOCATIONS} locations.`,
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('Setup');
  };

  const handleLocationLongPress = (location: UserLocation) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Location', 'Delete Location'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEditLocation(location);
          } else if (buttonIndex === 2) {
            handleDeleteLocation(location);
          }
        }
      );
    } else {
      // Android: Use Alert with buttons
      Alert.alert(
        location.name,
        'Choose an action',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Location', onPress: () => handleEditLocation(location) },
          {
            text: 'Delete Location',
            style: 'destructive',
            onPress: () => handleDeleteLocation(location),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleEditLocation = (location: UserLocation) => {
    // TODO: Navigate to SetupScreen with edit mode
    Alert.alert('Edit Location', `Editing ${location.name} - Coming soon!`);
  };

  const handleDeleteLocation = (location: UserLocation) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"? This will also delete all tracking history for this location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              const geofenceService = getGeofenceService();

              // Unregister geofence
              await geofenceService.unregisterGeofence(location.id);

              // Delete from database
              await db.deleteLocation(location.id);

              // Reload locations
              await loadLocations();

              Alert.alert('Success', 'Location deleted');
            } catch (error) {
              console.error('[HomeScreen] Failed to delete location:', error);
              Alert.alert('Error', 'Failed to delete location');
            }
          },
        },
      ]
    );
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
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to get current location:', error);
    }
  };

  const renderLocationCard = ({ item }: { item: UserLocation }) => {
    const isSelected = selectedLocation?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.locationCard, isSelected && styles.locationCardSelected]}
        onPress={() => handleLocationTap(item)}
        onLongPress={() => handleLocationLongPress(item)}
        delayLongPress={500}
      >
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Show circle for selected location */}
        {selectedLocation && (
          <>
            <Marker
              coordinate={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }}
              title={selectedLocation.name}
            />
            <Circle
              center={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }}
              radius={selectedLocation.radiusMeters}
              strokeColor="rgba(0, 122, 255, 0.5)"
              fillColor="rgba(0, 122, 255, 0.2)"
              strokeWidth={2}
            />
          </>
        )}
      </MapView>

      {/* Map Controls */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMyLocation={handleMyLocation}
      />

      {/* Bottom Sheet */}
      <RBSheet
        ref={bottomSheetRef}
        height={SCREEN_HEIGHT * 0.4}
        openDuration={250}
        closeDuration={200}
        customStyles={{
          wrapper: {
            backgroundColor: 'rgba(0,0,0,0.3)',
          },
          draggableIcon: {
            backgroundColor: '#000',
            width: 50,
          },
          container: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          },
        }}
      >
        <View style={styles.bottomSheetContent}>
          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>
              📍 My Locations ({locations.length}/{MAX_LOCATIONS})
            </Text>
          </View>

          {/* Location List */}
          <FlatList
            data={locations}
            keyExtractor={(item) => item.id}
            renderItem={renderLocationCard}
            contentContainerStyle={styles.locationList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No locations saved yet</Text>
                <Text style={styles.emptySubtext}>
                  Add your first work location to start tracking
                </Text>
              </View>
            }
          />

          {/* Add Location Button */}
          <TouchableOpacity
            style={[
              styles.addButton,
              locations.length >= MAX_LOCATIONS && styles.addButtonDisabled,
            ]}
            onPress={handleAddLocation}
            disabled={locations.length >= MAX_LOCATIONS}
          >
            <Text style={styles.addButtonText}>+ Add New Location</Text>
          </TouchableOpacity>
        </View>
      </RBSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomSheetHeader: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  locationList: {
    paddingVertical: 15,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
