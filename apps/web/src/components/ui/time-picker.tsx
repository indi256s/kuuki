"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimePickerProps {
  /** Value in HH:MM format (24-hour) */
  value?: string
  /** Called with value in HH:MM format */
  onChange?: (value: string) => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional class names for the wrapper */
  className?: string
}

// Generate hours 00-23
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))

// Generate minutes in 5-minute increments
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

/**
 * Unified time picker with single-view dual-grid layout.
 * Hours and minutes grids displayed side by side.
 */
function TimePicker({
  value,
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse current value
  const [selectedHour, selectedMinute] = React.useMemo(() => {
    if (!value) return ["12", "00"]
    const [h, m] = value.split(":")
    return [h || "12", m || "00"]
  }, [value])

  const handleHourSelect = (hour: string) => {
    const newValue = `${hour}:${selectedMinute}`
    onChange?.(newValue)
    // Stay open for minute selection
  }

  const handleMinuteSelect = (minute: string) => {
    const newValue = `${selectedHour}:${minute}`
    onChange?.(newValue)
    setOpen(false) // Auto-close after minute selection
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 justify-start text-left font-mono",
            !value && "text-muted-foreground",
            className
          )}
          aria-label="Pick time"
        >
          <Clock className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
          {value || "Pick a time"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
        <div className="p-3 space-y-3">
          {/* Current selection header */}
          <div className="text-2xl font-mono text-center tracking-tight">
            <span className="text-foreground">{selectedHour}</span>
            <span className="text-muted-foreground/40">:</span>
            <span className="text-foreground">{selectedMinute}</span>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Side-by-side grids */}
          <div className="flex gap-4">
            {/* Hour grid: 4 columns × 6 rows */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-0.5">
                Hours
              </div>
              <div className="grid grid-cols-4 gap-1">
                {HOURS.map((hour) => {
                  const isSelected = hour === selectedHour
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => handleHourSelect(hour)}
                      className={cn(
                        "h-8 w-8 rounded-lg font-mono text-sm transition-all duration-150",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-accent/60 text-foreground/80"
                      )}
                    >
                      {hour}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Minute grid: 3 columns × 4 rows */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-0.5">
                Minutes
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MINUTES.map((minute) => {
                  const isSelected = minute === selectedMinute
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => handleMinuteSelect(minute)}
                      className={cn(
                        "h-8 w-8 rounded-lg font-mono text-sm transition-all duration-150",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-accent/60 text-foreground/80"
                      )}
                    >
                      {minute}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
TimePicker.displayName = "TimePicker"

export { TimePicker }
