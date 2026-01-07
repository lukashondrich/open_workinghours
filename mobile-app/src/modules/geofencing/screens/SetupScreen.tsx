import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard,
  ScrollView,
} from 'react-native';
import MapView, { Circle, Marker, Region, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { Minus, Plus, Search, X, ChevronLeft, MapPin } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { Button, Input } from '@/components/ui';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getGeofenceService } from '@/modules/geofencing/services/GeofenceService';
import { searchLocations, GeocodingResult, isGeocodingAvailable, SearchOptions } from '@/modules/geofencing/services/GeocodingService';
import type { UserLocation } from '@/modules/geofencing/types';

type SetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Setup'>;
type SetupScreenRouteProp = RouteProp<RootStackParamList, 'Setup'>;

interface Props {
  navigation: SetupScreenNavigationProp;
  route: SetupScreenRouteProp;
}

// Map circle colors using primary theme color
const MAP_CIRCLE_STROKE = 'rgba(46, 139, 107, 0.6)';
const MAP_CIRCLE_FILL = 'rgba(46, 139, 107, 0.2)';

type Step = 1 | 2 | 3;

interface PinCoordinate {
  latitude: number;
  longitude: number;
}

// Step indicator dots component
function StepIndicator({ currentStep }: { currentStep: Step }) {
  return (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            step === currentStep && styles.stepDotActive,
            step < currentStep && styles.stepDotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

export default function SetupScreen({ navigation, route }: Props) {
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Edit mode
  const editLocation = route.params?.editLocation;
  const isEditMode = !!editLocation;

  // Step state - start at step 2 in edit mode (skip search)
  const [step, setStep] = useState<Step>(isEditMode ? 2 : 1);

  // Location data - pre-populate in edit mode
  const [pinCoordinate, setPinCoordinate] = useState<PinCoordinate | null>(
    editLocation ? { latitude: editLocation.latitude, longitude: editLocation.longitude } : null
  );
  const [radius, setRadius] = useState(editLocation?.radiusMeters ?? 200);
  const [name, setName] = useState(editLocation?.name ?? '');

  // Map region (separate from pin - allows panning without moving pin)
  const [region, setRegion] = useState<Region>({
    latitude: editLocation?.latitude ?? 37.78825,
    longitude: editLocation?.longitude ?? -122.4324,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // UI state
  const [loading, setLoading] = useState(!isEditMode); // Skip loading in edit mode
  const [saving, setSaving] = useState(false);

  // Check if geocoding is available
  const geocodingEnabled = isGeocodingAvailable();

  useEffect(() => {
    if (!isEditMode) {
      requestPermissionsAndGetLocation();
    }
  }, [isEditMode]);

  const requestPermissionsAndGetLocation = async () => {
    try {
      console.log('[SetupScreen] Starting location permission request...');
      const geofenceService = getGeofenceService();

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
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (locationError) {
        console.warn('[SetupScreen] Failed to get location, using default:', locationError);
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

  // Debounced search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!text.trim() || text.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchLocations(text, {
        proximity: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
      });
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, []);

  const handleSearchResultSelect = (result: GeocodingResult) => {
    // Place pin at search result location
    setPinCoordinate({
      latitude: result.latitude,
      longitude: result.longitude,
    });

    // Center map on result
    const newRegion = {
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 500);

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  const handleMapPress = (event: MapPressEvent) => {
    // Allow tap-to-place in step 1 and step 2
    if (step !== 1 && step !== 2) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPinCoordinate({ latitude, longitude });

    // Clear search if active (step 1 only)
    if (showSearchResults) {
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handlePinDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPinCoordinate({ latitude, longitude });
  };

  const increaseRadius = () => {
    setRadius((prev) => Math.min(prev + 50, 1000));
  };

  const decreaseRadius = () => {
    setRadius((prev) => Math.max(prev - 50, 100));
  };

  const handleContinue = () => {
    if (step === 1 && pinCoordinate) {
      // Center map on pin for step 2
      const newRegion = {
        latitude: pinCoordinate.latitude,
        longitude: pinCoordinate.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 300);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      if (isEditMode) {
        // In edit mode, go back to locations list
        navigation.goBack();
      } else {
        setStep(1);
      }
    } else if (step === 3) {
      setStep(2);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !pinCoordinate) {
      Alert.alert(t('setup.missingInfoTitle'), t('setup.missingInfoMessage'));
      return;
    }

    setSaving(true);

    try {
      const geofenceService = getGeofenceService();
      const backgroundGranted = await geofenceService.requestBackgroundPermissions();

      if (!backgroundGranted) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('setup.backgroundPermissionTitle'),
            t('setup.backgroundPermissionMessage'),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('setup.continueAnyway'), onPress: () => resolve(true) },
            ]
          );
        });

        if (!shouldContinue) {
          setSaving(false);
          return;
        }
      }

      const db = await getDatabase();

      if (isEditMode && editLocation) {
        // Update existing location
        await db.updateLocation(editLocation.id, {
          name: name.trim(),
          latitude: pinCoordinate.latitude,
          longitude: pinCoordinate.longitude,
          radiusMeters: radius,
        });

        // Re-register geofence with new coordinates/radius
        if (backgroundGranted) {
          try {
            await geofenceService.unregisterGeofence(editLocation.id);
            const updatedLocation = await db.getLocation(editLocation.id);
            if (updatedLocation) {
              await geofenceService.registerGeofence(updatedLocation);
            }
            console.log('[SetupScreen] Geofence updated successfully');
          } catch (error) {
            console.warn('[SetupScreen] Failed to update geofence:', error);
          }
        }

        setSaving(false);
        navigation.navigate('LocationsList');
      } else {
        // Create new location
        const location: UserLocation = {
          id: Crypto.randomUUID(),
          name: name.trim(),
          latitude: pinCoordinate.latitude,
          longitude: pinCoordinate.longitude,
          radiusMeters: radius,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.insertLocation(location);

        if (backgroundGranted) {
          try {
            await geofenceService.registerGeofence(location);
            console.log('[SetupScreen] Geofence registered successfully');
          } catch (error) {
            console.warn('[SetupScreen] Failed to register geofence:', error);
          }
        }

        setSaving(false);

        const locations = await db.getActiveLocations();
        if (locations.length > 1) {
          navigation.navigate('LocationsList');
        } else {
          navigation.navigate('MainTabs');
        }
      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(t('common.error'), t('setup.saveFailed'));
      setSaving(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
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

  // Render search results
  const renderSearchResult = ({ item }: { item: GeocodingResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleSearchResultSelect(item)}
    >
      <MapPin size={18} color={colors.text.secondary} />
      <View style={styles.searchResultText}>
        <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.searchResultAddress} numberOfLines={1}>{item.address}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Step Indicator */}
      <View style={styles.headerBar}>
        {step > 1 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
        <StepIndicator currentStep={step} />
        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Step 1: Search / Tap to place */}
      {step === 1 && (
        <>
          {/* Search Bar */}
          {geocodingEnabled && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <Search size={18} color={colors.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder={t('setup.searchPlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={() => searchQuery.length >= 3 && setShowSearchResults(true)}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                    <X size={18} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <View style={styles.searchResultsContainer}>
                  {isSearching ? (
                    <View style={styles.searchLoading}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    </View>
                  ) : searchResults.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id}
                      renderItem={renderSearchResult}
                      keyboardShouldPersistTaps="handled"
                      style={styles.searchResultsList}
                    />
                  ) : (
                    <Text style={styles.noResults}>{t('setup.searchNoResults')}</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton={false}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              {pinCoordinate && (
                <Marker
                  coordinate={pinCoordinate}
                  draggable
                  onDragEnd={handlePinDragEnd}
                />
              )}
            </MapView>

            {/* Tap hint overlay */}
            {!pinCoordinate && (
              <View style={styles.tapHintOverlay} pointerEvents="none">
                <View style={styles.tapHintBadge}>
                  <Text style={styles.tapHintText}>{t('setup.tapToPlace')}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Continue button */}
          <View style={styles.bottomPanel}>
            <Text style={styles.stepTitle}>{t('setup.step1Title')}</Text>
            <Button
              onPress={handleContinue}
              disabled={!pinCoordinate}
              fullWidth
            >
              {t('setup.continue')}
            </Button>
          </View>
        </>
      )}

      {/* Step 2: Fine-tune position + radius */}
      {step === 2 && pinCoordinate && (
        <>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton={false}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker
                coordinate={pinCoordinate}
                draggable
                onDragEnd={handlePinDragEnd}
              />
              <Circle
                center={pinCoordinate}
                radius={radius}
                strokeColor={MAP_CIRCLE_STROKE}
                fillColor={MAP_CIRCLE_FILL}
                strokeWidth={2}
              />
            </MapView>
          </View>

          <View style={styles.bottomPanel}>
            <Text style={styles.stepTitle}>{isEditMode ? t('setup.editStep2Title') : t('setup.step2Title')}</Text>
            <Text style={styles.stepHint}>{t('setup.dragToAdjust')}</Text>

            {/* Radius controls */}
            <Text style={styles.label}>{t('setup.geofenceRadius', { radius })}</Text>
            <View style={styles.radiusControls}>
              <Button
                variant="secondary"
                onPress={decreaseRadius}
                disabled={radius <= 100}
                icon={<Minus size={20} color={colors.text.primary} />}
                style={styles.radiusButton}
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
              >
                {''}
              </Button>
            </View>

            <Button onPress={handleContinue} fullWidth>
              {t('setup.continue')}
            </Button>
          </View>
        </>
      )}

      {/* Step 3: Name the location */}
      {step === 3 && pinCoordinate && (
        <>
          {/* Mini map preview */}
          <View style={styles.miniMapContainer}>
            <MapView
              style={styles.miniMap}
              region={{
                latitude: pinCoordinate.latitude,
                longitude: pinCoordinate.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={pinCoordinate} />
              <Circle
                center={pinCoordinate}
                radius={radius}
                strokeColor={MAP_CIRCLE_STROKE}
                fillColor={MAP_CIRCLE_FILL}
                strokeWidth={2}
              />
            </MapView>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.step3Panel}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
          >
            <ScrollView
              contentContainerStyle={styles.step3Content}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={styles.stepTitle}>{isEditMode ? t('setup.editStep3Title') : t('setup.step3Title')}</Text>

              <Input
                label={t('setup.locationNameLabel')}
                placeholder={t('setup.locationNamePlaceholder')}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
                containerStyle={styles.nameInput}
              />

              <Button
                onPress={handleSave}
                loading={saving}
                disabled={saving || !name.trim()}
                fullWidth
              >
                {isEditMode ? t('setup.update') : t('setup.save')}
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
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

  // Header with step indicator
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.paper,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.grey[300],
  },
  stepDotActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: colors.primary[300],
  },

  // Search
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...shadows.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  clearButton: {
    padding: spacing.sm,
  },
  searchResultsContainer: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    maxHeight: 200,
    ...shadows.md,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: spacing.sm,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  searchResultAddress: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  searchLoading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  noResults: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  tapHintOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapHintBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
  },
  tapHintText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: colors.background.paper,
    padding: spacing.xl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  stepTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  stepHint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
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

  // Step 3 specific
  miniMapContainer: {
    height: 200,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  miniMap: {
    flex: 1,
  },
  step3Panel: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  step3Content: {
    padding: spacing.xl,
  },
  nameInput: {
    marginBottom: spacing.xl,
  },
});
