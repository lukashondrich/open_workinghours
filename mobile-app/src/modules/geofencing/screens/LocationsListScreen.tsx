import React, { useState, useRef } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MapPin, Plus, ChevronUp, ChevronDown } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import MapControls from '@/modules/geofencing/components/MapControls';
import type { UserLocation } from '@/modules/geofencing/types';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type LocationsListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MAX_LOCATIONS = 5;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_PANEL_HEIGHT = 88;
const EXPANDED_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.5, 360);

// Map circle colors using primary theme color
const MAP_CIRCLE_STROKE = 'rgba(46, 139, 107, 0.6)';
const MAP_CIRCLE_FILL = 'rgba(46, 139, 107, 0.2)';

export default function LocationsListScreen() {
  const navigation = useNavigation<LocationsListScreenNavigationProp>();
  const mapRef = useRef<MapView>(null);

  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<UserLocation | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadLocations();
      getCurrentLocation();
    }, [])
  );

  const loadLocations = async () => {
    try {
      const db = await getDatabase();
      const locs = await db.getActiveLocations();
      setLocations(locs);

      // Set first location as selected and center map if none selected
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
      console.error('[LocationsListScreen] Failed to load locations:', error);
      Alert.alert(t('common.error'), t('locations.loadFailed'));
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
      console.error('[LocationsListScreen] Failed to get current location:', error);
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
        t('locations.maxReachedTitle'),
        t('locations.maxReachedMessage', { max: MAX_LOCATIONS }),
        [{ text: t('common.ok') }]
      );
      return;
    }

    navigation.navigate('Setup');
  };

  const handleLocationLongPress = (location: UserLocation) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('locations.editLocation'), t('locations.deleteLocation')],
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
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('locations.editLocation'), onPress: () => handleEditLocation(location) },
          {
            text: t('locations.deleteLocation'),
            style: 'destructive',
            onPress: () => handleDeleteLocation(location),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleEditLocation = (location: UserLocation) => {
    navigation.navigate('Setup', {
      editLocation: {
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: location.radiusMeters,
      },
    });
  };

  const handleDeleteLocation = (location: UserLocation) => {
    Alert.alert(
      t('locations.deleteConfirmTitle'),
      t('locations.deleteConfirmMessage', { name: location.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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

              Alert.alert(t('common.success'), t('locations.deleteSuccess'));
            } catch (error) {
              console.error('[LocationsListScreen] Failed to delete location:', error);
              Alert.alert(t('common.error'), t('locations.deleteFailed'));
            }
          },
        },
      ]
    );
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
      console.error('[LocationsListScreen] Failed to get current location:', error);
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
        <MapPin size={24} color={isSelected ? colors.primary[500] : colors.text.secondary} />
        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{item.name}</Text>
          <Text style={styles.locationRadius}>{t('locations.radiusLabel', { radius: item.radiusMeters })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const panelHeight = isPanelExpanded ? EXPANDED_PANEL_HEIGHT : COLLAPSED_PANEL_HEIGHT;

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
        {/* Show all location markers and circles */}
        {locations.map((location) => (
          <React.Fragment key={location.id}>
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              title={location.name}
            />
            <Circle
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              radius={location.radiusMeters}
              strokeColor={MAP_CIRCLE_STROKE}
              fillColor={MAP_CIRCLE_FILL}
              strokeWidth={2}
            />
          </React.Fragment>
        ))}
      </MapView>

      {/* Map Controls */}
      <MapControls
        onMyLocation={handleMyLocation}
        bottomOffset={panelHeight + 16}
      />

      {/* Location Panel */}
      <View style={[styles.panel, { height: panelHeight }]}>
        <TouchableOpacity
          style={[styles.panelHeader, isPanelExpanded && styles.panelHeaderExpanded]}
          onPress={() => setIsPanelExpanded((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.panelTitle}>
            {t('locations.panelHeader', { count: locations.length, max: MAX_LOCATIONS })}
          </Text>
          {isPanelExpanded ? (
            <ChevronDown size={20} color={colors.text.secondary} />
          ) : (
            <ChevronUp size={20} color={colors.text.secondary} />
          )}
        </TouchableOpacity>

        {isPanelExpanded ? (
          <>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              renderItem={renderLocationCard}
              contentContainerStyle={styles.locationList}
              showsVerticalScrollIndicator={false}
              style={styles.panelList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{t('locations.emptyTitle')}</Text>
                  <Text style={styles.emptySubtext}>
                    {t('locations.emptySubtitle')}
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={[
                styles.addButton,
                locations.length >= MAX_LOCATIONS && styles.addButtonDisabled,
              ]}
              onPress={handleAddLocation}
              disabled={locations.length >= MAX_LOCATIONS}
            >
              <Plus size={20} color={colors.white} />
              <Text style={styles.addButtonText}>{t('locations.addNew')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.panelHint}>{t('locations.panelHint')}</Text>
        )}
      </View>
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
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  panelHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  panelTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  panelHint: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  panelList: {
    flex: 1,
  },
  locationList: {
    paddingVertical: spacing.lg,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.transparent,
    gap: spacing.md,
  },
  locationCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  locationRadius: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  addButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addButtonDisabled: {
    backgroundColor: colors.grey[400],
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
