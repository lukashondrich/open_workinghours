"use client"

import { FormEvent, useState } from "react"
import { submitReport, type ReportPayload } from "@/lib/backend-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const STAFF_GROUPS = [
  { value: "group_a", label: "Assistenz- & Fachärzt:innen" },
  { value: "group_b", label: "Ober- & Chefärzt:innen" },
  { value: "group_c", label: "Pflegepersonal" },
] as const

interface Props {
  token: string
  onSubmitSuccess?: () => void
  onLogout: () => void
}

export function ReportForm({ token, onSubmitSuccess, onLogout }: Props) {
  const [payload, setPayload] = useState<ReportPayload>({
    shift_date: "",
    actual_hours_worked: 0,
    overtime_hours: 0,
    staff_group: "group_a",
  })
  const [notes, setNotes] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setStatusMessage(null)
    try {
      if (!payload.shift_date) throw new Error("Bitte ein Datum wählen.")
      if (!payload.actual_hours_worked || payload.actual_hours_worked <= 0) {
        throw new Error("Bitte tatsächliche Stunden angeben.")
      }
      if (payload.overtime_hours < 0) {
        throw new Error("Bitte gültige Überstunden angeben (>= 0).")
      }
      if (payload.overtime_hours > payload.actual_hours_worked) {
        throw new Error("Überstunden dürfen die tatsächlichen Stunden nicht überschreiten.")
      }

      await submitReport({ ...payload, notes: notes || undefined }, token)
      setStatusMessage("Report submitted. Vielen Dank!")
      setPayload({
        shift_date: "",
        actual_hours_worked: 0,
        overtime_hours: 0,
        staff_group: "group_a",
      })
      setNotes("")
      onSubmitSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Schritt 2</p>
          <h2 className="text-xl font-semibold text-slate-900">Submit worked hours</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onLogout}>
          Remove verification
        </Button>
      </header>

      {statusMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{statusMessage}</p>}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="space-y-1">
          <Label htmlFor="shift_date">Shift date</Label>
          <Input
            id="shift_date"
            type="date"
            value={payload.shift_date}
            onChange={(event) => setPayload((prev) => ({ ...prev, shift_date: event.target.value }))}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="actual_hours">Tatsächlich geleistete Stunden</Label>
            <Input
              id="actual_hours"
              type="number"
              min={1}
              max={480}
              step={0.25}
              value={payload.actual_hours_worked || ""}
              onChange={(event) =>
                setPayload((prev) => ({ ...prev, actual_hours_worked: Number(event.target.value) }))
              }
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="overtime_hours">Davon Überstunden</Label>
            <Input
              id="overtime_hours"
              type="number"
              min={0}
              max={240}
              step={0.25}
              value={payload.overtime_hours || ""}
              onChange={(event) =>
                setPayload((prev) => ({ ...prev, overtime_hours: Number(event.target.value || 0) }))
              }
            />
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Bitte trage die Stunden der abgeschlossenen Schicht ein. Überstunden sind die Teile, die über den
          vertraglich vorgesehenen Umfang hinausgehen.
        </p>

        <div className="space-y-1">
          <Label htmlFor="staff_group">Personengruppe</Label>
          <select
            id="staff_group"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={payload.staff_group}
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, staff_group: event.target.value as ReportPayload["staff_group"] }))
            }
          >
            {STAFF_GROUPS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Optional context, avoid PII."
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit report"}
        </Button>
      </form>
    </section>
  )
}

