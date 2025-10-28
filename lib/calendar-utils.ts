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
