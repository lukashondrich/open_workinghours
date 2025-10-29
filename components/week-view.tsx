"use client"

import type React from "react"

import { format, startOfWeek, subDays } from "date-fns"
import { useCalendar } from "./calendar-context"
import {
  getWeekDays,
  generateHourMarkers,
  formatDateKey,
  getColorClasses,
  calculateShiftDisplay,
  getInstancesForDate,
  formatDuration,
} from "@/lib/calendar-utils"
import type { ShiftInstance, TrackingRecord } from "@/lib/types"
import { ChevronUp, ChevronDown, Trash2, Check, AlertTriangle, Edit2, X } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"

export function WeekView() {
  const { state, dispatch } = useCalendar()
  const weekStart = startOfWeek(state.currentWeekStart, { weekStartsOn: 1 })
  const weekDays = getWeekDays(weekStart)
  const hourMarkers = generateHourMarkers()
  const [draggingTrackingId, setDraggingTrackingId] = useState<string | null>(null)
  const [dragType, setDragType] = useState<"start" | "end" | null>(null)
  const [dragDateKey, setDragDateKey] = useState<string | null>(null)
  const dayColumnRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    if (!draggingTrackingId || !dragType || !dragDateKey) return

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()

      const columnRef = dayColumnRefs.current[dragDateKey]
      if (!columnRef) return

      const rect = columnRef.getBoundingClientRect()
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      const y = clientY - rect.top

      // Calculate time based on position in full day column (24 hours * 40px = 960px)
      const totalMinutes = Math.max(0, Math.min(1440, Math.round((y / 960) * 1440)))
      const roundedMinutes = Math.floor(totalMinutes / 5) * 5
      const hours = Math.floor(roundedMinutes / 60)
      const minutes = roundedMinutes % 60
      const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`

      if (dragType === "start") {
        dispatch({ type: "UPDATE_TRACKING_START", id: draggingTrackingId, startTime: timeString })
      } else {
        dispatch({ type: "UPDATE_TRACKING_END", id: draggingTrackingId, endTime: timeString })
      }
    }

    const handleGlobalEnd = () => {
      setDraggingTrackingId(null)
      setDragType(null)
      setDragDateKey(null)
    }

    document.addEventListener("mousemove", handleGlobalMove)
    document.addEventListener("mouseup", handleGlobalEnd)
    document.addEventListener("touchmove", handleGlobalMove, { passive: false })
    document.addEventListener("touchend", handleGlobalEnd)

    return () => {
      document.removeEventListener("mousemove", handleGlobalMove)
      document.removeEventListener("mouseup", handleGlobalEnd)
      document.removeEventListener("touchmove", handleGlobalMove)
      document.removeEventListener("touchend", handleGlobalEnd)
    }
  }, [draggingTrackingId, dragType, dragDateKey, dispatch])

  const getChronologicalZIndex = (instance: ShiftInstance, allInstances: ShiftInstance[]) => {
    const [year, month, day] = instance.date.split("-").map(Number)
    const [hours, minutes] = instance.startTime.split(":").map(Number)
    const timestamp = new Date(year, month - 1, day, hours, minutes).getTime()

    const sortedByTime = [...allInstances].sort((a, b) => {
      const [yearA, monthA, dayA] = a.date.split("-").map(Number)
      const [hoursA, minutesA] = a.startTime.split(":").map(Number)
      const timestampA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA).getTime()

      const [yearB, monthB, dayB] = b.date.split("-").map(Number)
      const [hoursB, minutesB] = b.endTime.split(":").map(Number)
      const timestampB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB).getTime()

      return timestampA - timestampB
    })

    const position = sortedByTime.findIndex((inst) => inst.id === instance.id)
    return 10 + position
  }

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

  const handleTrackingDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    trackingId: string,
    type: "start" | "end",
    dateKey: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingTrackingId(trackingId)
    setDragType(type)
    setDragDateKey(dateKey)
  }

  const getTrackingForDate = (dateKey: string): TrackingRecord[] => {
    return Object.values(state.trackingRecords).filter((record) => record.date === dateKey)
  }

  const isDayConfirmed = (dateKey: string): boolean => {
    return state.confirmedDates.has(dateKey)
  }

  const hasDayTracking = (dateKey: string): boolean => {
    return getTrackingForDate(dateKey).length > 0
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[640px] relative">
        {/* Header with days - Sticky positioning with higher z-index */}
        <div className="sticky top-0 z-50 bg-background border-b border-border shadow-md">
          <div className="flex">
            <div className="w-12 flex-shrink-0 border-r border-border bg-muted sticky left-0 z-[60]" />
            {weekDays.map((day) => {
              const dateKey = formatDateKey(day)
              const isConfirmed = isDayConfirmed(dateKey)
              const hasTracking = hasDayTracking(dateKey)
              const needsReview = state.reviewMode && hasTracking && !isConfirmed

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex-1 min-w-0 py-1 px-1 text-center border-r border-border last:border-r-0 relative",
                    isConfirmed && "bg-green-50 dark:bg-green-950/20",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground font-medium">{format(day, "EEE")}</div>
                  <div className="text-xs font-semibold">{format(day, "d")}</div>
                  {state.reviewMode && (
                    <div className="absolute top-0.5 right-0.5">
                      {isConfirmed ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : needsReview ? (
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
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
                const trackingRecords = getTrackingForDate(dateKey)
                const isConfirmed = isDayConfirmed(dateKey)

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    ref={(el) => {
                      if (hourIndex === 0) {
                        dayColumnRefs.current[dateKey] = el
                      }
                    }}
                    className={cn(
                      "flex-1 min-w-0 h-[40px] border-r border-border last:border-r-0 relative cursor-pointer transition-colors",
                      isArmed && "hover:bg-accent/50",
                      isConfirmed && "bg-green-50/50 dark:bg-green-950/10",
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
                        const zIndex = getChronologicalZIndex(instance, Object.values(state.instances))

                        return (
                          <div
                            key={instance.id}
                            className={cn(
                              "absolute inset-x-0 border-l-2 px-1 overflow-hidden",
                              colors.bg,
                              colors.border,
                              colors.text,
                              isEditing && "ring-2 ring-ring",
                            )}
                            style={{
                              top: `${display.topOffset}px`,
                              height: `${display.height}px`,
                              zIndex: zIndex,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!state.reviewMode) {
                                dispatch({ type: "START_EDIT_INSTANCE", id: instance.id })
                              }
                            }}
                          >
                            <div className="text-xs font-medium truncate">{instance.name}</div>
                            <div className="text-xs opacity-75">
                              {instance.startTime} ({formatDuration(instance.duration)})
                            </div>

                            {isEditing && !state.reviewMode && (
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

                        const zIndex = getChronologicalZIndex(instance, Object.values(state.instances))

                        return (
                          <div
                            key={`${instance.id}-continuation`}
                            className={cn(
                              "absolute inset-x-0 border-l-2 px-1 overflow-hidden opacity-75",
                              colors.bg,
                              colors.border,
                              colors.text,
                            )}
                            style={{
                              top: 0,
                              height: `${display.nextDayHeight}px`,
                              zIndex: zIndex,
                            }}
                          >
                            <div className="text-xs font-medium truncate">{instance.name} (cont.)</div>
                          </div>
                        )
                      })}

                    {state.reviewMode &&
                      hourIndex === 0 &&
                      trackingRecords.map((tracking: TrackingRecord) => {
                        const display = calculateShiftDisplay(tracking.startTime, tracking.duration, dateKey)
                        const isEditing = state.editingTrackingId === tracking.id

                        return (
                          <div key={tracking.id} className="absolute left-2 right-auto w-1 z-[100]">
                            {/* Red tracking line */}
                            <div
                              className="absolute w-1 bg-red-500/70"
                              style={{
                                top: `${display.topOffset}px`,
                                height: `${display.height}px`,
                              }}
                            />

                            {!isEditing ? (
                              /* Read-only mode - show edit button */
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="absolute w-6 h-6 bg-background left-4 shadow-md"
                                  style={{
                                    top: `${display.topOffset + display.height / 2 - 12}px`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    dispatch({ type: "START_EDIT_TRACKING", id: tracking.id })
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>

                                {!isConfirmed && (
                                  <Button
                                    size="icon"
                                    variant="default"
                                    className="absolute w-6 h-6 bg-green-600 hover:bg-green-700 left-4"
                                    style={{
                                      top: `${display.topOffset + display.height + 4}px`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      dispatch({ type: "CONFIRM_DAY", date: dateKey })
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            ) : (
                              /* Edit mode - show large draggable zones */
                              <>
                                {/* Large draggable start zone with touch-action: none */}
                                <div
                                  className="absolute left-0 w-8 bg-red-600/20 border-2 border-red-600 rounded cursor-ns-resize hover:bg-red-600/40 transition-colors"
                                  style={{
                                    top: `${display.topOffset - 20}px`,
                                    height: "40px",
                                    touchAction: "none",
                                  }}
                                  onMouseDown={(e) => handleTrackingDragStart(e, tracking.id, "start", dateKey)}
                                  onTouchStart={(e) => handleTrackingDragStart(e, tracking.id, "start", dateKey)}
                                >
                                  <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                    </div>
                                  </div>
                                </div>

                                {/* Large draggable end zone with touch-action: none */}
                                <div
                                  className="absolute left-0 w-8 bg-red-600/20 border-2 border-red-600 rounded cursor-ns-resize hover:bg-red-600/40 transition-colors"
                                  style={{
                                    top: `${display.topOffset + display.height - 20}px`,
                                    height: "40px",
                                    touchAction: "none",
                                  }}
                                  onMouseDown={(e) => handleTrackingDragStart(e, tracking.id, "end", dateKey)}
                                  onTouchStart={(e) => handleTrackingDragStart(e, tracking.id, "end", dateKey)}
                                >
                                  <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                      <div className="h-0.5 w-4 bg-red-600 rounded" />
                                    </div>
                                  </div>
                                </div>

                                {/* Action buttons in edit mode */}
                                <div
                                  className="absolute left-4 flex gap-1"
                                  style={{
                                    top: `${display.topOffset + display.height + 4}px`,
                                  }}
                                >
                                  {!isConfirmed && (
                                    <Button
                                      size="icon"
                                      variant="default"
                                      className="w-6 h-6 bg-green-600 hover:bg-green-700"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        dispatch({ type: "CONFIRM_DAY", date: dateKey })
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="w-6 h-6 bg-background"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      dispatch({ type: "CANCEL_EDIT_TRACKING" })
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
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
