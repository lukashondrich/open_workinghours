"use client"

import { useEffect, useMemo, useState } from "react"
import type { AnalyticsResponse, StaffGroup } from "@/lib/backend-api"
import { fetchAnalytics } from "@/lib/backend-api"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Legend as RechartsLegend,
} from "recharts"

const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" })
const numberFormatter = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })

export default function PublicDashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<StaffGroup | "all">("all")
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAnalytics({ months: 6, staffGroup: selectedGroup === "all" ? undefined : selectedGroup })
      .then((response) => {
        if (active) {
          setData(response)
          const hospitals = Array.from(new Set(response.hospital_monthly.map((row) => row.hospital_domain))).sort()
          if (!selectedHospital && hospitals.length) {
            setSelectedHospital(hospitals[0])
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load analytics")
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [selectedGroup])

  const hospitalOptions = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.hospital_monthly.map((row) => row.hospital_domain))).sort()
  }, [data])

  useEffect(() => {
    if (!data) {
      return
    }
    if (!selectedHospital && hospitalOptions.length > 0) {
      setSelectedHospital(hospitalOptions[0])
    }
  }, [data, hospitalOptions, selectedHospital])

  const hospitalSeries = useMemo(() => {
    if (!data || !selectedHospital) return []
    return data.hospital_monthly
      .filter((row) => row.hospital_domain === selectedHospital && !row.suppressed)
      .map((row) => {
        const avgActual =
          row.avgActualHours ?? row.average_actual_hours ?? row.total_actual_hours ?? 0
        const avgOvertime =
          row.avgOvertimeHours ?? row.average_overtime_hours ?? row.total_overtime_hours ?? 0
        return {
          label: monthFormatter.format(new Date(row.month_start)),
          avgActual,
          avgOvertime,
          base: Math.max(avgActual - avgOvertime, 0),
        }
      })
  }, [data, selectedHospital])

  return (
    <main className="px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Public dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-900">Aggregated working-hours analytics</h1>
          <p className="text-slate-600">
            We only publish de-identified, aggregated metrics. Small-n buckets are suppressed automatically.
          </p>
        </header>

        <div className="flex flex-wrap gap-4">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value as StaffGroup | "all")}
          >
            <option value="all">Alle Gruppen</option>
            <option value="group_a">Assistenz- & Fachärzt:innen</option>
            <option value="group_b">Ober- & Chefärzt:innen</option>
            <option value="group_c">Pflegepersonal</option>
          </select>

          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedHospital ?? ""}
            onChange={(event) => setSelectedHospital(event.target.value || null)}
          >
            {hospitalOptions.map((hospital) => (
              <option key={hospital} value={hospital}>
                {hospital}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading analytics…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {data && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {selectedHospital || "Select a hospital"} · Verlauf
              </h2>
              {hospitalSeries.length === 0 ? (
                <p className="text-sm text-slate-500">No data available.</p>
              ) : (
                <HospitalRechartsChart series={hospitalSeries} />
              )}
            </div>

            <details
              className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm"
              open={tableOpen}
              onToggle={(event) => setTableOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-slate-900">
                Reports per hospital
              </summary>
              <div className="max-h-[420px] overflow-auto px-6 pb-6 text-sm text-slate-600">
                <table className="w-full">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2">Hospital</th>
                      <th className="pb-2">Reports</th>
                      <th className="pb-2">Ø Hours</th>
                      <th className="pb-2">Ø Overtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hospital_monthly.slice(0, 100).map((row, index) => (
                      <tr key={`${row.hospital_domain}-${row.month_start}-${row.staff_group}-${index}`}>
                        <td className="py-1">{row.hospital_domain}</td>
                        <td className="py-1">{row.report_count}</td>
                        <td className="py-1">{row.average_actual_hours ?? "–"}</td>
                        <td className="py-1">{row.average_overtime_hours ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )}
      </div>
    </main>
  )
}

interface ChartPoint {
  label: string
  avgActual: number
  avgOvertime: number
  base: number
}

function HospitalRechartsChart({ series }: { series: ChartPoint[] }) {
  return (
    <div className="w-full pr-4">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={series} margin={{ top: 24, bottom: 8, left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <RechartsTooltip content={<ChartTooltip />} />
          <RechartsLegend
            payload={[
              { value: "Basis (Plan/Normalstunden)", type: "square", color: "rgba(31,119,180,0.35)" },
              { value: "Überstunden", type: "square", color: "rgba(214,39,40,0.4)" },
              { value: "Summe tatsächliche Stunden", type: "line", color: "#1f77b4" },
            ]}
          />
          <Area
            type="monotone"
            dataKey="base"
            stackId="1"
            stroke="rgba(31,119,180,0.6)"
            fill="rgba(31,119,180,0.35)"
            name="Basis"
          />
          <Area
            type="monotone"
            dataKey="avgOvertime"
            stackId="1"
            stroke="rgba(214,39,40,0.6)"
            fill="rgba(214,39,40,0.4)"
            name="Überstunden"
          />
          <Line
            type="monotone"
            dataKey="avgActual"
            stroke="#1f77b4"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Summe tatsächliche Stunden"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const actual = payload.find((p: any) => p.dataKey === "avgActual")
  const overtime = payload.find((p: any) => p.dataKey === "avgOvertime")
  const base = payload.find((p: any) => p.dataKey === "base")
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-sm shadow">
      <p className="font-medium text-slate-900">{label}</p>
      <ul className="mt-2 space-y-1 text-slate-600">
        <li>
          <span className="font-medium text-slate-900">Summe tatsächliche Stunden:</span>{" "}
          {actual ? numberFormatter.format(actual.value) : "–"}h
        </li>
        <li>
          <span className="font-medium text-slate-900">Überstunden:</span>{" "}
          {overtime ? `+${numberFormatter.format(overtime.value)}h` : "–"} (Anteile über Planstunden)
        </li>
        <li>
          <span className="font-medium text-slate-900">Basis / Planstunden:</span>{" "}
          {base ? numberFormatter.format(base.value) : "–"}h
        </li>
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        Basis sind geplante Stunden, Überstunden liegen darüber. Summe = Basis + Überstunden.
      </p>
    </div>
  )
}
