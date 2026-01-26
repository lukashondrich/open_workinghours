import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, Bot, Hand, Download, ClipboardList, Check, Circle } from 'lucide-react-native';

import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { exportSessionsToCSV } from '@/modules/geofencing/utils/exportHistory';
import type { UserLocation, TrackingSession } from '@/modules/geofencing/types';
import type { ConfirmedDayStatus } from '@/lib/calendar/types';

type LogScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Log'>;
type LogScreenRouteProp = RouteProp<RootStackParamList, 'Log'>;

interface Props {
  navigation: LogScreenNavigationProp;
  route: LogScreenRouteProp;
}

type DatePreset = 'week' | 'month' | 'all';

interface DayGroup {
  date: string; // YYYY-MM-DD
  title: string; // Formatted display title
  data: TrackingSession[];
  isConfirmed: boolean;
}

// Helper functions
function formatDate(isoString: string): string {
  return isoString.split('T')[0];
}

function formatDateTitle(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function formatTotalHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function getDateBounds(preset: DatePreset): { start: string | null; end: string } {
  const today = new Date();
  const end = formatDate(today.toISOString());

  switch (preset) {
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: formatDate(weekAgo.toISOString()), end };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: formatDate(monthAgo.toISOString()), end };
    }
    case 'all':
      return { start: null, end };
  }
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const todayStr = formatDate(today.toISOString());
  return dateStr === todayStr;
}

function groupSessionsByDate(
  sessions: TrackingSession[],
  confirmedDays: Record<string, ConfirmedDayStatus>
): DayGroup[] {
  const groups: Map<string, TrackingSession[]> = new Map();

  for (const session of sessions) {
    const date = formatDate(session.clockIn);
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(session);
  }

  // Convert to array and sort by date descending
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, data]) => {
      const dayStatus = confirmedDays[date];
      const isConfirmed = dayStatus?.status === 'confirmed' || dayStatus?.status === 'locked';
      return {
        date,
        title: formatDateTitle(date),
        data,
        isConfirmed,
      };
    });
}

function computeLiveDuration(clockIn: string): number {
  const start = new Date(clockIn).getTime();
  const now = Date.now();
  return Math.floor((now - start) / 60000);
}

