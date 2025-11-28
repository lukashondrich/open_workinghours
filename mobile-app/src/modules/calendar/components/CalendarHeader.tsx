import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { addDays, addWeeks, format, startOfWeek, subWeeks, addMonths, subMonths } from 'date-fns';
import { useCalendar } from '@/lib/calendar/calendar-context';
import { buildWeekDateKeys, enqueueWeeklySubmission, loadWeekSummary } from '../services/WeeklySubmissionService';
import { getDatabase } from '@/modules/geofencing/services/Database';
import type { WeeklySubmissionRecord } from '@/modules/geofencing/types';
import { processSubmissionQueue } from '../services/SubmissionQueueWorker';

export default function CalendarHeader() {
  const { state, dispatch } = useCalendar();
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  const monthLabel = format(state.currentMonth, 'LLLL yyyy');
  const title = state.view === 'week' ? weekRangeLabel : monthLabel;

  const handlePrev = () => {
    if (state.view === 'week') {
      dispatch({ type: 'SET_WEEK', date: subWeeks(state.currentWeekStart, 1) });
    } else {
      dispatch({ type: 'SET_MONTH', date: subMonths(state.currentMonth, 1) });
    }
  };

  const handleNext = () => {
    if (state.view === 'week') {
      dispatch({ type: 'SET_WEEK', date: addWeeks(state.currentWeekStart, 1) });
    } else {
      dispatch({ type: 'SET_MONTH', date: addMonths(state.currentMonth, 1) });
    }
  };

  const toggleTemplatePanel = () => {
    dispatch({ type: 'TOGGLE_TEMPLATE_PANEL' });
  };

  const toggleReview = () => {
    dispatch({ type: 'TOGGLE_REVIEW_MODE' });
  };

  const setView = (view: 'week' | 'month') => {
    dispatch({ type: 'SET_VIEW', view });
  };

  const [submissionRecord, setSubmissionRecord] = useState<WeeklySubmissionRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const weekDateKeys = useMemo(() => buildWeekDateKeys(weekStart), [weekStart]);
  const weekStartKey = weekDateKeys[0];

  const allConfirmed = weekDateKeys.every((date) => state.confirmedDayStatus[date]?.status === 'confirmed');
  const weekLocked = weekDateKeys.some((date) => state.confirmedDayStatus[date]?.status === 'locked');
  const hasReadyWeek = allConfirmed && !weekLocked && !submissionRecord;

  useEffect(() => {
    if (state.view !== 'week') return;
    let isMounted = true;
    async function loadQueue() {
      try {
        const db = await getDatabase();
        const record = await db.getWeeklySubmissionByWeek(weekStartKey);
        if (!isMounted) return;
        setSubmissionRecord(record);
      } catch (error) {
        console.error('[CalendarHeader] Failed to load submission state', error);
      }
    }
    loadQueue();
    return () => {
      isMounted = false;
    };
  }, [state.view, weekStartKey, queueRefreshKey]);

  const canSubmitWeek = state.view === 'week' && hasReadyWeek && !isSubmitting;

  const submissionStatusLabel = (() => {
    if (submissionRecord) {
      switch (submissionRecord.status) {
        case 'pending':
          return 'Pending submission';
        case 'sending':
          return 'Sending…';
        case 'failed':
          return 'Failed to send';
        case 'sent':
          return 'Sent to backend';
        default:
          return submissionRecord.status;
      }
    }
    if (weekLocked) {
      return 'Locked (already sent)';
    }
    if (hasReadyWeek) {
      return 'Ready to submit';
    }
    return 'Confirm all days';
  })();

  const submissionHint = (() => {
    if (state.view !== 'week') return null;
    if (!allConfirmed && !weekLocked) {
      return 'Confirm all 7 days to enable submission.';
    }
    if (weekLocked && !submissionRecord) {
      return 'Unlock this week before editing.';
    }
    if (submissionRecord?.status === 'failed') {
      return 'Tap retry to queue again.';
    }
    if (submissionRecord?.status === 'pending') {
      return 'Submission queued locally; keep the app open to send later.';
    }
    if (hasReadyWeek) {
      return 'Ready to submit when you are.';
    }
    return null;
  })();

  const handleSubmitWeek = async () => {
    try {
      setIsSubmitting(true);
      const summary = await loadWeekSummary(state.currentWeekStart);
      const record = await enqueueWeeklySubmission(summary);
      dispatch({ type: 'LOCK_CONFIRMED_DAYS', dates: weekDateKeys, submissionId: record.id });
      setSubmissionRecord(record);
      await processQueue(record.id);
    } catch (error) {
      console.error('[CalendarHeader] Failed to submit week:', error);
      Alert.alert('Submit failed', error instanceof Error ? error.message : 'Unable to submit this week.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processQueue = async (targetId?: string) => {
    try {
      setIsProcessingQueue(true);
      await processSubmissionQueue(targetId ? [targetId] : undefined);
      setQueueRefreshKey((key) => key + 1);
      if (targetId) {
        Alert.alert('Week sent', 'Your weekly totals were transmitted to the backend.');
      }
    } catch (error) {
      console.error('[CalendarHeader] Failed to process submission queue:', error);
      Alert.alert('Submission failed', error instanceof Error ? error.message : 'Unable to reach submission endpoint.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleRetrySubmission = async () => {
    if (!submissionRecord) return;
    try {
      setIsSubmitting(true);
      const db = await getDatabase();
      await db.updateWeeklySubmissionStatus(submissionRecord.id, 'pending', null);
      await processQueue(submissionRecord.id);
    } catch (error) {
      console.error('[CalendarHeader] Failed to retry submission:', error);
      Alert.alert('Retry failed', 'Could not retry this submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockWeek = async () => {
    if (!submissionRecord) {
      Alert.alert('Nothing to unlock', 'This week is not tied to any submissions.');
      return;
    }
    if (submissionRecord.status === 'sent') {
      Alert.alert('Unlock not available yet', 'Unlocking a sent week will be supported in a later update.');
      return;
    }
    try {
      setIsSubmitting(true);
      const db = await getDatabase();
      await db.deleteWeeklySubmission(submissionRecord.id);
      dispatch({ type: 'UNLOCK_CONFIRMED_DAYS', dates: weekDateKeys });
      setSubmissionRecord(null);
      setQueueRefreshKey((key) => key + 1);
      Alert.alert('Week unlocked', 'You can edit this week again before re-submitting.');
    } catch (error) {
      console.error('[CalendarHeader] Failed to unlock week:', error);
      Alert.alert('Unlock failed', 'Could not unlock this week.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>Planning Calendar</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.segment, state.view === 'week' && styles.segmentActive]}
            onPress={() => setView('week')}
          >
            <Text style={[styles.segmentText, state.view === 'week' && styles.segmentTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, state.view === 'month' && styles.segmentActive]}
            onPress={() => setView('month')}
          >
            <Text style={[styles.segmentText, state.view === 'month' && styles.segmentTextActive]}>Month</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.navigation}>
          <TouchableOpacity style={styles.navButton} onPress={handlePrev}>
            <Text style={styles.navButtonText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
            <Text style={styles.navButtonText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, state.reviewMode && styles.actionButtonActive]}
            onPress={toggleReview}
          >
            <Text style={[styles.actionButtonText, state.reviewMode && styles.actionButtonTextActive]}>
              {state.reviewMode ? 'Exit Review' : 'Enter Review'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={toggleTemplatePanel}>
            <Text style={styles.primaryButtonText}>Templates</Text>
          </TouchableOpacity>
        </View>
      </View>

      {state.view === 'week' && (
        <View style={styles.submissionContainer}>
          <View style={styles.submissionInfo}>
            <Text style={styles.submissionLabel}>Weekly Submission</Text>
            <Text style={styles.submissionStatus}>{submissionStatusLabel}</Text>
            {submissionRecord?.status === 'failed' && submissionRecord.lastError ? (
              <Text style={styles.errorText}>{submissionRecord.lastError}</Text>
            ) : submissionHint ? (
              <Text style={styles.submissionHint}>{submissionHint}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!canSubmitWeek || isSubmitting) && styles.submitButtonDisabled,
            ]}
            disabled={!canSubmitWeek || isSubmitting}
            onPress={handleSubmitWeek}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit Week</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {state.view === 'week' && submissionRecord && (
        <View style={styles.submissionActionsRow}>
          {submissionRecord.status === 'pending' && (
            <TouchableOpacity
              style={styles.submissionLink}
              onPress={() => processQueue(submissionRecord.id)}
              disabled={isProcessingQueue}
            >
              {isProcessingQueue ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.submissionLinkText}>Send Now</Text>
              )}
            </TouchableOpacity>
          )}
          {submissionRecord.status === 'failed' && (
            <TouchableOpacity style={styles.submissionLink} onPress={handleRetrySubmission}>
              <Text style={styles.submissionLinkText}>Retry Submission</Text>
            </TouchableOpacity>
          )}
          {submissionRecord.status !== 'sent' && (
            <TouchableOpacity style={styles.submissionLink} onPress={handleUnlockWeek}>
              <Text style={styles.submissionLinkText}>Unlock Week</Text>
            </TouchableOpacity>
          )}
          {submissionRecord.status === 'sent' && (
            <Text style={styles.lockedBadge}>Locked after send</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 24,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  segmentActive: {
    backgroundColor: '#111',
  },
  segmentText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 18,
    color: '#111',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionButtonActive: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FF5A5F',
  },
  actionButtonText: {
    color: '#111',
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#B71C1C',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  submissionContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F7FF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A4B9F',
    textTransform: 'uppercase',
  },
  submissionStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  submissionHint: {
    marginTop: 4,
    color: '#5F6D7E',
    fontSize: 12,
  },
  errorText: {
    marginTop: 4,
    color: '#B3261E',
    fontSize: 12,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A7C8FF',
  },
  submissionActionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  submissionLink: {
    paddingVertical: 4,
  },
  submissionLinkText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  lockedBadge: {
    fontSize: 13,
    color: '#5F6D7E',
    fontStyle: 'italic',
  },
});
