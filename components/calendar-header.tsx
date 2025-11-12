"use client"

import { useCalendar } from "./calendar-context"
import { Button } from "./ui/button"
import { ChevronLeft, ChevronRight, Calendar, Grid3x3, MapPin } from "lucide-react"
import { addWeeks, subWeeks, addMonths, subMonths, format } from "date-fns"
import { cn } from "@/lib/utils"

export function CalendarHeader() {
  const { state, dispatch } = useCalendar()

  const handlePrevious = () => {
    if (state.view === "week") {
      dispatch({ type: "SET_WEEK", date: subWeeks(state.currentWeekStart, 1) })
    } else {
      dispatch({ type: "SET_MONTH", date: subMonths(state.currentMonth, 1) })
    }
  }

  const handleNext = () => {
    if (state.view === "week") {
      dispatch({ type: "SET_WEEK", date: addWeeks(state.currentWeekStart, 1) })
    } else {
      dispatch({ type: "SET_MONTH", date: addMonths(state.currentMonth, 1) })
    }
  }

  const handleToday = () => {
    const today = new Date()
    if (state.view === "week") {
      dispatch({ type: "SET_WEEK", date: today })
    } else {
      dispatch({ type: "SET_MONTH", date: today })
    }
  }

  const toggleView = () => {
    dispatch({ type: "SET_VIEW", view: state.view === "week" ? "month" : "week" })
  }

  const toggleReviewMode = () => {
    dispatch({ type: "TOGGLE_REVIEW_MODE" })
  }

  const currentDate = state.view === "week" ? state.currentWeekStart : state.currentMonth

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleToday}>
            Today
          </Button>
          <div className="ml-2 font-semibold">
            {state.view === "week" ? format(currentDate, "MMM d, yyyy") : format(currentDate, "MMMM yyyy")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={state.reviewMode ? "default" : "outline"}
            onClick={toggleReviewMode}
            className={cn(state.reviewMode && "bg-orange-500 hover:bg-orange-600")}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {state.reviewMode ? "Exit Review" : "Review"}
          </Button>

          <Button size="sm" variant="outline" onClick={toggleView}>
            {state.view === "week" ? (
              <>
                <Grid3x3 className="h-4 w-4 mr-2" />
                Month
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Week
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
