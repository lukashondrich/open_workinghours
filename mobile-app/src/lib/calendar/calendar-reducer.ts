import { addWeeks, subWeeks, format } from 'date-fns';
import type { CalendarState, CalendarAction, ShiftInstance, ConfirmedDayStatus, AbsenceTemplate, AbsenceInstance } from './types';
import { generateSimulatedTracking } from './calendar-utils';

function computeEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const totalMinutes = (startMinutes + Math.max(0, duration)) % (24 * 60);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

function deriveConfirmedSet(statusMap: Record<string, ConfirmedDayStatus>): Set<string> {
  return new Set(
    Object.entries(statusMap)
      .filter(([, meta]) => meta.status === 'confirmed' || meta.status === 'locked')
      .map(([date]) => date),
  );
}

export const initialState: CalendarState = {
  mode: 'viewing',
  view: 'week',
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
  confirmedDayStatus: {},
  editingTrackingId: null,
  // Absence state
  absenceTemplates: {},
  absenceInstances: {},
  editingAbsenceId: null,
  templatePanelTab: 'shifts',
  armedAbsenceTemplateId: null,
  // UI state
  hideFAB: false,
  // Last-used tracking for picker priority
  lastUsedTemplateId: null,
  lastUsedAbsenceTemplateId: null,
  // Manual session form state
  manualSessionFormOpen: false,
  manualSessionFormDate: null,
  // Inline picker state
  inlinePickerOpen: false,
  inlinePickerTargetDate: null,
  inlinePickerTab: 'shifts',
};

