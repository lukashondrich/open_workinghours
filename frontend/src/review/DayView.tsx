import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { BreakSegment, DayReviewRecord, ShiftSegment } from "./fixtures";
import { buildTimelineSegments } from "./calculations";
import {
  addMinutes,
  clamp,
  minutesBetween,
  minutesToHours,
  parseDateTime,
  roundHours,
  startOfDay,
  toDateKey
} from "../lib/time";

export interface DayViewProps {
  day: DayReviewRecord | undefined;
  cursorDate: Date;
  onUpdateBreak: (options: { segmentId: string; timestamp: Date }) => void;
  totals: {
    scheduledMinutes: number;
    actualMinutes: number;
    breakMinutes: number;
    overtimeMinutes: number;
    onCallCreditMinutes: number;
  };
  defaultBreakMinutes: number;
  onCallCreditPct: number;
  connectorThickness: "thin" | "thick";
  onCallDisplay: "shaded" | "badge";
  onSegmentTimeChange: (options: { segmentId: string; start?: Date; end?: Date }) => void;
  defaultShiftDurationMinutes: number;
  onInsertShift: (options: { timestamp: Date; durationMinutes: number }) => ShiftSegment | null;
  onDeleteSegment: (segmentId: string) => boolean;
  onConfirmDay: () => void;
}

const TIMELINE_HEIGHT = 24 * 22;
const MIN_SHIFT_MINUTES = 10;

