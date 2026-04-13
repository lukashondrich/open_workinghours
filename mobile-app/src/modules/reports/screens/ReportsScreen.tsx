import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/ui/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Check, X, Share2, Send, Download, MapPin, Lock } from 'lucide-react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/theme';
import { getDateLocale, t } from '@/lib/i18n';
import { addDays, format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { WeekStateService, type WeekState, type WeekStateRecord } from '../services/WeekStateService';
import {
  CollectiveInsightsService,
  type CollectiveInsightsData,
} from '../services/CollectiveInsightsService';
import { useAuth } from '@/lib/auth/auth-context';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, MainTabParamList } from '@/navigation/AppNavigator';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type ReportsNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Reports'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeekData {
  weekStart: string;
  weekNumber: number;
  dateRange: string;
  confirmedDays: number;
  totalDays: number;
  state: WeekState;
}

interface ReportsSnapshot {
  autoSendEnabled: boolean;
  firstTimeSeen: boolean;
  activeWeeks: WeekData[];
  sentWeeks: WeekData[];
  insightsData: CollectiveInsightsData | null;
  showReward: boolean;
  rewardWeekStart: string | null;
}

function formatWeekDateRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const locale = getDateLocale() === 'de' ? de : enUS;

  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d', { locale })} – ${format(end, 'd', { locale })}`;
  }
  return `${format(start, 'MMM d', { locale })} – ${format(end, 'MMM d', { locale })}`;
}

function toWeekData(week: WeekStateRecord): WeekData {
  return {
    weekStart: week.weekStart,
    weekNumber: week.weekNumber,
    dateRange: formatWeekDateRange(week.weekStart),
    confirmedDays: week.confirmedDays,
    totalDays: week.totalDays,
    state: week.state,
  };
}

function formatInsightsPeriodRange(periodStart: string, periodEnd: string): string {
  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${periodStart} - ${periodEnd}`;
  }

  const locale = getDateLocale() === 'de' ? de : enUS;
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d', { locale })} – ${format(end, 'd', { locale })}`;
  }
  return `${format(start, 'MMM d', { locale })} – ${format(end, 'MMM d', { locale })}`;
}

// ─── Collective Insights (swipeable cards) ──────────────────────────────────

function PlaceholderBar({ width, opacity = 0.3 }: { width: number; opacity?: number }) {
  return (
    <View style={[styles.hBar, { width, opacity }]} />
  );
}

/** Semi-transparent lock overlay — covers the card content to signal data isn't real */
function LockedOverlay({ message }: { message: string }) {
  return (
    <View style={styles.lockedOverlay} pointerEvents="none">
      <View style={styles.lockedBadge}>
        <Lock size={16} color={colors.text.tertiary} />
        <Text style={styles.lockedText}>{message}</Text>
      </View>
    </View>
  );
}

