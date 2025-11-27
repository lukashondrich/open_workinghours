import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  CalendarState,
  CalendarAction,
  ShiftTemplate,
  ShiftInstance,
  TrackingRecord,
} from './types';
import { calendarReducer, initialState } from './calendar-reducer';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';

interface CalendarContextValue {
  state: CalendarState;
  dispatch: React.Dispatch<CalendarAction>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const storageRef = useRef<Awaited<ReturnType<typeof getCalendarStorage>> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const storage = await getCalendarStorage();
        if (!isMounted) return;
        storageRef.current = storage;

        const [templates, instances, trackingRecords] = await Promise.all([
          storage.loadTemplates(),
          storage.loadInstances(),
          storage.loadTrackingRecords(),
        ]);

        if (!isMounted) return;
        dispatch({ type: 'HYDRATE_STATE', payload: { templates, instances, trackingRecords } });
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

  return <CalendarContext.Provider value={{ state, dispatch }}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return ctx;
}
