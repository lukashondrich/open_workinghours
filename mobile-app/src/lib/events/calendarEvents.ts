/**
 * Event emitter for calendar state refresh signals coming from other modules.
 */

type CalendarEventType = 'confirmed-days-updated' | 'day-confirmation-message' | 'week-state-changed';

interface CalendarEventPayloadMap {
  'confirmed-days-updated': {
    dates: string[];
    // Present when days were locked by a week submission; absent when a day was
    // un-confirmed (reopened for editing). Listeners reload from storage and
    // don't read this — it's informational.
    submissionId?: string;
  };
  'day-confirmation-message': {
    message: string;
  };
  // weekStart === null means a global change (e.g. auto-send toggle) — refetch for any week
  'week-state-changed': {
    weekStart: string | null;
  };
}

type Listener<T extends CalendarEventType> = (payload: CalendarEventPayloadMap[T]) => void;

class CalendarEventEmitter {
  private listeners: Map<CalendarEventType, Set<Listener<any>>> = new Map();

  on<T extends CalendarEventType>(event: T, listener: Listener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<any>);
  }

  off<T extends CalendarEventType>(event: T, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener<any>);
  }

  emit<T extends CalendarEventType>(event: T, payload: CalendarEventPayloadMap[T]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('[CalendarEvents] Listener error:', error);
      }
    });
  }
}

export const calendarEvents = new CalendarEventEmitter();
