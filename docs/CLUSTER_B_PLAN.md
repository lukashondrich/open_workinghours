# Cluster B: Shift Instance Management

**Created:** 2026-01-06
**Status:** Planning
**Estimated Sessions:** 2

---

## Overview

Cluster B addresses shift management issues from user testing:
- Shifts can be duplicated on the same day (need overlap detection)
- Shifts should be deletable (already works, but UX needs simplification)
- Template edits should propagate to future instances
- Tap-to-add interaction improvements

---

## Design Decisions (Confirmed)

| Aspect | Decision |
|--------|----------|
| **Tap on empty space** | Place armed template at that day |
| **Double-tap on empty space** | Show template picker |
| **Tap on existing shift** | Show popup: "Edit Start Time", "Delete", "Cancel" |
| **Long-tap on shift** | Same as tap (shows popup) |
| **Edit shift instance** | Start time ONLY - duration/breaks/color come from template |
| **Edit template** | Propagates to ALL future instances |
| **Delete template** | Confirmation with count, removes template + future instances |
| **Orphaned past instances** | Keep name, render grey |
| **Overlapping shifts** | Blocked with error |

---

## Current State Analysis

### What Exists

| Feature | Status | Location |
|---------|--------|----------|
| Arm template → tap to place | ✅ Works | `WeekView.tsx:705`, `calendar-reducer.ts:91-110` |
| Long-press → Edit/Delete/Cancel | ✅ Works | `WeekView.tsx:852` |
| ShiftEditModal (inline editing) | ✅ Works | `ShiftEditModal.tsx` |
| Template editing | ✅ Works | `TemplatePanel.tsx` |
| Template deletion | ✅ Works | `calendar-reducer.ts` |
| Instance stores `templateId` | ✅ Works | `types.ts`, `CalendarStorage.ts` |

### What's Missing

| Feature | Status | Notes |
|---------|--------|-------|
| Overlap detection | ❌ Missing | Need utility + validation |
| Template propagation | ❌ Missing | Edit → update future instances |
| Orphaned instance styling | ❌ Missing | Grey color for deleted templates |
| Double-tap template picker | ❌ Missing | **Conflicts with zoom toggle** |
| Simplified instance popup | ⚠️ Needs change | Remove "Edit" option |

---

## Implementation Plan

### Phase 1: Simplify Instance Interaction

**Goal:** Tap on shift → Edit Start Time / Delete / Cancel (no full editing)

#### 1.1 Simplify instance popup to start-time-only editing

**File:** `WeekView.tsx` (~line 852)

Current:
```typescript
Alert.alert(t('calendar.week.shiftOptions'), instance.name, [
  { text: t('common.edit'), onPress: () => { /* open ShiftEditModal */ } },
  { text: t('common.delete'), style: 'destructive', onPress: showDeleteConfirm },
  { text: t('common.cancel'), style: 'cancel' },
]);
```

New:
```typescript
Alert.alert(
  instance.name,
  t('calendar.week.shiftOptionsPrompt'), // "What would you like to do?"
  [
    { text: t('calendar.week.editStartTime'), onPress: () => showStartTimePicker(instance) },
    { text: t('common.delete'), style: 'destructive', onPress: () => confirmDelete(instance) },
    { text: t('common.cancel'), style: 'cancel' },
  ]
);
```

#### 1.2 Add simple time picker for start time

**Options:**
- A) Use `@react-native-community/datetimepicker` (native picker)
- B) Simple TextInput with validation (HH:mm format)
- C) Custom wheel picker

**Recommendation:** Option A - native picker is familiar and accessible.

