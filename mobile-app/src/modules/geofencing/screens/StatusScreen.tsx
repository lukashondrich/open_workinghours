import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { useAuth } from '@/lib/auth/auth-context';
import { getDatabase, Database } from '@/modules/geofencing/services/Database';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import {
  loadDashboardData,
  DashboardData,
} from '@/modules/geofencing/services/DashboardDataService';
import PermissionWarningBanner from '@/modules/geofencing/components/PermissionWarningBanner';
import HoursSummaryWidget from '@/modules/geofencing/components/HoursSummaryWidget';
import NextShiftWidget from '@/modules/geofencing/components/NextShiftWidget';
import type { UserLocation } from '@/modules/geofencing/types';
import type { RootStackParamList, MainTabParamList } from '@/navigation/AppNavigator';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type StatusScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Status'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface LocationStatus {
  location: UserLocation;
  isCheckedIn: boolean;
  clockInTime?: string;
  elapsedMinutes?: number;
}

function CollapsedStatusLine({
  status,
  onCheckIn,
  onCheckOut,
  onLocationPress,
  index,
}: {
  status: LocationStatus;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onLocationPress: () => void;
  index: number;
}) {
  const { location, isCheckedIn, elapsedMinutes } = status;

  const formatElapsed = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const accessibilityLabel = isCheckedIn
    ? `${location.name}, ${t('status.checkedIn')}${elapsedMinutes !== undefined ? `, ${formatElapsed(elapsedMinutes)}` : ''}`
    : `${location.name}, ${t('status.notCheckedIn')}`;

  if (isCheckedIn) {
    // Active/clocked-in state - prominent design
    return (
      <View
        style={[styles.statusLineCard, styles.statusLineCardActive]}
        testID={`location-card-${index}`}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <TouchableOpacity
          style={styles.statusLineContent}
          onPress={onLocationPress}
          accessibilityLabel={`${location.name}, ${t('status.tapToManage')}`}
        >
          <View style={[styles.statusDot, styles.statusDotActive]} />
          <Text style={styles.locationName} numberOfLines={1}>
            {location.name}
          </Text>
        </TouchableOpacity>
        <View style={styles.activeControls}>
          <View style={styles.timeBadge} accessibilityElementsHidden={true}>
            <View style={styles.timeBadgeDot} />
            <Text style={styles.timeBadgeText}>
              {elapsedMinutes !== undefined ? formatElapsed(elapsedMinutes) : t('status.checkedIn')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.endButton}
            onPress={onCheckOut}
            accessibilityRole="button"
            accessibilityLabel={t('status.checkOut')}
            testID={`location-checkout-${index}`}
          >
            <Text style={styles.endButtonText}>{t('status.end')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Inactive/not clocked-in state
  return (
    <View
      style={styles.statusLineCard}
      testID={`location-card-${index}`}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <TouchableOpacity
        style={styles.statusLineContent}
        onPress={onLocationPress}
        accessibilityLabel={`${location.name}, ${t('status.tapToManage')}`}
      >
        <View style={[styles.statusDot, styles.statusDotInactive]} />
        <Text style={styles.locationName} numberOfLines={1}>
          {location.name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.checkInButton}
        onPress={onCheckIn}
        accessibilityRole="button"
        accessibilityLabel={t('status.checkIn')}
        testID={`location-checkin-${index}`}
      >
        <Text style={styles.checkInButtonText}>{t('status.checkIn')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function StatusScreen() {
  const navigation = useNavigation<StatusScreenNavigationProp>();
  const { state: authState } = useAuth();

  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(true);

  const loadAllData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const locations = await db.getActiveLocations();

      // Load location statuses
      const statuses: LocationStatus[] = [];
      for (const location of locations) {
        const activeSession = await db.getActiveSession(location.id);

        if (activeSession && !activeSession.clockOut) {
          const checkInDate = new Date(activeSession.clockIn);
          const now = new Date();
          const elapsedMs = now.getTime() - checkInDate.getTime();
          const elapsedMinutes = Math.floor(elapsedMs / 60000);

          statuses.push({
            location,
            isCheckedIn: true,
            clockInTime: activeSession.clockIn,
            elapsedMinutes,
          });
        } else {
          statuses.push({
            location,
            isCheckedIn: false,
          });
        }
      }
      setLocationStatuses(statuses);

      // Load dashboard data (pass account creation date for accurate display)
      const dashboard = await loadDashboardData(authState.user?.createdAt);
      setDashboardData(dashboard);

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('[StatusScreen] Failed to load data:', error);
      Alert.alert(t('common.error'), t('status.failedToLoadData'));
      setLoading(false);
      setRefreshing(false);
    }
  }, [authState.user?.createdAt]);

  const checkBackgroundPermission = async () => {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      setHasBackgroundPermission(status === 'granted');
    } catch (error) {
      console.error('[StatusScreen] Failed to check background permission:', error);
    }
  };

  // Process any pending exits that may have expired (fallback mechanism)
  const processPendingExitsIfNeeded = useCallback(async () => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);
      await trackingManager.processPendingExits();
    } catch (error) {
      console.error('[StatusScreen] Error processing pending exits:', error);
    }
  }, []);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
      checkBackgroundPermission();

      // Fallback: process any pending exits when user opens app
      // This catches cases where verification notifications didn't fire
      processPendingExitsIfNeeded();
    }, [loadAllData, processPendingExitsIfNeeded])
  );

  // Update every 60 seconds for live data
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadAllData]);

  // Update elapsed times every minute (for checked-in status)
  useEffect(() => {
    const interval = setInterval(() => {
      setLocationStatuses((prevStatuses) =>
        prevStatuses.map((status) => {
          if (status.isCheckedIn && status.clockInTime) {
            const checkInDate = new Date(status.clockInTime);
            const now = new Date();
            const elapsedMs = now.getTime() - checkInDate.getTime();
            const elapsedMinutes = Math.floor(elapsedMs / 60000);
            return { ...status, elapsedMinutes };
          }
          return status;
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleManualCheckIn = async (locationId: string) => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);
      await trackingManager.clockIn(locationId);
      Alert.alert(t('common.success'), t('status.manualCheckInSuccess'));
      await loadAllData();
    } catch (error) {
      console.error('[StatusScreen] Failed to check in:', error);
      if (error instanceof Error && error.message.includes('Already clocked in')) {
        Alert.alert(t('status.alreadyCheckedIn'), t('status.alreadyCheckedInMessage'));
        await loadAllData();
      } else {
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('status.failedToCheckIn'));
      }
    }
  };

  const handleManualCheckOut = async (locationId: string) => {
    try {
      const db = await getDatabase();
      const trackingManager = new TrackingManager(db);
      await trackingManager.clockOut(locationId);
      Alert.alert(t('common.success'), t('status.manualCheckOutSuccess'));
      await loadAllData();
    } catch (error) {
      console.error('[StatusScreen] Failed to check out:', error);
      if (error instanceof Error && error.message.includes('No active session')) {
        Alert.alert(t('status.notCurrentlyCheckedIn'), t('status.notCurrentlyCheckedInMessage'));
        await loadAllData();
      } else {
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('status.failedToCheckOut'));
      }
    }
  };

  const handleNavigateToCalendar = () => {
    navigation.navigate('Calendar', {});
  };

  const handleNavigateToCalendarWithDate = (date: string) => {
    navigation.navigate('Calendar', { targetDate: date });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleAddWorkplace = () => {
    navigation.navigate('Setup');
  };

  const handleLocationPress = (location: UserLocation) => {
    // Navigate to tracking screen for this specific location
    navigation.navigate('Tracking', { locationId: location.id });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>{t('status.loadingStatus')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('status.appTitle')}</Text>
      </View>

      {/* Permission Warning Banner */}
      <PermissionWarningBanner visible={!hasBackgroundPermission} />

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Collapsed Status Lines */}
        {locationStatuses.length > 0 ? (
          <View style={styles.statusSection}>
            {locationStatuses.map((status, index) => (
              <CollapsedStatusLine
                key={status.location.id}
                status={status}
                index={index}
                onCheckIn={() => handleManualCheckIn(status.location.id)}
                onCheckOut={() => handleManualCheckOut(status.location.id)}
                onLocationPress={() => handleLocationPress(status.location)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyLocationState}>
            <MapPin size={32} color={colors.text.tertiary} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{t('status.noLocations')}</Text>
            <Text style={styles.emptySubtext}>
              {t('status.noLocationsHint')}
            </Text>
            <TouchableOpacity
              style={styles.addWorkplaceButton}
              onPress={handleAddWorkplace}
              accessibilityRole="button"
              accessibilityLabel={t('status.addWorkplace')}
              testID="add-workplace-button"
            >
              <MapPin size={18} color={colors.white} />
              <Text style={styles.addWorkplaceButtonText}>{t('status.addWorkplace')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hours Summary Widget */}
        {dashboardData && (
          <HoursSummaryWidget
            data={dashboardData.hoursSummary}
            isLive={dashboardData.isLive}
            onPress={handleNavigateToCalendar}
          />
        )}

        {/* Next Shift Widget */}
        {dashboardData && (
          <NextShiftWidget
            nextShift={dashboardData.nextShift}
            onPress={() =>
              dashboardData.nextShift
                ? handleNavigateToCalendarWithDate(dashboardData.nextShift.date)
                : handleNavigateToCalendar()
            }
          />
        )}
      </ScrollView>
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
    backgroundColor: colors.background.default,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  statusSection: {
    marginBottom: spacing.sm,
  },
  statusLineCard: {
    backgroundColor: colors.background.paper,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  statusLineCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  statusLineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusDotActive: {
    backgroundColor: colors.primary[500],
  },
  statusDotInactive: {
    backgroundColor: colors.grey[400],
  },
  locationName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  activeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  timeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  timeBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  endButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.grey[200],
  },
  endButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  checkInButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: borderRadius.sm,
  },
  checkInButtonText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  emptyLocationState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: 40,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
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
    marginBottom: spacing.lg,
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  addWorkplaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  addWorkplaceButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  tapHint: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginHorizontal: spacing.xl,
  },
});
