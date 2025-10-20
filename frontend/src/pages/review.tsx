import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { DayView } from "../review/DayView";
import { MonthView } from "../review/MonthView";
import { DayReviewRecord, ReviewDataset, REVIEW_FIXTURES } from "../review/fixtures";
import {
  cloneDataset,
  computeDayTotals,
  computeWeekTotals,
  describeTotals,
  findDay,
  updateShiftTimes,
  toggleBreakForSegment,
  weekForDate
} from "../review/calculations";
import { DayViewProps } from "../review/DayView";
import { WeekView } from "../review/WeekView";
import { WeekViewProps } from "../review/WeekView";
import { MonthViewProps } from "../review/MonthView";
import { addMinutes, minutesToHours, parseDateTime, roundHours, startOfDay, toDateKey } from "../lib/time";
import { useMediaQuery } from "../hooks/useMediaQuery";

type ViewMode = "MONTH" | "WEEK" | "DAY";
type OvertimeIndicator = "dot" | "pill";
type OnCallDisplay = "shaded" | "badge";
type ConnectorThickness = "thin" | "thick";

interface ExperimentToggles {
  overtimeIndicator: OvertimeIndicator;
  onCallDisplay: OnCallDisplay;
  connectorThickness: ConnectorThickness;
}

interface SettingsState {
  defaultBreakMinutes: number;
  defaultShiftStart: string;
  defaultShiftEnd: string;
  onCallCreditPct: number;
}

const initialDataset = cloneDataset(REVIEW_FIXTURES[0]);
const initialCursorDate = parseDateTime(
  `${initialDataset.days[0]?.date ?? toDateKey(startOfDay(new Date()))}T00:00`
);

