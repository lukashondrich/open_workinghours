import { getDatabase } from '@/modules/geofencing/services/Database';
import { getCalendarStorage } from '@/modules/calendar/services/CalendarStorage';
import { calendarEvents } from '@/lib/events/calendarEvents';
import { SundayNotificationService } from '@/modules/reports/services/SundayNotificationService';

/**
 * Side effects of reopening a confirmed day for editing.
 *
 * The in-memory status flip back to `pending` is dispatched separately by the
 * caller (UNCONFIRM_DAY) and auto-persisted to the `confirmed_days` table. This
 * function clears the *other* source of truth — the `daily_actuals` snapshot —
 * which the week state machine counts to decide whether a week is submittable.
 * Both must be cleared together or an un-confirmed day could still be sent to
 * the backend with stale data. See WeekStateService (confirmedDays =
 * dailyActuals.length).
 *
 * It then refreshes off-screen surfaces (Dashboard "X to confirm" nudge, Log
 * tab badge, HoursSummaryWidget) and bumps the Sunday reminder count back up.
 */
export async function unconfirmDaySideEffects(dateKey: string): Promise<void> {
  const db = await getDatabase();
  await db.deleteDailyActual(dateKey);

  // Persist the status flip to storage BEFORE emitting. The provider both
  // persists `confirmedDayStatus` via an async effect AND reloads from storage
  // on this event — writing 'pending' here first avoids a race where the reload
  // re-hydrates a stale 'confirmed' row over the in-memory pending state.
  const calendarStorage = await getCalendarStorage();
  await calendarStorage.markDayUnconfirmed(dateKey);

  calendarEvents.emit('confirmed-days-updated', { dates: [dateKey] });

  try {
    await SundayNotificationService.scheduleWeeklyNotifications();
  } catch (error) {
    console.error('[unconfirmDay] Failed to reschedule notifications:', error);
  }
}
