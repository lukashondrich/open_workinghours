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
import { format, startOfWeek, addDays } from 'date-fns';
import type {
  CalendarState,
  CalendarAction,
  ShiftTemplate,
  ShiftInstance,
  TrackingRecord,
  ConfirmedDayStatus,
} from './types';
import { calendarReducer, initialState } from './calendar-reducer';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { loadRealTrackingRecords } from './calendar-utils';

interface CalendarContextValue {
  state: CalendarState;
  dispatch: React.Dispatch<CalendarAction>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(calendarReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const storageRef = useRef<Awaited<ReturnType<typeof getCalendarStorage>> | null>(null);

  // Wrapped dispatch to handle async operations
  const dispatch = useCallback(
    (action: CalendarAction) => {
      if (action.type === 'TOGGLE_REVIEW_MODE' && !state.reviewMode) {
        // Entering review mode - load real tracking records asynchronously
        const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        const startDate = format(weekStart, 'yyyy-MM-dd');
        const endDate = format(weekEnd, 'yyyy-MM-dd');

        console.log(`[CalendarProvider] Loading tracking records from ${startDate} to ${endDate}`);

        loadRealTrackingRecords(startDate, endDate)
          .then((trackingRecords) => {
            console.log(`[CalendarProvider] Loaded ${Object.keys(trackingRecords).length} tracking records`);
            // Dispatch with loaded tracking records
            rawDispatch({
              type: 'TOGGLE_REVIEW_MODE',
              trackingRecords,
            });
          })
          .catch((error) => {
            console.error('[CalendarProvider] Failed to load tracking records:', error);
            // Fallback to simulated tracking
            rawDispatch(action);
          });
      } else {
        // Pass through all other actions
        rawDispatch(action);
      }
    },
    [state.reviewMode, state.currentWeekStart]
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const storage = await getCalendarStorage();
        if (!isMounted) return;
        storageRef.current = storage;

        const [templates, instances, trackingRecords, confirmedDays] = await Promise.all([
          storage.loadTemplates(),
          storage.loadInstances(),
          storage.loadTrackingRecords(),
          storage.loadConfirmedDays(),
        ]);

        if (!isMounted) return;
        dispatch({
          type: 'HYDRATE_STATE',
          payload: { templates, instances, trackingRecords, confirmedDayStatus: confirmedDays },
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

  return <CalendarContext.Provider value={{ state, dispatch }}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return ctx;
}
