import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { scheduleEvents } from '@/lib/events/scheduleEvents';

import { getCalendarExportManager } from './CalendarExportManager';

export function CalendarExportOrchestrator() {
  const { state: authState } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncInFlightRef = useRef(false);
  const needsResyncRef = useRef(false);

  useEffect(() => {
    if (authState.status !== 'authenticated') {
      return;
    }

    let isMounted = true;

    const runSync = async () => {
      if (!isMounted) {
        return;
      }

      if (syncInFlightRef.current) {
        needsResyncRef.current = true;
        return;
      }

      syncInFlightRef.current = true;
      try {
        const manager = await getCalendarExportManager();
        await manager.runSyncIfEnabled();
      } catch (error) {
        console.error('[CalendarExportOrchestrator] Sync failed:', error);
      } finally {
        syncInFlightRef.current = false;
        if (needsResyncRef.current && isMounted) {
          needsResyncRef.current = false;
          void runSync();
        }
      }
    };

    void runSync();

    const handleScheduleChanged = () => {
      void runSync();
    };

    scheduleEvents.on('schedule-changed', handleScheduleChanged);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/background|inactive/) &&
        nextState === 'active' &&
        authState.status === 'authenticated'
      ) {
        void runSync();
      }

      appStateRef.current = nextState;
    });

    return () => {
      isMounted = false;
      scheduleEvents.off('schedule-changed', handleScheduleChanged);
      subscription.remove();
    };
  }, [authState.status]);

  return null;
}
