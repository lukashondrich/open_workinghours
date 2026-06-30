import { Alert } from 'react-native';
import type { Dispatch } from 'react';
import { t } from '@/lib/i18n';
import type { CalendarState, CalendarAction } from '@/lib/calendar/types';
import { unconfirmDaySideEffects } from '@/modules/calendar/services/unconfirmDay';

export type DayLockState = 'editable' | 'confirmed' | 'locked';

export function getDayLockState(state: CalendarState, dateKey: string): DayLockState {
  const status = state.confirmedDayStatus[dateKey]?.status;
  if (status === 'locked') return 'locked';
  if (status === 'confirmed') return 'confirmed';
  return 'editable';
}

async function performUnconfirm(dateKey: string, dispatch: Dispatch<CalendarAction>): Promise<void> {
  dispatch({ type: 'UNCONFIRM_DAY', date: dateKey });
  await unconfirmDaySideEffects(dateKey);
}

/**
 * Confirmed-day edit lock. A day that has been confirmed (or week-locked) must
 * not be mutated directly. This hook centralises the gating UX:
 *   - editable day  → action runs immediately
 *   - confirmed day → "Un-confirm to edit?" → reopens the day, then runs action
 *   - locked day    → hard-block (already submitted to backend)
 *
 * `t` is the global i18n function (these components don't use the hook form),
 * so this is a plain factory rather than a true React hook — call it each render
 * to capture the latest state.
 */
export function useDayLock(state: CalendarState, dispatch: Dispatch<CalendarAction>) {
  const lockStateFor = (dateKey: string): DayLockState => getDayLockState(state, dateKey);

  /** Gate a mutating action behind the lock (see hook doc). */
  const ensureEditable = (dateKey: string, proceed: () => void): void => {
    const lock = lockStateFor(dateKey);
    if (lock === 'editable') {
      proceed();
      return;
    }
    if (lock === 'locked') {
      Alert.alert(t('calendar.dayLock.lockedTitle'), t('calendar.dayLock.lockedMessage'));
      return;
    }
    Alert.alert(
      t('calendar.dayLock.unconfirmTitle'),
      t('calendar.dayLock.unconfirmEditMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('calendar.dayLock.unconfirmAndEdit'),
          onPress: async () => {
            await performUnconfirm(dateKey, dispatch);
            proceed();
          },
        },
      ],
    );
  };

  /** Deliberate un-confirm (e.g. tapping the ✓ badge). No follow-up edit. */
  const promptUnconfirm = (dateKey: string): void => {
    if (lockStateFor(dateKey) !== 'confirmed') return;
    Alert.alert(
      t('calendar.dayLock.unconfirmTitle'),
      t('calendar.dayLock.unconfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('calendar.dayLock.unconfirm'),
          style: 'destructive',
          onPress: () => { void performUnconfirm(dateKey, dispatch); },
        },
      ],
    );
  };

  return { ensureEditable, promptUnconfirm, lockStateFor };
}
