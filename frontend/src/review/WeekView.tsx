import { useMemo } from "react";

import { DayReviewRecord } from "./fixtures";
import { buildTimelineSegments, hasOverlap, TimelineSegment } from "./calculations";
import {
  addMinutes,
  minutesBetween,
  minutesToHours,
  parseDateTime,
  roundHours,
  startOfDay,
  toDateKey
} from "../lib/time";

export interface WeekViewProps {
  weekDays: DayReviewRecord[];
  cursorDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenDay: (date: Date) => void;
  onCallDisplay: "shaded" | "badge";
  connectorThickness: "thin" | "thick";
  onCallCreditPct: number;
  getDayTotals: (day: DayReviewRecord) => {
    scheduledMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
  };
}

const TIMELINE_HEIGHT = 24 * 20; // 20px per hour

export function WeekView({
  weekDays,
  cursorDate,
  onSelectDate,
  onOpenDay,
  onCallDisplay,
  connectorThickness,
  onCallCreditPct,
  getDayTotals
}: WeekViewProps) {
  const segments = useMemo(() => weekDays.flatMap((day) => buildTimelineSegments(day)), [weekDays]);

  const hourMarks = useMemo(() => Array.from({ length: 25 }, (_, index) => index), []);

  const weekLabel = `${formatDateRange(weekDays[0]?.date ?? "", weekDays[6]?.date ?? "")}`;

  return (
    <section style={{ display: "grid", gap: "1rem" }} aria-label={`Week view ${weekLabel}`}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{weekLabel}</h2>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
          Ghost bands show scheduled hours. Solid bars show actual work / on-call; gaps indicate breaks.
        </p>
      </header>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(7, minmax(0, 1fr))",
            gap: "0.75rem",
            alignItems: "stretch",
            minWidth: "720px"
          }}
        >
          <div
            aria-hidden="true"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: "0.75rem" }}
          >
            {hourMarks.map((hour) => (
              <span key={hour} style={{ height: `${TIMELINE_HEIGHT / 24}px`, position: "relative" }}>
                <span style={{ position: "absolute", top: -6, left: 0 }}>{hour.toString().padStart(2, "0")}</span>
              </span>
            ))}
          </div>

          {weekDays.map((day) => {
          const date = parseDateTime(`${day.date}T00:00`);
          const isSelected = toDateKey(startOfDay(cursorDate)) === day.date;
          const totals = getDayTotals(day);
          const daySegments = segments.filter((segment) => segment.dayKey === day.date);
          const scheduledBands = buildScheduledBands(day);
          const conflict = hasOverlap(day);
          const emptyState = day.actual.length === 0 && day.scheduled.length === 0;

          return (
            <div key={day.date} style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(date);
                  onOpenDay(date);
                }}
                onFocus={() => onSelectDate(date)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 0,
                  display: "grid",
                  gap: "0.15rem"
                }}
                aria-pressed={isSelected}
                aria-label={`Open day view for ${date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })}`}
              >
                <span style={{ fontWeight: 600, fontSize: "0.95rem", color: isSelected ? "#0052cc" : "#1f2328" }}>
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#4f5661" }}>
                  {date.getDate()}.{date.getMonth() + 1}.
                </span>
                <span style={{ fontSize: "0.7rem", color: "#6e7781" }}>
                  {formatHours(totals.actualMinutes)} actual
                </span>
                {conflict && (
                  <span style={{ fontSize: "0.65rem", color: "#b54708", fontWeight: 600 }}>Conflict</span>
                )}
                {day.reviewed ? null : (
                  <span style={{ fontSize: "0.65rem", color: "#8a5800", fontWeight: 600 }}>review</span>
                )}
              </button>

              <div
                role="grid"
                aria-label="24 hour timeline"
                style={{
                  position: "relative",
                  height: `${TIMELINE_HEIGHT}px`,
                  background: "#fbfdff",
                  border: isSelected ? "2px solid #0052cc" : "1px solid #d0d7de",
                  borderRadius: "12px",
                  overflow: "hidden"
                }}
              >
                {hourMarks.map((hour) => (
                  <div
                    key={`${day.date}-hour-${hour}`}
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
                      left: "5%",
                      right: "5%",
                      borderRadius: "8px",
                      background: "rgba(157, 191, 249, 0.35)"
                    }}
                  />
                ))}

                {emptyState && (
                  <div
                    style={{
                      position: "absolute",
                      inset: "0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8rem",
                      color: "#8c939f",
                      fontStyle: "italic"
                    }}
                  >
                    No entries
                  </div>
                )}

                {daySegments.map((segment) => (
                  <WeekSegment
                    key={segment.id}
                    segment={segment}
                    connectorThickness={connectorThickness}
                    onCallDisplay={onCallDisplay}
                    onCallCreditPct={onCallCreditPct}
                  />
                ))}
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}

