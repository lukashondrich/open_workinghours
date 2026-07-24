/**
 * Confirmation-completeness line shared by the MonthView footer and the
 * Status HoursSummaryWidget. Lives outside calendar-utils so the pure
 * calculation module stays free of the i18n (expo-localization) dependency.
 */
import { t } from '@/lib/i18n';

/** Returns null when there is nothing to confirm yet (no elapsed days with activity). */
export function getConfirmedFractionText(
  confirmedDayCount: number,
  eligibleDayCount: number,
): string | null {
  if (eligibleDayCount === 0) return null;
  if (confirmedDayCount === eligibleDayCount) return t('calendar.month.allDaysConfirmed');
  if (eligibleDayCount === 1) {
    // Only reachable with confirmedDayCount === 0 (the equality branch above
    // catches 1 of 1), so the string needs no interpolation
    return t('calendar.month.daysConfirmedFractionOne');
  }
  return t('calendar.month.daysConfirmedFraction', {
    confirmed: confirmedDayCount,
    total: eligibleDayCount,
  });
}
