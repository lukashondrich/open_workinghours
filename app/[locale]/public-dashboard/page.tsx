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
import { useLocale, useTranslations } from "next-intl"

export default function PublicDashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<StaffGroup | "all">("all")
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
    [locale],
  )
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }),
    [locale],
  )
  const fallbackError = t('error')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAnalytics({ months: 6, staffGroup: selectedGroup === "all" ? undefined : selectedGroup })
      .then((response) => {
        if (active) {
          setData(response)
          setError(null)
          const hospitals = Array.from(new Set(response.hospital_monthly.map((row) => row.hospital_domain))).sort()
          setSelectedHospital((current) => current ?? hospitals[0] ?? null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : fallbackError)
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
  }, [selectedGroup, fallbackError])

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
        const avgOvertime =
          row.avgOvertimeHours ?? row.average_overtime_hours ?? row.total_overtime_hours ?? 0
        const avgActual =
          row.avgActualHours ?? row.average_actual_hours ?? row.total_actual_hours ?? 0
        const base = Math.max(avgActual - avgOvertime, 0)
        const totalActual = avgActual > 0 ? avgActual : base + avgOvertime
        return {
          label: monthFormatter.format(new Date(row.month_start)),
          avgActual: totalActual,
          avgOvertime,
          base,
        }
      })
  }, [data, selectedHospital, monthFormatter])

  const filterLabels = {
    all: t('filters.allGroups'),
    group_a: t('filters.groupA'),
    group_b: t('filters.groupB'),
    group_c: t('filters.groupC'),
  }

  const chartLabels = {
    base: t('chart.basePlan'),
    overtime: t('chart.overtime'),
    total: t('chart.totalActual'),
  }

  const tooltipLabels = {
    totalActual: t('tooltip.totalActual'),
    overtime: t('tooltip.overtime'),
    overtimeNote: t('tooltip.overtimeNote'),
    base: t('tooltip.base'),
    explanation: t('tooltip.explanation'),
  }

  return (
    <main className="px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-medium">{t('label')}</p>
          <h1 className="text-4xl font-light text-slate-900">{t('title')}</h1>
          <p className="text-slate-500 font-light leading-relaxed">{t('description')}</p>
        </header>

        <div className="flex flex-wrap gap-4">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value as StaffGroup | "all")}
          >
            <option value="all">{filterLabels.all}</option>
            <option value="group_a">{filterLabels.group_a}</option>
            <option value="group_b">{filterLabels.group_b}</option>
            <option value="group_c">{filterLabels.group_c}</option>
          </select>

          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedHospital ?? ""}
            onChange={(event) => setSelectedHospital(event.target.value || null)}
          >
            <option value="">{t('selectHospital')}</option>
            {hospitalOptions.map((hospital) => (
              <option key={hospital} value={hospital}>
                {hospital}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {data && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {selectedHospital || t('selectHospital')} {t('verlauf')}
              </h2>
              {hospitalSeries.length === 0 ? (
                <p className="text-sm text-slate-500">{t('noData')}</p>
              ) : (
                <HospitalRechartsChart
                  series={hospitalSeries}
                  chartLabels={chartLabels}
                  tooltipLabels={tooltipLabels}
                  numberFormatter={numberFormatter}
                />
              )}
            </div>

            <details
              className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm"
              open={tableOpen}
              onToggle={(event) => setTableOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-slate-900">
                {t('reportsPerHospital')}
              </summary>
              <div className="max-h-[420px] overflow-auto px-6 pb-6 text-sm text-slate-600">
                <table className="w-full">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2">{t('table.hospital')}</th>
                      <th className="pb-2">{t('table.reports')}</th>
                      <th className="pb-2">{t('table.avgHours')}</th>
                      <th className="pb-2">{t('table.avgOvertime')}</th>
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

interface ChartLabels {
  base: string
  overtime: string
  total: string
}

interface TooltipLabels {
  totalActual: string
  overtime: string
  overtimeNote: string
  base: string
  explanation: string
}

interface TooltipDatum {
  dataKey?: string
  value?: number
}

function HospitalRechartsChart({
  series,
  chartLabels,
  tooltipLabels,
  numberFormatter,
}: {
  series: ChartPoint[]
  chartLabels: ChartLabels
  tooltipLabels: TooltipLabels
  numberFormatter: Intl.NumberFormat
}) {
  return (
    <div className="w-full pr-4">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={series} margin={{ top: 24, bottom: 8, left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <RechartsTooltip content={<ChartTooltip numberFormatter={numberFormatter} labels={tooltipLabels} />} />
          <RechartsLegend
            payload={[
              { value: chartLabels.base, type: "square", color: "rgba(31,119,180,0.35)" },
              { value: chartLabels.overtime, type: "square", color: "rgba(214,39,40,0.4)" },
              { value: chartLabels.total, type: "line", color: "#1f77b4" },
            ]}
          />
          <Area
            type="monotone"
            dataKey="base"
            stackId="1"
            stroke="rgba(31,119,180,0.6)"
            fill="rgba(31,119,180,0.35)"
            name={chartLabels.base}
          />
          <Area
            type="monotone"
            dataKey="avgOvertime"
            stackId="1"
            stroke="rgba(214,39,40,0.6)"
            fill="rgba(214,39,40,0.4)"
            name={chartLabels.overtime}
          />
          <Line
            type="monotone"
            dataKey="avgActual"
            stroke="#1f77b4"
            strokeWidth={2}
            dot={{ r: 3 }}
            name={chartLabels.total}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipDatum[]
  label?: string
  numberFormatter: Intl.NumberFormat
  labels: TooltipLabels
}

function ChartTooltip({ active, payload, label, numberFormatter, labels }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const actual = payload.find((p) => p.dataKey === "avgActual")
  const overtime = payload.find((p) => p.dataKey === "avgOvertime")
  const base = payload.find((p) => p.dataKey === "base")

  // Calculate total actual hours as sum of base + overtime
  const totalActual = (base?.value || 0) + (overtime?.value || 0)
  const displayActual = actual?.value || totalActual

  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-sm shadow">
      <p className="font-medium text-slate-900">{label}</p>
      <ul className="mt-2 space-y-1 text-slate-600">
        <li>
          <span className="font-medium text-slate-900">{labels.totalActual} </span>
          {displayActual > 0 ? numberFormatter.format(displayActual) : "–"}h
        </li>
        <li>
          <span className="font-medium text-slate-900">{labels.overtime} </span>
          {overtime ? `+${numberFormatter.format(overtime.value)}h` : "–"} {labels.overtimeNote}
        </li>
        <li>
          <span className="font-medium text-slate-900">{labels.base} </span>
          {base ? numberFormatter.format(base.value) : "–"}h
        </li>
      </ul>
      <p className="mt-2 text-xs text-slate-400">{labels.explanation}</p>
    </div>
  )
}
