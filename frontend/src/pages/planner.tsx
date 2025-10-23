import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  computeSegments,
  computeShiftRange,
  createShiftInstance,
  defaultShiftColors,
  findOverlap,
  formatConflict,
  instantiateBreaks,
  minutesToHm,
  moveShiftStart,
  ensureDefaultBreaks,
  snapToGrid,
  sanitizeBreaks,
  updateShiftDuration,
} from "../review/calculations";
import { DayIndex, ShiftInstance, ShiftType, ShiftSegment } from "../review/types";

type ViewMode = "week" | "day" | "month";

const MINUTES_PER_DAY = 24 * 60;
const HOUR_HEIGHT = 48;
const DAY_LABELS: Record<DayIndex, string> = {
  0: "Montag",
  1: "Dienstag",
  2: "Mittwoch",
  3: "Donnerstag",
  4: "Freitag",
  5: "Samstag",
  6: "Sonntag",
};
const DAY_ORDER: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_SHORT_LABELS = ["M", "D", "M", "D", "F", "S", "S"];
const GERMAN_MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

interface DragPreviewState {
  shiftId: string;
  startMinute: number;
  durationMinutes: number;
}

function startOfDay(date: Date): Date {
  const clone = new Date(date.getTime());
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date.getTime());
  clone.setDate(clone.getDate() + days);
  return clone;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const clone = new Date(date.getTime());
  clone.setMonth(clone.getMonth() + months);
  return startOfMonth(clone);
}

function startOfISOWeek(date: Date): Date {
  const clone = startOfDay(date);
  const jsDay = clone.getDay();
  const diff = (jsDay + 6) % 7; // Monday = 0
  return addDays(clone, -diff);
}

function startOfMonth(date: Date): Date {
  const clone = startOfDay(date);
  clone.setDate(1);
  return clone;
}

