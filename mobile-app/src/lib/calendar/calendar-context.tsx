import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import type {
  CalendarState,
  CalendarAction,
  ShiftTemplate,
  ShiftInstance,
  TrackingRecord,
  ConfirmedDayStatus,
  AbsenceTemplate,
  AbsenceInstance,
} from './types';
import { calendarReducer, initialState } from './calendar-reducer';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { loadRealTrackingRecords } from './calendar-utils';
import { trackingEvents } from '@/lib/events/trackingEvents';

interface CalendarContextValue {
  state: CalendarState;
  dispatch: React.Dispatch<CalendarAction>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(calendarReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const storageRef = useRef<Awaited<ReturnType<typeof getCalendarStorage>> | null>(null);

  // Helper to load tracking records for a date range
  const loadTrackingForRange = useCallback(
    async (start: Date, end: Date): Promise<Record<string, TrackingRecord>> => {
      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');
      return loadRealTrackingRecords(startDate, endDate);
    },
    []
  );

  // Wrapped dispatch to handle async operations
  const dispatch = useCallback(
    (action: CalendarAction) => {
      if (action.type === 'TOGGLE_REVIEW_MODE' && !state.reviewMode) {
        // Entering review mode - load real tracking records for appropriate range
        const isMonthView = state.view === 'month';
        const start = isMonthView
          ? startOfMonth(state.currentMonth)
          : startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
        const end = isMonthView
          ? endOfMonth(state.currentMonth)
          : addDays(startOfWeek(state.currentWeekStart, { weekStartsOn: 1 }), 6);

        loadTrackingForRange(start, end)
          .then((trackingRecords) => {
            rawDispatch({
              type: 'TOGGLE_REVIEW_MODE',
              trackingRecords,
            });
          })
          .catch((error) => {
            console.error('[CalendarProvider] Failed to load tracking records:', error);
            rawDispatch(action);
          });
      } else if (action.type === 'SET_VIEW' && action.view === 'month' && state.reviewMode) {
        // Switching to month view while in review mode - load full month data
        const monthStart = startOfMonth(state.currentMonth);
        const monthEnd = endOfMonth(state.currentMonth);

        loadTrackingForRange(monthStart, monthEnd)
          .then((trackingRecords) => {
            rawDispatch(action);
            rawDispatch({ type: 'UPDATE_TRACKING_RECORDS', trackingRecords });
          })
          .catch((error) => {
            console.error('[CalendarProvider] Failed to load month tracking records:', error);
            rawDispatch(action);
          });
      } else if (action.type === 'SET_MONTH' && state.view === 'month' && state.reviewMode) {
        // Changing month while in month view and review mode - load new month data
        const newMonth = action.date;
        const monthStart = startOfMonth(newMonth);
        const monthEnd = endOfMonth(newMonth);

        rawDispatch(action); // Update month immediately for UI responsiveness

        loadTrackingForRange(monthStart, monthEnd)
          .then((trackingRecords) => {
            rawDispatch({ type: 'UPDATE_TRACKING_RECORDS', trackingRecords });
          })
          .catch((error) => {
            console.error('[CalendarProvider] Failed to load month tracking records:', error);
          });
      } else {
        // Pass through all other actions
        rawDispatch(action);
      }
    },
    [state.reviewMode, state.currentWeekStart, state.currentMonth, state.view, loadTrackingForRange]
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const storage = await getCalendarStorage();
        if (!isMounted) return;
        storageRef.current = storage;

        const [templates, instances, trackingRecords, confirmedDays, absenceTemplates, absenceInstances] = await Promise.all([
          storage.loadTemplates(),
          storage.loadInstances(),
          storage.loadTrackingRecords(),
          storage.loadConfirmedDays(),
          storage.loadAbsenceTemplates(),
          storage.loadAbsenceInstances(),
        ]);

        if (!isMounted) return;
        dispatch({
          type: 'HYDRATE_STATE',
          payload: {
            templates,
            instances,
            trackingRecords,
            confirmedDayStatus: confirmedDays,
            absenceTemplates,
            absenceInstances,
          },
        });
      } catch (error) {
        console.error('[CalendarProvider] Failed to hydrate calendar data:', error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistTemplates = async (templates: ShiftTemplate[]) => {
    try {
      await storageRef.current?.replaceTemplates(templates);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist templates:', error);
    }
  };

  const persistInstances = async (instances: ShiftInstance[]) => {
    try {
      await storageRef.current?.replaceInstances(instances);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist instances:', error);
    }
  };

  const persistTracking = async (records: TrackingRecord[]) => {
    try {
      await storageRef.current?.replaceTrackingRecords(records);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist tracking records:', error);
    }
  };

  const persistConfirmedDays = async (days: Record<string, ConfirmedDayStatus>) => {
    try {
      await storageRef.current?.replaceConfirmedDays(days);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist confirmed days:', error);
    }
  };

  const persistAbsenceInstances = async (instances: AbsenceInstance[]) => {
    try {
      await storageRef.current?.replaceAbsenceInstances(instances);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist absence instances:', error);
    }
  };

  const persistAbsenceTemplates = async (templates: AbsenceTemplate[]) => {
    try {
      await storageRef.current?.replaceAbsenceTemplates(templates);
    } catch (error) {
      console.error('[CalendarProvider] Failed to persist absence templates:', error);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;
    persistTemplates(Object.values(state.templates));
  }, [state.templates, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    persistInstances(Object.values(state.instances));
  }, [state.instances, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    persistTracking(Object.values(state.trackingRecords));
  }, [state.trackingRecords, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    persistConfirmedDays(state.confirmedDayStatus);
  }, [state.confirmedDayStatus, isHydrated]);

  // Persist absence templates and instances together to avoid FK constraint issues
  // Templates must be persisted before instances that reference them
  useEffect(() => {
    if (!isHydrated) return;
    const persistAbsenceData = async () => {
      // First persist templates (instances have FK reference to templates)
      await persistAbsenceTemplates(Object.values(state.absenceTemplates));
      // Then persist instances
      await persistAbsenceInstances(Object.values(state.absenceInstances));
    };
    persistAbsenceData();
  }, [state.absenceTemplates, state.absenceInstances, isHydrated]);

  // Subscribe to tracking events (clock-in/clock-out) to refresh calendar in review mode
  useEffect(() => {
    const handleTrackingChanged = () => {
      if (!state.reviewMode) return;

      // Load appropriate range based on current view
      const isMonthView = state.view === 'month';
      const start = isMonthView
        ? startOfMonth(state.currentMonth)
        : startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
      const end = isMonthView
        ? endOfMonth(state.currentMonth)
        : addDays(startOfWeek(state.currentWeekStart, { weekStartsOn: 1 }), 6);

      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');

      loadRealTrackingRecords(startDate, endDate)
        .then((trackingRecords) => {
          rawDispatch({ type: 'UPDATE_TRACKING_RECORDS', trackingRecords });
        })
        .catch((error) => {
          console.error('[CalendarProvider] Failed to refresh tracking records:', error);
        });
    };

    trackingEvents.on('tracking-changed', handleTrackingChanged);
    return () => {
      trackingEvents.off('tracking-changed', handleTrackingChanged);
    };
  }, [state.reviewMode, state.currentWeekStart, state.currentMonth, state.view]);

  return <CalendarContext.Provider value={{ state, dispatch }}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return ctx;
}