// Inline components
function SessionCard({ session }: { session: TrackingSession }) {
  const isActive = session.state === 'active' || session.state === 'pending_exit';
  const duration = isActive
    ? computeLiveDuration(session.clockIn)
    : session.durationMinutes;

  return (
    <View style={[styles.sessionCard, isActive && styles.sessionCardActive]}>
      <View style={styles.sessionTimeRow}>
        <Text style={styles.sessionTime}>
          {formatTime(session.clockIn)} – {session.clockOut ? formatTime(session.clockOut) : t('log.ongoing')}
        </Text>
        <Text style={styles.sessionDuration}>{formatDuration(duration)}</Text>
      </View>
      <View style={styles.sessionMetaRow}>
        {session.trackingMethod === 'geofence_auto' ? (
          <>
            <Bot size={14} color={colors.text.tertiary} />
            <Text style={styles.sessionMethod}>{t('log.automatic')}</Text>
          </>
        ) : (
          <>
            <Hand size={14} color={colors.text.tertiary} />
            <Text style={styles.sessionMethod}>{t('log.manual')}</Text>
          </>
        )}
        {isActive && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{t('log.active')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DateHeader({
  title,
  date,
  isConfirmed,
  onPress,
}: {
  title: string;
  date: string;
  isConfirmed: boolean;
  onPress: () => void;
}) {
  // Don't show indicator for today (can't confirm yet)
  const isTodayDate = isToday(date);

  return (
    <TouchableOpacity style={styles.dateHeader} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.dateHeaderText}>{title}</Text>
      {!isTodayDate && (
        isConfirmed ? (
          <View style={styles.confirmedBadge}>
            <Check size={12} color={colors.primary[600]} strokeWidth={3} />
            <Text style={styles.confirmedText}>{t('log.confirmed')}</Text>
          </View>
        ) : (
          <View style={styles.unconfirmedBadge}>
            <Text style={styles.unconfirmedText}>{t('log.tapToConfirm')}</Text>
          </View>
        )
      )}
    </TouchableOpacity>
  );
}

function PresetTabs({
  selected,
  onSelect,
}: {
  selected: DatePreset;
  onSelect: (preset: DatePreset) => void;
}) {
  const presets: { key: DatePreset; label: string }[] = [
    { key: 'week', label: t('log.week') },
    { key: 'month', label: t('log.month') },
    { key: 'all', label: t('log.all') },
  ];

  return (
    <View style={styles.presetContainer}>
      {presets.map((preset) => (
        <TouchableOpacity
          key={preset.key}
          style={[styles.presetTab, selected === preset.key && styles.presetTabSelected]}
          onPress={() => onSelect(preset.key)}
        >
          <Text
            style={[
              styles.presetTabText,
              selected === preset.key && styles.presetTabTextSelected,
            ]}
          >
            {preset.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SummaryCard({ totalMinutes, sessionCount }: { totalMinutes: number; sessionCount: number }) {
  const sessionLabel =
    sessionCount === 1 ? t('log.sessionCountOne') : t('log.sessionCount', { count: sessionCount });

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryHours}>{formatTotalHours(totalMinutes)}</Text>
      <Text style={styles.summarySeparator}>·</Text>
      <Text style={styles.summaryCount}>{sessionLabel}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <ClipboardList size={48} color={colors.grey[400]} />
      <Text style={styles.emptyTitle}>{t('log.noSessions')}</Text>
      <Text style={styles.emptyHint}>{t('log.noSessionsHint')}</Text>
    </View>
  );
}

export default function LogScreen({ navigation, route }: Props) {
  const { locationId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [confirmedDays, setConfirmedDays] = useState<Record<string, ConfirmedDayStatus>>({});
  const [preset, setPreset] = useState<DatePreset>('week');
  const [exporting, setExporting] = useState(false);

  // Use ref to track current preset/locationId for focus effect
  const currentPresetRef = useRef(preset);
  const currentLocationIdRef = useRef(locationId);
  currentPresetRef.current = preset;
  currentLocationIdRef.current = locationId;

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const db = await getDatabase();

      // Load location
      const loc = await db.getLocation(currentLocationIdRef.current);
      setLocation(loc);

      if (!loc) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Load sessions for current date range
      const { start, end } = getDateBounds(currentPresetRef.current);
      const sessionData = await db.getSessionsInRange(currentLocationIdRef.current, start, end);
      setSessions(sessionData);

      // Load confirmed days from calendar storage
      const calendarStorage = await getCalendarStorage();
      const confirmed = await calendarStorage.loadConfirmedDays();
      setConfirmedDays(confirmed);
    } catch (error) {
      console.error('[LogScreen] Failed to load data:', error);
      Alert.alert(t('common.error'), t('log.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load on mount and when preset changes
  useEffect(() => {
    loadData(true);
  }, [locationId, preset]);

  // Refresh on screen focus (to catch new sessions / confirmation changes)
  useFocusEffect(
    useCallback(() => {
      // Don't show loading spinner on focus refresh
      loadData(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePresetChange = (newPreset: DatePreset) => {
    if (newPreset !== preset) {
      setPreset(newPreset);
    }
  };

  const handleExport = async () => {
    if (!location || sessions.length === 0) return;

    setExporting(true);
    try {
      await exportSessionsToCSV(sessions, location.name);
    } catch (error) {
      console.error('[LogScreen] Export failed:', error);
      Alert.alert(t('common.error'), t('log.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDatePress = (date: string) => {
    // Navigate to calendar tab with this date
    // Using nested navigation since Calendar is in MainTabs
    (navigation as any).navigate('MainTabs', {
      screen: 'Calendar',
      params: { targetDate: date },
    });
  };

  // Derived data
  const sections = useMemo(() => groupSessionsByDate(sessions, confirmedDays), [sessions, confirmedDays]);
  const totalMinutes = useMemo(
    () =>
      sessions.reduce((sum, s) => {
        if (s.state === 'active' || s.state === 'pending_exit') {
          return sum + computeLiveDuration(s.clockIn);
        }
        return sum + (s.durationMinutes ?? 0);
      }, 0),
    [sessions]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('log.loadFailed')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Location header */}
      <View style={styles.locationHeader}>
        <MapPin size={16} color={colors.primary[500]} />
        <Text style={styles.locationName}>{location.name}</Text>
      </View>

      {/* Date range tabs */}
      <PresetTabs selected={preset} onSelect={handlePresetChange} />

      {/* Summary */}
      {sessions.length > 0 && (
        <SummaryCard totalMinutes={totalMinutes} sessionCount={sessions.length} />
      )}

      {/* Session list or empty state */}
      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SessionCard session={item} />}
          renderSectionHeader={({ section }) => (
            <DateHeader
              title={section.title}
              date={section.date}
              isConfirmed={section.isConfirmed}
              onPress={() => handleDatePress(section.date)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Export button */}
      <View style={styles.exportContainer}>
        <Button
          variant="secondary"
          onPress={handleExport}
          loading={exporting}
          disabled={sessions.length === 0 || exporting}
          fullWidth
        >
          <View style={styles.exportButtonContent}>
            <Download size={18} color={sessions.length === 0 ? colors.grey[400] : colors.text.primary} />
            <Text style={[styles.exportButtonText, sessions.length === 0 && styles.exportButtonTextDisabled]}>
              {t('log.exportCSV')}
            </Text>
          </View>
        </Button>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    padding: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Location header
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  locationName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },

  // Preset tabs
  presetContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  presetTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.grey[100],
  },
  presetTabSelected: {
    backgroundColor: colors.primary[500],
  },
  presetTabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  presetTabTextSelected: {
    color: colors.white,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  summaryHours: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  summarySeparator: {
    fontSize: fontSize.lg,
    color: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  summaryCount: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },

  // List
  listContent: {
    paddingBottom: spacing.xl,
  },

  // Date header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dateHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    gap: 4,
  },
  confirmedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },
  unconfirmedBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.error.light,
    borderRadius: borderRadius.full,
  },
  unconfirmedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.error.main,
  },

  // Session card
  sessionCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  sessionCardActive: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  sessionTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sessionTime: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  sessionDuration: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionMethod: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary[500],
  },
  activeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // Export button
  exportContainer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.paper,
  },
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exportButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  exportButtonTextDisabled: {
    color: colors.grey[400],
  },
});
