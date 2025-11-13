import type { CalendarState, CalendarAction, ShiftInstance } from "./types"
import { generateSimulatedTracking } from "./calendar-utils"

function computeEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(":").map(Number)
  const startMinutes = hours * 60 + minutes
  const totalMinutes = (startMinutes + Math.max(0, duration)) % (24 * 60)
  const endHours = Math.floor(totalMinutes / 60)
  const endMinutes = totalMinutes % 60
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
}

export const initialState: CalendarState = {
  mode: "viewing",
  view: "week",
  templates: {},
  instances: {},
  armedTemplateId: null,
  editingTemplateId: null,
  editingInstanceId: null,
  currentWeekStart: new Date(),
  currentMonth: new Date(),
  templatePanelOpen: false,
  reviewMode: false,
  trackingRecords: {},
  confirmedDates: new Set(),
  editingTrackingId: null,
}

export function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode }

    case "SET_VIEW":
      return { ...state, view: action.view }

    case "ADD_TEMPLATE":
      return {
        ...state,
        templates: {
          ...state.templates,
          [action.template.id]: action.template,
        },
      }

    case "UPDATE_TEMPLATE":
      return {
        ...state,
        templates: {
          ...state.templates,
          [action.id]: {
            ...state.templates[action.id],
            ...action.template,
          },
        },
      }

    case "DELETE_TEMPLATE": {
      const remainingTemplates = { ...state.templates }
      delete remainingTemplates[action.id]
      return {
        ...state,
        templates: remainingTemplates,
      }
    }

    case "ARM_SHIFT":
      return {
        ...state,
        mode: "shift-armed",
        armedTemplateId: action.templateId,
      }

    case "DISARM_SHIFT":
      return {
        ...state,
        mode: "viewing",
        armedTemplateId: null,
      }

    case "ADD_INSTANCE": {
      const ensuredEndTime =
        action.instance.endTime ?? computeEndTime(action.instance.startTime, action.instance.duration)
      const nextInstance: ShiftInstance = { ...action.instance, endTime: ensuredEndTime }
      return {
        ...state,
        instances: {
          ...state.instances,
          [action.instance.id]: nextInstance,
        },
      }
    }

    case "PLACE_SHIFT":
      if (!state.armedTemplateId) return state

      const template = state.templates[state.armedTemplateId]
      if (!template) return state

      const startTime = action.timeSlot ?? template.startTime
      const duration = template.duration

      const newInstance: ShiftInstance = {
        id: `instance-${Date.now()}-${Math.random()}`,
        templateId: template.id,
        date: action.date,
        startTime,
        duration,
        endTime: computeEndTime(startTime, duration),
        color: template.color,
        name: template.name,
      }

      return {
        ...state,
        instances: {
          ...state.instances,
          [newInstance.id]: newInstance,
        },
      }

    case "UPDATE_INSTANCE": {
      const existing = state.instances[action.id]
      if (!existing) {
        return state
      }
      const merged = { ...existing, ...action.instance }
      if (action.instance.startTime !== undefined || action.instance.duration !== undefined) {
        merged.endTime = computeEndTime(merged.startTime, merged.duration)
      }
      return {
        ...state,
        instances: {
          ...state.instances,
          [action.id]: merged,
        },
      }
    }

    case "DELETE_INSTANCE": {
      const remainingInstances = { ...state.instances }
      delete remainingInstances[action.id]
      return {
        ...state,
        instances: remainingInstances,
        mode: "viewing",
        editingInstanceId: null,
      }
    }

    case "START_EDIT_TEMPLATE":
      return {
        ...state,
        mode: "template-editing",
        editingTemplateId: action.id,
      }

    case "START_EDIT_INSTANCE":
      return {
        ...state,
        mode: "instance-editing",
        editingInstanceId: action.id,
      }

    case "STOP_EDITING":
      return {
        ...state,
        mode: "viewing",
        editingTemplateId: null,
        editingInstanceId: null,
      }

    case "MOVE_INSTANCE_UP": {
      const instance = state.instances[action.id]
      if (!instance) return state

      const [hours, minutes] = instance.startTime.split(":").map(Number)
      const totalMinutes = hours * 60 + minutes
      const newTotalMinutes = Math.max(0, totalMinutes - 5)
      const newHours = Math.floor(newTotalMinutes / 60)
      const newMinutes = newTotalMinutes % 60
      const newStartTime = `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`

      return {
        ...state,
        instances: {
          ...state.instances,
          [action.id]: {
            ...instance,
            startTime: newStartTime,
            endTime: computeEndTime(newStartTime, instance.duration),
          },
        },
      }
    }

    case "MOVE_INSTANCE_DOWN": {
      const instance = state.instances[action.id]
      if (!instance) return state

      const [hours, minutes] = instance.startTime.split(":").map(Number)
      const totalMinutes = hours * 60 + minutes
      const newTotalMinutes = totalMinutes + 5
      const newHours = Math.floor(newTotalMinutes / 60) % 24
      const newMinutes = newTotalMinutes % 60
      const newStartTime = `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`

      return {
        ...state,
        instances: {
          ...state.instances,
          [action.id]: {
            ...instance,
            startTime: newStartTime,
            endTime: computeEndTime(newStartTime, instance.duration),
          },
        },
      }
    }

    case "SET_WEEK":
      return {
        ...state,
        currentWeekStart: action.date,
      }

    case "SET_MONTH":
      return {
        ...state,
        currentMonth: action.date,
      }

    case "TOGGLE_TEMPLATE_PANEL":
      return {
        ...state,
        templatePanelOpen: !state.templatePanelOpen,
      }

    case "TOGGLE_REVIEW_MODE": {
      if (!state.reviewMode) {
        // Entering review mode - generate simulated tracking data
        const trackingRecords = generateSimulatedTracking(state.instances)
        return {
          ...state,
          reviewMode: true,
          trackingRecords,
          mode: "viewing",
          armedTemplateId: null,
        }
      } else {
        // Exiting review mode
        return {
          ...state,
          reviewMode: false,
        }
      }
    }

    case "UPDATE_TRACKING_START": {
      const record = state.trackingRecords[action.id]
      if (!record) return state

      const [oldHours, oldMinutes] = record.startTime.split(":").map(Number)
      const [newHours, newMinutes] = action.startTime.split(":").map(Number)

      const oldStartMinutes = oldHours * 60 + oldMinutes
      const newStartMinutes = newHours * 60 + newMinutes
      const timeDiff = newStartMinutes - oldStartMinutes

      return {
        ...state,
        trackingRecords: {
          ...state.trackingRecords,
          [action.id]: {
            ...record,
            startTime: action.startTime,
            duration: record.duration - timeDiff,
          },
        },
      }
    }

    case "UPDATE_TRACKING_END": {
      const record = state.trackingRecords[action.id]
      if (!record) return state

      const [startHours, startMinutes] = record.startTime.split(":").map(Number)
      const [endHours, endMinutes] = action.endTime.split(":").map(Number)

      const startTotalMinutes = startHours * 60 + startMinutes
      const endTotalMinutes = endHours * 60 + endMinutes
      const newDuration = endTotalMinutes - startTotalMinutes

      return {
        ...state,
        trackingRecords: {
          ...state.trackingRecords,
          [action.id]: {
            ...record,
            duration: Math.max(5, newDuration),
          },
        },
      }
    }

    case "CONFIRM_DAY": {
      const newConfirmedDates = new Set(state.confirmedDates)
      newConfirmedDates.add(action.date)
      return {
        ...state,
        confirmedDates: newConfirmedDates,
        editingTrackingId: null,
      }
    }

    case "START_EDIT_TRACKING":
      return {
        ...state,
        editingTrackingId: action.id,
      }

    case "CANCEL_EDIT_TRACKING":
      return {
        ...state,
        editingTrackingId: null,
      }

    default:
      return state
  }
}