export function DayView({
  day,
  cursorDate,
  onUpdateBreak,
  totals,
  defaultBreakMinutes,
  onCallCreditPct,
  connectorThickness,
  onCallDisplay,
  onSegmentTimeChange,
  defaultShiftDurationMinutes,
  onInsertShift,
  onDeleteSegment,
  onConfirmDay
}: DayViewProps) {
  const effectiveDay = useMemo<DayReviewRecord>(() => {
    if (day) {
      return day;
    }
    return {
      date: toDateKey(cursorDate),
      scheduled: [],
      actual: [],
      reviewed: false
    };
  }, [day, cursorDate]);
  const dayLabel = cursorDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const segments = useMemo(() => buildTimelineSegments(effectiveDay), [effectiveDay]);
  const daySegments = segments.filter((segment) => segment.dayKey === effectiveDay.date);
  const gestureRef = useRef<GestureState | null>(null);
  const [gestureActive, setGestureActive] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSegmentId) {
      return;
    }
    const exists = daySegments.some((segment) => segment.original.id === activeSegmentId);
    if (!exists) {
      setActiveSegmentId(null);
    }
  }, [daySegments, activeSegmentId]);

  const hours = useMemo(() => Array.from({ length: 25 }, (_, index) => index), []);

  const scheduledBands = useMemo(() => {
    const dayStart = parseDateTime(`${effectiveDay.date}T00:00`);
    return effectiveDay.scheduled
      .map((segment, index) => {
        const start = parseDateTime(segment.start);
        const end = parseDateTime(segment.end);
        const clippedStart = start < dayStart ? dayStart : start;
        const clippedEnd = end > addMinutes(dayStart, 24 * 60) ? addMinutes(dayStart, 24 * 60) : end;
        if (clippedEnd <= clippedStart) {
          return null;
        }
        const topMinutes = minutesBetween(dayStart, clippedStart);
        const heightMinutes = minutesBetween(clippedStart, clippedEnd);
        return {
          id: `sched-day-${index}`,
          top: (topMinutes / (24 * 60)) * 100,
          height: (heightMinutes / (24 * 60)) * 100
        };
      })
      .filter(Boolean) as Array<{ id: string; top: number; height: number }>;
  }, [effectiveDay]);

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) {
      return;
    }
    const rect = timelineRef.current.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const ratio = offset / rect.height;
    if (ratio < 0 || ratio > 1) {
      return;
    }
    const minutesFromMidnight = Math.min(Math.max(ratio * 24 * 60, 0), 24 * 60);
    const snappedMinutes = Math.round(minutesFromMidnight / 5) * 5;
    const dayStart = parseDateTime(`${effectiveDay.date}T00:00`);
    const timestamp = addMinutes(dayStart, snappedMinutes);

    const target = daySegments.find(
      (segment) => timestamp >= segment.start && timestamp <= segment.end
    );
    if (!target) {
      const created = onInsertShift({
        timestamp,
        durationMinutes: defaultShiftDurationMinutes
      });
      if (created) {
        setActiveSegmentId(created.id);
      }
      return;
    }
    onUpdateBreak({ segmentId: target.original.id, timestamp });
  };

  useEffect(() => {
    if (!gestureActive) {
      return;
    }
    const handlePointerMove = (event: PointerEvent) => {
      const state = gestureRef.current;
      if (!state || event.pointerId !== state.pointerId) {
        return;
      }
      event.preventDefault();
      const horizontalDelta = event.clientX - state.startX;
      const verticalDelta = event.clientY - state.startY;
      if (
        state.mode === "move" &&
        !state.swipeHandled &&
        horizontalDelta > 80 &&
        Math.abs(verticalDelta) < 40
      ) {
        const removed = onDeleteSegment(state.segmentId);
        if (removed) {
          setActiveSegmentId((prev) => (prev === state.segmentId ? null : prev));
        }
        gestureRef.current = null;
        setGestureActive(false);
        return;
      }
      const minutePosition = minuteFromPointer(event.clientY, timelineRef.current);
      if (minutePosition == null) {
        return;
      }
      if (state.mode === "move") {
        const maxStart = 24 * 60 - state.sliceDuration;
        const newSliceStart = clamp(minutePosition - state.offsetMinutes, 0, maxStart);
        const delta = newSliceStart - state.initialSliceStartMinutes;
        if (delta === 0) {
          return;
        }
        const newStart = addMinutes(state.originalStart, delta);
        const newEnd = addMinutes(state.originalEnd, delta);
        onSegmentTimeChange({
          segmentId: state.segmentId,
          start: newStart,
          end: newEnd
        });
        gestureRef.current = {
          ...state,
          originalStart: newStart,
          originalEnd: newEnd,
          initialSliceStartMinutes: newSliceStart,
          initialSliceEndMinutes: newSliceStart + state.sliceDuration,
          swipeHandled: state.swipeHandled || Math.abs(horizontalDelta) > 10
        };
      } else if (state.mode === "resize-start") {
        const maxStart = state.initialSliceEndMinutes - MIN_SHIFT_MINUTES;
        const clampedStart = clamp(minutePosition, 0, maxStart);
        const delta = clampedStart - state.initialSliceStartMinutes;
        if (delta === 0) {
          return;
        }
        const newStart = addMinutes(state.originalStart, delta);
        if (minutesBetween(newStart, state.originalEnd) < MIN_SHIFT_MINUTES) {
          return;
        }
        onSegmentTimeChange({
          segmentId: state.segmentId,
          start: newStart
        });
        const newDuration = minutesBetween(newStart, state.originalEnd);
        gestureRef.current = {
          ...state,
          originalStart: newStart,
          initialSliceStartMinutes: clampedStart,
          sliceDuration: newDuration,
          swipeHandled: state.swipeHandled
        };
      } else if (state.mode === "resize-end") {
        const minEnd = state.initialSliceStartMinutes + MIN_SHIFT_MINUTES;
        const clampedEnd = clamp(minutePosition, minEnd, 24 * 60);
        const delta = clampedEnd - state.initialSliceEndMinutes;
        if (delta === 0) {
          return;
        }
        const newEnd = addMinutes(state.originalEnd, delta);
        if (minutesBetween(state.originalStart, newEnd) < MIN_SHIFT_MINUTES) {
          return;
        }
        onSegmentTimeChange({
          segmentId: state.segmentId,
          end: newEnd
        });
        const newDuration = minutesBetween(state.originalStart, newEnd);
        gestureRef.current = {
          ...state,
          originalEnd: newEnd,
          initialSliceEndMinutes: clampedEnd,
          sliceDuration: newDuration,
          swipeHandled: state.swipeHandled
        };
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const state = gestureRef.current;
      if (!state || event.pointerId !== state.pointerId) {
        return;
      }
      gestureRef.current = null;
      setGestureActive(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [gestureActive, onSegmentTimeChange, onDeleteSegment]);

  return (
    <section aria-label={`Day view for ${dayLabel}`} style={{ display: "grid", gap: "1.25rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0 }}>{dayLabel}</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#666", fontSize: "0.85rem" }}>
            Double-click inside a shift to toggle a {defaultBreakMinutes}-minute break at that spot.
          </p>
        </div>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0.5rem",
            fontSize: "0.8rem",
            textAlign: "right"
          }}
        >
          <div>
            <dt style={{ textTransform: "uppercase", color: "#777" }}>Actual</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatHours(totals.actualMinutes)}</dd>
          </div>
          <div>
            <dt style={{ textTransform: "uppercase", color: "#777" }}>Breaks</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatHours(totals.breakMinutes)}</dd>
          </div>
          <div>
            <dt style={{ textTransform: "uppercase", color: "#777" }}>Overtime</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatHours(totals.overtimeMinutes)}</dd>
          </div>
        </dl>
      </header>

      <div
        ref={timelineRef}
        role="application"
        aria-label="Interactive timeline area"
        onDoubleClick={handleDoubleClick}
        style={{
          position: "relative",
          border: "1px solid #d0d7de",
          borderRadius: "16px",
          background: "#fbfdff",
          height: `${TIMELINE_HEIGHT}px`,
          overflow: "hidden",
          touchAction: "none"
        }}
      >
        {hours.map((hour) => (
          <div
            key={`hour-${hour}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: `${(hour / 24) * 100}%`,
              left: 0,
              right: 0,
              height: "1px",
              background: hour % 6 === 0 ? "#c6d1f3" : "#e7ecf8"
            }}
          />
        ))}

        {scheduledBands.map((band) => (
          <div
            key={band.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: `${band.top}%`,
              height: `${band.height}%`,
              left: "6%",
              right: "6%",
              background: "rgba(157, 191, 249, 0.4)",
              borderRadius: "12px"
            }}
          />
        ))}

        {daySegments.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8c939f",
              fontSize: "0.9rem",
              fontStyle: "italic"
            }}
          >
            No tracked activity for this day.
          </div>
        )}

        {daySegments.map((segment) => (
          <DaySegment
            key={segment.id}
            segment={segment}
            onCallCreditPct={onCallCreditPct}
            connectorThickness={connectorThickness}
            onCallDisplay={onCallDisplay}
            onSegmentTimeChange={onSegmentTimeChange}
            timelineRef={timelineRef}
            startGesture={(state) => {
              gestureRef.current = state;
              setGestureActive(true);
            }}
            isActive={segment.original.id === activeSegmentId}
            setActive={(segmentId) => setActiveSegmentId(segmentId)}
            onDelete={(segmentId) => onDeleteSegment(segmentId)}
          />
        ))}
      </div>

      <section aria-label="Shift details" style={{ display: "grid", gap: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Shift breakdown</h3>
        {effectiveDay.actual.length === 0 ? (
          <p style={{ margin: 0, color: "#6e7781", fontStyle: "italic" }}>No actual shifts recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {effectiveDay.actual.map((segment) => {
              const start = parseDateTime(segment.start);
              const end = parseDateTime(segment.end);
              const breaks = segment.breaks.map((pause) => ({
                start: parseDateTime(pause.start),
                end: parseDateTime(pause.end)
              }));
              const durationMinutes = Math.max(minutesBetween(start, end), 0);
              const breakMinutes = breaks.reduce(
                (total, current) => total + minutesBetween(current.start, current.end),
                0
              );
              const netMinutes = durationMinutes - breakMinutes;
              const isOnCall = segment.category === "oncall";
              const appliedCredit = onCallCreditPct;
              const fixtureCredit = segment.creditPct;
              return (
                <article
                  key={segment.id}
                  style={{
                    border: "1px solid #d0d7de",
                    borderRadius: "12px",
                    padding: "0.75rem",
                    background: isOnCall ? "rgba(242, 240, 255, 0.6)" : "white"
                  }}
                >
                  <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{formatTimeRange(start, end)}</strong>{" "}
                      <span style={{ color: "#57606a" }}>{segment.label ?? (isOnCall ? "On-call" : "Work")}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#444" }}>
                      {formatHours(netMinutes)} net · {formatHours(breakMinutes)} break
                    </div>
                  </header>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#585f67" }}>
                    <div>Total span: {formatHours(durationMinutes)}</div>
                    {segment.breaks.length > 0 ? (
                      <ul style={{ margin: "0.35rem 0 0 1rem", padding: 0 }}>
                        {segment.breaks.map((pause) => {
                          const bStart = parseDateTime(pause.start);
                          const bEnd = parseDateTime(pause.end);
                          return (
                            <li key={pause.id}>
                              {formatTimeRange(bStart, bEnd)} ({formatHours(minutesBetween(bStart, bEnd))})
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p style={{ margin: "0.35rem 0 0", fontStyle: "italic" }}>No breaks recorded.</p>
                    )}
                    {isOnCall && (
                      <p style={{ margin: "0.5rem 0 0", color: "#3c218e" }}>
                        Credit applied: {appliedCredit}% → {formatHours((netMinutes * appliedCredit) / 100)}
                        {fixtureCredit !== undefined && fixtureCredit !== appliedCredit
                          ? ` (fixture suggested ${fixtureCredit}%)`
                          : ""}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#6e7781" }}>
          Double-click break logic: If a break already exists within ±{defaultBreakMinutes / 2} minutes, it is removed.
          Otherwise a break of {defaultBreakMinutes} minutes is inserted. Totals refresh immediately.
        </div>
      </section>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "0.75rem"
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (effectiveDay.reviewed) {
              return;
            }
            onConfirmDay();
            setActiveSegmentId(null);
          }}
          disabled={effectiveDay.actual.length === 0 || effectiveDay.reviewed}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 1rem",
            borderRadius: "999px",
            border: "none",
            background: effectiveDay.reviewed
              ? "#10b981"
              : effectiveDay.actual.length === 0
              ? "#cbd5f5"
              : "#16a34a",
            color: effectiveDay.reviewed
              ? "#ecfdf5"
              : effectiveDay.actual.length === 0
              ? "#475569"
              : "#fff",
            fontWeight: 600,
            cursor:
              effectiveDay.actual.length === 0 || effectiveDay.reviewed ? "not-allowed" : "pointer",
            opacity: effectiveDay.reviewed ? 1 : 0.98,
            boxShadow: effectiveDay.reviewed ? "0 0 0 1px #0f766e" : "none"
          }}
        >
          <span aria-hidden="true">✓</span>
          {effectiveDay.reviewed ? "Confirmed" : "Confirm day"}
        </button>
      </div>
    </section>
  );
}

function DaySegment({
  segment,
  onCallCreditPct,
  connectorThickness,
  onCallDisplay,
  onSegmentTimeChange,
  timelineRef,
  startGesture,
  isActive,
  setActive,
  onDelete
}: {
  segment: ReturnType<typeof buildTimelineSegments>[number];
  onCallCreditPct: number;
  connectorThickness: "thin" | "thick";
  onCallDisplay: "shaded" | "badge";
  onSegmentTimeChange: (options: { segmentId: string; start?: Date; end?: Date }) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  startGesture: (state: GestureState) => void;
  isActive: boolean;
  setActive: (segmentId: string | null) => void;
  onDelete: (segmentId: string) => boolean;
}) {
  const dayStart = parseDateTime(`${segment.dayKey}T00:00`);
  const startMinutes = minutesBetween(dayStart, segment.start);
  const endMinutes = minutesBetween(dayStart, segment.end);
  const sliceDuration = Math.max(endMinutes - startMinutes, 1);
  const top = (startMinutes / (24 * 60)) * 100;
  const height = Math.max(4, ((endMinutes - startMinutes) / (24 * 60)) * 100);
  const isOnCall = segment.category === "oncall";
  const activeBackgroundWork = "rgba(212, 63, 91, 1)";
  const idleBackgroundWork = "rgba(212, 63, 91, 0.88)";
  const activeBackgroundOnCall =
    onCallDisplay === "shaded" ? "rgba(124, 58, 237, 0.4)" : "rgba(225, 215, 255, 1)";
  const idleBackgroundOnCall =
    onCallDisplay === "shaded" ? "rgba(124, 58, 237, 0.25)" : "rgba(246, 244, 255, 0.95)";
  const backgroundColor = isOnCall ? (isActive ? activeBackgroundOnCall : idleBackgroundOnCall) : isActive ? activeBackgroundWork : idleBackgroundWork;
  const boxShadow = isOnCall
    ? isActive
      ? "0 0 0 1px rgba(124,58,237,0.55)"
      : "0 0 0 1px rgba(124,58,237,0.3)"
    : isActive
    ? "0 6px 14px rgba(212, 63, 91, 0.35)"
    : "0 4px 10px rgba(212, 63, 91, 0.2)";
  const durationLabel = `${segment.start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })} – ${segment.end.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })}`;
  const appliedCredit = onCallCreditPct;
  const fixtureCredit = segment.original.creditPct;

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${isOnCall ? "On-call" : "Shift"} ${durationLabel}`}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          event.preventDefault();
        }
        setActive(segment.original.id);
        const minutePosition = minuteFromPointer(event.clientY, timelineRef.current);
        if (minutePosition == null) {
          return;
        }
        const offsetMinutes = minutePosition - startMinutes;
        startGesture({
          mode: "move",
          pointerId: event.pointerId,
          segmentId: segment.original.id,
          dayKey: segment.dayKey,
          sliceStart: segment.start,
          sliceEnd: segment.end,
          originalStart: parseDateTime(segment.original.start),
          originalEnd: parseDateTime(segment.original.end),
          sliceDuration,
          offsetMinutes,
          initialSliceStartMinutes: startMinutes,
          initialSliceEndMinutes: endMinutes,
          startX: event.clientX,
          startY: event.clientY,
          swipeHandled: false
        });
      }}
      style={{
        position: "absolute",
        top: `${top}%`,
        left: isOnCall ? "16%" : "10%",
        right: isOnCall ? "16%" : "10%",
        height: `${height}%`,
        borderRadius: "12px",
        background: backgroundColor,
        color: isOnCall ? "#3c218e" : "#fff",
        padding: "0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        fontSize: "0.8rem",
        boxShadow,
        border: isActive ? "2px solid rgba(15, 118, 110, 0.4)" : "1px solid rgba(0,0,0,0.05)",
        transition: "background 0.2s ease, box-shadow 0.2s ease, border 0.2s ease"
      }}
    >
      {isActive && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            const removed = onDelete(segment.original.id);
            if (removed) {
              setActive(null);
            }
          }}
          style={{
            alignSelf: "flex-end",
            background: "#f87171",
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            padding: "0.15rem 0.5rem",
            fontSize: "0.7rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Delete
        </button>
      )}
      <span style={{ fontWeight: 600 }}>{durationLabel}</span>
      {segment.original.label && <span>{segment.original.label}</span>}
      {segment.breaks.map((pause: BreakSegment, index) => {
        const totalSpan = Math.max(minutesBetween(segment.start, segment.end), 1);
        const pauseStart = minutesBetween(segment.start, parseDateTime(pause.start));
        const pauseEnd = minutesBetween(segment.start, parseDateTime(pause.end));
        const breakMinutes = Math.max(pauseEnd - pauseStart, 0);
        const relativeTop = (pauseStart / totalSpan) * 100;
        const segmentPixelHeight = (height / 100) * TIMELINE_HEIGHT;
        const minPercent = segmentPixelHeight <= 0 ? 0 : (4 / segmentPixelHeight) * 100;
        const relativeHeight = Math.max((breakMinutes / totalSpan) * 100, minPercent);
        return (
          <span
            key={`${segment.id}-break-${index}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "12%",
              right: "12%",
              top: `${relativeTop}%`,
              height: `${relativeHeight}%`,
              background: "rgba(255,255,255,0.85)",
              borderRadius: "8px",
              border: "1px dashed rgba(255,255,255,0.9)"
            }}
          />
        );
      })}
      {isOnCall && (
        <span
          style={{
            alignSelf: "flex-start",
            padding: "0.1rem 0.4rem",
            borderRadius: "999px",
            background: "rgba(124,58,237,0.16)",
            color: "#3c218e",
            fontWeight: 600
          }}
        >
          {appliedCredit}%
          {fixtureCredit !== undefined && fixtureCredit !== appliedCredit ? ` · fixture ${fixtureCredit}%` : ""}
        </span>
      )}
      {segment.connectsFromPreviousDay && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-8px",
            left: "50%",
            transform: "translateX(-50%)",
            width: connectorThickness === "thin" ? "8px" : "14px",
            height: connectorThickness === "thin" ? "6px" : "10px",
            borderRadius: "999px",
            background: isOnCall ? "rgba(124,58,237,0.4)" : "rgba(212,63,91,0.75)"
          }}
        />
      )}
      {segment.connectsToNextDay && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-8px",
            left: "50%",
            transform: "translateX(-50%)",
            width: connectorThickness === "thin" ? "8px" : "14px",
            height: connectorThickness === "thin" ? "6px" : "10px",
            borderRadius: "999px",
            background: isOnCall ? "rgba(124,58,237,0.4)" : "rgba(212,63,91,0.75)"
          }}
        />
      )}
      <span
        role="presentation"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.pointerType === "touch") {
            event.preventDefault();
          }
          setActive(segment.original.id);
          startGesture({
            mode: "resize-start",
            pointerId: event.pointerId,
            segmentId: segment.original.id,
            dayKey: segment.dayKey,
            sliceStart: segment.start,
            sliceEnd: segment.end,
            originalStart: parseDateTime(segment.original.start),
            originalEnd: parseDateTime(segment.original.end),
            sliceDuration,
            offsetMinutes: 0,
            initialSliceStartMinutes: startMinutes,
            initialSliceEndMinutes: endMinutes,
            startX: event.clientX,
            startY: event.clientY,
            swipeHandled: true
          });
        }}
        style={{
          position: "absolute",
          top: "-6px",
          left: "20%",
          right: "20%",
          height: "12px",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.08)",
          cursor: "ns-resize"
        }}
      />
      <span
        role="presentation"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.pointerType === "touch") {
            event.preventDefault();
          }
          setActive(segment.original.id);
          startGesture({
            mode: "resize-end",
            pointerId: event.pointerId,
            segmentId: segment.original.id,
            dayKey: segment.dayKey,
            sliceStart: segment.start,
            sliceEnd: segment.end,
            originalStart: parseDateTime(segment.original.start),
            originalEnd: parseDateTime(segment.original.end),
            sliceDuration,
            offsetMinutes: 0,
            initialSliceStartMinutes: startMinutes,
            initialSliceEndMinutes: endMinutes,
            startX: event.clientX,
            startY: event.clientY,
            swipeHandled: true
          });
        }}
        style={{
          position: "absolute",
          bottom: "-6px",
          left: "20%",
          right: "20%",
          height: "12px",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.08)",
          cursor: "ns-resize"
        }}
      />
    </div>
  );
}

function formatHours(minutes: number) {
  return `${roundHours(minutesToHours(minutes)).toFixed(1)}h`;
}

function formatTimeRange(start: Date, end: Date) {
  const startLabel = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const endLabel = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${startLabel} – ${endLabel}`;
}

type GestureMode = "move" | "resize-start" | "resize-end";

interface GestureStateBase {
  mode: GestureMode;
  pointerId: number;
  segmentId: string;
  dayKey: string;
  sliceStart: Date;
  sliceEnd: Date;
  originalStart: Date;
  originalEnd: Date;
  sliceDuration: number;
  initialSliceStartMinutes: number;
  initialSliceEndMinutes: number;
  offsetMinutes: number;
  startX: number;
  startY: number;
  swipeHandled: boolean;
}

type GestureState = GestureStateBase;

function minuteFromPointer(clientY: number, timeline: HTMLDivElement | null): number | null {
  if (!timeline) {
    return null;
  }
  const rect = timeline.getBoundingClientRect();
  const relative = (clientY - rect.top) / rect.height;
  return clamp(relative, 0, 1) * 24 * 60;
}
