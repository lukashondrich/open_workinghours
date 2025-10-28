import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import type { ShiftColor } from "./types"

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function getMonthDays(month: Date): Date[] {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  return eachDayOfInterval({ start, end })
}

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      slots.push(timeString)
    }
  }
  return slots
}

export function getColorClasses(color: ShiftColor): {
  bg: string
  border: string
  text: string
  dot: string
} {
  const colorMap = {
    blue: {
      bg: "bg-blue-100 dark:bg-blue-950",
      border: "border-blue-400 dark:border-blue-600",
      text: "text-blue-900 dark:text-blue-100",
      dot: "bg-blue-500",
    },
    green: {
      bg: "bg-green-100 dark:bg-green-950",
      border: "border-green-400 dark:border-green-600",
      text: "text-green-900 dark:text-green-100",
      dot: "bg-green-500",
    },
    amber: {
      bg: "bg-amber-100 dark:bg-amber-950",
      border: "border-amber-400 dark:border-amber-600",
      text: "text-amber-900 dark:text-amber-100",
      dot: "bg-amber-500",
    },
    rose: {
      bg: "bg-rose-100 dark:bg-rose-950",
      border: "border-rose-400 dark:border-rose-600",
      text: "text-rose-900 dark:text-rose-100",
      dot: "bg-rose-500",
    },
    purple: {
      bg: "bg-purple-100 dark:bg-purple-950",
      border: "border-purple-400 dark:border-purple-600",
      text: "text-purple-900 dark:text-purple-100",
      dot: "bg-purple-500",
    },
    cyan: {
      bg: "bg-cyan-100 dark:bg-cyan-950",
      border: "border-cyan-400 dark:border-cyan-600",
      text: "text-cyan-900 dark:text-cyan-100",
      dot: "bg-cyan-500",
    },
  }

  return colorMap[color]
}

export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins}min`
  } else if (mins === 0) {
    return `${hours}h`
  } else {
    return `${hours}h ${mins}min`
  }
}

export function generateSimulatedTracking(instances: Record<string, any>): Record<string, any> {
  const trackingRecords: Record<string, any> = {}

  // Group instances by date
  const instancesByDate: Record<string, any[]> = {}
  Object.values(instances).forEach((instance: any) => {
    if (!instancesByDate[instance.date]) {
      instancesByDate[instance.date] = []
    }
    instancesByDate[instance.date].push(instance)
  })

  // Generate tracking for each date with shifts
  Object.entries(instancesByDate).forEach(([date, dateInstances]) => {
    dateInstances.forEach((instance: any) => {
      const variance = Math.random()
      let startTime = instance.startTime
      let duration = instance.duration

      // Add realistic variance
      if (variance < 0.3) {
        // 30% chance: arrived 5-20 minutes late
        const lateMinutes = Math.floor(Math.random() * 4) * 5 + 5 // 5, 10, 15, or 20
        const [hours, minutes] = startTime.split(":").map(Number)
        const totalMinutes = hours * 60 + minutes + lateMinutes
        const newHours = Math.floor(totalMinutes / 60) % 24
        const newMinutes = totalMinutes % 60
        startTime = `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`
        duration = Math.max(5, duration - lateMinutes)
      } else if (variance < 0.5) {
        // 20% chance: left 5-15 minutes early
        const earlyMinutes = Math.floor(Math.random() * 3) * 5 + 5 // 5, 10, or 15
        duration = Math.max(5, duration - earlyMinutes)
      } else if (variance < 0.65) {
        // 15% chance: worked 10-30 minutes extra
        const extraMinutes = Math.floor(Math.random() * 5) * 5 + 10 // 10, 15, 20, 25, or 30
        duration = duration + extraMinutes
      }
      // 35% chance: exact match (no change)

      const trackingId = `tracking-${date}-${instance.id}`
      trackingRecords[trackingId] = {
        id: trackingId,
        date,
        startTime,
        duration,
      }
    })
  })

  // 10% chance to add unexpected tracking (day without scheduled shift)
  if (Math.random() < 0.1 && Object.keys(instancesByDate).length > 0) {
    const dates = Object.keys(instancesByDate)
    const randomDate = dates[Math.floor(Math.random() * dates.length)]
    const unexpectedId = `tracking-unexpected-${randomDate}`
    trackingRecords[unexpectedId] = {
      id: unexpectedId,
      date: randomDate,
      startTime: "14:00",
      duration: 120, // 2 hours
    }
  }

  return trackingRecords
}

export function generateHourMarkers(): string[] {
  const hours: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    hours.push(`${String(hour).padStart(2, "0")}:00`)
  }
  return hours
}

export function calculateShiftDisplay(
  startTime: string,
  duration: number,
  date: string,
): {
  topOffset: number
  height: number
  spansNextDay: boolean
  nextDayHeight: number
} {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + duration
  const minutesInDay = 24 * 60

  const topOffset = (startMinutes / 60) * 40

  if (endMinutes <= minutesInDay) {
    // Shift fits within the day
    return {
      topOffset,
      height: (duration / 60) * 40,
      spansNextDay: false,
      nextDayHeight: 0,
    }
  } else {
    // Shift spans into next day
    const remainingMinutesToday = minutesInDay - startMinutes
    const minutesNextDay = endMinutes - minutesInDay

    return {
      topOffset,
      height: (remainingMinutesToday / 60) * 40,
      spansNextDay: true,
      nextDayHeight: (minutesNextDay / 60) * 40,
    }
  }
}

export function getInstancesForDate(
  instances: Record<string, any>,
  date: string,
  previousDate: string | null,
): { current: any[]; fromPrevious: any[] } {
  const current = Object.values(instances).filter((instance) => instance.date === date)

  const fromPrevious = previousDate
    ? Object.values(instances).filter((instance) => {
        if (instance.date !== previousDate) return false
        const startMinutes = timeToMinutes(instance.startTime)
        const endMinutes = startMinutes + instance.duration
        return endMinutes > 24 * 60 // Spans past midnight
      })
    : []

  return { current, fromPrevious }
}
