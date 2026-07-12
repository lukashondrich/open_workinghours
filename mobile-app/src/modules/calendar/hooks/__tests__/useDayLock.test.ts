import { Alert } from 'react-native';

import { useDayLock, getDayLockState } from '../useDayLock';
import { unconfirmDaySideEffects } from '@/modules/calendar/services/unconfirmDay';
import type { CalendarState } from '@/lib/calendar/types';

jest.mock('@/lib/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/modules/calendar/services/unconfirmDay', () => ({
  unconfirmDaySideEffects: jest.fn(),
}));

const mockedSideEffects = unconfirmDaySideEffects as jest.MockedFunction<typeof unconfirmDaySideEffects>;

const DATE_KEY = '2026-07-06';

function stateWith(status?: 'confirmed' | 'locked'): CalendarState {
  return {
    confirmedDayStatus: status ? { [DATE_KEY]: { status } } : {},
  } as unknown as CalendarState;
}

/** Extract the non-cancel button from the last Alert.alert call and press it. */
async function pressConfirmButton(): Promise<void> {
  const alertMock = Alert.alert as jest.Mock;
  const buttons = alertMock.mock.calls[alertMock.mock.calls.length - 1][2];
  const confirm = buttons.find((b: { style?: string }) => b.style !== 'cancel');
  await confirm.onPress();
}

describe('useDayLock', () => {
  const dispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedSideEffects.mockResolvedValue(undefined);
  });

  describe('getDayLockState', () => {
    it('maps statuses to lock states', () => {
      expect(getDayLockState(stateWith(), DATE_KEY)).toBe('editable');
      expect(getDayLockState(stateWith('confirmed'), DATE_KEY)).toBe('confirmed');
      expect(getDayLockState(stateWith('locked'), DATE_KEY)).toBe('locked');
    });
  });

  describe('ensureEditable', () => {
    it('runs the action immediately on an editable day', () => {
      const proceed = jest.fn();
      useDayLock(stateWith(), dispatch).ensureEditable(DATE_KEY, proceed);

      expect(proceed).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('hard-blocks a locked day', () => {
      const proceed = jest.fn();
      useDayLock(stateWith('locked'), dispatch).ensureEditable(DATE_KEY, proceed);

      expect(proceed).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'calendar.dayLock.lockedTitle',
        'calendar.dayLock.lockedMessage',
      );
    });

    it('un-confirms then proceeds when side effects succeed', async () => {
      const callOrder: string[] = [];
      mockedSideEffects.mockImplementation(async () => {
        callOrder.push('sideEffects');
      });
      dispatch.mockImplementation(() => {
        callOrder.push('dispatch');
      });
      const proceed = jest.fn(() => {
        callOrder.push('proceed');
      });

      useDayLock(stateWith('confirmed'), dispatch).ensureEditable(DATE_KEY, proceed);
      await pressConfirmButton();

      expect(mockedSideEffects).toHaveBeenCalledWith(DATE_KEY);
      expect(dispatch).toHaveBeenCalledWith({ type: 'UNCONFIRM_DAY', date: DATE_KEY });
      // Side effects MUST complete before the state flip: a failure after the
      // flip would let the Sunday auto-send submit stale hours.
      expect(callOrder).toEqual(['sideEffects', 'dispatch', 'proceed']);
    });

    it('keeps the day confirmed and does not proceed when side effects fail', async () => {
      mockedSideEffects.mockRejectedValue(new Error('db locked'));
      const proceed = jest.fn();

      useDayLock(stateWith('confirmed'), dispatch).ensureEditable(DATE_KEY, proceed);
      await pressConfirmButton();

      expect(dispatch).not.toHaveBeenCalled();
      expect(proceed).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenLastCalledWith(
        'calendar.dayLock.unconfirmFailedTitle',
        'calendar.dayLock.unconfirmFailedMessage',
      );
    });
  });

  describe('promptUnconfirm', () => {
    it('does nothing unless the day is confirmed', () => {
      useDayLock(stateWith(), dispatch).promptUnconfirm(DATE_KEY);
      useDayLock(stateWith('locked'), dispatch).promptUnconfirm(DATE_KEY);

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('un-confirms after confirmation', async () => {
      useDayLock(stateWith('confirmed'), dispatch).promptUnconfirm(DATE_KEY);
      await pressConfirmButton();

      expect(mockedSideEffects).toHaveBeenCalledWith(DATE_KEY);
      expect(dispatch).toHaveBeenCalledWith({ type: 'UNCONFIRM_DAY', date: DATE_KEY });
    });

    it('does not flip state when side effects fail', async () => {
      mockedSideEffects.mockRejectedValue(new Error('db locked'));

      useDayLock(stateWith('confirmed'), dispatch).promptUnconfirm(DATE_KEY);
      await pressConfirmButton();

      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
