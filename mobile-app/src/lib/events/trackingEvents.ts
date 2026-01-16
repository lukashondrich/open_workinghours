/**
 * Simple event emitter for tracking state changes.
 *
 * Used to notify the Calendar module when clock-in/clock-out events occur
 * in the Geofencing module, enabling instant UI updates without polling.
 */

type TrackingEventType = 'tracking-changed';
type Listener = () => void;

class TrackingEventEmitter {
  private listeners: Map<TrackingEventType, Set<Listener>> = new Map();

  on(event: TrackingEventType, listener: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: TrackingEventType, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: TrackingEventType): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error(`[TrackingEvents] Listener error:`, error);
      }
    });
  }
}

export const trackingEvents = new TrackingEventEmitter();