function endOfMonth(date: Date): Date {
  const clone = startOfMonth(date);
  clone.setMonth(clone.getMonth() + 1);
  clone.setDate(0);
  return startOfDay(clone);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayIndexFromDate(date: Date): DayIndex {
  return (((date.getDay() + 6) % 7) as DayIndex);
}

function formatDateGerman(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  return `${formatDateGerman(start)} – ${formatDateGerman(end)}`;
}

function getISOWeekNumber(date: Date): number {
  const temp = startOfDay(date);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const firstThursday = new Date(temp.getFullYear(), 0, 4);
  const weekNumber =
    1 + Math.round(((temp.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return weekNumber;
}

function formatMonthYear(date: Date): string {
  return `${GERMAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const time = startOfDay(date).getTime();
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime();
}

function snapDurationToFive(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return 5;
  }
  const snapped = Math.round(minutes / 5) * 5;
  return Math.max(5, snapped);
}

interface MonthCell {
  date: Date;
  inCurrentMonth: boolean;
}

function buildMonthMatrix(monthDate: Date): MonthCell[][] {
  const firstDay = startOfMonth(monthDate);
  const lastDay = endOfMonth(monthDate);
  const firstWeekStart = startOfISOWeek(firstDay);
  const lastWeekStart = startOfISOWeek(lastDay);
  const weeks: MonthCell[][] = [];
  let cursor = firstWeekStart;

  while (cursor.getTime() <= lastWeekStart.getTime()) {
    const week: MonthCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dayDate = addDays(cursor, i);
      week.push({ date: dayDate, inCurrentMonth: dayDate.getMonth() === monthDate.getMonth() });
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  {
    id: "normal-wochentag",
    name: "Normaler Wochentag",
    durationMinutes: 8 * 60,
    defaultBreaks: [
      {
        id: "pause-30",
        offsetMinutes: 4 * 60,
        durationMinutes: 30,
      },
    ],
    color: defaultShiftColors()[0],
  },
  {
    id: "wochenende-12h",
    name: "Wochenenddienst",
    durationMinutes: 12 * 60,
    defaultBreaks: [
      {
        id: "pause-60",
        offsetMinutes: 6 * 60,
        durationMinutes: 30,
      },
    ],
    color: defaultShiftColors()[2],
  },
];

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function minutesFromTimeInput(value: string | null): number {
  if (!value || !value.includes(":")) {
    return 0;
  }
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

function timeInputValueFromMinutes(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function getDayLabel(day: DayIndex) {
  return DAY_LABELS[day];
}

function getShiftColor(type: ShiftType | undefined, fallback: number): string {
  if (type) {
    return type.color;
  }
  const palette = defaultShiftColors();
  return palette[fallback % palette.length];
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0h";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function NewShiftTypeForm({
  onCreate,
  nextColor,
  onCancel,
}: {
  onCreate: (type: ShiftType) => void;
  nextColor: string;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [durationHours, setDurationHours] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [defaultBreakOffsetHours, setDefaultBreakOffsetHours] = useState(4);
  const [defaultBreakOffsetMinutes, setDefaultBreakOffsetMinutes] = useState(0);
  const [defaultBreakLengthMinutes, setDefaultBreakLengthMinutes] = useState(30);
  const [includeBreak, setIncludeBreak] = useState(true);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const durationTotal = durationHours * 60 + durationMinutes;
    const newType: ShiftType = {
      id: createId(),
      name: name.trim(),
      durationMinutes: durationTotal,
      defaultBreaks: includeBreak
        ? [
            {
              id: "break-1",
              offsetMinutes: defaultBreakOffsetHours * 60 + defaultBreakOffsetMinutes,
              durationMinutes: defaultBreakLengthMinutes,
            },
          ]
        : [],
      color: nextColor,
    };

    onCreate(newType);
    setName("");
    setDurationHours(8);
    setDurationMinutes(0);
    setDefaultBreakOffsetHours(4);
    setDefaultBreakOffsetMinutes(0);
    setIncludeBreak(true);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.5rem" }}>
      <h3>Neue Dienstart</h3>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="z. B. Nachtdienst" />
      </label>
      <label>
        Dauer
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            min={1}
            max={24}
            value={durationHours}
            onChange={(event) => setDurationHours(Number(event.target.value))}
            style={{ width: "5rem" }}
          />
          <input
            type="number"
            min={0}
            max={55}
            step={5}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            style={{ width: "5rem" }}
          />
        </div>
      </label>
      <fieldset style={{ border: "1px solid #ccc", padding: "0.75rem", borderRadius: "0.5rem" }}>
        <legend style={{ padding: "0 0.25rem" }}>Standardpause</legend>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={includeBreak} onChange={(event) => setIncludeBreak(event.target.checked)} />
          Pause nach fester Zeit einfügen
        </label>
        {includeBreak && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <label>
              nach (Stunden)
              <input
                type="number"
                min={0}
                max={24}
                value={defaultBreakOffsetHours}
                onChange={(event) => setDefaultBreakOffsetHours(Number(event.target.value))}
                style={{ width: "5rem" }}
              />
            </label>
            <label>
              nach (Minuten)
              <input
                type="number"
                min={0}
                max={55}
                step={5}
                value={defaultBreakOffsetMinutes}
                onChange={(event) => setDefaultBreakOffsetMinutes(Number(event.target.value))}
                style={{ width: "5rem" }}
              />
            </label>
            <label>
              Länge (Minuten)
              <input
                type="number"
                min={5}
                step={5}
                value={defaultBreakLengthMinutes}
                onChange={(event) => setDefaultBreakLengthMinutes(Number(event.target.value))}
                style={{ width: "5rem" }}
              />
            </label>
          </div>
        )}
      </fieldset>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button type="submit">Dienstart anlegen</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

interface ShiftTypeCardProps {
  type: ShiftType;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onUpdate: (type: ShiftType) => void;
}

function ShiftTypeCard({ type, selected, expanded, onSelect, onToggleExpand, onUpdate }: ShiftTypeCardProps) {
  const [name, setName] = useState(type.name);
  const [durationHours, setDurationHours] = useState(Math.floor(type.durationMinutes / 60));
  const [durationMinutes, setDurationMinutes] = useState(type.durationMinutes % 60);
  const [includeBreak, setIncludeBreak] = useState(type.defaultBreaks.length > 0);
  const [breakOffsetHours, setBreakOffsetHours] = useState(
    type.defaultBreaks.length > 0 ? Math.floor(type.defaultBreaks[0].offsetMinutes / 60) : 4,
  );
  const [breakOffsetMinutes, setBreakOffsetMinutes] = useState(
    type.defaultBreaks.length > 0 ? type.defaultBreaks[0].offsetMinutes % 60 : 0,
  );
  const [breakLengthMinutes, setBreakLengthMinutes] = useState(
    type.defaultBreaks.length > 0 ? type.defaultBreaks[0].durationMinutes : 30,
  );
  const [color, setColor] = useState(type.color);

  const resetState = useCallback(() => {
    setName(type.name);
    setDurationHours(Math.floor(type.durationMinutes / 60));
    setDurationMinutes(type.durationMinutes % 60);
    setIncludeBreak(type.defaultBreaks.length > 0);
    setBreakOffsetHours(type.defaultBreaks.length > 0 ? Math.floor(type.defaultBreaks[0].offsetMinutes / 60) : 4);
    setBreakOffsetMinutes(type.defaultBreaks.length > 0 ? type.defaultBreaks[0].offsetMinutes % 60 : 0);
    setBreakLengthMinutes(type.defaultBreaks.length > 0 ? type.defaultBreaks[0].durationMinutes : 30);
    setColor(type.color);
  }, [type]);

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    resetState();
    setHasChanges(false);
  }, [resetState]);

  const handleHeaderClick = () => {
    onSelect(type.id);
    onToggleExpand(type.id);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/x-shift-type", type.id);
    event.dataTransfer.effectAllowed = "copy";
    onSelect(type.id);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const totalDuration = durationHours * 60 + durationMinutes;
    const nextType: ShiftType = {
      ...type,
      name: name.trim(),
      durationMinutes: Math.max(5, totalDuration),
      color,
      defaultBreaks: includeBreak
        ? [
            {
              id: type.defaultBreaks[0]?.id ?? "break-1",
              offsetMinutes: breakOffsetHours * 60 + breakOffsetMinutes,
              durationMinutes: breakLengthMinutes,
            },
          ]
        : [],
    };
    onUpdate(nextType);
    setHasChanges(false);
  };

  const handleCancel = () => {
    resetState();
    setHasChanges(false);
  };

  useEffect(() => {
    const totalDuration = durationHours * 60 + durationMinutes;
    const hasBreak = includeBreak ? 1 : 0;
    const originalBreak = type.defaultBreaks[0];
    const breakChanged = includeBreak
      ? !originalBreak ||
        originalBreak.offsetMinutes !== breakOffsetHours * 60 + breakOffsetMinutes ||
        originalBreak.durationMinutes !== breakLengthMinutes
      : Boolean(originalBreak);
    const colorChanged = color !== type.color;
    const changed =
      name !== type.name ||
      totalDuration !== type.durationMinutes ||
      colorChanged ||
      hasBreak !== (type.defaultBreaks.length > 0 ? 1 : 0) ||
      breakChanged;
    setHasChanges(changed);
  }, [
    name,
    durationHours,
    durationMinutes,
    includeBreak,
    breakOffsetHours,
    breakOffsetMinutes,
    breakLengthMinutes,
    color,
    type,
  ]);

  return (
    <div
      style={{
        border: selected ? `2px solid ${color}` : "1px solid #ccc",
        borderRadius: "0.75rem",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleHeaderClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleHeaderClick();
          }
        }}
        draggable
        onDragStart={handleDragStart}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          background: selected ? `${color}20` : "#fdfdfd",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong>{type.name}</strong>
          <span style={{ fontSize: "0.8rem", color: "#555" }}>{formatDuration(type.durationMinutes)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            aria-hidden
            style={{
              width: "16px",
              height: "16px",
              background: color,
              borderRadius: "50%",
              border: "1px solid #ccc",
            }}
          />
          <span style={{ fontSize: "1.25rem" }}>{expanded ? "▴" : "▾"}</span>
        </div>
      </div>
      {expanded && (
        <form onSubmit={handleSave} style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Dauer
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                min={1}
                max={24}
                value={durationHours}
                onChange={(event) => setDurationHours(Number(event.target.value))}
                style={{ width: "5rem" }}
              />
              <input
                type="number"
                min={0}
                max={55}
                step={5}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                style={{ width: "5rem" }}
              />
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Farbe
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
          <fieldset style={{ border: "1px solid #ddd", borderRadius: "0.5rem", padding: "0.75rem" }}>
            <legend style={{ padding: "0 0.25rem" }}>Standardpause</legend>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={includeBreak} onChange={(event) => setIncludeBreak(event.target.checked)} />
              Pause automatisch platzieren
            </label>
            {includeBreak && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  nach Stunden
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={breakOffsetHours}
                    onChange={(event) => setBreakOffsetHours(Number(event.target.value))}
                    style={{ width: "5rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  nach Minuten
                  <input
                    type="number"
                    min={0}
                    max={55}
                    step={5}
                    value={breakOffsetMinutes}
                    onChange={(event) => setBreakOffsetMinutes(Number(event.target.value))}
                    style={{ width: "5rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  Länge (Minuten)
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={breakLengthMinutes}
                    onChange={(event) => setBreakLengthMinutes(Number(event.target.value))}
                    style={{ width: "5rem" }}
                  />
                </label>
              </div>
            )}
          </fieldset>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={handleCancel} disabled={!hasChanges}>
              Zurücksetzen
            </button>
            <button type="submit" disabled={!hasChanges}>
              Speichern
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ShiftPalette({
  shiftTypes,
  selectedId,
  onSelect,
  onUpdate,
  onCreate,
  nextColor,
}: {
  shiftTypes: ShiftType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (type: ShiftType) => void;
  onCreate: (type: ShiftType) => void;
  nextColor: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3>Schichtpalette</h3>
      {shiftTypes.length === 0 && <p>Noch keine Dienstarten definiert.</p>}
      {shiftTypes.map((type) => (
        <ShiftTypeCard
          key={type.id}
          type={type}
          selected={selectedId === type.id}
          expanded={expandedId === type.id}
          onSelect={onSelect}
          onToggleExpand={handleToggleExpand}
          onUpdate={onUpdate}
        />
      ))}
      <div
        style={{
          border: "1px dashed #bbb",
          borderRadius: "0.75rem",
          padding: "0.75rem",
          background: "#fff",
        }}
      >
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            style={{ width: "100%", padding: "0.5rem", cursor: "pointer" }}
          >
            Neue Dienstart hinzufügen
          </button>
        ) : (
          <NewShiftTypeForm
            onCreate={onCreate}
            nextColor={nextColor}
            onCancel={() => setShowCreateForm(false)}
          />
        )}
      </div>
    </div>
  );
}

function ShiftDetails({
  shift,
  type,
  onChange,
  onDelete,
  onClose,
  availableTypes,
  onError,
}: {
  shift: ShiftInstance;
  type: ShiftType | undefined;
  availableTypes: ShiftType[];
  onChange: (shift: ShiftInstance) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const handleDayChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const day = Number(event.target.value) as DayIndex;
    if (!type) {
      return;
    }

    const moved = moveShiftStart(shift, day, shift.startMinute);
    const originalDate = parseISODate(shift.startDateISO);
    const weekStart = startOfISOWeek(originalDate);
    const newDate = addDays(weekStart, moved.startDay);
    const normalized: ShiftInstance = {
      ...moved,
      startDay: getDayIndexFromDate(newDate),
      startDateISO: toISODate(newDate),
    };
    onChange(normalized);
  };

  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!type) {
      return;
    }
    const minute = minutesFromTimeInput(event.target.value);
    const moved = moveShiftStart(shift, shift.startDay, minute);
    const originalDate = parseISODate(shift.startDateISO);
    const weekStart = startOfISOWeek(originalDate);
    const newDate = addDays(weekStart, moved.startDay);
    const normalized: ShiftInstance = {
      ...moved,
      startDay: getDayIndexFromDate(newDate),
      startDateISO: toISODate(newDate),
    };
    onChange(normalized);
  };

  const handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!type) {
      return;
    }
    const rawMinutes = Number(event.target.value);
    if (Number.isNaN(rawMinutes)) {
      return;
    }
    const minutes = snapToGrid(Math.max(5, rawMinutes));
    const updated = updateShiftDuration(shift, minutes);
    onChange(updated);
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = availableTypes.find((candidate) => candidate.id === event.target.value);
    if (!newType) {
      return;
    }

    const updated: ShiftInstance = {
      ...shift,
      shiftTypeId: newType.id,
      durationMinutes: newType.durationMinutes,
      originalDurationMinutes: newType.durationMinutes,
      breaks: instantiateBreaks(newType),
      edited: false,
      startDateISO: shift.startDateISO,
    };
    onChange(updated);
  };

  return (
    <aside style={{ border: "1px solid #ccc", borderRadius: "0.75rem", padding: "1rem", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Schicht bearbeiten</h3>
        <button onClick={onClose} type="button">
          Schließen
        </button>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
        Dienstart
        <select value={shift.shiftTypeId} onChange={handleTypeChange}>
          {availableTypes.map((candidate) => (
            <option value={candidate.id} key={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
        Tag
        <select value={shift.startDay} onChange={handleDayChange}>
          {Object.entries(DAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
        Startzeit
        <input type="time" value={timeInputValueFromMinutes(shift.startMinute)} onChange={handleStartChange} step={300} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
        Dauer (Minuten)
        <input
          type="number"
          min={5}
          step={5}
          value={shift.durationMinutes}
          onChange={handleDurationChange}
        />
        <span style={{ fontSize: "0.85rem", color: "#555" }}>Original: {shift.originalDurationMinutes} Minuten</span>
      </label>
      {shift.breaks.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <h4>Pausen</h4>
          <ul style={{ paddingLeft: "1.5rem", margin: 0 }}>
            {shift.breaks.map((brk) => (
              <li key={brk.id}>
                nach {formatDuration(brk.offsetMinutes)} für {formatDuration(brk.durationMinutes)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="button" onClick={() => onDelete(shift.id)} style={{ color: "#c62828" }}>
          Löschen
        </button>
      </div>
    </aside>
  );
}

interface DayColumnProps {
  day: DayIndex;
  dayDate: Date;
  shifts: ShiftInstance[];
  types: ShiftType[];
  onAddByClick: (day: DayIndex, minute: number, date: Date) => void;
  onSelectShift: (id: string) => void;
  height: number;
  onDropShiftType: (shiftTypeId: string, day: DayIndex, minute: number, date: Date) => void;
  onCommitMove: (id: string, day: DayIndex, minute: number, date: Date) => void;
  onCommitResizeStart: (id: string, day: DayIndex, minute: number) => void;
  onCommitResizeEnd: (id: string, newDurationMinutes: number) => void;
  onPreviewChange: (preview: DragPreviewState | null) => void;
  dragPreview: DragPreviewState | null;
  selectedShiftId: string | null;
  onDeleteShift: (id: string) => void;
}

function DayColumn({
  day,
  dayDate,
  shifts,
  types,
  onAddByClick,
  onSelectShift,
  height,
  onDropShiftType,
  onCommitMove,
  onCommitResizeStart,
  onCommitResizeEnd,
  onPreviewChange,
  dragPreview,
  selectedShiftId,
  onDeleteShift,
}: DayColumnProps) {
  type DragState =
    | {
        mode: "move";
        shiftId: string;
        day: DayIndex;
        initialPointerMinute: number;
        initialShiftMinute: number;
        shiftDuration: number;
        lastApplied: number | null;
      }
    | {
        mode: "resize-start";
        shiftId: string;
        day: DayIndex;
        initialPointerMinute: number;
        initialShiftMinute: number;
        initialDuration: number;
        shiftDuration: number;
        lastApplied: number | null;
      }
    | {
        mode: "resize-end";
        shiftId: string;
        day: DayIndex;
        initialPointerMinute: number;
        initialDuration: number;
        shiftDuration: number;
        initialShiftMinute: number;
        shiftStartAbsolute: number;
        segmentAbsoluteDay: number;
        lastApplied: number | null;
      };

  const segments = useMemo(
    () =>
      shifts
        .flatMap((shift) => {
          const effectiveShift =
            dragPreview && dragPreview.shiftId === shift.id
              ? {
                  ...shift,
                  startMinute: Math.min(Math.max(dragPreview.startMinute, 0), MINUTES_PER_DAY - 1),
                  durationMinutes: Math.max(5, dragPreview.durationMinutes),
                }
              : shift;
          const computed = computeSegments(effectiveShift);
          return computed.map((segment, index) => ({
            shift,
            renderShift: effectiveShift,
            segment,
            isStartSegment: index === 0,
            isEndSegment: index === computed.length - 1,
          }));
        })
        .filter((pair) => pair.segment.day === day),
    [day, shifts, dragPreview],
  );

  const columnRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const minuteFromClientY = useCallback((clientY: number) => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    const relative = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const rawMinutes = (relative / rect.height) * MINUTES_PER_DAY;
    return Math.min(Math.max(rawMinutes, 0), MINUTES_PER_DAY);
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) {
        return;
      }

      if (drag.mode === "move") {
        const pointerMinute = minuteFromClientY(event.clientY);
        const delta = pointerMinute - drag.initialPointerMinute;
        const candidateMinute = drag.initialShiftMinute + delta;
        const rawMinute = Math.min(Math.max(candidateMinute, 0), MINUTES_PER_DAY - 0.001);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[Planner drag-move]", {
            shiftId: drag.shiftId,
            pointerMinute: pointerMinute.toFixed(2),
            delta: delta.toFixed(2),
            candidateMinute,
            rawMinute,
          });
        }
        if (Math.abs((drag.lastApplied ?? -1) - rawMinute) < 0.1) {
          return;
        }
        drag.lastApplied = rawMinute;
        suppressClickRef.current = true;
        onPreviewChange({ shiftId: drag.shiftId, startMinute: rawMinute, durationMinutes: drag.shiftDuration });
        return;
      }

      if (drag.mode === "resize-start") {
        const pointerMinute = minuteFromClientY(event.clientY);
        const delta = pointerMinute - drag.initialPointerMinute;
        const candidateMinute = drag.initialShiftMinute + delta;
        const rawMinute = Math.min(Math.max(candidateMinute, 0), MINUTES_PER_DAY - 5);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[Planner resize-start]", {
            shiftId: drag.shiftId,
            pointerMinute: pointerMinute.toFixed(2),
            delta: delta.toFixed(2),
            candidateMinute,
            rawMinute,
          });
        }
        if (Math.abs((drag.lastApplied ?? -1) - rawMinute) < 0.1) {
          return;
        }
        drag.lastApplied = rawMinute;
        suppressClickRef.current = true;
        const newDuration = Math.max(5, drag.shiftDuration + (drag.initialShiftMinute - rawMinute));
        onPreviewChange({ shiftId: drag.shiftId, startMinute: rawMinute, durationMinutes: newDuration });
        return;
      }

      if (drag.mode === "resize-end") {
        const pointerMinute = minuteFromClientY(event.clientY);
        const absoluteEnd = drag.segmentAbsoluteDay * MINUTES_PER_DAY + pointerMinute;
        const delta = pointerMinute - drag.initialPointerMinute;
        const incrementalDuration = Math.max(5, drag.shiftDuration + delta);
        const absoluteDuration = Math.max(5, absoluteEnd - drag.shiftStartAbsolute);
        const previewDuration = Math.max(5, Math.max(incrementalDuration, absoluteDuration));
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[Planner resize-end]", {
            shiftId: drag.shiftId,
            pointerMinute: pointerMinute.toFixed(2),
            delta: delta.toFixed(2),
            incrementalDuration,
            absoluteDuration,
            previewDuration,
          });
        }
        if (Math.abs((drag.lastApplied ?? -1) - previewDuration) < 0.1) {
          return;
        }
        drag.lastApplied = previewDuration;
        suppressClickRef.current = true;
        onPreviewChange({ shiftId: drag.shiftId, startMinute: drag.initialShiftMinute, durationMinutes: previewDuration });
      }
    },
    [minuteFromClientY, onPreviewChange],
  );

  const handleMouseUp = useCallback(() => {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    if (!drag) {
      return;
    }

    if (drag.mode === "move") {
      const finalMinute = snapToGrid(Math.round(drag.lastApplied ?? drag.initialShiftMinute));
      onCommitMove(drag.shiftId, drag.day, finalMinute, dayDate);
    } else if (drag.mode === "resize-start") {
      const finalMinute = snapToGrid(Math.round(drag.lastApplied ?? drag.initialShiftMinute));
      onCommitResizeStart(drag.shiftId, drag.day, finalMinute);
    } else if (drag.mode === "resize-end") {
      const finalDuration = snapDurationToFive(drag.lastApplied ?? drag.shiftDuration);
      onCommitResizeEnd(drag.shiftId, finalDuration);
    }

    onPreviewChange(null);
  }, [dayDate, handleMouseMove, onCommitMove, onCommitResizeStart, onCommitResizeEnd, onPreviewChange]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const beginMoveDrag = useCallback(
    (shift: ShiftInstance, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      const pointerMinute = minuteFromClientY(event.clientY);
      dragStateRef.current = {
        mode: "move",
        shiftId: shift.id,
        day,
        initialPointerMinute: pointerMinute,
        initialShiftMinute: shift.startMinute,
        shiftDuration: shift.durationMinutes,
        lastApplied: null,
      };
      onPreviewChange({ shiftId: shift.id, startMinute: shift.startMinute, durationMinutes: shift.durationMinutes });
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [day, handleMouseMove, handleMouseUp, minuteFromClientY, onPreviewChange],
  );

  const beginResizeStart = useCallback(
    (shift: ShiftInstance, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      const pointerMinute = minuteFromClientY(event.clientY);
      dragStateRef.current = {
        mode: "resize-start",
        shiftId: shift.id,
        day,
        initialPointerMinute: pointerMinute,
        initialShiftMinute: shift.startMinute,
        initialDuration: shift.durationMinutes,
        shiftDuration: shift.durationMinutes,
        lastApplied: null,
      };
      onPreviewChange({ shiftId: shift.id, startMinute: shift.startMinute, durationMinutes: shift.durationMinutes });
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [day, handleMouseMove, handleMouseUp, minuteFromClientY, onPreviewChange],
  );

  const beginResizeEnd = useCallback(
    (shift: ShiftInstance, segment: ShiftSegment, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      const { start } = computeShiftRange(shift);
      const pointerMinute = minuteFromClientY(event.clientY);
      dragStateRef.current = {
        mode: "resize-end",
        shiftId: shift.id,
        day,
        initialPointerMinute: pointerMinute,
        initialDuration: shift.durationMinutes,
        shiftDuration: shift.durationMinutes,
        initialShiftMinute: shift.startMinute,
        lastApplied: null,
        shiftStartAbsolute: start,
        segmentAbsoluteDay: segment.absoluteDayIndex,
      };
      onPreviewChange({ shiftId: shift.id, startMinute: shift.startMinute, durationMinutes: shift.durationMinutes });
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [day, handleMouseMove, handleMouseUp, minuteFromClientY, onPreviewChange],
  );

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const minute = snapToGrid(Math.round(minuteFromClientY(event.clientY)));
    onAddByClick(day, minute, dayDate);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const shiftTypeId = event.dataTransfer.getData("application/x-shift-type");
    if (!shiftTypeId) {
      return;
    }
    suppressClickRef.current = true;
    const minute = snapToGrid(Math.round(minuteFromClientY(event.clientY)));
    onDropShiftType(shiftTypeId, day, minute, dayDate);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "90px" }}>
      <header style={{ padding: "0.5rem", textAlign: "center", background: "#fafafa", borderBottom: "1px solid #eee" }}>
        <strong>{getDayLabel(day)}</strong>
        <div style={{ fontSize: "0.75rem", color: "#666" }}>{formatDateGerman(dayDate)}</div>
      </header>
      <div
        style={{
          position: "relative",
          borderLeft: "1px solid #eee",
          borderRight: "1px solid #eee",
          borderBottom: "1px solid #eee",
          background: "#fff",
          height,
        }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        ref={columnRef}
        role="presentation"
      >
        {[...Array(24).keys()].map((hour) => (
          <div
            key={hour}
            style={{
              position: "absolute",
              top: hour * HOUR_HEIGHT,
              left: 0,
              right: 0,
              height: 0,
              borderTop: hour === 0 ? "none" : "1px dashed #f0f0f0",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -6,
                left: 4,
                fontSize: "0.7rem",
                color: "#999",
              }}
            >
              {hour.toString().padStart(2, "0")}:00
            </span>
          </div>
        ))}
        {segments.map(({ shift, renderShift, segment, isStartSegment, isEndSegment }) => {
          const type = types.find((candidate) => candidate.id === renderShift.shiftTypeId);
          const color = getShiftColor(type, 0);
          const top = (segment.startMinute / MINUTES_PER_DAY) * height;
          const segmentHeight = Math.max(6, ((segment.endMinute - segment.startMinute) / MINUTES_PER_DAY) * height);
          const { start, end } = computeShiftRange(renderShift);
          const labelStart = minutesToHm(start);
          const labelEnd = minutesToHm(end);
          const isSelected = selectedShiftId === shift.id;
          const segmentStartAbs = segment.absoluteStart;
          const segmentEndAbs = segment.absoluteEnd;
          const segmentDuration = Math.max(1, segmentEndAbs - segmentStartAbs);
          const breakOverlays = renderShift.breaks
            .map((brk, index) => {
              const breakStartAbs = start + brk.offsetMinutes;
              const breakEndAbs = breakStartAbs + brk.durationMinutes;
              const overlapStart = Math.max(breakStartAbs, segmentStartAbs);
              const overlapEnd = Math.min(breakEndAbs, segmentEndAbs);
              if (overlapEnd <= overlapStart) {
                return null;
              }
              const relativeStart = (overlapStart - segmentStartAbs) / segmentDuration;
              const relativeHeight = (overlapEnd - overlapStart) / segmentDuration;
              return {
                id: `${brk.id}-${index}`,
                top: relativeStart * segmentHeight,
                height: Math.max(2, relativeHeight * segmentHeight),
              };
            })
            .filter(Boolean) as { id: string; top: number; height: number }[];

          return (
            <div
              key={`${shift.id}-${segment.day}-${segment.startMinute}`}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onSelectShift(shift.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectShift(shift.id);
                }
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                if (!isStartSegment) {
                  suppressClickRef.current = false;
                  return;
                }
                beginMoveDrag(shift, event);
              }}
              style={{
                position: "absolute",
                top,
                left: "10%",
                width: "80%",
                height: segmentHeight,
                border: `1px solid ${color}`,
                background: `${color}33`,
                borderRadius: "0.5rem",
                cursor: isStartSegment ? "grab" : "pointer",
                overflow: "hidden",
                padding: 0,
              }}
              title={`${type?.name ?? "Schicht"} • ${labelStart} – ${labelEnd}`}
            >
              {isStartSegment && (
                <div
                  onMouseDown={(event) => beginResizeStart(shift, event)}
                  role="presentation"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 10,
                    cursor: "ns-resize",
                    zIndex: 3,
                  }}
                />
              )}
              {isEndSegment && (
                <div
                  onMouseDown={(event) => beginResizeEnd(shift, segment, event)}
                  role="presentation"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 10,
                    cursor: "ns-resize",
                    zIndex: 3,
                  }}
                />
              )}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "block",
                }}
              >
                {breakOverlays.map((overlay) => (
                  <span
                    key={overlay.id}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: overlay.top,
                      height: overlay.height,
                      background: "#fafafa",
                      opacity: 0.9,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem",
                  width: "100%",
                  height: "100%",
                }}
              >
                <strong style={{ fontSize: "0.8rem" }}>{type?.name ?? "Schicht"}</strong>
                <span style={{ fontSize: "0.75rem" }}>
                  {labelStart} – {labelEnd}
                </span>
                {shift.edited && <span style={{ fontSize: "0.7rem", color: "#d84315" }}>angepasst</span>}
              </div>
              {isSelected && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteShift(shift.id);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    fontSize: "0.7rem",
                    padding: "0.15rem 0.4rem",
                    border: "1px solid #c62828",
                    background: "#fff",
                    color: "#c62828",
                    borderRadius: "0.4rem",
                    cursor: "pointer",
                    zIndex: 4,
                  }}
                >
                  Löschen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverviewTotals({ shifts }: { shifts: ShiftInstance[] }) {
  const totals = useMemo(() => {
    const scheduledPerDay: Record<DayIndex, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };
    const overtimePerDay: Record<DayIndex, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };

    shifts.forEach((shift) => {
      let remainingScheduled = shift.originalDurationMinutes;
      computeSegments(shift).forEach((segment) => {
        const duration = Math.max(0, segment.endMinute - segment.startMinute);
        if (duration === 0) {
          return;
        }
        const scheduledShare = Math.max(0, Math.min(duration, remainingScheduled));
        const overtimeShare = Math.max(0, duration - scheduledShare);
        remainingScheduled -= scheduledShare;
        scheduledPerDay[segment.day] += scheduledShare;
        if (overtimeShare > 0) {
          overtimePerDay[segment.day] += overtimeShare;
        }
      });
    });

    return { scheduledPerDay, overtimePerDay };
  }, [shifts]);

  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      {DAY_ORDER.map((day) => {
        const label = DAY_LABELS[day];
        const scheduled = totals.scheduledPerDay[day];
        const overtime = totals.overtimePerDay[day];
        return (
          <div key={day} style={{ flex: 1 }}>
            <strong>{label}</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span>Geplant: {formatDuration(scheduled)}</span>
              <span>Überzeit: {formatDuration(overtime)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MonthViewProps {
  monthDate: Date;
  shifts: ShiftInstance[];
  shiftTypes: ShiftType[];
  onSelectDate: (date: Date) => void;
}

function MonthView({ monthDate, shifts, shiftTypes, onSelectDate }: MonthViewProps) {
  const monthMatrix = useMemo(() => buildMonthMatrix(monthDate), [monthDate]);
  const shiftTypeMap = useMemo(() => {
    const map = new Map<string, ShiftType>();
    shiftTypes.forEach((type) => map.set(type.id, type));
    return map;
  }, [shiftTypes]);
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftInstance[]>();
    shifts.forEach((shift) => {
      if (!shift.startDateISO) {
        return;
      }
      if (!map.has(shift.startDateISO)) {
        map.set(shift.startDateISO, []);
      }
      map.get(shift.startDateISO)?.push(shift);
    });
    return map;
  }, [shifts]);

  const todayISO = toISODate(startOfDay(new Date()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0.25rem" }}>
        {WEEKDAY_SHORT_LABELS.map((label) => (
          <div key={label} style={{ textAlign: "center", fontWeight: 600, fontSize: "0.85rem", color: "#555" }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {monthMatrix.map((week, weekIndex) => (
          <div
            key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${weekIndex}`}
            style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0.25rem" }}
          >
            {week.map((cell) => {
              const iso = toISODate(cell.date);
              const dayShifts = shiftsByDate.get(iso) ?? [];
              const isToday = iso === todayISO;
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => onSelectDate(cell.date)}
                  style={{
                    padding: "0.45rem 0.35rem",
                    borderRadius: "0.5rem",
                    border: isToday ? "2px solid #3f51b5" : "1px solid #e0e0e0",
                    background: cell.inCurrentMonth ? "#fff" : "#f5f5f5",
                    textAlign: "left",
                    cursor: "pointer",
                    minHeight: "68px",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: cell.inCurrentMonth ? "#333" : "#999" }}>
                    {cell.date.getDate()}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.3rem" }}>
                    {dayShifts.slice(0, 5).map((shift, index) => {
                      const type = shiftTypeMap.get(shift.shiftTypeId);
                      const color = getShiftColor(type, index);
                      return (
                        <span
                          key={`${shift.id}-${index}`}
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: color,
                          }}
                        />
                      );
                    })}
                    {dayShifts.length > 5 && (
                      <span style={{ fontSize: "0.7rem", color: "#555" }}>+{dayShifts.length - 5}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(DEFAULT_SHIFT_TYPES);
  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string | null>(
    DEFAULT_SHIFT_TYPES.length > 0 ? DEFAULT_SHIFT_TYPES[0].id : null,
  );
  const [shifts, setShifts] = useState<ShiftInstance[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [activeDay, setActiveDay] = useState<DayIndex>(0);
  const [message, setMessage] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfISOWeek(new Date()));
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    setCurrentMonthDate(startOfMonth(currentWeekStart));
  }, [currentWeekStart]);

  const weekDayDates = useMemo(() => DAY_ORDER.map((_, idx) => addDays(currentWeekStart, idx)), [currentWeekStart]);

  const weekShifts = useMemo(() => {
    const weekEnd = addDays(currentWeekStart, 6);
    return shifts.filter((shift) => {
      if (!shift.startDateISO) {
        return false;
      }
      const date = parseISODate(shift.startDateISO);
      return isDateInRange(date, currentWeekStart, weekEnd);
    });
  }, [shifts, currentWeekStart]);

  const kwNumber = getISOWeekNumber(currentWeekStart);
  const weekRangeLabel = formatWeekRange(currentWeekStart);
  const monthLabel = formatMonthYear(currentMonthDate);

  const activeShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [selectedShiftId, shifts],
  );

  const nextColor = defaultShiftColors()[shiftTypes.length % defaultShiftColors().length];

  const handleWeekStep = useCallback((delta: number) => {
    setCurrentWeekStart((prev) => startOfISOWeek(addWeeks(prev, delta)));
  }, []);

  const handleMonthStep = useCallback((delta: number) => {
    setCurrentMonthDate((prev) => {
      const next = addMonths(prev, delta);
      setCurrentWeekStart(startOfISOWeek(next));
      return next;
    });
  }, []);

  const handleCreateShiftType = useCallback(
    (type: ShiftType) => {
      setShiftTypes((prev) => [...prev, type]);
      setSelectedShiftTypeId(type.id);
    },
    [setShiftTypes],
  );

  const handleAddShift = useCallback(
    (day: DayIndex, minute: number, options?: { shiftTypeId?: string; date?: Date }) => {
      setMessage(null);
      const targetShiftTypeId = options?.shiftTypeId ?? selectedShiftTypeId;
      if (!targetShiftTypeId) {
        setMessage("Bitte eine Dienstart auswählen.");
        return;
      }
      const type = shiftTypes.find((candidate) => candidate.id === targetShiftTypeId);
      if (!type) {
        setMessage("Unbekannte Dienstart.");
        return;
      }

      if (options?.shiftTypeId) {
        setSelectedShiftTypeId(targetShiftTypeId);
      }

      const baseDate = startOfDay(options?.date ?? addDays(currentWeekStart, day));
      const placementDay = options?.date ? getDayIndexFromDate(baseDate) : day;

      const newShiftOrError = createShiftInstance(
        type,
        { shiftTypeId: type.id, startDay: placementDay, startMinute: minute },
        createId(),
      );

      if (newShiftOrError instanceof Error) {
        setMessage(newShiftOrError.message);
        return;
      }

      const dayDelta = (newShiftOrError.startDay - placementDay + 7) % 7;
      const actualDate = addDays(baseDate, dayDelta);
      const startDateISO = toISODate(actualDate);
      const alignedShift: ShiftInstance = {
        ...newShiftOrError,
        startDay: getDayIndexFromDate(actualDate),
        startDateISO,
      };
      const normalizedShift = ensureDefaultBreaks(alignedShift, type);

      const overlap = findOverlap(shifts, {
        startDay: normalizedShift.startDay,
        startMinute: normalizedShift.startMinute,
        durationMinutes: normalizedShift.durationMinutes,
        startDateISO: normalizedShift.startDateISO,
      });

      if (overlap) {
        setMessage(formatConflict(overlap));
        return;
      }

      setShifts((prev) => [...prev, normalizedShift]);
      setSelectedShiftId(normalizedShift.id);
    },
    [selectedShiftTypeId, shiftTypes, shifts, currentWeekStart],
  );

  const handleMoveShiftInstance = useCallback(
    (shiftId: string, day: DayIndex, minute: number, date: Date) => {
      setShifts((prev) => {
        const index = prev.findIndex((candidate) => candidate.id === shiftId);
        if (index === -1) {
          return prev;
        }
        const shift = prev[index];
        const type = shiftTypes.find((candidate) => candidate.id === shift.shiftTypeId);
        if (!type) {
          return prev;
        }
        const candidate = moveShiftStart(shift, day, minute);
        if (candidate.startDay === shift.startDay && candidate.startMinute === shift.startMinute) {
          return prev;
        }
        const baseDate = startOfDay(date);
        const dayDelta = (candidate.startDay - day + 7) % 7;
        const actualDate = addDays(baseDate, dayDelta);
        const aligned: ShiftInstance = {
          ...candidate,
          startDay: getDayIndexFromDate(actualDate),
          startDateISO: toISODate(actualDate),
          edited: true,
        };
        const normalized = ensureDefaultBreaks(aligned, type);
        const overlap = findOverlap(prev, {
          id: shift.id,
          startDay: normalized.startDay,
          startMinute: normalized.startMinute,
          durationMinutes: normalized.durationMinutes,
          startDateISO: normalized.startDateISO,
        });
        if (overlap) {
          setMessage(formatConflict(overlap));
          return prev;
        }
        setMessage(null);
        const next = [...prev];
        next[index] = normalized;
        return next;
      });
    },
    [shiftTypes],
  );

  const handleResizeShiftStart = useCallback(
    (shiftId: string, day: DayIndex, minute: number) => {
      setShifts((prev) => {
        const index = prev.findIndex((candidate) => candidate.id === shiftId);
        if (index === -1) {
          return prev;
        }
        const shift = prev[index];
        const type = shiftTypes.find((candidate) => candidate.id === shift.shiftTypeId);
        if (!type) {
          return prev;
        }
        const maxStart = shift.startMinute + shift.durationMinutes - 5;
        const newStartMinute = Math.max(0, Math.min(minute, maxStart));
        const newDuration = shift.durationMinutes + (shift.startMinute - newStartMinute);
        if (newDuration < 5) {
          return prev;
        }
        const sanitized: ShiftInstance = {
          ...shift,
          startMinute: newStartMinute,
          durationMinutes: newDuration,
          breaks: sanitizeBreaks({
            ...shift,
            startMinute: newStartMinute,
            durationMinutes: newDuration,
          }),
          edited: true,
        };
        const updated = ensureDefaultBreaks(
          {
            ...sanitized,
            startDay: getDayIndexFromDate(parseISODate(sanitized.startDateISO)),
          },
          type,
        );
        const overlap = findOverlap(prev, {
          id: shift.id,
          startDay: updated.startDay,
          startMinute: updated.startMinute,
          durationMinutes: updated.durationMinutes,
          startDateISO: updated.startDateISO,
        });
        if (overlap) {
          setMessage(formatConflict(overlap));
          return prev;
        }
        setMessage(null);
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [shiftTypes],
  );

  const handleResizeShiftEnd = useCallback(
    (shiftId: string, newDurationMinutes: number) => {
      setShifts((prev) => {
        const index = prev.findIndex((candidate) => candidate.id === shiftId);
        if (index === -1) {
          return prev;
        }
        const shift = prev[index];
        const type = shiftTypes.find((candidate) => candidate.id === shift.shiftTypeId);
        if (!type) {
          return prev;
        }
        const resized = updateShiftDuration(shift, Math.max(5, newDurationMinutes));
        const candidate = ensureDefaultBreaks(
          {
            ...resized,
            startDay: getDayIndexFromDate(parseISODate(resized.startDateISO)),
          },
          type,
        );
        const overlap = findOverlap(prev, {
          id: shift.id,
          startDay: candidate.startDay,
          startMinute: candidate.startMinute,
          durationMinutes: candidate.durationMinutes,
          startDateISO: candidate.startDateISO,
        });
        if (overlap) {
          setMessage(formatConflict(overlap));
          return prev;
        }
        setMessage(null);
        const next = [...prev];
        next[index] = {
          ...candidate,
          edited: true,
        };
        return next;
      });
    },
    [shiftTypes],
  );

  const handleChangeShift = useCallback(
    (updated: ShiftInstance) => {
      const type = shiftTypes.find((candidate) => candidate.id === updated.shiftTypeId);
      if (!type) {
        return;
      }
      const normalizedDay = getDayIndexFromDate(parseISODate(updated.startDateISO));
      const adjusted = ensureDefaultBreaks(
        {
          ...updated,
          startDay: normalizedDay,
        },
        type,
      );
      const overlap = findOverlap(shifts, {
        id: adjusted.id,
        startDay: adjusted.startDay,
        startMinute: adjusted.startMinute,
        durationMinutes: adjusted.durationMinutes,
        startDateISO: adjusted.startDateISO,
      });
      if (overlap) {
        setMessage(formatConflict(overlap));
        return;
      }
      setMessage(null);
      setShifts((prev) => prev.map((shift) => (shift.id === adjusted.id ? adjusted : shift)));
    },
    [shiftTypes, shifts],
  );

  const handleDeleteShift = useCallback((id: string) => {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
    setSelectedShiftId(null);
  }, []);

  const handleSelectDateFromMonth = useCallback((date: Date) => {
    const normalized = startOfDay(date);
    setCurrentWeekStart(startOfISOWeek(normalized));
    setActiveDay(getDayIndexFromDate(normalized));
    setSelectedShiftId(null);
    setViewMode("day");
  }, []);

  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1>Schichtplanung (Preview)</h1>
          <p style={{ maxWidth: "720px" }}>
            Legen Sie Dienstarten fest, platzieren Sie sie in der Wochenübersicht und korrigieren Sie Start- und Endzeiten.
            Alle Daten werden nur lokal im Browser gespeichert.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            Ansicht:
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}>
              <option value="week">Woche</option>
              <option value="day">Tag</option>
              <option value="month">Monat</option>
            </select>
          </label>
          {viewMode === "day" && (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              Tag:
              <select value={activeDay} onChange={(event) => setActiveDay(Number(event.target.value) as DayIndex)}>
                {Object.entries(DAY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {viewMode === "week" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" onClick={() => handleWeekStep(-1)} aria-label="Vorherige Woche">
                ←
              </button>
              <span style={{ fontSize: "0.85rem", color: "#555" }}>KW {kwNumber}</span>
              <button type="button" onClick={() => handleWeekStep(1)} aria-label="Nächste Woche">
                →
              </button>
            </div>
          )}
          {viewMode === "month" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" onClick={() => handleMonthStep(-1)} aria-label="Vorheriger Monat">
                ←
              </button>
              <span style={{ fontSize: "0.85rem", color: "#555" }}>{monthLabel}</span>
              <button type="button" onClick={() => handleMonthStep(1)} aria-label="Nächster Monat">
                →
              </button>
            </div>
          )}
        </div>
      </header>
      {message && (
        <div style={{ padding: "0.75rem 1rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "0.75rem" }}>
          {message}
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
        <ShiftPalette
          shiftTypes={shiftTypes}
          selectedId={selectedShiftTypeId}
          onSelect={setSelectedShiftTypeId}
          onUpdate={(updated) =>
            setShiftTypes((prev) => prev.map((existing) => (existing.id === updated.id ? updated : existing)))
          }
          onCreate={handleCreateShiftType}
          nextColor={nextColor}
        />
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: "1rem", padding: "1rem", background: "#fafafa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>
            Kalender
            {viewMode === "week" && (
              <span style={{ fontSize: "0.9rem", color: "#555", marginLeft: "0.75rem" }}>
                KW {kwNumber} · {weekRangeLabel}
              </span>
            )}
          </h2>
        </div>
        {viewMode === "week" && (
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto" }}>
            {DAY_ORDER.map((day, index) => (
              <DayColumn
                key={day}
                day={day}
                dayDate={weekDayDates[index]}
                shifts={weekShifts}
                types={shiftTypes}
                onAddByClick={(columnDay, minute, date) => handleAddShift(columnDay, minute, { date })}
                onSelectShift={(id) => setSelectedShiftId(id)}
                height={HOUR_HEIGHT * 24}
                onDropShiftType={(typeId, dropDay, dropMinute, date) =>
                  handleAddShift(dropDay, dropMinute, { shiftTypeId: typeId, date })
                }
                onCommitMove={handleMoveShiftInstance}
                onCommitResizeStart={handleResizeShiftStart}
                onCommitResizeEnd={handleResizeShiftEnd}
                onPreviewChange={setDragPreview}
                dragPreview={dragPreview}
                selectedShiftId={selectedShiftId}
                onDeleteShift={handleDeleteShift}
              />
            ))}
          </div>
        )}

        {viewMode === "day" && (
          <div style={{ display: "flex", gap: "1rem" }}>
            <DayColumn
              day={activeDay}
              dayDate={weekDayDates[activeDay]}
              shifts={weekShifts}
              types={shiftTypes}
              onAddByClick={(columnDay, minute, date) => handleAddShift(columnDay, minute, { date })}
              onSelectShift={(id) => setSelectedShiftId(id)}
              height={HOUR_HEIGHT * 24}
              onDropShiftType={(typeId, dropDay, dropMinute, date) =>
                handleAddShift(dropDay, dropMinute, { shiftTypeId: typeId, date })
              }
              onCommitMove={handleMoveShiftInstance}
              onCommitResizeStart={handleResizeShiftStart}
              onCommitResizeEnd={handleResizeShiftEnd}
              onPreviewChange={setDragPreview}
              dragPreview={dragPreview}
              selectedShiftId={selectedShiftId}
              onDeleteShift={handleDeleteShift}
            />
          </div>
        )}
        {viewMode === "month" && (
          <div style={{ marginTop: "1rem" }}>
            <MonthView
              monthDate={currentMonthDate}
              shifts={shifts}
              shiftTypes={shiftTypes}
              onSelectDate={handleSelectDateFromMonth}
            />
          </div>
        )}
        {viewMode !== "month" && (
          <div style={{ marginTop: "1rem" }}>
            <OverviewTotals shifts={weekShifts} />
          </div>
        )}
      </section>

      {activeShift && (
        <ShiftDetails
          shift={activeShift}
          type={shiftTypes.find((candidate) => candidate.id === activeShift.shiftTypeId)}
          availableTypes={shiftTypes}
          onChange={handleChangeShift}
          onDelete={handleDeleteShift}
          onClose={() => setSelectedShiftId(null)}
          onError={(msg) => setMessage(msg)}
        />
      )}
    </main>
  );
}
