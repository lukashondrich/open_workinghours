"use client"

import { useState } from "react"
import { useCalendar } from "./calendar-context"
import type { ShiftTemplate, ShiftColor } from "@/lib/types"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card } from "./ui/card"
import { Plus, Edit2, Check, X } from "lucide-react"
import { getColorClasses } from "@/lib/calendar-utils"
import { cn } from "@/lib/utils"

const SHIFT_COLORS: ShiftColor[] = ["blue", "green", "amber", "rose", "purple", "cyan"]

export function ShiftTemplatePanel() {
  const { state, dispatch } = useCalendar()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<ShiftTemplate>>({})

  const [durationHours, setDurationHours] = useState(0)
  const [durationMinutes, setDurationMinutes] = useState(0)

  const handleCreateTemplate = () => {
    const newTemplate: ShiftTemplate = {
      id: `template-${Date.now()}`,
      name: "New Shift",
      duration: 480, // 8 hours default
      startTime: "08:00",
      color: "blue",
    }
    dispatch({ type: "ADD_TEMPLATE", template: newTemplate })
    setEditingId(newTemplate.id)
    setFormData(newTemplate)
    setDurationHours(8)
    setDurationMinutes(0)
  }

  const handleSaveTemplate = () => {
    if (editingId && formData) {
      const totalDuration = durationHours * 60 + durationMinutes
      dispatch({
        type: "UPDATE_TEMPLATE",
        id: editingId,
        template: { ...formData, duration: totalDuration },
      })
      setEditingId(null)
      setFormData({})
      setDurationHours(0)
      setDurationMinutes(0)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({})
    setDurationHours(0)
    setDurationMinutes(0)
  }

  const handleArmShift = (templateId: string) => {
    if (state.armedTemplateId === templateId) {
      dispatch({ type: "DISARM_SHIFT" })
    } else {
      dispatch({ type: "ARM_SHIFT", templateId })
    }
  }

  const templates = Object.values(state.templates)

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 w-full md:w-96 bg-card border-t md:border-l border-border transition-transform duration-300 ease-in-out z-30",
        state.templatePanelOpen ? "translate-y-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
      )}
      style={{ maxHeight: "70vh" }}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Shift Templates</h3>
          <Button size="sm" onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No shift templates yet. Create one to get started.
            </p>
          )}

          {templates.map((template) => {
            const isEditing = editingId === template.id
            const isArmed = state.armedTemplateId === template.id
            const colors = getColorClasses(template.color)

            return (
              <Card key={template.id} className={cn("p-3", isArmed && "ring-2 ring-primary")}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="name" className="text-xs">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-8"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="startTime" className="text-xs">
                          Start Time
                        </Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={formData.startTime || ""}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <div className="flex gap-1">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="23"
                              value={durationHours}
                              onChange={(e) => setDurationHours(Number.parseInt(e.target.value) || 0)}
                              className="h-8"
                              placeholder="h"
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              max="55"
                              step="5"
                              value={durationMinutes}
                              onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value) || 0)}
                              className="h-8"
                              placeholder="m"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Color</Label>
                      <div className="flex gap-2 mt-1">
                        {SHIFT_COLORS.map((color) => {
                          const colorClasses = getColorClasses(color)
                          return (
                            <button
                              key={color}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-transform",
                                colorClasses.dot,
                                formData.color === color ? "border-foreground scale-110" : "border-transparent",
                              )}
                              onClick={() => setFormData({ ...formData, color })}
                            />
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveTemplate} className="flex-1">
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", colors.dot)} />
                        <span className="font-medium text-sm">{template.name}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingId(template.id)
                          setFormData(template)
                          setDurationHours(Math.floor(template.duration / 60))
                          setDurationMinutes(template.duration % 60)
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      {template.startTime} • {Math.floor(template.duration / 60)}h {template.duration % 60}m
                    </div>
                    <Button
                      size="sm"
                      variant={isArmed ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleArmShift(template.id)}
                    >
                      {isArmed ? "Armed" : "Arm Shift"}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
