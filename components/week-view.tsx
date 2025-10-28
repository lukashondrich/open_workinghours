"use client"

import { format, startOfWeek, subDays } from "date-fns"
import { useCalendar } from "./calendar-context"
import {
  getWeekDays,
  generateHourMarkers,
  formatDateKey,
  getColorClasses,
  calculateShiftDisplay,
  getInstancesForDate,
} from "@/lib/calendar-utils"
import type { ShiftInstance } from "@/lib/types"
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

export function WeekView() {
  const { state, dispatch } = useCalendar()
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 })
  const weekDays = getWeekDays(weekStart)
  const hourMarkers = generateHourMarkers()

  const handleCellClick = (date: Date, hour: number, minute: number) => {
    if (state.mode === "shift-armed" && state.armedTemplateId) {
      const roundedMinute = Math.floor(minute / 5) * 5
      const timeSlot = `${String(hour).padStart(2, "0")}:${String(roundedMinute).padStart(2, "0")}`

      dispatch({
        type: "PLACE_SHIFT",
        date: formatDateKey(date),
        timeSlot,
      })
    }
  }

  const handleDayClick = (date: Date) => {
    if (state.mode === "shift-armed" && state.armedTemplateId) {
      dispatch({
        type: "PLACE_SHIFT",
        date: formatDateKey(date),
      })
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[640px] relative">
        {/* Header with days - Sticky positioning with higher z-index */}
        <div className="sticky top-0 z-50 bg-background border-b border-border shadow-md">
          <div className="flex">
            <div className="w-12 flex-shrink-0 border-r border-border bg-muted sticky left-0 z-[60]" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-0 py-1 px-1 text-center border-r border-border last:border-r-0 bg-background"
              >
                <div className="text-[10px] text-muted-foreground font-medium">{format(day, "EEE")}</div>
                <div className="text-xs font-semibold">{format(day, "d")}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Time grid - 24 hours */}
        <div className="relative">
          {hourMarkers.map((hour, hourIndex) => (
            <div key={hour} className="flex border-b border-border">
              <div className="w-12 flex-shrink-0 border-r border-border bg-muted sticky left-0 z-10">
                <div className="text-[10px] text-muted-foreground px-1 py-0.5">{hour}</div>
              </div>

              {/* Day columns - each hour is 40px tall */}
              {weekDays.map((day, dayIndex) => {
                const isArmed = state.mode === "shift-armed"
                const dateKey = formatDateKey(day)
                const previousDateKey =
                  dayIndex > 0 ? formatDateKey(weekDays[dayIndex - 1]) : formatDateKey(subDays(day, 1))

                const { current, fromPrevious } = getInstancesForDate(state.instances, dateKey, previousDateKey)

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "flex-1 min-w-0 h-[40px] border-r border-border last:border-r-0 relative cursor-pointer transition-colors",
                      isArmed && "hover:bg-accent/50",
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDayClick(day)
                    }}
                  >
                    {/* Render shifts that start on this day */}
                    {hourIndex === 0 &&
                      current.map((instance: ShiftInstance) => {
                        const colors = getColorClasses(instance.color)
                        const isEditing = state.editingInstanceId === instance.id
                        const display = calculateShiftDisplay(instance.startTime, instance.duration, dateKey)

                        return (
                          <div
                            key={instance.id}
                            className={cn(
                              "absolute inset-x-0 border-l-2 px-1 overflow-hidden z-10",
                              colors.bg,
                              colors.border,
                              colors.text,
                              isEditing && "ring-2 ring-ring",
                            )}
                            style={{
                              top: `${display.topOffset}px`,
                              height: `${display.height}px`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              dispatch({ type: "START_EDIT_INSTANCE", id: instance.id })
                            }}
                          >
                            <div className="text-xs font-medium truncate">{instance.name}</div>
                            <div className="text-xs opacity-75">
                              {instance.startTime} ({instance.duration}m)
                            </div>

                            {isEditing && (
                              <div className="absolute top-1 right-1 flex gap-1 bg-background/90 rounded p-0.5">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    dispatch({ type: "MOVE_INSTANCE_UP", id: instance.id })
                                  }}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    dispatch({ type: "MOVE_INSTANCE_DOWN", id: instance.id })
                                  }}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    dispatch({ type: "DELETE_INSTANCE", id: instance.id })
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}

                    {/* Render continuation of shifts from previous day */}
                    {hourIndex === 0 &&
                      fromPrevious.map((instance: ShiftInstance) => {
                        const colors = getColorClasses(instance.color)
                        const display = calculateShiftDisplay(instance.startTime, instance.duration, instance.date)

                        if (!display.spansNextDay) return null

                        return (
                          <div
                            key={`${instance.id}-continuation`}
                            className={cn(
                              "absolute inset-x-0 border-l-2 px-1 overflow-hidden z-10 opacity-75",
                              colors.bg,
                              colors.border,
                              colors.text,
                            )}
                            style={{
                              top: 0,
                              height: `${display.nextDayHeight}px`,
                            }}
                          >
                            <div className="text-xs font-medium truncate">{instance.name} (cont.)</div>
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