/** View 1: You vs Group — unlocks when published state/specialty stats exist */
function InsightYouVsGroup({
  cardWidth,
  insightsData,
}: {
  cardWidth: number;
  insightsData: CollectiveInsightsData | null;
}) {
  const maxHours = insightsData
    ? Math.max(insightsData.plannedMeanHours, insightsData.actualMeanHours, 1)
    : 1;
  const plannedWidth = insightsData
    ? `${Math.max((insightsData.plannedMeanHours / maxHours) * 100, 6)}%`
    : undefined;
  const actualWidth = insightsData
    ? `${Math.max((insightsData.actualMeanHours / maxHours) * 100, 6)}%`
    : undefined;

  return (
    <View style={[styles.insightSlide, { width: cardWidth }]}>
      <Text style={styles.insightSlideTitle}>{t('reports.collective.youVsGroup')}</Text>

      {/* Chart area with lock overlay */}
      <View style={styles.lockedChartArea}>
        <View style={styles.hBarSection} accessible={false}>
          <View style={styles.hBarRow}>
            <Text style={styles.hBarLabel}>
              {insightsData ? t('reports.collective.avgPlanned') : t('reports.collective.you')}
            </Text>
            <View style={styles.hBarTrack}>
              {insightsData ? (
                <View style={[styles.hBar, { width: plannedWidth, opacity: 0.35 }]} />
              ) : (
                <PlaceholderBar width={140} opacity={0.25} />
              )}
            </View>
            <Text style={styles.hBarValue}>
              {insightsData
                ? `${insightsData.plannedMeanHours.toFixed(1)} ${t('reports.collective.hours')}`
                : `— ${t('reports.collective.hours')}`}
            </Text>
          </View>
          <View style={styles.hBarRow}>
            <Text style={styles.hBarLabel}>
              {insightsData ? t('reports.collective.avgActual') : t('reports.collective.group')}
            </Text>
            <View style={styles.hBarTrack}>
              {insightsData ? (
                <View style={[styles.hBar, { width: actualWidth, opacity: 0.5 }]} />
              ) : (
                <>
                  <PlaceholderBar width={110} opacity={0.2} />
                  <View style={[styles.hBarCi, { left: 100, width: 30 }]} />
                </>
              )}
            </View>
            <Text style={styles.hBarValue}>
              {insightsData
                ? `${insightsData.actualMeanHours.toFixed(1)} ${t('reports.collective.hours')}`
                : `— ${t('reports.collective.hours')}`}
            </Text>
          </View>
        </View>
        {!insightsData && (
          <LockedOverlay message={t('reports.collective.placeholder')} />
        )}
      </View>

      {insightsData && (
        <View style={styles.insightMetaBlock}>
          <Text style={styles.insightMetaText}>
            {`${t('reports.collective.avgOvertime')}: ${insightsData.overtimeMeanHours.toFixed(1)} ${t('reports.collective.hours')} ± ${insightsData.overtimeCiHalf.toFixed(1)} ${t('reports.collective.hours')}`}
          </Text>
          <Text style={styles.insightMetaText}>
            {t('reports.collective.contributors', { count: insightsData.nDisplay })}
          </Text>
          <Text style={styles.insightMetaText}>
            {formatInsightsPeriodRange(insightsData.periodStart, insightsData.periodEnd)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.shareButton}
        accessibilityRole="button"
        accessibilityLabel={t('reports.collective.share')}
        testID="share-button"
      >
        <Share2 size={16} color={colors.primary[500]} />
        <Text style={styles.shareButtonText}>{t('reports.collective.share')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** View 2: Regional hospitals — mini map + overtime bars */
function InsightRegionalHospitals({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={[styles.insightSlide, { width: cardWidth }]}>
      <Text style={styles.insightSlideTitle}>{t('reports.collective.regional')}</Text>

      <View style={styles.lockedChartArea}>
        <View style={styles.regionalContent} accessible={false}>
          <View style={styles.miniMap}>
            <View style={styles.miniMapBg} />
            {[
              { top: '20%', left: '30%' },
              { top: '45%', left: '60%' },
              { top: '70%', left: '35%' },
            ].map((pos, i) => (
              <View key={i} style={[styles.miniMapPin, { top: pos.top as any, left: pos.left as any }]}>
                <MapPin size={14} color={colors.primary[300]} />
              </View>
            ))}
          </View>

          <View style={styles.hospitalBars}>
            {[
              { label: 'Klinik A', width: 60 },
              { label: 'Klinik B', width: 45 },
              { label: 'Klinik C', width: 80 },
            ].map((h) => (
              <View key={h.label} style={styles.hospitalBarRow}>
                <Text style={styles.hospitalBarLabel}>{h.label}</Text>
                <PlaceholderBar width={h.width} opacity={0.2} />
                <Text style={styles.hBarValue}>—</Text>
              </View>
            ))}
          </View>
        </View>
        <LockedOverlay message={t('reports.collective.regionalPlaceholder')} />
      </View>
    </View>
  );
}

/** View 3: Trend over time — sparkline of overtime gap */
function InsightTrend({ cardWidth }: { cardWidth: number }) {
  // Placeholder sparkline as a series of dots connected by a line
  const points = [4, 6, 5, 7, 3, 5, 6, 4];

  return (
    <View style={[styles.insightSlide, { width: cardWidth }]}>
      <Text style={styles.insightSlideTitle}>{t('reports.collective.trend')}</Text>

      <View style={styles.lockedChartArea}>
        <View style={styles.sparklineContainer} accessible={false}>
          <View style={styles.sparklineYAxis}>
            <Text style={styles.sparklineAxisLabel}>+8h</Text>
            <Text style={styles.sparklineAxisLabel}>0h</Text>
          </View>

          <View style={styles.sparklineArea}>
            <View style={styles.sparklineBaseline} />
            <View style={styles.sparklinePoints}>
              {points.map((p, i) => (
                <View key={i} style={styles.sparklineColumn}>
                  <View
                    style={[
                      styles.sparklineDot,
                      { bottom: (p / 8) * 40, opacity: 0.25 },
                    ]}
                  />
                  <View
                    style={[
                      styles.sparklineBar,
                      { height: (p / 8) * 40, opacity: 0.15 },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.sparklineXAxis}>
              {points.map((_, i) => (
                <Text key={i} style={styles.sparklineXLabel}>
                  {`W${i + 1}`}
                </Text>
              ))}
            </View>
          </View>
        </View>
        <LockedOverlay message={t('reports.collective.trendPlaceholder')} />
      </View>
    </View>
  );
}

/** Swipeable container with page dots */
function CollectiveInsights({ insightsData }: { insightsData: CollectiveInsightsData | null }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - spacing.xl * 2;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / cardWidth);
    setActiveIndex(index);
  }, [cardWidth]);

  return (
    <View style={styles.insightsContainer} testID="collective-insights">
      <ScrollView
        horizontal
        pagingEnabled
        accessible={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        snapToInterval={cardWidth}
        snapToAlignment="start"
        contentContainerStyle={styles.insightsScrollContent}
        style={styles.insightsScroll}
      >
        <InsightYouVsGroup cardWidth={cardWidth} insightsData={insightsData} />
        <InsightRegionalHospitals cardWidth={cardWidth} />
        <InsightTrend cardWidth={cardWidth} />
      </ScrollView>

      {/* Page dots */}
      <View style={styles.pageDots} accessible={false}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.pageDot, i === activeIndex && styles.pageDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Monday Reward Card ─────────────────────────────────────────────────────

function MondayRewardCard({ weekNumber, totalWeeks, onDismiss }: {
  weekNumber: number;
  totalWeeks: number;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.rewardCard} testID="monday-reward-card">
      <View style={styles.rewardContent} accessible={false}>
        <View style={styles.rewardIconCircle}>
          <Check size={16} color={colors.white} strokeWidth={3} />
        </View>
        <View style={styles.rewardTextContainer}>
          <Text style={styles.rewardTitle}>
            {t('reports.reward.title', { week: weekNumber })}
          </Text>
          <Text style={styles.rewardSubtitle}>
            {t('reports.reward.subtitle', { count: totalWeeks })}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.rewardDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('reports.reward.dismiss')}
        testID="monday-reward-dismiss"
      >
        <X size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Week Card (unified row) ────────────────────────────────────────────────

function WeekCard({ week, autoSend, onNavigate, onToggleSend }: {
  week: WeekData;
  autoSend: boolean;
  onNavigate: (weekStart: string) => void;
  onToggleSend: (weekStart: string, value: boolean) => void;
}) {
  const isFullyConfirmed = week.confirmedDays === week.totalDays;
  const remaining = week.totalDays - week.confirmedDays;

  // Switch state: ON when queued, or when confirmed + auto-send
  const isSending = week.state === 'queued' || (week.state === 'confirmed' && autoSend);
  const switchEnabled = isFullyConfirmed && !autoSend;

  return (
    <TouchableOpacity
      style={styles.weekCard}
      onPress={() => onNavigate(week.weekStart)}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      testID={`week-card-${week.weekStart}`}
    >
      <View style={styles.weekCardRow} accessible={false}>
        <View style={styles.weekCardContent}>
          <Text style={styles.weekCardTitle}>
            {t('reports.week.label', { number: week.weekNumber })} · {week.dateRange}
          </Text>
          {week.state === 'queued' ? (
            <Text style={styles.badgeQueued}>{t('reports.week.queuedForSunday')}</Text>
          ) : week.state === 'confirmed' && autoSend ? (
            <Text style={styles.badgeQueued}>{t('reports.week.sendingSunday')}</Text>
          ) : isFullyConfirmed ? (
            <Text style={styles.badgeConfirmed}>✓ {t('reports.week.allConfirmed')}</Text>
          ) : (
            <Text style={styles.badgeUnconfirmed}>
              <Text style={styles.remainingCount}>{remaining}</Text>
              {' '}{remaining === 1 ? t('reports.week.dayToConfirm') : t('reports.week.daysToConfirm')}
            </Text>
          )}
        </View>
        <Switch
          value={isSending}
          onValueChange={(value) => onToggleSend(week.weekStart, value)}
          disabled={!switchEnabled}
          trackColor={{ false: colors.grey[200], true: colors.primary[100] }}
          thumbColor={isSending ? colors.primary[400] : colors.grey[50]}
          ios_backgroundColor={colors.grey[200]}
          style={styles.weekCardSwitch}
          testID={`week-send-toggle-${week.weekStart}`}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Sent History ───────────────────────────────────────────────────────────

function SentHistory({ weeks }: { weeks: WeekData[] }) {
  const [expanded, setExpanded] = useState(false);
  const handleExport = useCallback(() => {
    // TODO: export all sent weeks as PDF/CSV
  }, []);

  if (weeks.length === 0) return null;

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.sentSection} testID="sent-history">
      <View style={styles.sentCard}>
        <TouchableOpacity
          style={styles.sentHeader}
          onPress={toggleExpanded}
          activeOpacity={0.7}
          accessibilityRole="button"
          testID="sent-history-toggle"
          accessible={false}
        >
          <Text style={styles.sentHeaderTitle}>{t('reports.sent.title')}</Text>
          <Text style={styles.sentSummary}>
            {t('reports.sent.weeksContributed', { count: weeks.length })}
          </Text>
          <TouchableOpacity
            onPress={handleExport}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('reports.sent.export')}
            testID="export-button"
          >
            <Download size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.sentList}>
            {weeks.map((week) => (
              <View key={week.weekStart} style={styles.sentRow}>
                <Check size={12} color={colors.success.dark} strokeWidth={3} />
                <Text style={styles.sentRowText}>
                  {t('reports.week.label', { number: week.weekNumber })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── First-Time Overlay ─────────────────────────────────────────────────────

function FirstTimeOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.overlayBackdrop} testID="first-time-overlay">
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>{t('reports.firstTime.title')}</Text>
        <Text style={styles.overlayBody}>{t('reports.firstTime.body')}</Text>

        <View style={styles.overlayBullets} accessible={false}>
          <Text style={styles.overlayBullet}>
            {'\u2022'} {t('reports.firstTime.bullet1')}
          </Text>
          <Text style={styles.overlayBullet}>
            {'\u2022'} {t('reports.firstTime.bullet2')}
          </Text>
          <Text style={styles.overlayBullet}>
            {'\u2022'} {t('reports.firstTime.bullet3')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onDismiss}
          accessibilityRole="button"
          testID="first-time-got-it"
        >
          <Text style={styles.primaryButtonText}>{t('reports.firstTime.gotIt')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const navigation = useNavigation<ReportsNavigationProp>();
  const { state: authState } = useAuth();
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [sentWeeks, setSentWeeks] = useState<WeekData[]>([]);
  const [insightsData, setInsightsData] = useState<CollectiveInsightsData | null>(null);
  const [autoSend, setAutoSend] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardWeekStart, setRewardWeekStart] = useState<string | null>(null);
  const [showFirstTime, setShowFirstTime] = useState(false);
  const [hasShownFirstTime, setHasShownFirstTime] = useState(false);
  const isToggleMutationInFlightRef = useRef(false);

  const applySnapshot = useCallback((snapshot: ReportsSnapshot) => {
    setAutoSend(snapshot.autoSendEnabled);
    setHasShownFirstTime(snapshot.firstTimeSeen);
    setWeeks(snapshot.activeWeeks);
    setSentWeeks(snapshot.sentWeeks);
    setInsightsData(snapshot.insightsData);
    setShowReward(snapshot.showReward);
    setRewardWeekStart(snapshot.rewardWeekStart);
  }, []);

  const loadSnapshot = useCallback(async (autoSendOverride?: boolean): Promise<ReportsSnapshot> => {
    const [storedAutoSend, firstTimeSeen, lastRewardWeek] = await Promise.all([
      WeekStateService.getAutoSend(),
      WeekStateService.getReportsFirstTimeSeen(),
      WeekStateService.getLastRewardWeek(),
    ]);
    const autoSendEnabled = autoSendOverride ?? storedAutoSend;

    if (autoSendEnabled) {
      await WeekStateService.reconcileAutoSendQueue();
    }

    const model = await WeekStateService.loadWeekState();
    const latestSentWeekStart = model.sentWeeks[0]?.weekStart ?? null;
    const showRewardCard = Boolean(
      latestSentWeekStart && (!lastRewardWeek || latestSentWeekStart > lastRewardWeek),
    );
    let insightsData: CollectiveInsightsData | null = null;

    if (model.sentWeeks.length > 0 && authState.user?.stateCode && authState.user.specialty) {
      try {
        insightsData = await CollectiveInsightsService.getLatestPublishedStateSpecialtyInsights({
          stateCode: authState.user.stateCode,
          specialty: authState.user.specialty,
        });
      } catch (error) {
        console.error('[ReportsScreen] Failed to load collective insights:', error);
      }
    }

    return {
      autoSendEnabled,
      firstTimeSeen,
      activeWeeks: model.activeWeeks.map(toWeekData),
      sentWeeks: model.sentWeeks.map(toWeekData),
      insightsData,
      showReward: showRewardCard,
      rewardWeekStart: showRewardCard ? latestSentWeekStart : null,
    };
  }, [authState.user?.specialty, authState.user?.stateCode]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadWeekData = async () => {
        try {
          const snapshot = await loadSnapshot();
          if (!isActive) return;
          applySnapshot(snapshot);
        } catch (error) {
          console.error('[ReportsScreen] Failed to load week state:', error);
        }
      };

      void loadWeekData();

      return () => {
        isActive = false;
      };
    }, [applySnapshot, loadSnapshot]),
  );

  const reloadSnapshotAfterFailure = useCallback(async () => {
    try {
      const snapshot = await loadSnapshot();
      applySnapshot(snapshot);
    } catch (reloadError) {
      console.error('[ReportsScreen] Failed to reload snapshot after mutation failure:', reloadError);
    }
  }, [applySnapshot, loadSnapshot]);

  const handleToggleSend = useCallback((weekStart: string, value: boolean) => {
    if (isToggleMutationInFlightRef.current) {
      return;
    }
    isToggleMutationInFlightRef.current = true;

    void (async () => {
      try {
        if (value && !hasShownFirstTime) {
          setShowFirstTime(true);
          setHasShownFirstTime(true);
          await WeekStateService.setReportsFirstTimeSeen(true);
        }

        if (value) {
          await WeekStateService.queueWeek(weekStart);
        } else {
          await WeekStateService.unqueueWeek(weekStart);
        }

        const snapshot = await loadSnapshot(autoSend);
        applySnapshot(snapshot);
      } catch (error) {
        console.error('[ReportsScreen] Failed to update queue toggle:', error);
        Alert.alert(t('common.error'), t('reports.errors.updateFailed'));
        await reloadSnapshotAfterFailure();
      } finally {
        isToggleMutationInFlightRef.current = false;
      }
    })();
  }, [applySnapshot, autoSend, hasShownFirstTime, loadSnapshot, reloadSnapshotAfterFailure]);

  const handleNavigateToWeek = useCallback((weekStart: string) => {
    navigation.navigate('Calendar', { targetDate: weekStart });
  }, [navigation]);

  const handleAutoSendToggle = useCallback((value: boolean) => {
    if (isToggleMutationInFlightRef.current) {
      return;
    }
    isToggleMutationInFlightRef.current = true;

    void (async () => {
      try {
        if (value && !hasShownFirstTime) {
          setShowFirstTime(true);
          setHasShownFirstTime(true);
          await WeekStateService.setReportsFirstTimeSeen(true);
        }

        await WeekStateService.setAutoSend(value);

        const snapshot = await loadSnapshot(value);
        applySnapshot(snapshot);
      } catch (error) {
        console.error('[ReportsScreen] Failed to update auto-send preference:', error);
        Alert.alert(t('common.error'), t('reports.errors.updateFailed'));
        await reloadSnapshotAfterFailure();
      } finally {
        isToggleMutationInFlightRef.current = false;
      }
    })();
  }, [applySnapshot, hasShownFirstTime, loadSnapshot, reloadSnapshotAfterFailure]);

  const handleDismissReward = useCallback(() => {
    setShowReward(false);
    if (!rewardWeekStart) {
      return;
    }

    void WeekStateService.setLastRewardWeek(rewardWeekStart).catch((error) => {
      console.error('[ReportsScreen] Failed to persist reward dismissal:', error);
    });
  }, [rewardWeekStart]);

  // Sort: most recent first
  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [weeks],
  );
  const sortedSentWeeks = useMemo(
    () => [...sentWeeks].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [sentWeeks],
  );
  const latestSentWeek = sortedSentWeeks[0];
  const rewardWeek = rewardWeekStart
    ? sortedSentWeeks.find((week) => week.weekStart === rewardWeekStart) ?? latestSentWeek
    : latestSentWeek;

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('reports.title')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Monday reward card */}
        {showReward && rewardWeek && (
          <MondayRewardCard
            weekNumber={rewardWeek.weekNumber}
            totalWeeks={sortedSentWeeks.length}
            onDismiss={handleDismissReward}
          />
        )}

        {/* Collective Insights (swipeable) */}
        <CollectiveInsights insightsData={insightsData} />

        {/* Submissions section header + auto-send toggle (same row) */}
        <View style={styles.submissionsHeader}>
          <Text style={styles.sectionTitle}>{t('reports.submissions.title')}</Text>
          <View style={styles.autoSendToggle}>
            <View style={[styles.autoSendIndicator, autoSend && styles.autoSendIndicatorActive]}>
              <Send size={12} color={autoSend ? colors.primary[700] : colors.grey[500]} />
              <Text style={[styles.autoSendText, autoSend && styles.autoSendTextActive]}>
                {t('reports.submissions.autoSend')}
              </Text>
            </View>
            <Switch
              value={autoSend}
              onValueChange={handleAutoSendToggle}
              trackColor={{ false: colors.grey[300], true: colors.primary[200] }}
              thumbColor={autoSend ? colors.primary[500] : colors.grey[100]}
              ios_backgroundColor={colors.grey[300]}
              testID="auto-send-toggle"
            />
          </View>
        </View>

        {/* Week cards */}
        <View style={styles.weekList}>
          {sortedWeeks.map((week) => (
            <WeekCard
              key={week.weekStart}
              week={week}
              autoSend={autoSend}
              onNavigate={handleNavigateToWeek}
              onToggleSend={handleToggleSend}
            />
          ))}
        </View>

        {/* Sent history */}
        <SentHistory weeks={sortedSentWeeks} />
      </ScrollView>

      {/* First-time overlay (inline, not Modal) */}
      {showFirstTime && (
        <FirstTimeOverlay onDismiss={() => setShowFirstTime(false)} />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  headerSafeArea: {
    backgroundColor: colors.background.paper,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
    paddingBottom: 100,
  },

  // ─── Monday reward ────────────────────────
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  rewardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardTextContainer: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  rewardSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 1,
  },
  rewardDismiss: {
    padding: spacing.sm,
  },

  // ─── Collective insights (swipeable) ─────
  insightsContainer: {
    marginTop: spacing.lg,
  },
  insightsScroll: {
    overflow: 'visible',
  },
  insightsScrollContent: {
    paddingHorizontal: spacing.xl,
  },
  insightSlide: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  insightSlideTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Lock overlay watermark
  lockedChartArea: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  lockedText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
    maxWidth: 200,
    textAlign: 'center',
  },

  // Page dots
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.grey[300],
  },
  pageDotActive: {
    backgroundColor: colors.primary[500],
    width: 18,
  },

  // View 1: horizontal bars
  hBarSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hBarLabel: {
    width: 48,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  hBarTrack: {
    flex: 1,
    height: 20,
    backgroundColor: colors.grey[100],
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hBar: {
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.primary[400],
  },
  hBarCi: {
    position: 'absolute',
    height: 20,
    backgroundColor: colors.primary[200],
    opacity: 0.3,
    borderRadius: 4,
  },
  hBarValue: {
    width: 36,
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
  insightMetaBlock: {
    gap: 2,
    marginBottom: spacing.md,
  },
  insightMetaText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  insightsPlaceholderText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    lineHeight: 20,
    marginBottom: spacing.md,
    flex: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  shareButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },

  // View 2: regional hospitals
  regionalContent: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  miniMap: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  miniMapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.grey[100],
    borderRadius: borderRadius.md,
  },
  miniMapPin: {
    position: 'absolute',
  },
  hospitalBars: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hospitalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hospitalBarLabel: {
    width: 48,
    fontSize: fontSize.xxs,
    color: colors.text.tertiary,
  },

  // View 3: trend sparkline
  sparklineContainer: {
    flexDirection: 'row',
    height: 80,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  sparklineYAxis: {
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sparklineAxisLabel: {
    fontSize: fontSize.xxs,
    color: colors.text.tertiary,
  },
  sparklineArea: {
    flex: 1,
    position: 'relative',
  },
  sparklineBaseline: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.grey[300],
  },
  sparklinePoints: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-end',
    paddingBottom: 16,
  },
  sparklineColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sparklineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary[500],
    position: 'absolute',
  },
  sparklineBar: {
    width: 12,
    borderRadius: 2,
    backgroundColor: colors.primary[300],
  },
  sparklineXAxis: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sparklineXLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xxs,
    color: colors.text.tertiary,
  },

  // ─── Submissions header ───────────────────
  submissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autoSendToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  autoSendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.grey[100],
  },
  autoSendIndicatorActive: {
    backgroundColor: colors.primary[50],
  },
  autoSendText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.grey[500],
  },
  autoSendTextActive: {
    color: colors.primary[700],
  },

  // ─── Week cards ───────────────────────────
  weekList: {
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  weekCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  weekCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekCardContent: {
    flex: 1,
  },
  weekCardSwitch: {
    transform: [{ scale: 0.8 }],
    marginLeft: spacing.sm,
  },
  weekCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  badgeUnconfirmed: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  remainingCount: {
    color: colors.warning.main,
    fontWeight: fontWeight.bold,
  },
  badgeConfirmed: {
    fontSize: fontSize.xs,
    color: colors.primary[700],
    fontWeight: fontWeight.medium,
  },
  badgeQueued: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },

  // ─── Primary button (first-time overlay) ──
  primaryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  // ─── Sent section ─────────────────────────
  sentSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxl,
  },
  sentCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  sentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sentHeaderTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sentSummary: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
  sentList: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  sentRowText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // ─── First-time overlay ───────────────────
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  overlayCard: {
    backgroundColor: colors.background.paper,
    marginHorizontal: spacing.xxl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.md,
  },
  overlayTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  overlayBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  overlayBullets: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  overlayBullet: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    paddingLeft: spacing.sm,
  },
});
