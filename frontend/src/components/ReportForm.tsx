import { FormEvent, useState } from "react";

import { submitReport } from "../lib/api";

interface Props {
  token: string;
  onSubmitSuccess?: () => void;
  onLogout: () => void;
}

const STAFF_GROUPS = [
  { value: "group_a", label: "Assistenz- & Fachärzt:innen" },
  { value: "group_b", label: "Ober- & Chefärzt:innen" },
  { value: "group_c", label: "Pflegepersonal" }
] as const;

export function ReportForm({ token, onSubmitSuccess, onLogout }: Props) {
  const [shiftDate, setShiftDate] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [staffGroup, setStaffGroup] = useState<(typeof STAFF_GROUPS)[number]["value"]>("group_a");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const actual = Number(actualHours);
      const overtime = Number(overtimeHours || "0");
      if (!Number.isFinite(actual) || actual <= 0) {
        throw new Error("Bitte tatsächliche Stunden angeben.");
      }
      if (!Number.isFinite(overtime) || overtime < 0) {
        throw new Error("Bitte gültige Überstunden angeben (>= 0).");
      }
      if (overtime > actual) {
        throw new Error("Überstunden dürfen die tatsächlichen Stunden nicht überschreiten.");
      }
      await submitReport(
        {
          shift_date: shiftDate,
          actual_hours_worked: actual,
          overtime_hours: overtime,
          staff_group: staffGroup,
          notes: notes || undefined
        },
        token
      );
      setStatusMessage("Report submitted. Thank you!");
      setShiftDate("");
      setActualHours("");
      setOvertimeHours("");
      setNotes("");
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Submit Worked Hours</h2>
        <button type="button" onClick={onLogout}>
          Remove verification
        </button>
      </header>
      {statusMessage && <p>{statusMessage}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="shift_date">Shift Date</label>
        <input
          id="shift_date"
          type="date"
          value={shiftDate}
          onChange={(event) => setShiftDate(event.target.value)}
          required
        />

        <label htmlFor="actual_hours">Tatsächlich geleistete Stunden</label>
        <input
          id="actual_hours"
          type="number"
          min="1"
          max="480"
          step="0.25"
          value={actualHours}
          onChange={(event) => setActualHours(event.target.value)}
          required
        />

        <label htmlFor="overtime_hours">Davon Überstunden</label>
        <input
          id="overtime_hours"
          type="number"
          min="0"
          max="240"
          step="0.25"
          value={overtimeHours}
          onChange={(event) => setOvertimeHours(event.target.value)}
          placeholder="0"
        />

        <p style={{ fontSize: "0.85rem", color: "#555" }}>
          Bitte trage die Stunden der abgeschlossenen Schicht ein. Überstunden sind die Teile, die über den
          vertraglich vorgesehenen Umfang hinausgehen.
        </p>

        <label htmlFor="staff_group">Personengruppe</label>
        <select
          id="staff_group"
          value={staffGroup}
          onChange={(event) => setStaffGroup(event.target.value as (typeof STAFF_GROUPS)[number]["value"])}
          required
        >
          {STAFF_GROUPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Optional context, avoid PII."
        />

        <button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </section>
  );
}
