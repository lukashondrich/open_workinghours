import { useMemo } from "react";

import { DayReviewRecord, ReviewDataset } from "./fixtures";
import { minutesToHours, roundHours, startOfDay, startOfWeek, toDateKey } from "../lib/time";

export interface MonthViewProps {
  dataset: ReviewDataset;
  cursorDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenWeek: (date: Date) => void;
  overtimeIndicator: "dot" | "pill";
  getDayTotals: (day: DayReviewRecord) => {
    scheduledMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
  };
}

interface CalendarCell {
  date: Date;
  iso: string;
  record?: DayReviewRecord;
  totals: {
    scheduledMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
  };
}

export function MonthView({
  dataset,
  cursorDate,
  onSelectDate,
  onOpenWeek,
  overtimeIndicator,
  getDayTotals
}: MonthViewProps) {
  const monthCells = useMemo(() => buildCalendar(dataset, cursorDate, getDayTotals), [dataset, cursorDate, getDayTotals]);
  const monthLabel = cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const maxMinutes = monthCells.reduce((acc, cell) => {
    const maxForCell = Math.max(cell.totals.scheduledMinutes, cell.totals.actualMinutes);
    return Math.max(acc, maxForCell);
  }, 0);
  const maxHours = Math.max(minutesToHours(maxMinutes), 1);

  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const base = startOfWeek(cursorDate);
        const day = new Date(base);
        day.setDate(base.getDate() + index);
        return day.toLocaleDateString(undefined, { weekday: "short" });
      }),
    [cursorDate]
  );

  return (
    <section aria-label={`Month view for ${monthLabel}`} style={{ display: "grid", gap: "0.75rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{monthLabel}</h2>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
          Click a day to jump into its detail week. Scheduled vs actual shown as twin micro-bars.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          fontSize: "0.8rem",
          textTransform: "uppercase",
          color: "#666",
          letterSpacing: "0.06em"
        }}
      >
        {weekdayLabels.map((label) => (
          <div key={label} style={{ padding: "0.25rem 0.5rem" }}>
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          border: "1px solid #d0d7de",
          borderRadius: "12px",
          overflow: "hidden"
        }}
      >
        {monthCells.map((cell) => {
          const isCurrentMonth = cell.date.getMonth() === cursorDate.getMonth();
          const isSelected = toDateKey(startOfDay(cell.date)) === toDateKey(startOfDay(cursorDate));
          const totals = cell.totals;
          const scheduledWidth = percentWidth(totals.scheduledMinutes, maxHours);
          const actualWidth = percentWidth(totals.actualMinutes, maxHours);
          const overtime = totals.overtimeMinutes > 0;
          const reviewIndicator = cell.record && !cell.record.reviewed;
          const ariaLabel = buildAriaLabel(cell, totals);

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => {
                onSelectDate(cell.date);
                onOpenWeek(cell.date);
              }}
              onFocus={() => onSelectDate(cell.date)}
              onMouseEnter={() => onSelectDate(cell.date)}
              className="month-day-cell"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-start",
                padding: "0.75rem 0.5rem",
                minHeight: "96px",
                border: "none",
                borderRight: "1px solid #d0d7de",
                borderBottom: "1px solid #d0d7de",
                background: isSelected ? "rgba(0, 82, 204, 0.08)" : "white",
                color: isCurrentMonth ? "#1f2328" : "#8c939f",
                position: "relative",
                cursor: "pointer",
                outline: isSelected ? "2px solid #0052cc" : "none"
              }}
              aria-pressed={isSelected}
              aria-label={ariaLabel}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{cell.date.getDate()}</span>
                {reviewIndicator && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "0.1rem 0.35rem",
                      borderRadius: "999px",
                      background: "#fde68a",
                      color: "#8a5800",
                      fontWeight: 600
                    }}
                  >
                    review
                  </span>
                )}
              </div>

              <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
                <div style={{ height: "6px", background: "#e6edf3", borderRadius: "999px", overflow: "hidden" }}>
                  <span
                    style={{
                      display: "block",
                      width: `${scheduledWidth}%`,
                      height: "100%",
                      background: "#9dbff9"
                    }}
                  />
                </div>
                <div style={{ height: "6px", background: "#f1d3d6", borderRadius: "999px", overflow: "hidden" }}>
                  <span
                    style={{
                      display: "block",
                      width: `${actualWidth}%`,
                      height: "100%",
                      background: "#d43f5b"
                    }}
                  />
                </div>
              </div>

              {overtime && (
                <OvertimeIndicator variant={overtimeIndicator} overtimeMinutes={totals.overtimeMinutes} />
              )}

              <div
                className="month-day-details"
                style={{
                  marginTop: "auto",
                  paddingTop: "0.35rem",
                  fontSize: "0.75rem",
                  color: "#4f5661",
                  opacity: isSelected ? 1 : 0,
                  transition: "opacity 0.2s"
                }}
              >
                <div>Sched: {formatHours(totals.scheduledMinutes)}</div>
                <div>Actual: {formatHours(totals.actualMinutes)}</div>
                <div>OT: {formatHours(totals.overtimeMinutes)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function percentWidth(minutes: number, maxHours: number) {
  if (maxHours <= 0) {
    return 0;
  }
  const hours = minutesToHours(minutes);
  const ratio = hours / maxHours;
  return Math.min(100, Math.round(ratio * 100));
}

function formatHours(minutes: number) {
  return `${roundHours(minutesToHours(minutes)).toFixed(1)}h`;
}

function buildCalendar(
  dataset: ReviewDataset,
  cursorDate: Date,
  getDayTotals: MonthViewProps["getDayTotals"]
): CalendarCell[] {
  const monthStart = startOfDay(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1));
  const firstVisible = startOfWeek(monthStart);
  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(firstVisible);
    cellDate.setDate(firstVisible.getDate() + index);
    const iso = toDateKey(cellDate);
    const record = dataset.days.find((day) => day.date === iso);
    const totals = record
      ? getDayTotals(record)
      : {
          scheduledMinutes: 0,
          actualMinutes: 0,
          overtimeMinutes: 0
        };
    cells.push({
      date: cellDate,
      iso,
      record,
      totals
    });
  }
  return cells;
}

function buildAriaLabel(cell: CalendarCell, totals: CalendarCell["totals"]) {
  const { date, record } = cell;
  const base = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const scheduled = formatHours(totals.scheduledMinutes);
  const actual = formatHours(totals.actualMinutes);
  const overtime = formatHours(totals.overtimeMinutes);
  const reviewStatus = record
    ? record.reviewed
      ? "reviewed"
      : "needs review"
    : "no data recorded";
  return `${base}. Scheduled ${scheduled}. Actual ${actual}. Overtime ${overtime}. ${reviewStatus}.`;
}

function OvertimeIndicator({
  variant,
  overtimeMinutes
}: {
  variant: "dot" | "pill";
  overtimeMinutes: number;
}) {
  if (variant === "dot") {
    return (
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "0.65rem",
          right: "0.6rem",
          width: "10px",
          height: "10px",
          borderRadius: "999px",
          background: "#d43f5b"
        }}
      />
    );
  }
  return (
    <span
      style={{
        position: "absolute",
        top: "0.6rem",
        right: "0.5rem",
        padding: "0.1rem 0.45rem",
        borderRadius: "999px",
        background: "rgba(212, 63, 91, 0.85)",
        color: "#fff",
        fontSize: "0.65rem",
        fontWeight: 600
      }}
    >
      +{roundHours(minutesToHours(overtimeMinutes)).toFixed(1)}h
    </span>
  );
}
