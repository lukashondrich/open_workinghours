import * as Notifications from 'expo-notifications';
import { WeekStateService } from './WeekStateService';
import { t } from '@/lib/i18n';

export class SundayNotificationService {
  private static NOTIFICATION_IDS = {
    unconfirmed: 'sunday-unconfirmed',
    queueReminder: 'sunday-queue-reminder',
    readyToSend: 'sunday-ready-to-send',
  };

  /**
   * Schedule Sunday notifications for the current week.
   *
   * Called on app open / after state changes.
   * Cancels and reschedules to avoid duplicates.
   *
   * Timeline (all times refer to this Sunday if still before 18:00, otherwise next Sunday):
   *   14:00 - "This week has X unconfirmed days" (current week incomplete)
   *   17:00 - "Your week can be queued tonight" (current week complete, auto-send OFF)
   *   18:00 - "Your weekly data is ready" (current week complete; open app to queue/send)
   */
  static async scheduleWeeklyNotifications(): Promise<void> {
    try {
      await this.cancelAll();

      const targetSunday = this.getTargetSunday();
      if (!targetSunday) return;

      const weekState = await WeekStateService.loadWeekState();
      const currentWeek = weekState.activeWeeks.find((w) => w.isCurrentWeek);
      if (!currentWeek) return;

      const isComplete = currentWeek.confirmedDays === currentWeek.totalDays;
      const autoSend = await WeekStateService.getAutoSend();

      // ~14:00 - current week still incomplete
      if (currentWeek.confirmedDays < currentWeek.totalDays) {
        const missing = currentWeek.totalDays - currentWeek.confirmedDays;
        await this.schedule(
          this.NOTIFICATION_IDS.unconfirmed,
          targetSunday,
          14,
          0,
          t('notifications.sundayUnconfirmedTitle'),
          t('notifications.sundayUnconfirmedBody', { count: missing }),
        );
      }

      // ~17:00 - heads-up that a fully confirmed week can be queued tonight
      if (!autoSend && isComplete) {
        await this.schedule(
          this.NOTIFICATION_IDS.queueReminder,
          targetSunday,
          17,
          0,
          t('notifications.sundayQueueTitle'),
          t('notifications.sundayQueueBody', { week: `KW${currentWeek.weekNumber}` }),
        );
      }

      // ~18:00 - current week is complete; open app to queue/send
      if (isComplete) {
        await this.schedule(
          this.NOTIFICATION_IDS.readyToSend,
          targetSunday,
          18,
          0,
          t('notifications.sundayReadyTitle'),
          t('notifications.sundayReadyBody'),
        );
      }
    } catch (error) {
      console.warn('[SundayNotificationService] Failed to schedule notifications:', error);
    }
  }

  private static async schedule(
    id: string,
    sunday: Date,
    hour: number,
    minute: number,
    title: string,
    body: string,
  ): Promise<void> {
    const trigger = new Date(sunday);
    trigger.setHours(hour, minute, 0, 0);
    if (trigger <= new Date()) return; // Don't schedule in the past

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }

  private static async cancelAll(): Promise<void> {
    for (const id of Object.values(this.NOTIFICATION_IDS)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }

  /**
   * Get the target Sunday for scheduling.
   * If it's Sunday before 18:00, target is today.
   * Otherwise, target is next Sunday.
   */
  private static getTargetSunday(): Date | null {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    if (day === 0 && now.getHours() < 18) return now;
    const daysUntilSunday = (7 - day) % 7 || 7;
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() + daysUntilSunday);
    return sunday;
  }
}
