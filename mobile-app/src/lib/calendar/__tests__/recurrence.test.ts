import { buildSeriesOccurrences, SERIES_HORIZON_DAYS } from '../recurrence';
import { calendarReducer, initialState } from '../calendar-reducer';
import type { CalendarState, ShiftInstance } from '../types';

function makeInstance(overrides: Partial<ShiftInstance> = {}): ShiftInstance {
  return {
    id: 'source-1',
    templateId: 'tpl-1',
    date: '2026-09-07', // a Monday
    startTime: '08:00',
    duration: 480,
    endTime: '16:00',
    color: 'teal',
    name: 'Frühdienst',
    ...overrides,
  };
}

let idCounter = 0;
const makeId = () => `gen-${++idCounter}`;

beforeEach(() => {
  idCounter = 0;
});

describe('buildSeriesOccurrences', () => {
  it('creates weekly occurrences on the same weekday within the horizon', () => {
    const source = makeInstance();
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(source, 1, 'series-1', {}, makeId);

    // 90-day horizon at 7-day steps: offsets 7..84 → 12 occurrences
    expect(occurrences).toHaveLength(12);
    expect(skippedOverlaps).toBe(0);
    expect(occurrences[0].date).toBe('2026-09-14');
    expect(occurrences[11].date).toBe('2026-11-30');
    // All Mondays
    for (const occ of occurrences) {
      expect(new Date(occ.date).getDay()).toBe(1);
    }
  });

  it('creates bi-weekly occurrences', () => {
    const source = makeInstance();
    const { occurrences } = buildSeriesOccurrences(source, 2, 'series-1', {}, makeId);

    // offsets 14..84 at 14-day steps → 6 occurrences
    expect(occurrences).toHaveLength(6);
    expect(occurrences[0].date).toBe('2026-09-21');
    expect(occurrences[5].date).toBe('2026-11-30');
  });

  it('copies shift fields and tags occurrences with the seriesId and fresh ids', () => {
    const source = makeInstance();
    const { occurrences } = buildSeriesOccurrences(source, 1, 'series-42', {}, makeId);

    for (const occ of occurrences) {
      expect(occ.templateId).toBe('tpl-1');
      expect(occ.startTime).toBe('08:00');
      expect(occ.duration).toBe(480);
      expect(occ.endTime).toBe('16:00');
      expect(occ.name).toBe('Frühdienst');
      expect(occ.seriesId).toBe('series-42');
      expect(occ.id).not.toBe(source.id);
    }
    expect(new Set(occurrences.map((o) => o.id)).size).toBe(occurrences.length);
  });

  it('skips occurrences that overlap existing shifts and counts them', () => {
    const source = makeInstance();
    const blocker = makeInstance({
      id: 'existing-1',
      date: '2026-09-21', // second weekly occurrence
      startTime: '10:00', // overlaps 08:00–16:00
      duration: 120,
    });
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(
      source,
      1,
      'series-1',
      { [blocker.id]: blocker },
      makeId
    );

    expect(skippedOverlaps).toBe(1);
    expect(occurrences).toHaveLength(11);
    expect(occurrences.map((o) => o.date)).not.toContain('2026-09-21');
  });

  it('does not skip when the existing shift is on a different date or non-overlapping time', () => {
    const source = makeInstance();
    const sameDayLater = makeInstance({
      id: 'existing-2',
      date: '2026-09-14',
      startTime: '17:00', // after the 08:00–16:00 occurrence
      duration: 120,
    });
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(
      source,
      1,
      'series-1',
      { [sameDayLater.id]: sameDayLater },
      makeId
    );

    expect(skippedOverlaps).toBe(0);
    expect(occurrences.map((o) => o.date)).toContain('2026-09-14');
  });

  it('skips occurrences blocked by a previous-day overnight shift spilling past midnight', () => {
    // Frühdienst repeating on Mondays at 05:30
    const source = makeInstance({ startTime: '05:30', duration: 480, endTime: '13:30' });
    // Nachtdienst on Sunday 2026-09-20, 22:00 + 8h → ends Monday 06:00
    const nachtdienst = makeInstance({
      id: 'nacht-1',
      date: '2026-09-20',
      startTime: '22:00',
      duration: 480,
      endTime: '06:00',
      name: 'Nachtdienst',
    });
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(
      source,
      1,
      'series-1',
      { [nachtdienst.id]: nachtdienst },
      makeId
    );

    expect(skippedOverlaps).toBe(1);
    expect(occurrences.map((o) => o.date)).not.toContain('2026-09-21');
  });

  it('skips occurrences whose own tail crosses midnight into a next-day shift', () => {
    // Nachtdienst repeating on Mondays, 22:00 + 8h → ends Tuesday 06:00
    const source = makeInstance({ startTime: '22:00', duration: 480, endTime: '06:00', name: 'Nachtdienst' });
    // Existing Frühdienst on Tuesday 2026-09-15 at 05:30
    const fruehdienst = makeInstance({
      id: 'frueh-1',
      date: '2026-09-15',
      startTime: '05:30',
      duration: 480,
      endTime: '13:30',
    });
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(
      source,
      1,
      'series-1',
      { [fruehdienst.id]: fruehdienst },
      makeId
    );

    expect(skippedOverlaps).toBe(1);
    expect(occurrences.map((o) => o.date)).not.toContain('2026-09-14');
  });

  it('does not skip when the previous-day shift ends exactly at midnight or before the occurrence starts', () => {
    const source = makeInstance({ startTime: '05:30', duration: 480, endTime: '13:30' });
    // Spätdienst Sunday 16:00 + 8h → ends exactly 24:00, no spill
    const spaet = makeInstance({
      id: 'spaet-1',
      date: '2026-09-20',
      startTime: '16:00',
      duration: 480,
      endTime: '00:00',
    });
    // Nachtdienst Sunday 21:00 + 8h → ends Monday 05:00, before the 05:30 start
    const nacht = makeInstance({
      id: 'nacht-2',
      date: '2026-09-27',
      startTime: '21:00',
      duration: 480,
      endTime: '05:00',
      name: 'Nachtdienst',
    });
    const { occurrences, skippedOverlaps } = buildSeriesOccurrences(
      source,
      1,
      'series-1',
      { [spaet.id]: spaet, [nacht.id]: nacht },
      makeId
    );

    expect(skippedOverlaps).toBe(0);
    expect(occurrences.map((o) => o.date)).toEqual(expect.arrayContaining(['2026-09-21', '2026-09-28']));
  });

  it('respects the horizon constant', () => {
    const source = makeInstance();
    const { occurrences } = buildSeriesOccurrences(source, 1, 'series-1', {}, makeId);
    const last = occurrences[occurrences.length - 1];
    const diffDays =
      (new Date(last.date).getTime() - new Date(source.date).getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeLessThanOrEqual(SERIES_HORIZON_DAYS);
  });
});

describe('calendarReducer series actions', () => {
  function stateWithInstances(instances: ShiftInstance[]): CalendarState {
    return {
      ...initialState,
      instances: Object.fromEntries(instances.map((i) => [i.id, i])),
    };
  }

  it('ADD_SERIES adds occurrences and tags the source instance', () => {
    const source = makeInstance();
    const occurrence = makeInstance({ id: 'occ-1', date: '2026-09-14', seriesId: 'series-1' });
    const state = stateWithInstances([source]);

    const next = calendarReducer(state, {
      type: 'ADD_SERIES',
      instances: [occurrence],
      sourceInstanceId: source.id,
      seriesId: 'series-1',
    });

    expect(next.instances['occ-1']).toBeDefined();
    expect(next.instances['occ-1'].seriesId).toBe('series-1');
    expect(next.instances[source.id].seriesId).toBe('series-1');
  });

  it('ADD_SERIES never re-tags a source that already belongs to another series', () => {
    const source = makeInstance({ seriesId: 'series-old' });
    const occurrence = makeInstance({ id: 'occ-1', date: '2026-09-14' });
    const state = stateWithInstances([source]);

    const next = calendarReducer(state, {
      type: 'ADD_SERIES',
      instances: [occurrence],
      sourceInstanceId: source.id,
      seriesId: 'series-new',
    });

    expect(next.instances[source.id].seriesId).toBe('series-old');
    expect(next.instances['occ-1'].seriesId).toBe('series-new');
  });

  it('DELETE_SERIES_FROM removes only same-series instances on or after fromDate', () => {
    const a = makeInstance({ id: 'a', date: '2026-09-07', seriesId: 's1' });
    const b = makeInstance({ id: 'b', date: '2026-09-14', seriesId: 's1' });
    const c = makeInstance({ id: 'c', date: '2026-09-21', seriesId: 's1' });
    const other = makeInstance({ id: 'other', date: '2026-09-14', seriesId: 's2' });
    const loose = makeInstance({ id: 'loose', date: '2026-09-14' });
    const state = stateWithInstances([a, b, c, other, loose]);

    const next = calendarReducer(state, {
      type: 'DELETE_SERIES_FROM',
      seriesId: 's1',
      fromDate: '2026-09-14',
    });

    expect(next.instances['a']).toBeDefined(); // before fromDate — kept
    expect(next.instances['b']).toBeUndefined();
    expect(next.instances['c']).toBeUndefined();
    expect(next.instances['other']).toBeDefined(); // different series
    expect(next.instances['loose']).toBeDefined(); // no series
  });

  it('DELETE_SERIES_FROM leaves confirmed/locked days untouched', () => {
    const b = makeInstance({ id: 'b', date: '2026-09-14', seriesId: 's1' });
    const c = makeInstance({ id: 'c', date: '2026-09-21', seriesId: 's1' });
    const state: CalendarState = {
      ...stateWithInstances([b, c]),
      confirmedDates: new Set(['2026-09-14']),
      confirmedDayStatus: { '2026-09-14': { status: 'confirmed' } },
    };

    const next = calendarReducer(state, {
      type: 'DELETE_SERIES_FROM',
      seriesId: 's1',
      fromDate: '2026-09-01',
    });

    expect(next.instances['b']).toBeDefined(); // confirmed day — untouched
    expect(next.instances['c']).toBeUndefined();
  });
});