```typescript
const showStartTimePicker = (instance: ShiftInstance) => {
  setEditingStartTime(instance);
  setShowTimePicker(true);
};

const handleStartTimeChange = (event, selectedDate) => {
  if (event.type === 'set' && selectedDate && editingStartTime) {
    const newStartTime = format(selectedDate, 'HH:mm');

    // Check overlap with new time
    const overlap = findOverlappingShift(
      editingStartTime.date,
      newStartTime,
      editingStartTime.duration,
      state.instances,
      editingStartTime.id // exclude self
    );

    if (overlap) {
      Alert.alert(t('calendar.week.overlapTitle'), ...);
    } else {
      dispatch({
        type: 'UPDATE_INSTANCE_START_TIME',
        id: editingStartTime.id,
        startTime: newStartTime,
      });
    }
  }
  setShowTimePicker(false);
  setEditingStartTime(null);
};
```

#### 1.3 Add UPDATE_INSTANCE_START_TIME action

**File:** `calendar-reducer.ts`

```typescript
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
```

#### 1.4 Repurpose ShiftEditModal

**Options:**
- A) Delete `ShiftEditModal.tsx` entirely
- B) Keep but simplify to time-picker wrapper

**Recommendation:** Option A - use native picker inline, delete modal.

#### 1.5 Unify tap and long-tap behavior

Current:
- Tap: Selects instance (visual highlight)
- Long-tap: Shows Edit/Delete/Cancel

New:
- Tap: Shows Edit Start Time / Delete / Cancel popup
- Long-tap: Same as tap

---

### Phase 2: Overlap Detection

**Goal:** Prevent overlapping shifts on same day

#### 2.1 Add overlap utility

**File:** `calendar-utils.ts`

```typescript
/**
 * Check if a new shift would overlap with existing shifts on the same date
 * @returns Overlapping instance if found, null if no overlap
 */
export function findOverlappingShift(
  date: string,
  startTime: string,
  duration: number,
  instances: Record<string, ShiftInstance>,
  excludeId?: string // For editing existing shift
): ShiftInstance | null {
  const newStart = timeToMinutes(startTime);
  const newEnd = newStart + duration;

  for (const instance of Object.values(instances)) {
    if (instance.date !== date) continue;
    if (excludeId && instance.id === excludeId) continue;

    const existingStart = timeToMinutes(instance.startTime);
    const existingEnd = existingStart + instance.duration;

    // Check for any overlap
    if (newStart < existingEnd && newEnd > existingStart) {
      return instance;
    }
  }

  return null;
}
```

#### 2.2 Validate on PLACE_SHIFT

**File:** `WeekView.tsx` (in `handleHourPress`)

```typescript
const handleHourPress = (dateKey: string, timeSlot?: string) => {
  if (!state.armedTemplateId) return;

  const template = state.templates[state.armedTemplateId];
  const startTime = timeSlot ?? template.startTime;

  const overlap = findOverlappingShift(
    dateKey,
    startTime,
    template.duration,
    state.instances
  );

  if (overlap) {
    Alert.alert(
      t('calendar.week.overlapTitle'),      // "Shift Overlap"
      t('calendar.week.overlapMessage', { name: overlap.name }), // "Overlaps with [name]"
      [{ text: t('common.ok') }]
    );
    return;
  }

  dispatch({ type: 'PLACE_SHIFT', date: dateKey, timeSlot: startTime });
};
```

#### 2.3 Add translations

**Files:** `en.ts`, `de.ts`

```typescript
calendar: {
  week: {
    overlapTitle: 'Shift Overlap',
    overlapMessage: 'This shift would overlap with "{{name}}". Choose a different time.',
    // German:
    overlapTitle: 'Überschneidung',
    overlapMessage: 'Diese Schicht würde sich mit "{{name}}" überschneiden. Wähle eine andere Zeit.',
  }
}
```

---

### Phase 3: Tap-to-Add Improvements

**Goal:** Single tap places armed template, double-tap shows picker

#### 3.1 Design consideration: Double-tap conflict

**Problem:** Double-tap currently toggles zoom (line 607-627 in WeekView.tsx)

**Options:**
1. **Disable zoom toggle on empty hour cells** - double-tap there = picker
2. **Use different gesture** - e.g., long-press on empty space = picker
3. **Add floating "+" button** - always visible, opens picker
4. **Keep current behavior** - arm from TemplatePanel only

