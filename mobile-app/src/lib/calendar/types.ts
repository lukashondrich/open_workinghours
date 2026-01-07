export type ShiftColor = "teal" | "blue" | "green" | "amber" | "rose" | "purple" | "cyan"

// Absence types
export type AbsenceType = 'vacation' | 'sick'

export interface AbsenceTemplate {
  id: string
  type: AbsenceType
  name: string
  color: string           // hex color for muted background
  startTime: string | null  // HH:mm or null for full-day
  endTime: string | null    // HH:mm or null for full-day
  isFullDay: boolean
  createdAt: string
  updatedAt: string
}

export interface AbsenceInstance {
  id: string
  templateId: string | null  // null for one-off sick days
  type: AbsenceType
  date: string              // YYYY-MM-DD
  startTime: string         // HH:mm
  endTime: string           // HH:mm
  isFullDay: boolean
  name: string              // copied from template or "Sick Day"
  color: string             // copied from template
  createdAt: string
  updatedAt: string
}

export interface ShiftTemplate {
  id: string
  name: string
  duration: number // minutes
  startTime: string // HH:mm
  color: ShiftColor
  breakMinutes?: number // minutes - default 0
}

export interface ShiftInstance {
  id: string
  templateId: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  duration: number // minutes
  endTime: string // HH:mm
  color: ShiftColor
  name: string
}

export interface TrackingRecord {
  id: string
  date: string
  startTime: string
  duration: number
  isActive?: boolean
  breakMinutes?: number // minutes - default 0
}

export type ConfirmedDayStatus = {
  status: 'pending' | 'confirmed' | 'locked'
  confirmedAt?: string | null
  lockedSubmissionId?: string | null
}

export type AppMode = "viewing" | "template-editing" | "shift-armed" | "instance-editing" | "absence-armed"
export type CalendarView = "week" | "month"

export interface CalendarState {
  mode: AppMode
  view: CalendarView
  templates: Record<string, ShiftTemplate>
  instances: Record<string, ShiftInstance>
  armedTemplateId: string | null
  editingTemplateId: string | null
  editingInstanceId: string | null
  currentWeekStart: Date
  currentMonth: Date
  templatePanelOpen: boolean
  reviewMode: boolean
  trackingRecords: Record<string, TrackingRecord>
  confirmedDates: Set<string>
  confirmedDayStatus: Record<string, ConfirmedDayStatus>
  editingTrackingId: string | null
  // Absence state
  absenceTemplates: Record<string, AbsenceTemplate>
  absenceInstances: Record<string, AbsenceInstance>
  editingAbsenceId: string | null
  templatePanelTab: 'shifts' | 'absences'
  armedAbsenceTemplateId: string | null
}

export type CalendarAction =
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_VIEW"; view: CalendarView }
  | { type: "ADD_TEMPLATE"; template: ShiftTemplate }
  | { type: "UPDATE_TEMPLATE"; id: string; template: Partial<ShiftTemplate> }
  | { type: "DELETE_TEMPLATE"; id: string }
  | { type: "ARM_SHIFT"; templateId: string }
  | { type: "DISARM_SHIFT" }
  | { type: "PLACE_SHIFT"; date: string; timeSlot?: string }
  | { type: "ADD_INSTANCE"; instance: ShiftInstance }
  | { type: "UPDATE_INSTANCE"; id: string; instance: Partial<ShiftInstance> }
  | { type: "UPDATE_INSTANCE_START_TIME"; id: string; startTime: string }
  | { type: "DELETE_INSTANCE"; id: string }
  | { type: "START_EDIT_TEMPLATE"; id: string }
  | { type: "START_EDIT_INSTANCE"; id: string }
  | { type: "STOP_EDITING" }
  | { type: "DELETE_INSTANCE"; id: string }
  | { type: "MOVE_INSTANCE_UP"; id: string }
  | { type: "MOVE_INSTANCE_DOWN"; id: string }
  | { type: "SET_WEEK"; date: Date }
  | { type: "PREV_WEEK" }
  | { type: "NEXT_WEEK" }
  | { type: "SET_MONTH"; date: Date }
  | { type: "TOGGLE_TEMPLATE_PANEL" }
  | { type: "TOGGLE_REVIEW_MODE"; trackingRecords?: Record<string, TrackingRecord> }
  | { type: "UPDATE_TRACKING_RECORDS"; trackingRecords: Record<string, TrackingRecord> }
  | { type: "UPDATE_TRACKING_START"; id: string; startTime: string }
  | { type: "UPDATE_TRACKING_END"; id: string; endTime: string }
  | { type: "UPDATE_TRACKING_BREAK"; id: string; breakMinutes: number }
  | { type: "CONFIRM_DAY"; date: string; confirmedAt?: string }
  | { type: "START_EDIT_TRACKING"; id: string }
  | { type: "CANCEL_EDIT_TRACKING" }
  | { type: "DELETE_TRACKING_RECORD"; id: string }
  | { type: "LOCK_CONFIRMED_DAYS"; dates: string[]; submissionId: string }
  | { type: "UNLOCK_CONFIRMED_DAYS"; dates: string[] }
  // Absence actions
  | { type: "SET_TEMPLATE_PANEL_TAB"; tab: 'shifts' | 'absences' }
  | { type: "LOAD_ABSENCE_TEMPLATES"; templates: AbsenceTemplate[] }
  | { type: "ADD_ABSENCE_TEMPLATE"; template: AbsenceTemplate }
  | { type: "UPDATE_ABSENCE_TEMPLATE"; id: string; updates: Partial<AbsenceTemplate> }
  | { type: "DELETE_ABSENCE_TEMPLATE"; id: string }
  | { type: "LOAD_ABSENCE_INSTANCES"; instances: AbsenceInstance[] }
  | { type: "ADD_ABSENCE_INSTANCE"; instance: AbsenceInstance }
  | { type: "UPDATE_ABSENCE_INSTANCE"; id: string; updates: Partial<AbsenceInstance> }
  | { type: "DELETE_ABSENCE_INSTANCE"; id: string }
  | { type: "START_EDIT_ABSENCE"; id: string }
  | { type: "CANCEL_EDIT_ABSENCE" }
  | { type: "ARM_ABSENCE"; templateId: string }
  | { type: "DISARM_ABSENCE" }
  | {
      type: "HYDRATE_STATE"
      payload: {
        templates: Record<string, ShiftTemplate>
        instances: Record<string, ShiftInstance>
        trackingRecords: Record<string, TrackingRecord>
        confirmedDayStatus?: Record<string, ConfirmedDayStatus>
        absenceTemplates?: Record<string, AbsenceTemplate>
        absenceInstances?: Record<string, AbsenceInstance>
      }
    }
