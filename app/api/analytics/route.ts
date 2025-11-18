import { NextResponse } from "next/server"
import type { AnalyticsResponse, StaffGroup } from "@/lib/backend-api"

// Temporary mock API so the dashboard works without the FastAPI backend.
// Replace this with a real proxy once the backend is deployed.

const MOCK_HOSPITALS = [
  { domain: "charite.de", baseHours: 162 },
  { domain: "vivantes.de", baseHours: 155 },
  { domain: "uk-koeln.de", baseHours: 168 }
]

const STAFF_GROUPS: StaffGroup[] = ["group_a", "group_b", "group_c"]

const clampMonths = (value: number) => Math.min(Math.max(Math.round(value), 1), 36)

const monthStartFor = (offset: number) => {
  const today = new Date()
  const ref = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)
  return new Date(ref).toISOString()
}

const pseudoVariation = (seed: number) => {
  const value = Math.sin(seed) * 10000
  return value - Math.floor(value)
}

const round = (value: number) => Math.round(value * 100) / 100

const generateMockAnalytics = (months: number): AnalyticsResponse => {
  const hospitalRows: AnalyticsResponse["hospital_monthly"] = []
  const staffRows = new Map<
    string,
    {
      staff_group: StaffGroup
      month_start: string
      report_count: number
      totalActual: number
      totalOvertime: number
    }
  >()

  for (let monthIndex = 0; monthIndex < months; monthIndex += 1) {
    const month_start = monthStartFor(monthIndex)
    MOCK_HOSPITALS.forEach((hospital, hospitalIndex) => {
      STAFF_GROUPS.forEach((staffGroup, groupIndex) => {
        const variation = pseudoVariation((hospitalIndex + 1) * (groupIndex + 3) * (monthIndex + 5))
        const report_count = 11 + ((hospitalIndex + groupIndex + monthIndex) % 6)
        const suppressed = report_count < 5
        const avgActual = suppressed
          ? null
          : round(hospital.baseHours + groupIndex * 3 + monthIndex * 1.5 + variation * 6)
        const avgOvertime = suppressed ? null : round(6 + groupIndex * 2 + (monthIndex % 3) + variation * 2)
        const totalActual =
          avgActual !== null ? round(avgActual * report_count) : null
        const totalOvertime =
          avgOvertime !== null ? round(avgOvertime * report_count) : null
        const ciSpread = suppressed ? null : round(1.2 + variation * 1.5)

        hospitalRows.push({
          hospital_domain: hospital.domain,
          staff_group: staffGroup,
          month_start,
          report_count,
          average_actual_hours: avgActual,
          average_overtime_hours: avgOvertime,
          total_actual_hours: totalActual,
          total_overtime_hours: totalOvertime,
          ci_actual_low: avgActual !== null && ciSpread !== null ? round(avgActual - ciSpread) : null,
          ci_actual_high: avgActual !== null && ciSpread !== null ? round(avgActual + ciSpread) : null,
          ci_overtime_low: avgOvertime !== null && ciSpread !== null ? round(avgOvertime - ciSpread / 2) : null,
          ci_overtime_high: avgOvertime !== null && ciSpread !== null ? round(avgOvertime + ciSpread / 2) : null,
          suppressed
        })

        const staffKey = `${staffGroup}-${month_start}`
        const existing = staffRows.get(staffKey)
        const currentTotalActual = totalActual ?? 0
        const currentTotalOvertime = totalOvertime ?? 0
        if (existing) {
          existing.report_count += report_count
          existing.totalActual += currentTotalActual
          existing.totalOvertime += currentTotalOvertime
        } else {
          staffRows.set(staffKey, {
            staff_group: staffGroup,
            month_start,
            report_count,
            totalActual: currentTotalActual,
            totalOvertime: currentTotalOvertime
          })
        }
      })
    })
  }

  const staff_group_monthly: AnalyticsResponse["staff_group_monthly"] = Array.from(staffRows.values()).map(
    (row) => {
      const avgActual = row.report_count > 0 ? round(row.totalActual / row.report_count) : null
      const avgOvertime = row.report_count > 0 ? round(row.totalOvertime / row.report_count) : null
      return {
        staff_group: row.staff_group,
        month_start: row.month_start,
        report_count: row.report_count,
        average_actual_hours: avgActual,
        average_overtime_hours: avgOvertime,
        total_actual_hours: round(row.totalActual),
        total_overtime_hours: round(row.totalOvertime),
        ci_actual_low: avgActual !== null ? round(avgActual - 1.5) : null,
        ci_actual_high: avgActual !== null ? round(avgActual + 1.5) : null,
        ci_overtime_low: avgOvertime !== null ? round(avgOvertime - 0.7) : null,
        ci_overtime_high: avgOvertime !== null ? round(avgOvertime + 0.7) : null,
        suppressed: false
      }
    }
  )

  return {
    hospital_monthly: hospitalRows,
    staff_group_monthly
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const monthsParam = Number(url.searchParams.get("months") ?? "6")
  const months = Number.isFinite(monthsParam) ? clampMonths(monthsParam) : 6
  const staffParam = url.searchParams.get("staff_group") as StaffGroup | null
  const base = generateMockAnalytics(months)

  if (!staffParam || !STAFF_GROUPS.includes(staffParam)) {
    return NextResponse.json(base)
  }

  const filtered: AnalyticsResponse = {
    hospital_monthly: base.hospital_monthly.filter((row) => row.staff_group === staffParam),
    staff_group_monthly: base.staff_group_monthly.filter((row) => row.staff_group === staffParam)
  }
  return NextResponse.json(filtered)
}