**Recommendation:** Option 2 - Long-press on empty space shows template picker
- Consistent with instance long-press (shows menu)
- Doesn't conflict with zoom
- Natural gesture for "more options"

#### 3.2 Long-press on empty hour cell

**File:** `WeekView.tsx`

Add long-press handler to hour cells:

```typescript
const handleHourLongPress = (dateKey: string) => {
  setShowTemplatePicker(true);
  setPendingPlacementDate(dateKey);
};
```

#### 3.3 Create TemplatePicker component

**File:** `TemplatePicker.tsx` (new)

Simple modal with colored list:

```typescript
interface TemplatePickerProps {
  visible: boolean;
  templates: ShiftTemplate[];
  onSelect: (templateId: string) => void;
  onCancel: () => void;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({
  visible, templates, onSelect, onCancel
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>{t('calendar.templates.selectTemplate')}</Text>

          {templates.map(template => (
            <Pressable
              key={template.id}
              style={styles.templateRow}
              onPress={() => onSelect(template.id)}
            >
              <View style={[styles.colorDot, { backgroundColor: colorMap[template.color] }]} />
              <Text style={styles.templateName}>{template.name}</Text>
            </Pressable>
          ))}

          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    minWidth: 250,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  templateName: {
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
});
```

#### 3.4 Handle template selection

```typescript
const handleTemplateSelected = (templateId: string) => {
  if (pendingPlacementDate) {
    const template = state.templates[templateId];

    // Check overlap (uses template's default start time)
    const overlap = findOverlappingShift(
      pendingPlacementDate,
      template.startTime,
      template.duration,
      state.instances
    );

    if (overlap) {
      Alert.alert(
        t('calendar.week.overlapTitle'),
        t('calendar.week.overlapMessage', { name: overlap.name })
      );
    } else {
      dispatch({
        type: 'PLACE_SHIFT',
        date: pendingPlacementDate,
        templateId  // Override armed template
      });
    }
  }
  setShowTemplatePicker(false);
  setPendingPlacementDate(null);
};
```

#### 3.3 Update PLACE_SHIFT action

**File:** `calendar-reducer.ts`

Add optional `templateId` override:

```typescript
case 'PLACE_SHIFT': {
  const templateId = action.templateId ?? state.armedTemplateId;
  if (!templateId) return state;

  const template = state.templates[templateId];
  if (!template) return state;
  // ... rest unchanged
}
```

---

### Phase 4: Template Propagation

**Goal:** Editing a template updates all future instances

#### 4.1 Add propagation action

**File:** `calendar-reducer.ts`

```typescript
case 'UPDATE_TEMPLATE': {
  const { id, updates } = action;
  const template = state.templates[id];
  if (!template) return state;

  const updatedTemplate = { ...template, ...updates };
  const today = format(new Date(), 'yyyy-MM-dd');

  // Find future instances of this template
  const updatedInstances = { ...state.instances };
  let updateCount = 0;

  for (const [instanceId, instance] of Object.entries(updatedInstances)) {
    if (instance.templateId !== id) continue;
    if (instance.date <= today) continue; // Skip past/today

    // Update instance with new template values
    updatedInstances[instanceId] = {
      ...instance,
      name: updatedTemplate.name,
      startTime: updatedTemplate.startTime,
      duration: updatedTemplate.duration,
      endTime: computeEndTime(updatedTemplate.startTime, updatedTemplate.duration),
      color: updatedTemplate.color,
      breakMinutes: updatedTemplate.breakMinutes,
    };
    updateCount++;
  }

  return {
    ...state,
    templates: { ...state.templates, [id]: updatedTemplate },
    instances: updatedInstances,
  };
}
```

#### 4.2 Show confirmation in UI

**File:** `TemplatePanel.tsx`

Before saving template edits:

