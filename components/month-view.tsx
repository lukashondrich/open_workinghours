"use client"

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns"
import { useCalendar } from "./calendar-context"
import { formatDateKey, getColorClasses, timeToMinutes } from "@/lib/calendar-utils"
import { cn } from "@/lib/utils"

export function MonthView() {
  const { state, dispatch } = useCalendar()
  const monthStart = startOfMonth(state.currentMonth)
  const monthEnd = endOfMonth(state.currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getInstancesForDate = (date: Date) => {
    const dateKey = formatDateKey(date)
    const currentDayShifts = Object.values(state.instances).filter((instance) => instance.date === dateKey)

    const previousDate = new Date(date)
    previousDate.setDate(previousDate.getDate() - 1)
    const previousDateKey = formatDateKey(previousDate)

    const previousDaySpanningShifts = Object.values(state.instances).filter((instance) => {
      if (instance.date !== previousDateKey) return false
      const startMinutes = timeToMinutes(instance.startTime)
      const endMinutes = startMinutes + instance.duration
      return endMinutes > 24 * 60 // Spans past midnight into this day
    })

    return [...currentDayShifts, ...previousDaySpanningShifts]
  }

  const handleDayClick = (date: Date) => {
    if (state.mode === "shift-armed" && state.armedTemplateId) {
      const template = state.templates[state.armedTemplateId]
      if (template) {
        dispatch({
          type: "PLACE_SHIFT",
          date: formatDateKey(date),
          timeSlot: template.startTime,
        })
      }
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-4xl mx-auto">
        {/* Month header */}
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-semibold">{format(monthStart, "MMMM yyyy")}</h2>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const instances = getInstancesForDate(day)
            const isCurrentMonth = isSameMonth(day, monthStart)
            const isArmed = state.mode === "shift-armed"
            const uniqueColors = [...new Set(instances.map((i) => i.color))]

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square border border-border rounded-lg p-2 cursor-pointer transition-colors",
                  !isCurrentMonth && "opacity-40",
                  isCurrentMonth && "bg-card hover:bg-accent",
                  isArmed && isCurrentMonth && "hover:ring-2 hover:ring-primary",
                )}
                onClick={() => handleDayClick(day)}
              >
                <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                {instances.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {uniqueColors.map((color) => {
                      const colors = getColorClasses(color)
                      return <div key={color} className={cn("w-2 h-2 rounded-full", colors.dot)} />
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
