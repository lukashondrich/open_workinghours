/**
 * Breaks live only in the calendar's tracking_records table. Rebuilding tracking
 * records from sessions (every week navigation, toggle, mount) must not drop them
 * — the persist effect would then write the zeros back. Found 2026-09-27.
 */
import { mergeStoredBreaks } from '../calendar-utils';
import { calendarReducer, initialState } from '../calendar-reducer';
import type { CalendarState, TrackingRecord } from '../types';

const rec = (id: string, breakMinutes?: number): TrackingRecord => ({
  id,
  date: '2026-09-21',
  startTime: '09:05',
  duration: 215,
  ...(breakMinutes !== undefined ? { breakMinutes } : {}),
});

describe('mergeStoredBreaks', () => {
  it('carries stored break minutes onto rebuilt records', () => {
    const rebuilt = { a: rec('a'), b: rec('b') };
    const stored = { a: { breakMinutes: 15 } };
    const merged = mergeStoredBreaks(rebuilt, stored);
    expect(merged.a.breakMinutes).toBe(15);
    expect(merged.b.breakMinutes).toBeUndefined();
  });

  it('ignores stored records that no longer exist and zero breaks', () => {
    const merged = mergeStoredBreaks({ a: rec('a') }, { a: { breakMinutes: 0 }, gone: { breakMinutes: 30 } });
    expect(merged.a.breakMinutes).toBeUndefined();
    expect(Object.keys(merged)).toEqual(['a']);
  });
});

describe('UPDATE_TRACKING_RECORDS keeps known breaks', () => {
  const state: CalendarState = {
    ...initialState,
    trackingRecords: { a: rec('a', 15), b: rec('b', 0) },
  };

  it('preserves a break when the incoming record has none', () => {
    const next = calendarReducer(state, { type: 'UPDATE_TRACKING_RECORDS', trackingRecords: { a: rec('a'), b: rec('b') } });
    expect(next.trackingRecords.a.breakMinutes).toBe(15);
    expect(next.trackingRecords.b.breakMinutes ?? 0).toBe(0);
  });

  it('lets an explicit incoming break win', () => {
    const next = calendarReducer(state, { type: 'UPDATE_TRACKING_RECORDS', trackingRecords: { a: rec('a', 30) } });
    expect(next.trackingRecords.a.breakMinutes).toBe(30);
  });

  it('drops records that disappeared from the source', () => {
    const next = calendarReducer(state, { type: 'UPDATE_TRACKING_RECORDS', trackingRecords: { b: rec('b') } });
    expect(next.trackingRecords.a).toBeUndefined();
  });

  it('keeps a break only when the incoming record has NO breakMinutes (explicit 0 wins)', () => {
    const next = calendarReducer(state, { type: 'UPDATE_TRACKING_RECORDS', trackingRecords: { a: rec('a', 0) } });
    expect(next.trackingRecords.a.breakMinutes).toBe(0);
  });
});

describe('SET_REVIEW_MODE', () => {
  const state: CalendarState = {
    ...initialState,
    trackingRecords: { a: rec('a', 15) },
  };

  it('is idempotent: on stays on, and merges breaks like UPDATE_TRACKING_RECORDS', () => {
    const once = calendarReducer(state, { type: 'SET_REVIEW_MODE', on: true, trackingRecords: { a: rec('a') } });
    const twice = calendarReducer(once, { type: 'SET_REVIEW_MODE', on: true, trackingRecords: { a: rec('a') } });
    expect(once.reviewMode).toBe(true);
    expect(twice.reviewMode).toBe(true);
    expect(twice.trackingRecords.a.breakMinutes).toBe(15);
  });

  it('does not undo a user toggle that raced the mount load', () => {
    const userOn = calendarReducer(state, { type: 'TOGGLE_REVIEW_MODE', trackingRecords: { a: rec('a') } });
    const afterMount = calendarReducer(userOn, { type: 'SET_REVIEW_MODE', on: true, trackingRecords: { a: rec('a') } });
    expect(afterMount.reviewMode).toBe(true);
  });
});