```typescript
const handleSaveTemplate = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const futureCount = Object.values(state.instances).filter(
    i => i.templateId === editingTemplateId && i.date > today
  ).length;

  if (futureCount > 0) {
    Alert.alert(
      t('calendar.templates.updateFutureTitle'),
      t('calendar.templates.updateFutureMessage', { count: futureCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.update'), onPress: () => dispatch({ type: 'UPDATE_TEMPLATE', ... }) },
      ]
    );
  } else {
    dispatch({ type: 'UPDATE_TEMPLATE', ... });
  }
};
```

---

### Phase 5: Template Deletion with Cascade

**Goal:** Delete template removes future instances, keeps past ones orphaned

#### 5.1 Update DELETE_TEMPLATE action

**File:** `calendar-reducer.ts`

```typescript
case 'DELETE_TEMPLATE': {
  const { id } = action;
  const today = format(new Date(), 'yyyy-MM-dd');

  // Remove template
  const remainingTemplates = { ...state.templates };
  delete remainingTemplates[id];

  // Remove future instances, keep past ones
  const remainingInstances = { ...state.instances };
  for (const [instanceId, instance] of Object.entries(remainingInstances)) {
    if (instance.templateId === id && instance.date > today) {
      delete remainingInstances[instanceId];
    }
  }

  // Disarm if this template was armed
  const armedTemplateId = state.armedTemplateId === id ? null : state.armedTemplateId;

  return {
    ...state,
    templates: remainingTemplates,
    instances: remainingInstances,
    armedTemplateId,
  };
}
```

#### 5.2 Add confirmation with count

**File:** `TemplatePanel.tsx`

```typescript
const handleDeleteTemplate = (templateId: string) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const futureCount = Object.values(state.instances).filter(
    i => i.templateId === templateId && i.date > today
  ).length;

  const message = futureCount > 0
    ? t('calendar.templates.deleteWithFuture', { count: futureCount })
    : t('calendar.templates.deleteEmpty');

  Alert.alert(
    t('calendar.templates.deleteTitle'),
    message,
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        dispatch({ type: 'DELETE_TEMPLATE', id: templateId });
      }},
    ]
  );
};
```

---

### Phase 6: Orphaned Instance Styling

**Goal:** Past instances from deleted templates show as grey

#### 6.1 Add orphan detection

**File:** `WeekView.tsx` (in InstanceCard)

```typescript
const isOrphaned = !state.templates[instance.templateId];

const instanceStyle = [
  styles.shiftInstance,
  { backgroundColor: isOrphaned ? '#9E9E9E' : colorMap[instance.color] },
];
```

#### 6.2 Optional: Add visual indicator

```typescript
{isOrphaned && (
  <View style={styles.orphanBadge}>
    <Text style={styles.orphanText}>Deleted</Text>
  </View>
)}
```

---

## Database Considerations

### Instance Snapshot Strategy

Currently instances store a snapshot of template data:
- `name`, `color`, `duration`, `startTime`, `breakMinutes`

This is good for:
- Historical accuracy (past shifts keep original values)
- Offline functionality (no need to lookup template)

For propagation:
- `templateId` links instance to template
- Only update future instances, preserve past snapshots

### Persistence

After any state change affecting instances:
```typescript
await CalendarStorage.replaceInstances(Object.values(state.instances));
```

After template changes:
```typescript
await CalendarStorage.replaceTemplates(Object.values(state.templates));
```

---

## Translation Keys to Add