export default function ReviewPrototype() {
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDataset.id);
  const [dataset, setDataset] = useState<ReviewDataset>(initialDataset);
  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");
  const [cursorDate, setCursorDate] = useState<Date>(initialCursorDate);
  const [settings, setSettings] = useState<SettingsState>({
    defaultBreakMinutes: initialDataset.defaultBreakMinutes,
    defaultShiftStart: initialDataset.defaultShift.start,
    defaultShiftEnd: initialDataset.defaultShift.end,
    onCallCreditPct: initialDataset.defaultOnCallCreditPct
  });
  const [experiments, setExperiments] = useState<ExperimentToggles>({
    overtimeIndicator: "pill",
    onCallDisplay: "shaded",
    connectorThickness: "thin"
  });
  const [phonePreview, setPhonePreview] = useState(false);
  const isCompact = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewMode((prev) => {
          if (prev === "DAY") {
            return "WEEK";
          }
          if (prev === "WEEK") {
            return "MONTH";
          }
          return prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const weekDays = useMemo(() => weekForDate(dataset, cursorDate), [dataset, cursorDate]);
  const activeDay = useMemo(
    () => findDay(dataset, cursorDate),
    [dataset, cursorDate]
  );

  const weekTotals = useMemo(() => computeWeekTotals(weekDays, settings.onCallCreditPct), [weekDays, settings]);
  const dayTotals = useMemo(() => {
    const fallbackDay: DayReviewRecord = activeDay ?? {
      date: toDateKey(cursorDate),
      scheduled: [],
      actual: [],
      reviewed: false
    };
    return computeDayTotals(fallbackDay, settings.onCallCreditPct);
  }, [activeDay, cursorDate, settings.onCallCreditPct]);

  const handleDatasetChange = (id: string) => {
    const selected = REVIEW_FIXTURES.find((fixture) => fixture.id === id);
    if (!selected) {
      return;
    }
    const cloned = cloneDataset(selected);
    setSelectedDatasetId(selected.id);
    setDataset(cloned);
    const firstDateString = cloned.days[0]?.date ?? toDateKey(startOfDay(new Date()));
    setCursorDate(parseDateTime(`${firstDateString}T00:00`));
    setViewMode("MONTH");
    setSettings({
      defaultBreakMinutes: cloned.defaultBreakMinutes,
      defaultShiftStart: cloned.defaultShift.start,
      defaultShiftEnd: cloned.defaultShift.end,
      onCallCreditPct: cloned.defaultOnCallCreditPct
    });
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const goToDate = (date: Date) => {
    setCursorDate(date);
  };

  const goToWeek = (date: Date) => {
    setCursorDate(date);
    setViewMode("WEEK");
  };

  const goToDay = (date: Date) => {
    setCursorDate(date);
    setViewMode("DAY");
  };

  const stepWeek = (delta: number) => {
    setCursorDate((prev) => addMinutes(prev, delta * 7 * 24 * 60));
  };

  const goToToday = () => {
    setCursorDate(startOfDay(new Date()));
  };

  const handleBreakToggle: DayViewProps["onUpdateBreak"] = ({ segmentId, timestamp }) => {
    setDataset((prev) => {
      const copy = cloneDataset(prev);
      copy.days = copy.days.map((day) => ({
        ...day,
        actual: day.actual.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }
          return {
            ...segment,
            breaks: toggleBreakForSegment(segment, timestamp, settings.defaultBreakMinutes)
          };
        })
      }));
      return copy;
    });
  };

  const exportWeek = () => {
    const rows = weekDays.map((day) => {
      const totals = computeDayTotals(day, settings.onCallCreditPct);
      const formatted = [
        formatHours(totals.scheduledMinutes),
        formatHours(totals.actualMinutes),
        formatHours(totals.overtimeMinutes),
        formatHours(totals.onCallCreditMinutes)
      ];
      return [
        day.date,
        ...formatted
      ].join(",");
    });
    const header = "date,scheduled_h,actual_h,overtime_h,oncall_credit_h";
    const footerTotals = [
      formatHours(weekTotals.scheduledMinutes),
      formatHours(weekTotals.actualMinutes),
      formatHours(weekTotals.overtimeMinutes),
      formatHours(weekTotals.onCallCreditMinutes)
    ];
    const footer = [
      "TOTAL",
      ...footerTotals
    ].join(",");
    const csvContent = [header, ...rows, footer].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `working-hours-${weekTotals.weekStart}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateSettings = (partial: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const updateExperiments = (partial: Partial<ExperimentToggles>) => {
    setExperiments((prev) => ({ ...prev, ...partial }));
  };

  const handleSegmentTimeChange: DayViewProps["onSegmentTimeChange"] = ({ segmentId, start, end }) => {
    if (!start && !end) {
      return;
    }
    setDataset((prev) => {
      const copy = cloneDataset(prev);
      updateShiftTimes(copy, segmentId, {
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined
      });
      return copy;
    });
  };

  const renderView = () => {
    if (viewMode === "MONTH") {
      const monthProps: MonthViewProps = {
        dataset,
        cursorDate,
        onSelectDate: goToDate,
        onOpenWeek: goToWeek,
        overtimeIndicator: experiments.overtimeIndicator,
        getDayTotals: (day: DayReviewRecord) => {
          const totals = computeDayTotals(day, settings.onCallCreditPct);
          return {
            scheduledMinutes: totals.scheduledMinutes,
            actualMinutes: totals.actualMinutes,
            overtimeMinutes: totals.overtimeMinutes
          };
        }
      };
      return <MonthView {...monthProps} />;
    }
    if (viewMode === "WEEK") {
      const weekProps: WeekViewProps = {
        weekDays,
        cursorDate,
        onSelectDate: goToDate,
        onOpenDay: goToDay,
        onCallDisplay: experiments.onCallDisplay,
        connectorThickness: experiments.connectorThickness,
        onCallCreditPct: settings.onCallCreditPct,
        getDayTotals: (day: DayReviewRecord) => {
          const totals = computeDayTotals(day, settings.onCallCreditPct);
          return {
            scheduledMinutes: totals.scheduledMinutes,
            actualMinutes: totals.actualMinutes,
            overtimeMinutes: totals.overtimeMinutes
          };
        }
      };
      return <WeekView {...weekProps} />;
    }
    const dayProps: DayViewProps = {
      day: activeDay,
      cursorDate,
      onUpdateBreak: handleBreakToggle,
      totals: dayTotals,
      defaultBreakMinutes: settings.defaultBreakMinutes,
      onCallCreditPct: settings.onCallCreditPct,
      connectorThickness: experiments.connectorThickness,
      onCallDisplay: experiments.onCallDisplay,
      onSegmentTimeChange: handleSegmentTimeChange
    };
    return <DayView {...dayProps} />;
  };

  const useStackLayout = phonePreview || isCompact;

  const content = (
    <>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Review working hours</h1>
        <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
          Switch datasets to explore fixtures; navigate Month → Week → Day to edit tracked time on touch devices.
        </p>
      </header>

      <section
        aria-label="Prototype controls"
        style={{
          display: "flex",
          flexDirection: useStackLayout ? "column" : "column",
          gap: "0.9rem",
          marginBottom: "1.5rem"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: useStackLayout ? "column" : "row",
            gap: useStackLayout ? "0.75rem" : "0.75rem 1rem",
            flexWrap: useStackLayout ? "nowrap" : "wrap",
            alignItems: useStackLayout ? "stretch" : "center"
          }}
        >
          <label htmlFor="dataset-selector" style={{ display: "flex", flexDirection: "column", fontWeight: 600 }}>
            Dataset
            <select
              id="dataset-selector"
              value={selectedDatasetId}
              onChange={(event) => handleDatasetChange(event.target.value)}
              style={{
                marginTop: "0.35rem",
                padding: "0.4rem",
                borderRadius: "8px",
                border: "1px solid #cbd5f5"
              }}
            >
              {REVIEW_FIXTURES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div
            role="group"
            aria-label="View mode"
            style={{
              display: "inline-flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            {(["MONTH", "WEEK", "DAY"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleViewChange(mode)}
                aria-pressed={viewMode === mode}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "999px",
                  border: "1px solid #ccc",
                  background: viewMode === mode ? "#0052cc" : "#f8f8f8",
                  color: viewMode === mode ? "#fff" : "#222",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Week navigation"
            style={{
              display: "inline-flex",
              gap: "0.5rem",
              alignItems: "center"
            }}
          >
            <button type="button" onClick={() => stepWeek(-1)}>
              ← Prev
            </button>
            <button type="button" onClick={goToToday}>
              Today
            </button>
            <button type="button" onClick={() => stepWeek(1)}>
              Next →
            </button>
          </div>

          <button type="button" onClick={exportWeek}>
            Export week CSV
          </button>

          <button
            type="button"
            onClick={() => setPhonePreview((prev) => !prev)}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
              background: phonePreview ? "#1e293b" : "#f1f5f9",
              color: phonePreview ? "#fff" : "#0f172a",
              fontWeight: 600
            }}
          >
            {phonePreview ? "Exit phone frame" : "Phone frame preview"}
          </button>
        </div>

        <details style={{ fontSize: "0.85rem", color: "#555" }} open={!useStackLayout}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Scenario description</summary>
          <p style={{ marginTop: "0.5rem" }}>{dataset.description}</p>
        </details>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: useStackLayout ? "1fr" : "3fr 1fr",
          gap: "1.5rem",
          alignItems: "start"
        }}
      >
        <div>{renderView()}</div>
        <aside
          style={{
            display: "grid",
            gap: "1.5rem",
            alignContent: "start"
          }}
        >
          <TotalsCard dayTotals={dayTotals} weekTotals={weekTotals} cursorDate={cursorDate} />
          <SettingsCard settings={settings} onChange={updateSettings} />
          <ExperimentsCard experiments={experiments} onChange={updateExperiments} />
        </aside>
      </section>
    </>
  );

  const desktopMainStyle: CSSProperties = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    lineHeight: 1.5,
    display: "flex",
    flexDirection: "column"
  };

  const phoneFrameShell: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "1.5rem",
    background: "#0f172a"
  };

  const phoneBody: CSSProperties = {
    width: "390px",
    minHeight: "844px",
    borderRadius: "32px",
    border: "14px solid #020617",
    boxShadow: "0 25px 55px rgba(15, 23, 42, 0.45)",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  };

  const phoneMainStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "1.25rem 1.35rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    lineHeight: 1.4,
    display: "flex",
    flexDirection: "column"
  };

  return (
    <>
      <Head>
        <title>Open Working Hours – Review Prototype</title>
        <meta
          name="description"
          content="Prototype for reviewing tracked working hours with month/week/day flows."
        />
      </Head>
      {phonePreview ? (
        <div style={phoneFrameShell}>
          <div style={phoneBody}>
            <main style={phoneMainStyle}>{content}</main>
          </div>
        </div>
      ) : (
        <main style={desktopMainStyle}>{content}</main>
      )}
    </>
  );
}

function formatHours(minutes: number) {
  return roundHours(minutesToHours(minutes)).toFixed(1);
}
interface TotalsCardProps {
  dayTotals: ReturnType<typeof computeDayTotals>;
  weekTotals: ReturnType<typeof computeWeekTotals>;
  cursorDate: Date;
}

function TotalsCard({ dayTotals, weekTotals, cursorDate }: TotalsCardProps) {
  const dayLabel = cursorDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  const weekLabel = `Week of ${weekTotals.weekStart}`;
  return (
    <section
      aria-label="Totals"
      style={{
        border: "1px solid #d8dee4",
        borderRadius: "12px",
        padding: "1rem"
      }}
    >
      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Totals overview</h2>
      <StatsRow title={dayLabel} totals={dayTotals} />
      <StatsRow title={weekLabel} totals={weekTotals} />
    </section>
  );
}

function StatsRow({
  title,
  totals
}: {
  title: string;
  totals: ReturnType<typeof computeDayTotals> | ReturnType<typeof computeWeekTotals>;
}) {
  const summarized = describeTotals(totals);
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem", color: "#333" }}>{title}</h3>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.5rem",
          margin: 0
        }}
      >
        <Definition label="Scheduled" value={summarized.scheduled} />
        <Definition label="Actual" value={summarized.actual} />
        <Definition label="Overtime" value={summarized.overtime} />
        <Definition label="Breaks" value={summarized.break} />
        <Definition label="On-call credit" value={summarized.onCall} />
      </dl>
    </div>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#777" }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 600 }}>{value}</dd>
    </div>
  );
}

function SettingsCard({
  settings,
  onChange
}: {
  settings: SettingsState;
  onChange: (partial: Partial<SettingsState>) => void;
}) {
  return (
    <section
      aria-label="Settings"
      style={{
        border: "1px solid #d8dee4",
        borderRadius: "12px",
        padding: "1rem",
        display: "grid",
        gap: "0.75rem"
      }}
    >
      <h2 style={{ fontSize: "1rem", margin: 0 }}>Session defaults</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <label>
          Default shift start
          <input
            type="time"
            value={settings.defaultShiftStart}
            onChange={(event) => onChange({ defaultShiftStart: event.target.value })}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Default shift end
          <input
            type="time"
            value={settings.defaultShiftEnd}
            onChange={(event) => onChange({ defaultShiftEnd: event.target.value })}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Default break length (minutes)
          <input
            type="number"
            value={settings.defaultBreakMinutes}
            min={5}
            step={5}
            onChange={(event) => onChange({ defaultBreakMinutes: Number(event.target.value) })}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          On-call credit %
          <input
            type="number"
            value={settings.onCallCreditPct}
            min={0}
            max={200}
            onChange={(event) => onChange({ onCallCreditPct: Number(event.target.value) })}
            style={{ width: "100%" }}
          />
        </label>
      </div>
      <p style={{ margin: 0, color: "#666", fontSize: "0.8rem" }}>
        Changes apply instantly to totals and newly inserted breaks.
      </p>
    </section>
  );
}

function ExperimentsCard({
  experiments,
  onChange
}: {
  experiments: ExperimentToggles;
  onChange: (partial: Partial<ExperimentToggles>) => void;
}) {
  return (
    <section
      aria-label="Experiment toggles"
      style={{
        border: "1px solid #d8dee4",
        borderRadius: "12px",
        padding: "1rem",
        display: "grid",
        gap: "0.5rem"
      }}
    >
      <h2 style={{ fontSize: "1rem", margin: 0 }}>Experiment toggles</h2>

      <label>
        Overtime indicator
        <select
          value={experiments.overtimeIndicator}
          onChange={(event) => onChange({ overtimeIndicator: event.target.value as ExperimentToggles["overtimeIndicator"] })}
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          <option value="pill">Pill</option>
          <option value="dot">Dot</option>
        </select>
      </label>

      <label>
        On-call display
        <select
          value={experiments.onCallDisplay}
          onChange={(event) => onChange({ onCallDisplay: event.target.value as ExperimentToggles["onCallDisplay"] })}
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          <option value="shaded">Shaded bar</option>
          <option value="badge">Percent badge</option>
        </select>
      </label>

      <label>
        Midnight connector thickness
        <select
          value={experiments.connectorThickness}
          onChange={(event) => onChange({ connectorThickness: event.target.value as ExperimentToggles["connectorThickness"] })}
          style={{ width: "100%", marginTop: "0.25rem" }}
        >
          <option value="thin">Thin</option>
          <option value="thick">Thick</option>
        </select>
      </label>
    </section>
  );
}
