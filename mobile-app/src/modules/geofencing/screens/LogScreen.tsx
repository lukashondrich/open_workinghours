import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { TrackingManager } from '@/modules/geofencing/services/TrackingManager';
import type { TrackingSession } from '@/modules/geofencing/types';
import { format, formatDistanceToNow } from 'date-fns';

type LogScreenRouteProp = RouteProp<RootStackParamList, 'Log'>;

interface Props {
  route: LogScreenRouteProp;
}

export default function LogScreen({ route }: Props) {
  const { locationId } = route.params;
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [locationId]);

  const loadHistory = async () => {
    try {
      const db = await getDatabase();
      const manager = new TrackingManager(db);
      const history = await manager.getHistory(locationId, 50);
      setSessions(history);
      setLoading(false);
    } catch (error) {
      console.error('Error loading history:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const renderSessionItem = ({ item }: { item: TrackingSession }) => {
    const clockInDate = new Date(item.clockIn);
    const clockOutDate = item.clockOut ? new Date(item.clockOut) : null;
    const isActive = !item.clockOut;

    const formatTime = (date: Date) => {
      return format(date, 'h:mm a');
    };

    const formatDate = (date: Date) => {
      return format(date, 'MMM d, yyyy');
    };

    const getDuration = () => {
      if (item.durationMinutes === null) {
        return 'In progress';
      }
      const hours = Math.floor(item.durationMinutes / 60);
      const minutes = item.durationMinutes % 60;
      return `${hours}h ${minutes}m`;
    };

    const getMethodIcon = () => {
      return item.trackingMethod === 'geofence_auto' ? '🤖' : '✋';
    };

    return (
      <View style={[styles.sessionItem, isActive && styles.sessionItemActive]}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionDate}>{formatDate(clockInDate)}</Text>
          <Text style={styles.sessionMethod}>{getMethodIcon()}</Text>
        </View>

        <View style={styles.sessionTimes}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Clock In:</Text>
            <Text style={styles.timeValue}>{formatTime(clockInDate)}</Text>
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Clock Out:</Text>
            <Text style={[styles.timeValue, isActive && styles.activeText]}>
              {clockOutDate ? formatTime(clockOutDate) : 'Still working'}
            </Text>
          </View>
        </View>

        <View style={styles.sessionFooter}>
          <Text style={[styles.duration, isActive && styles.activeText]}>
            {getDuration()}
          </Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No work history yet</Text>
        <Text style={styles.emptyHint}>
          Your tracking sessions will appear here
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={sessions.length === 0 ? styles.emptyListContainer : undefined}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sessionItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sessionItemActive: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionMethod: {
    fontSize: 20,
  },
  sessionTimes: {
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  activeText: {
    color: '#4CAF50',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  duration: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
