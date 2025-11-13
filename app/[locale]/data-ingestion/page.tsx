"use client"

import { CalendarProvider } from "@/components/calendar-context"
import { CalendarHeader } from "@/components/calendar-header"
import { WeekView } from "@/components/week-view"
import { MonthView } from "@/components/month-view"
import { ShiftTemplatePanel } from "@/components/shift-template-panel"
import { useCalendar } from "@/components/calendar-context"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

function CalendarContent() {
  const { state, dispatch } = useCalendar()
  const t = useTranslations('dataIngestion')

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 pt-8 pb-6 border-b border-slate-200/60 bg-white">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-medium">{t('label')}</p>
          <h1 className="text-4xl font-light text-slate-900">{t('title')}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CalendarHeader />

        <div className="relative h-[calc(100%-4rem)]">
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
    </div>
  )
}

export default function DataIngestionPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  )
}
