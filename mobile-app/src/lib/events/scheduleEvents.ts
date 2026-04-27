type ScheduleEventType = 'schedule-changed';

export interface ScheduleChangeEvent {
  source: 'shifts' | 'absences';
  occurredAt: string;
}

type ScheduleEventPayloadMap = {
  'schedule-changed': ScheduleChangeEvent;
};

type Listener<T extends ScheduleEventType> = (payload: ScheduleEventPayloadMap[T]) => void;

class ScheduleEventEmitter {
  private listeners: Map<ScheduleEventType, Set<Listener<any>>> = new Map();

  on<T extends ScheduleEventType>(event: T, listener: Listener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<any>);
  }

  off<T extends ScheduleEventType>(event: T, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener<any>);
  }

  emit<T extends ScheduleEventType>(event: T, payload: ScheduleEventPayloadMap[T]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('[ScheduleEvents] Listener error:', error);
      }
    });
  }
}

export const scheduleEvents = new ScheduleEventEmitter();
