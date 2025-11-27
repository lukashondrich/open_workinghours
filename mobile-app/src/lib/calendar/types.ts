export type ShiftColor = "blue" | "green" | "amber" | "rose" | "purple" | "cyan"

export interface ShiftTemplate {
  id: string
  name: string
  duration: number // minutes
  startTime: string // HH:mm
  color: ShiftColor
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
}

export type AppMode = "viewing" | "template-editing" | "shift-armed" | "instance-editing"
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
  editingTrackingId: string | null
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
  | { type: "DELETE_INSTANCE"; id: string }
  | { type: "START_EDIT_TEMPLATE"; id: string }
  | { type: "START_EDIT_INSTANCE"; id: string }
  | { type: "STOP_EDITING" }
  | { type: "MOVE_INSTANCE_UP"; id: string }
  | { type: "MOVE_INSTANCE_DOWN"; id: string }
  | { type: "SET_WEEK"; date: Date }
  | { type: "SET_MONTH"; date: Date }
  | { type: "TOGGLE_TEMPLATE_PANEL" }
  | { type: "TOGGLE_REVIEW_MODE" }
  | { type: "UPDATE_TRACKING_START"; id: string; startTime: string }
  | { type: "UPDATE_TRACKING_END"; id: string; endTime: string }
  | { type: "CONFIRM_DAY"; date: string }
  | { type: "START_EDIT_TRACKING"; id: string }
  | { type: "CANCEL_EDIT_TRACKING" }
  | {
      type: "HYDRATE_STATE"
      payload: {
        templates: Record<string, ShiftTemplate>
        instances: Record<string, ShiftInstance>
        trackingRecords: Record<string, TrackingRecord>
      }
    }
