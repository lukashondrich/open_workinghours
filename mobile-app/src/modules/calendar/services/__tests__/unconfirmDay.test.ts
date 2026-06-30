import { unconfirmDaySideEffects } from '../unconfirmDay';
import { getDatabase } from '../../../geofencing/services/Database';
import { getCalendarStorage } from '../CalendarStorage';
import { calendarEvents } from '../../../../lib/events/calendarEvents';
import { SundayNotificationService } from '../../../reports/services/SundayNotificationService';

jest.mock('../../../geofencing/services/Database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../CalendarStorage', () => ({
  getCalendarStorage: jest.fn(),
}));

jest.mock('../../../../lib/events/calendarEvents', () => ({
  calendarEvents: { emit: jest.fn() },
}));

jest.mock('../../../reports/services/SundayNotificationService', () => ({
  SundayNotificationService: { scheduleWeeklyNotifications: jest.fn() },
}));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockedGetCalendarStorage = getCalendarStorage as jest.MockedFunction<typeof getCalendarStorage>;
const mockedEmit = calendarEvents.emit as jest.MockedFunction<typeof calendarEvents.emit>;
const mockedReschedule =
  SundayNotificationService.scheduleWeeklyNotifications as jest.MockedFunction<
    typeof SundayNotificationService.scheduleWeeklyNotifications
  >;

const DATE = '2026-06-15';

describe('unconfirmDaySideEffects', () => {
  let deleteDailyActual: jest.Mock;
  let markDayUnconfirmed: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    deleteDailyActual = jest.fn().mockResolvedValue(undefined);
    markDayUnconfirmed = jest.fn().mockResolvedValue(undefined);
    mockedGetDatabase.mockResolvedValue({ deleteDailyActual } as any);
    mockedGetCalendarStorage.mockResolvedValue({ markDayUnconfirmed } as any);
    mockedReschedule.mockResolvedValue(undefined as any);
  });

  it('deletes the daily_actuals snapshot for the date', async () => {
    await unconfirmDaySideEffects(DATE);
    expect(deleteDailyActual).toHaveBeenCalledWith(DATE);
  });

  it('persists the pending status to confirmed_days BEFORE emitting (avoids reload race)', async () => {
    const order: string[] = [];
    markDayUnconfirmed.mockImplementation(async () => { order.push('persist'); });
    mockedEmit.mockImplementation(() => { order.push('emit'); });
    await unconfirmDaySideEffects(DATE);
    expect(markDayUnconfirmed).toHaveBeenCalledWith(DATE);
    expect(order).toEqual(['persist', 'emit']);
  });

  it('emits confirmed-days-updated so off-screen surfaces refresh', async () => {
    await unconfirmDaySideEffects(DATE);
    expect(mockedEmit).toHaveBeenCalledWith('confirmed-days-updated', { dates: [DATE] });
  });

  it('reschedules Sunday notifications to bump the "to confirm" count back up', async () => {
    await unconfirmDaySideEffects(DATE);
    expect(mockedReschedule).toHaveBeenCalled();
  });

  it('still resolves if rescheduling notifications fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedReschedule.mockRejectedValueOnce(new Error('notif boom'));
    await expect(unconfirmDaySideEffects(DATE)).resolves.toBeUndefined();
    expect(deleteDailyActual).toHaveBeenCalledWith(DATE);
    errorSpy.mockRestore();
  });
});
