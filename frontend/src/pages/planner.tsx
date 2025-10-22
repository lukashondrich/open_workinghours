import { useCallback, useMemo, useState } from "react";

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
  snapToGrid,
  updateShiftDuration,
} from "../review/calculations";
import { DayIndex, ShiftInstance, ShiftType } from "../review/types";

type ViewMode = "week" | "day";

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

const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  {
    id: "normal-wochentag",
    name: "Normaler Wochentag",
    durationMinutes: 8 * 60,
    allowCrossMidnight: false,
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
    allowCrossMidnight: true,
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
}: {
  onCreate: (type: ShiftType) => void;
  nextColor: string;
}) {
  const [name, setName] = useState("");
  const [durationHours, setDurationHours] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [allowCrossMidnight, setAllowCrossMidnight] = useState(false);
  const [defaultBreakOffsetHours, setDefaultBreakOffsetHours] = useState(4);
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
      allowCrossMidnight,
      defaultBreaks: includeBreak
        ? [
            {
              id: "break-1",
              offsetMinutes: defaultBreakOffsetHours * 60,
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
    setAllowCrossMidnight(false);
    setIncludeBreak(true);
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
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={allowCrossMidnight}
          onChange={(event) => setAllowCrossMidnight(event.target.checked)}
        />
        Kann Mitternacht überschreiten
      </label>
      <fieldset style={{ border: "1px solid #ccc", padding: "0.75rem", borderRadius: "0.5rem" }}>
        <legend style={{ padding: "0 0.25rem" }}>Standardpause</legend>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={includeBreak} onChange={(event) => setIncludeBreak(event.target.checked)} />
          Pause nach fester Zeit einfügen
        </label>
        {includeBreak && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
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
      <button type="submit" style={{ marginTop: "0.5rem" }}>
        Dienstart anlegen
      </button>
    </form>
  );
}

function ShiftPalette({
  shiftTypes,
  selectedId,
  onSelect,
}: {
  shiftTypes: ShiftType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <h3>Schichtpalette</h3>
      {shiftTypes.length === 0 && <p>Noch keine Dienstarten definiert.</p>}
      {shiftTypes.map((type) => (
        <button
          key={type.id}
          onClick={() => onSelect(type.id)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem",
            borderRadius: "0.75rem",
            border: selectedId === type.id ? `2px solid ${type.color}` : "1px solid #ccc",
            background: selectedId === type.id ? `${type.color}20` : "#fff",
            cursor: "pointer",
          }}
        >
          <span>{type.name}</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{formatDuration(type.durationMinutes)}</span>
        </button>
      ))}
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
    onChange(moved);
  };

  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!type) {
      return;
    }
    const minute = minutesFromTimeInput(event.target.value);
    const moved = moveShiftStart(shift, shift.startDay, minute);

    if (!type.allowCrossMidnight && moved.startMinute + shift.durationMinutes > MINUTES_PER_DAY) {
      onError("Schichttyp erlaubt kein Überschreiten von Mitternacht.");
      return;
    }

    onChange(moved);
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
    if (!type.allowCrossMidnight && shift.startMinute + minutes > MINUTES_PER_DAY) {
      onError("Schichttyp erlaubt kein Überschreiten von Mitternacht.");
      return;
    }
    const updated = updateShiftDuration(shift, minutes);
    onChange(updated);
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = availableTypes.find((candidate) => candidate.id === event.target.value);
    if (!newType) {
      return;
    }

    if (!newType.allowCrossMidnight && shift.startMinute + newType.durationMinutes > MINUTES_PER_DAY) {
      onError("Diese Dienstart kann zu dieser Startzeit nicht über Mitternacht laufen.");
      return;
    }

    const updated: ShiftInstance = {
      ...shift,
      shiftTypeId: newType.id,
      durationMinutes: newType.durationMinutes,
      originalDurationMinutes: newType.durationMinutes,
      breaks: instantiateBreaks(newType),
      edited: false,
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
  shifts: ShiftInstance[];
  types: ShiftType[];
  onAddByClick: (day: DayIndex, minute: number) => void;
  onSelectShift: (id: string) => void;
  height: number;
}

function DayColumn({ day, shifts, types, onAddByClick, onSelectShift, height }: DayColumnProps) {
  const segments = useMemo(
    () =>
      shifts
        .flatMap((shift) => computeSegments(shift).map((segment) => ({ shift, segment })))
        .filter((pair) => pair.segment.day === day),
    [day, shifts],
  );

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const boundedY = Math.min(Math.max(relativeY, 0), height);
    const rawMinute = Math.round((boundedY / height) * (MINUTES_PER_DAY - 1));
    const minute = snapToGrid(Math.min(Math.max(rawMinute, 0), MINUTES_PER_DAY - 5));
    onAddByClick(day, minute);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "90px" }}>
      <header style={{ padding: "0.5rem", textAlign: "center", background: "#fafafa", borderBottom: "1px solid #eee" }}>
        <strong>{getDayLabel(day)}</strong>
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
        {segments.map(({ shift, segment }) => {
          const type = types.find((candidate) => candidate.id === shift.shiftTypeId);
          const color = getShiftColor(type, 0);
          const top = (segment.startMinute / MINUTES_PER_DAY) * height;
          const segmentHeight = Math.max(6, ((segment.endMinute - segment.startMinute) / MINUTES_PER_DAY) * height);
          const { start, end } = computeShiftRange(shift);
          const labelStart = minutesToHm(start);
          const labelEnd = minutesToHm(end);
          const dayStartAbs = day * MINUTES_PER_DAY;
          const segmentStartAbs = dayStartAbs + segment.startMinute;
          const segmentEndAbs = dayStartAbs + segment.endMinute;
          const breakOverlays = shift.breaks
            .map((brk, index) => {
              const breakStartAbs = start + brk.offsetMinutes;
              const breakEndAbs = breakStartAbs + brk.durationMinutes;
              const overlapStart = Math.max(breakStartAbs, segmentStartAbs);
              const overlapEnd = Math.min(breakEndAbs, segmentEndAbs);
              if (overlapEnd <= overlapStart) {
                return null;
              }
              const localStart = overlapStart - dayStartAbs;
              const localEnd = overlapEnd - dayStartAbs;
              return {
                id: `${brk.id}-${index}`,
                top: (localStart / MINUTES_PER_DAY) * height,
                height: Math.max(2, ((localEnd - localStart) / MINUTES_PER_DAY) * height),
              };
            })
            .filter(Boolean) as { id: string; top: number; height: number }[];

          return (
            <button
              key={`${shift.id}-${segment.day}-${segment.startMinute}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectShift(shift.id);
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
                cursor: "pointer",
                padding: 0,
                overflow: "hidden",
              }}
              title={`${type?.name ?? "Schicht"} • ${labelStart} – ${labelEnd}`}
            >
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
                  zIndex: 1,
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
            </button>
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

  const activeShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [selectedShiftId, shifts],
  );

  const nextColor = defaultShiftColors()[shiftTypes.length % defaultShiftColors().length];

  const handleCreateShiftType = useCallback(
    (type: ShiftType) => {
      setShiftTypes((prev) => [...prev, type]);
      setSelectedShiftTypeId(type.id);
    },
    [setShiftTypes],
  );

  const handleAddShift = useCallback(
    (day: DayIndex, minute: number) => {
      setMessage(null);
      if (!selectedShiftTypeId) {
        setMessage("Bitte eine Dienstart auswählen.");
        return;
      }
      const type = shiftTypes.find((candidate) => candidate.id === selectedShiftTypeId);
      if (!type) {
        setMessage("Unbekannte Dienstart.");
        return;
      }

      const newShiftOrError = createShiftInstance(type, { shiftTypeId: type.id, startDay: day, startMinute: minute }, createId());

      if (newShiftOrError instanceof Error) {
        setMessage(newShiftOrError.message);
        return;
      }

      const overlap = findOverlap(shifts, {
        startDay: newShiftOrError.startDay,
        startMinute: newShiftOrError.startMinute,
        durationMinutes: newShiftOrError.durationMinutes,
      });

      if (overlap) {
        setMessage(formatConflict(overlap));
        return;
      }

      setShifts((prev) => [...prev, newShiftOrError]);
      setSelectedShiftId(newShiftOrError.id);
    },
    [selectedShiftTypeId, shiftTypes, shifts],
  );

  const handleChangeShift = useCallback(
    (updated: ShiftInstance) => {
      const type = shiftTypes.find((candidate) => candidate.id === updated.shiftTypeId);
      if (!type) {
        return;
      }
      if (!type.allowCrossMidnight && updated.startMinute + updated.durationMinutes > MINUTES_PER_DAY) {
        setMessage("Diese Dienstart darf nicht über Mitternacht laufen.");
        return;
      }
      const overlap = findOverlap(shifts, {
        id: updated.id,
        startDay: updated.startDay,
        startMinute: updated.startMinute,
        durationMinutes: updated.durationMinutes,
      });
      if (overlap) {
        setMessage(formatConflict(overlap));
        return;
      }
      setMessage(null);
      setShifts((prev) => prev.map((shift) => (shift.id === updated.id ? updated : shift)));
    },
    [shiftTypes, shifts],
  );

  const handleDeleteShift = useCallback((id: string) => {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
    setSelectedShiftId(null);
  }, []);

  const handleAddShiftByForm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const day = Number(formData.get("day")) as DayIndex;
      const startValue = formData.get("startTime");
      const time = minutesFromTimeInput(typeof startValue === "string" ? startValue : null);
      handleAddShift(day, time);
    },
    [handleAddShift],
  );

  const dayShifts = useMemo(
    () => shifts.filter((shift) => computeSegments(shift).some((segment) => segment.day === activeDay)),
    [shifts, activeDay],
  );

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
        <div>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            Ansicht:
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}>
              <option value="week">Woche</option>
              <option value="day">Tag</option>
            </select>
          </label>
          {viewMode === "day" && (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
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
        </div>
      </header>
      {message && (
        <div style={{ padding: "0.75rem 1rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "0.75rem" }}>
          {message}
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
        <ShiftPalette shiftTypes={shiftTypes} selectedId={selectedShiftTypeId} onSelect={setSelectedShiftTypeId} />
        <form onSubmit={handleAddShiftByForm} style={{ display: "grid", gap: "0.5rem" }}>
          <h3>Schnell hinzufügen</h3>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            Dienstart auswählen, Tag und Startzeit setzen und per Klick übernehmen.
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Tag
            <select name="day" defaultValue={0}>
              {Object.entries(DAY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Startzeit
            <input type="time" name="startTime" defaultValue="08:00" step={300} />
          </label>
          <button type="submit">Schicht hinzufügen</button>
        </form>
        <NewShiftTypeForm onCreate={handleCreateShiftType} nextColor={nextColor} />
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: "1rem", padding: "1rem", background: "#fafafa" }}>
        <h2>Kalender</h2>
        {viewMode === "week" && (
          <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto" }}>
            {DAY_ORDER.map((day) => (
              <DayColumn
                key={day}
                day={day}
                shifts={shifts}
                types={shiftTypes}
                onAddByClick={handleAddShift}
                onSelectShift={(id) => setSelectedShiftId(id)}
                height={HOUR_HEIGHT * 24}
              />
            ))}
          </div>
        )}

        {viewMode === "day" && (
          <div style={{ display: "flex", gap: "1rem" }}>
            <DayColumn
              day={activeDay}
              shifts={dayShifts}
              types={shiftTypes}
              onAddByClick={handleAddShift}
              onSelectShift={(id) => setSelectedShiftId(id)}
              height={HOUR_HEIGHT * 24}
            />
          </div>
        )}
        <div style={{ marginTop: "1rem" }}>
          <OverviewTotals shifts={shifts} />
        </div>
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