```typescript
// English
calendar: {
  week: {
    shiftOptionsPrompt: 'What would you like to do?',
    editStartTime: 'Edit Start Time',
    deleteShiftPrompt: 'Delete this shift?',
    overlapTitle: 'Shift Overlap',
    overlapMessage: 'This shift would overlap with "{{name}}". Choose a different time.',
  },
  templates: {
    updateFutureTitle: 'Update Future Shifts?',
    updateFutureMessage: 'This will update {{count}} future shifts.',
    deleteTitle: 'Delete Shift Template?',
    deleteWithFuture: 'This will also remove {{count}} future shifts.',
    deleteEmpty: 'This template has no future shifts scheduled.',
    selectTemplate: 'Select Shift Template',
  },
}

// German
calendar: {
  week: {
    shiftOptionsPrompt: 'Was möchtest du tun?',
    editStartTime: 'Startzeit ändern',
    deleteShiftPrompt: 'Diese Schicht löschen?',
    overlapTitle: 'Überschneidung',
    overlapMessage: 'Diese Schicht würde sich mit "{{name}}" überschneiden.',
  },
  templates: {
    updateFutureTitle: 'Zukünftige Schichten aktualisieren?',
    updateFutureMessage: 'Dies aktualisiert {{count}} zukünftige Schichten.',
    deleteTitle: 'Dienstvorlage löschen?',
    deleteWithFuture: 'Dies entfernt auch {{count}} zukünftige Schichten.',
    deleteEmpty: 'Diese Vorlage hat keine geplanten Schichten.',
    selectTemplate: 'Dienstvorlage auswählen',
  },
}
```

---

## Testing Checklist

### Phase 1: Instance Interaction
- [ ] Tap on shift → shows Edit Start Time / Delete / Cancel popup
- [ ] Edit Start Time → opens native time picker
- [ ] Changing start time updates instance (duration preserved)
- [ ] Overlap detected when changing start time → shows error
- [ ] Cancel closes popup
- [ ] Delete removes instance
- [ ] Long-tap has same behavior as tap

### Phase 2: Overlap Detection
- [ ] Placing shift that overlaps → shows error
- [ ] Non-overlapping shifts on same day → allowed
- [ ] Overnight shifts → overlap detected correctly

### Phase 3: Tap-to-Add
- [ ] Single tap with armed template → places shift
- [ ] Long-press on empty hour → shows template picker
- [ ] Selecting template from picker → places at correct time
- [ ] Zoom toggle still works (double-tap elsewhere)

### Phase 4: Template Propagation
- [ ] Edit template → confirmation shows count
- [ ] Confirm → future instances updated
- [ ] Past instances unchanged
- [ ] Today's instances unchanged

### Phase 5: Template Deletion
- [ ] Delete template → confirmation shows count
- [ ] Confirm → template removed
- [ ] Future instances removed
- [ ] Past instances remain (orphaned)

### Phase 6: Orphaned Styling
- [ ] Orphaned instances render grey
- [ ] Original name still visible
- [ ] Can still delete orphaned instances

---

## Files to Modify

| File | Changes |
|------|---------|
| `WeekView.tsx` | Instance tap handler, overlap validation, long-press handler, time picker |
| `TemplatePicker.tsx` | **New** - modal with colored template list |
| `calendar-reducer.ts` | UPDATE_INSTANCE_START_TIME, UPDATE_TEMPLATE propagation, DELETE_TEMPLATE cascade |
| `calendar-utils.ts` | Add `findOverlappingShift()` utility |
| `TemplatePanel.tsx` | Confirmation dialogs for edit/delete |
| `ShiftEditModal.tsx` | Delete (no longer needed) |
| `en.ts` | Add new translation keys |
| `de.ts` | Add German translations |
| `types.ts` | Update action types if needed |

---

## Confirmed Decisions

| Question | Decision |
|----------|----------|
| Template picker UI | Custom modal with color dots + template names |
| Time slot precision | Use template's default start time (not tapped hour) |
| Double-tap conflict | Long-press on empty space → picker (not double-tap) |

---

## Remaining Trade-offs

1. **Start time editable, but not duration/breaks**
   - Users can shift an instance's start time (practical flexibility)
   - Duration/breaks still come from template (maintains consistency)
   - To change duration → edit template (affects all future instances)

2. **Long-press learning curve**
   - Long-press on shift = shows options popup
   - Long-press on empty = template picker
   - Consistent pattern ("long-press = more options") but users need to discover it

---

**Next:** Start implementation with Phase 1 (simplify instance interaction)
