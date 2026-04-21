/**
 * Event emitter for calendar state refresh signals coming from other modules.
 */

type CalendarEventType = 'confirmed-days-updated';

interface CalendarEventPayloadMap {
  'confirmed-days-updated': {
    dates: string[];
    submissionId: string;
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