function buildScheduledBands(day: DayReviewRecord) {
  const dayStart = parseDateTime(`${day.date}T00:00`);
  return day.scheduled
    .map((segment, index) => {
      const start = parseDateTime(segment.start);
      const end = parseDateTime(segment.end);
      const clippedStart = start < dayStart ? dayStart : start;
      const dayFinish = addMinutes(dayStart, 24 * 60);
      const clippedEnd = end > dayFinish ? dayFinish : end;
      if (clippedEnd <= clippedStart) {
        return null;
      }
      const topMinutes = minutesBetween(dayStart, clippedStart);
      const duration = minutesBetween(clippedStart, clippedEnd);
      return {
        id: `sched-${day.date}-${index}`,
        top: (topMinutes / (24 * 60)) * 100,
        height: (duration / (24 * 60)) * 100
      };
    })
    .filter(Boolean) as Array<{ id: string; top: number; height: number }>;
}

function WeekSegment({
  segment,
  connectorThickness,
  onCallDisplay,
  onCallCreditPct
}: {
  segment: TimelineSegment;
  connectorThickness: "thin" | "thick";
  onCallDisplay: "shaded" | "badge";
  onCallCreditPct: number;
}) {
  const dayStart = parseDateTime(`${segment.dayKey}T00:00`);
  const startMinutes = minutesBetween(dayStart, segment.start);
  const endMinutes = minutesBetween(dayStart, segment.end);
  const top = (startMinutes / (24 * 60)) * 100;
  const height = Math.max(4, ((endMinutes - startMinutes) / (24 * 60)) * 100);
  const isOnCall = segment.category === "oncall";
  const connectorSize = connectorThickness === "thin" ? 4 : 10;
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
      style={{
        position: "absolute",
        top: `${top}%`,
        left: isOnCall ? "15%" : "10%",
        right: isOnCall ? "15%" : "10%",
        height: `${height}%`,
        borderRadius: "10px",
        background: isOnCall
          ? onCallDisplay === "shaded"
            ? "rgba(124, 58, 237, 0.25)"
            : "#f2f0ff"
          : "rgba(212, 63, 91, 0.85)",
        color: isOnCall ? "#3c218e" : "#fff",
        boxShadow: isOnCall ? "0 0 0 1px rgba(124, 58, 237, 0.35)" : "0 4px 10px rgba(212, 63, 91, 0.2)",
        padding: "0.35rem 0.45rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        fontSize: "0.7rem",
        outline: "none"
      }}
    >
      <span style={{ fontWeight: 600 }}>{durationLabel}</span>
      {segment.original.label && <span>{segment.original.label}</span>}
      {isOnCall && (
        <span
          style={{
            alignSelf: "flex-start",
            padding: "0.1rem 0.35rem",
            borderRadius: "999px",
            background: onCallDisplay === "shaded" ? "rgba(124,58,237,0.16)" : "rgba(60,33,142,0.12)",
            color: "#3c218e",
            fontWeight: 600
          }}
        >
          {appliedCredit}%
          {fixtureCredit !== undefined && fixtureCredit !== appliedCredit ? ` · fixture ${fixtureCredit}%` : ""}
        </span>
      )}

      {segment.breaks.map((pause, index) => {
        const totalSpan = Math.max(minutesBetween(segment.start, segment.end), 1);
        const pauseStart = minutesBetween(segment.start, pause.start);
        const pauseEnd = minutesBetween(segment.start, pause.end);
        const breakMinutes = Math.max(pauseEnd - pauseStart, 0);
        const relativeTop = (pauseStart / totalSpan) * 100;
        const shiftPixelHeight = (height / 100) * TIMELINE_HEIGHT;
        const minPercent = shiftPixelHeight <= 0 ? 0 : (4 / shiftPixelHeight) * 100;
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
              background: "rgba(255, 255, 255, 0.85)",
              borderRadius: "6px",
              border: "1px dashed rgba(255,255,255,0.9)"
            }}
          />
        );
      })}

      {segment.connectsFromPreviousDay && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-6px",
            left: "50%",
            transform: "translateX(-50%)",
            width: `${connectorSize}px`,
            height: "6px",
            background: isOnCall ? "rgba(124, 58, 237, 0.5)" : "rgba(212, 63, 91, 0.8)",
            borderRadius: "999px"
          }}
        />
      )}
      {segment.connectsToNextDay && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-6px",
            left: "50%",
            transform: "translateX(-50%)",
            width: `${connectorSize}px`,
            height: "6px",
            background: isOnCall ? "rgba(124, 58, 237, 0.5)" : "rgba(212, 63, 91, 0.8)",
            borderRadius: "999px"
          }}
        />
      )}
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string) {
  if (!startIso || !endIso) {
    return "Selected week";
  }
  const start = parseDateTime(`${startIso}T00:00`);
  const end = parseDateTime(`${endIso}T00:00`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function formatHours(minutes: number) {
  return `${roundHours(minutesToHours(minutes)).toFixed(1)}h`;
}
