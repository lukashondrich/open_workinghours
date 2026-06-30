import { calendarReducer, initialState } from '../calendar-reducer';
import type { CalendarState, ConfirmedDayStatus, ShiftInstance, TrackingRecord } from '../types';

const DATE = '2026-06-15';

function shift(id: string, date = DATE): ShiftInstance {
  return {
    id,
    templateId: 'tpl-1',
    date,
    startTime: '08:00',
    duration: 480,
    endTime: '16:00',
    color: 'blue',
    name: 'Frühdienst',
  };
}

function tracking(id: string, date = DATE): TrackingRecord {
  return { id, date, startTime: '08:00', duration: 480, breakMinutes: 0 };
}

function stateWith(status: ConfirmedDayStatus['status'] | null): CalendarState {
  const confirmedDayStatus: Record<string, ConfirmedDayStatus> = status
    ? { [DATE]: { status, confirmedAt: '2026-06-15T18:00:00.000Z' } }
    : {};
  return {
    ...initialState,
    instances: { 's1': shift('s1') },
    trackingRecords: { 't1': tracking('t1') },
    confirmedDayStatus,
    confirmedDates: status === 'confirmed' || status === 'locked' ? new Set([DATE]) : new Set(),
  };
}

describe('UNCONFIRM_DAY', () => {
  it('reverts a confirmed day to pending and clears confirmedAt + confirmedDates', () => {
    const next = calendarReducer(stateWith('confirmed'), { type: 'UNCONFIRM_DAY', date: DATE });
    expect(next.confirmedDayStatus[DATE].status).toBe('pending');
    expect(next.confirmedDayStatus[DATE].confirmedAt).toBeNull();
    expect(next.confirmedDates.has(DATE)).toBe(false);
  });

  it('is a no-op on a locked (week-submitted) day', () => {
    const locked = stateWith('locked');
    const next = calendarReducer(locked, { type: 'UNCONFIRM_DAY', date: DATE });
    expect(next.confirmedDayStatus[DATE].status).toBe('locked');
    expect(next).toBe(locked);
  });

  it('is a no-op on a pending / unconfirmed day', () => {
    const pending = stateWith(null);
    expect(calendarReducer(pending, { type: 'UNCONFIRM_DAY', date: DATE })).toBe(pending);
  });
});

describe('edit lock guards', () => {
  it('blocks DELETE_INSTANCE on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), { type: 'DELETE_INSTANCE', id: 's1' });
    expect(next.instances['s1']).toBeDefined();
  });

  it('blocks DELETE_INSTANCE on a locked day', () => {
    const next = calendarReducer(stateWith('locked'), { type: 'DELETE_INSTANCE', id: 's1' });
    expect(next.instances['s1']).toBeDefined();
  });

  it('allows DELETE_INSTANCE on a pending day', () => {
    const next = calendarReducer(stateWith(null), { type: 'DELETE_INSTANCE', id: 's1' });
    expect(next.instances['s1']).toBeUndefined();
  });

  it('blocks UPDATE_INSTANCE_START_TIME on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), {
      type: 'UPDATE_INSTANCE_START_TIME',
      id: 's1',
      startTime: '09:00',
    });
    expect(next.instances['s1'].startTime).toBe('08:00');
  });

  it('blocks DELETE_TRACKING_RECORD on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), { type: 'DELETE_TRACKING_RECORD', id: 't1' });
    expect(next.trackingRecords['t1']).toBeDefined();
  });

  it('blocks ADD_INSTANCE on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), {
      type: 'ADD_INSTANCE',
      instance: shift('s2'),
    });
    expect(next.instances['s2']).toBeUndefined();
  });

  it('blocks UPDATE_INSTANCE on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), {
      type: 'UPDATE_INSTANCE',
      id: 's1',
      instance: { name: 'Changed' },
    });
    expect(next.instances['s1'].name).toBe('Frühdienst');
  });

  it('blocks PLACE_SHIFT on a confirmed day', () => {
    const armed: CalendarState = {
      ...stateWith('confirmed'),
      armedTemplateId: 'tpl-1',
      templates: { 'tpl-1': { id: 'tpl-1', name: 'X', startTime: '08:00', duration: 480, color: 'blue' } },
    };
    const next = calendarReducer(armed, { type: 'PLACE_SHIFT', date: DATE });
    // No new instance added for the locked day (only the seeded s1 remains).
    expect(Object.values(next.instances).filter((i) => i.date === DATE)).toHaveLength(1);
  });

  it('blocks ADD_ABSENCE_INSTANCE on a confirmed day', () => {
    const next = calendarReducer(stateWith('confirmed'), {
      type: 'ADD_ABSENCE_INSTANCE',
      instance: {
        id: 'a1', templateId: 'at1', type: 'vacation', date: DATE,
        startTime: '00:00', endTime: '23:59', isFullDay: true, name: 'Urlaub',
        color: 'teal', createdAt: '', updatedAt: '',
      },
    });
    expect(next.absenceInstances['a1']).toBeUndefined();
  });

  it('allows deleting tracked time after the day is un-confirmed', () => {
    // Reproduces the reported bug: a confirmed day must block the delete, but
    // un-confirming first should restore editability.
    const confirmed = stateWith('confirmed');
    const blocked = calendarReducer(confirmed, { type: 'DELETE_TRACKING_RECORD', id: 't1' });
    expect(blocked.trackingRecords['t1']).toBeDefined();

    const reopened = calendarReducer(confirmed, { type: 'UNCONFIRM_DAY', date: DATE });
    const deleted = calendarReducer(reopened, { type: 'DELETE_TRACKING_RECORD', id: 't1' });
    expect(deleted.trackingRecords['t1']).toBeUndefined();
  });
});
