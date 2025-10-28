"use client"

import type React from "react"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import type { CalendarState, CalendarAction } from "@/lib/types"
import { calendarReducer, initialState } from "@/lib/calendar-reducer"

const CalendarContext = createContext<{
  state: CalendarState
  dispatch: React.Dispatch<CalendarAction>
} | null>(null)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState)

  return <CalendarContext.Provider value={{ state, dispatch }}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider")
  }
  return context
}
