"use client"

import { CalendarProvider } from "@/components/calendar-context"
import { CalendarHeader } from "@/components/calendar-header"
import { WeekView } from "@/components/week-view"
import { MonthView } from "@/components/month-view"
import { ShiftTemplatePanel } from "@/components/shift-template-panel"
import { useCalendar } from "@/components/calendar-context"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

function CalendarContent() {
  const { state, dispatch } = useCalendar()

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <CalendarHeader />

      <div className="flex-1 relative">
        {state.view === "week" ? <WeekView /> : <MonthView />}

        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40 md:bottom-6 md:right-[25rem]"
          onClick={() => dispatch({ type: "TOGGLE_TEMPLATE_PANEL" })}
        >
          <Plus className="h-6 w-6" />
        </Button>

        <ShiftTemplatePanel />
      </div>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  )
}

