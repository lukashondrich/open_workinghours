export type ShiftColor = "blue" | "green" | "amber" | "rose" | "purple" | "cyan"

export interface ShiftTemplate {
  id: string
  name: string
  duration: number // in minutes
  startTime: string // HH:mm format
  color: ShiftColor
}

export interface ShiftInstance {
  id: string
  templateId: string
  date: string // YYYY-MM-DD format
  startTime: string // HH:mm format
  duration: number // in minutes
  color: ShiftColor
  name: string
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
}

export type CalendarAction =
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_VIEW"; view: CalendarView }
  | { type: "ADD_TEMPLATE"; template: ShiftTemplate }
  | { type: "UPDATE_TEMPLATE"; id: string; template: Partial<ShiftTemplate> }
  | { type: "DELETE_TEMPLATE"; id: string }
  | { type: "ARM_SHIFT"; templateId: string }
  | { type: "DISARM_SHIFT" }
  | { type: "PLACE_SHIFT"; date: string }
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