export function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'HYDRATE_STATE':
      return {
        ...state,
        templates: action.payload.templates,
        instances: action.payload.instances,
        trackingRecords: action.payload.trackingRecords,
        confirmedDayStatus: action.payload.confirmedDayStatus ?? state.confirmedDayStatus,
        confirmedDates: action.payload.confirmedDayStatus
          ? deriveConfirmedSet(action.payload.confirmedDayStatus)
          : state.confirmedDates,
        absenceTemplates: action.payload.absenceTemplates ?? state.absenceTemplates,
        absenceInstances: action.payload.absenceInstances ?? state.absenceInstances,
      };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'ADD_TEMPLATE':
      return {
        ...state,
        templates: { ...state.templates, [action.template.id]: action.template },
      };
    case 'UPDATE_TEMPLATE': {
      const oldTemplate = state.templates[action.id];
      if (!oldTemplate) return state;

      const updatedTemplate = { ...oldTemplate, ...action.template };
      const today = format(new Date(), 'yyyy-MM-dd');

      // Propagate changes to all future instances of this template
      const updatedInstances = { ...state.instances };
      for (const [instanceId, instance] of Object.entries(updatedInstances)) {
        if (instance.templateId !== action.id) continue;
        if (instance.date <= today) continue; // Skip past/today instances

        // Update instance with new template values
        updatedInstances[instanceId] = {
          ...instance,
          name: updatedTemplate.name,
          startTime: updatedTemplate.startTime,
          duration: updatedTemplate.duration,
          endTime: computeEndTime(updatedTemplate.startTime, updatedTemplate.duration),
          color: updatedTemplate.color,
        };
      }

      return {
        ...state,
        templates: { ...state.templates, [action.id]: updatedTemplate },
        instances: updatedInstances,
      };
    }
    case 'DELETE_TEMPLATE': {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Remove template
      const remainingTemplates = { ...state.templates };
      delete remainingTemplates[action.id];

      // Remove future instances, keep past ones (they become orphaned)
      const remainingInstances = { ...state.instances };
      for (const [instanceId, instance] of Object.entries(remainingInstances)) {
        if (instance.templateId === action.id && instance.date > today) {
          delete remainingInstances[instanceId];
        }
      }

      // Disarm if this template was armed
      const armedTemplateId = state.armedTemplateId === action.id ? null : state.armedTemplateId;

      return {
        ...state,
        templates: remainingTemplates,
        instances: remainingInstances,
        armedTemplateId,
      };
    }
    case 'ARM_SHIFT':
      return { ...state, mode: 'shift-armed', armedTemplateId: action.templateId };
    case 'DISARM_SHIFT':
      return { ...state, mode: 'viewing', armedTemplateId: null };
    case 'ADD_INSTANCE': {
      const ensuredEndTime =
        action.instance.endTime ?? computeEndTime(action.instance.startTime, action.instance.duration);
      const nextInstance: ShiftInstance = { ...action.instance, endTime: ensuredEndTime };
      return {
        ...state,
        instances: { ...state.instances, [action.instance.id]: nextInstance },
      };
    }
    case 'PLACE_SHIFT': {
      if (!state.armedTemplateId) return state;
      const template = state.templates[state.armedTemplateId];
      if (!template) return state;
      const startTime = action.timeSlot ?? template.startTime;
      const duration = template.duration;
      const newInstance: ShiftInstance = {
        id: `instance-${Date.now()}-${Math.random()}`,
        templateId: template.id,
        date: action.date,
        startTime,
        duration,
        endTime: computeEndTime(startTime, duration),
        color: template.color,
        name: template.name,
      };
      return {
        ...state,
        instances: { ...state.instances, [newInstance.id]: newInstance },
      };
    }
    case 'UPDATE_INSTANCE': {
      const existing = state.instances[action.id];
      if (!existing) return state;
      const merged = { ...existing, ...action.instance };
      if (action.instance.startTime !== undefined || action.instance.duration !== undefined) {
        merged.endTime = computeEndTime(merged.startTime, merged.duration);
      }
      return { ...state, instances: { ...state.instances, [action.id]: merged } };
    }
    case 'UPDATE_INSTANCE_START_TIME': {
      const instance = state.instances[action.id];
      if (!instance) return state;
      const updatedInstance = {
        ...instance,
        startTime: action.startTime,
        endTime: computeEndTime(action.startTime, instance.duration),
      };
      return {
        ...state,
        instances: { ...state.instances, [action.id]: updatedInstance },
      };
    }
    case 'DELETE_INSTANCE': {
      const remaining = { ...state.instances };
      delete remaining[action.id];
      return { ...state, instances: remaining, mode: 'viewing', editingInstanceId: null };
    }
    case 'START_EDIT_TEMPLATE':
      return { ...state, mode: 'template-editing', editingTemplateId: action.id };
    case 'START_EDIT_INSTANCE':
      return { ...state, mode: 'instance-editing', editingInstanceId: action.id };
    case 'STOP_EDITING':
      return { ...state, mode: 'viewing', editingTemplateId: null, editingInstanceId: null };
    case 'MOVE_INSTANCE_UP': {
      const instance = state.instances[action.id];
      if (!instance) return state;
      const [hours, minutes] = instance.startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes;
      const newTotalMinutes = Math.max(0, totalMinutes - 5);
      const newHours = Math.floor(newTotalMinutes / 60);
      const newMinutes = newTotalMinutes % 60;
      const newStartTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
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
      };
    }
    case 'MOVE_INSTANCE_DOWN': {
      const instance = state.instances[action.id];
      if (!instance) return state;
      const [hours, minutes] = instance.startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes;
      const newTotalMinutes = totalMinutes + 5;
      const newHours = Math.floor(newTotalMinutes / 60) % 24;
      const newMinutes = newTotalMinutes % 60;
      const newStartTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
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
      };
    }
    case 'SET_WEEK':
      return { ...state, currentWeekStart: action.date };
    case 'PREV_WEEK':
      return { ...state, currentWeekStart: subWeeks(state.currentWeekStart, 1) };
    case 'NEXT_WEEK':
      return { ...state, currentWeekStart: addWeeks(state.currentWeekStart, 1) };
    case 'SET_MONTH':
      return { ...state, currentMonth: action.date };
    case 'TOGGLE_TEMPLATE_PANEL':
      return { ...state, templatePanelOpen: !state.templatePanelOpen };
    case 'TOGGLE_REVIEW_MODE': {
      if (!state.reviewMode) {
        // Use provided tracking records (real data), or fall back to simulated
        const trackingRecords = action.trackingRecords ?? generateSimulatedTracking(state.instances);
        return {
          ...state,
          reviewMode: true,
          trackingRecords,
          mode: 'viewing',
          armedTemplateId: null,
        };
      }
      return { ...state, reviewMode: false };
    }
    case 'UPDATE_TRACKING_START': {
      const record = state.trackingRecords[action.id];
      if (!record) return state;
      const [oldHours, oldMinutes] = record.startTime.split(':').map(Number);
      const [newHours, newMinutes] = action.startTime.split(':').map(Number);
      const oldStartMinutes = oldHours * 60 + oldMinutes;
      const newStartMinutes = newHours * 60 + newMinutes;
      const timeDiff = newStartMinutes - oldStartMinutes;
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
      };
    }
    case 'UPDATE_TRACKING_END': {
      const record = state.trackingRecords[action.id];
      if (!record) return state;
      // Directly use the new duration (supports multi-day sessions)
      return {
        ...state,
        trackingRecords: {
          ...state.trackingRecords,
          [action.id]: {
            ...record,
            duration: Math.max(5, action.newDuration),
          },
        },
      };
    }
    case 'UPDATE_TRACKING_BREAK': {
      const record = state.trackingRecords[action.id];
      if (!record) return state;
      return {
        ...state,
        trackingRecords: {
          ...state.trackingRecords,
          [action.id]: {
            ...record,
            breakMinutes: action.breakMinutes,
          },
        },
      };
    }
    case 'CONFIRM_DAY': {
      const confirmedAt = action.confirmedAt ?? new Date().toISOString();
      const updatedStatus: Record<string, ConfirmedDayStatus> = {
        ...state.confirmedDayStatus,
        [action.date]: {
          ...(state.confirmedDayStatus[action.date] ?? { status: 'pending' }),
          status: 'confirmed',
          confirmedAt,
        },
      };
      return {
        ...state,
        confirmedDates: deriveConfirmedSet(updatedStatus),
        confirmedDayStatus: updatedStatus,
        editingTrackingId: null,
      };
    }
    case 'START_EDIT_TRACKING':
      return { ...state, editingTrackingId: action.id };
    case 'CANCEL_EDIT_TRACKING':
      return { ...state, editingTrackingId: null };
    case 'LOCK_CONFIRMED_DAYS': {
      const nextStatus: Record<string, ConfirmedDayStatus> = { ...state.confirmedDayStatus };
      action.dates.forEach((date) => {
        const existing = nextStatus[date] ?? { status: 'pending' };
        nextStatus[date] = {
          ...existing,
          status: 'locked',
          lockedSubmissionId: action.submissionId,
        };
      });
      return {
        ...state,
        confirmedDayStatus: nextStatus,
        confirmedDates: deriveConfirmedSet(nextStatus),
      };
    }
    case 'UNLOCK_CONFIRMED_DAYS': {
      const nextStatus: Record<string, ConfirmedDayStatus> = { ...state.confirmedDayStatus };
      action.dates.forEach((date) => {
        const existing = nextStatus[date];
        if (!existing) return;
        nextStatus[date] = {
          ...existing,
          status: 'confirmed',
          lockedSubmissionId: null,
        };
      });
      return {
        ...state,
        confirmedDayStatus: nextStatus,
        confirmedDates: deriveConfirmedSet(nextStatus),
      };
    }
    case 'DELETE_TRACKING_RECORD': {
      const remaining = { ...state.trackingRecords };
      delete remaining[action.id];
      return {
        ...state,
        trackingRecords: remaining,
        editingTrackingId: state.editingTrackingId === action.id ? null : state.editingTrackingId,
      };
    }
    case 'UPDATE_TRACKING_RECORDS':
      return {
        ...state,
        trackingRecords: action.trackingRecords,
      };

    // ========================================
    // Absence Actions
    // ========================================

    case 'SET_TEMPLATE_PANEL_TAB':
      return { ...state, templatePanelTab: action.tab };

    case 'LOAD_ABSENCE_TEMPLATES': {
      const templatesRecord: Record<string, AbsenceTemplate> = {};
      action.templates.forEach((t) => {
        templatesRecord[t.id] = t;
      });
      return { ...state, absenceTemplates: templatesRecord };
    }

    case 'ADD_ABSENCE_TEMPLATE':
      return {
        ...state,
        absenceTemplates: {
          ...state.absenceTemplates,
          [action.template.id]: action.template,
        },
      };

    case 'UPDATE_ABSENCE_TEMPLATE': {
      const existing = state.absenceTemplates[action.id];
      if (!existing) return state;
      return {
        ...state,
        absenceTemplates: {
          ...state.absenceTemplates,
          [action.id]: { ...existing, ...action.updates },
        },
      };
    }

    case 'DELETE_ABSENCE_TEMPLATE': {
      const remaining = { ...state.absenceTemplates };
      delete remaining[action.id];
      return { ...state, absenceTemplates: remaining };
    }

    case 'LOAD_ABSENCE_INSTANCES': {
      const instancesRecord: Record<string, AbsenceInstance> = {};
      action.instances.forEach((i) => {
        instancesRecord[i.id] = i;
      });
      return { ...state, absenceInstances: instancesRecord };
    }

    case 'ADD_ABSENCE_INSTANCE':
      return {
        ...state,
        absenceInstances: {
          ...state.absenceInstances,
          [action.instance.id]: action.instance,
        },
      };

    case 'UPDATE_ABSENCE_INSTANCE': {
      const existing = state.absenceInstances[action.id];
      if (!existing) return state;
      return {
        ...state,
        absenceInstances: {
          ...state.absenceInstances,
          [action.id]: { ...existing, ...action.updates },
        },
      };
    }

    case 'DELETE_ABSENCE_INSTANCE': {
      const remaining = { ...state.absenceInstances };
      delete remaining[action.id];
      return {
        ...state,
        absenceInstances: remaining,
        editingAbsenceId: state.editingAbsenceId === action.id ? null : state.editingAbsenceId,
      };
    }

    case 'START_EDIT_ABSENCE':
      return { ...state, editingAbsenceId: action.id };

    case 'CANCEL_EDIT_ABSENCE':
      return { ...state, editingAbsenceId: null };

    case 'ARM_ABSENCE':
      return {
        ...state,
        armedAbsenceTemplateId: action.templateId,
        // Disarm any shift template
        armedTemplateId: null,
        mode: 'absence-armed',
      };

    case 'DISARM_ABSENCE':
      return { ...state, armedAbsenceTemplateId: null, mode: 'viewing' };

    case 'SET_HIDE_FAB':
      return { ...state, hideFAB: action.hide };

    case 'SET_LAST_USED_TEMPLATE':
      return { ...state, lastUsedTemplateId: action.templateId };

    case 'SET_LAST_USED_ABSENCE_TEMPLATE':
      return { ...state, lastUsedAbsenceTemplateId: action.templateId };

    // ========================================
    // Manual Session Form Actions
    // ========================================

    case 'OPEN_MANUAL_SESSION_FORM':
      return {
        ...state,
        manualSessionFormOpen: true,
        manualSessionFormDate: action.date ?? null,
      };

    case 'CLOSE_MANUAL_SESSION_FORM':
      return {
        ...state,
        manualSessionFormOpen: false,
        manualSessionFormDate: null,
      };

    // ========================================
    // Inline Picker Actions
    // ========================================

    case 'OPEN_INLINE_PICKER':
      return {
        ...state,
        inlinePickerOpen: true,
        inlinePickerTargetDate: action.targetDate ?? null,
        inlinePickerTab: action.tab ?? 'shifts',
        // Disarm any armed templates when opening picker (clean slate)
        armedTemplateId: null,
        armedAbsenceTemplateId: null,
        mode: 'viewing',
      };

    case 'CLOSE_INLINE_PICKER':
      return {
        ...state,
        inlinePickerOpen: false,
        inlinePickerTargetDate: null,
      };

    case 'SET_INLINE_PICKER_TAB':
      return {
        ...state,
        inlinePickerTab: action.tab,
      };

    default:
      return state;
  }
}
