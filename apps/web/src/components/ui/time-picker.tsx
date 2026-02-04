"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TimeInput } from "@/components/ui/time-input"
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

// Quick time presets for common flight times
const TIME_PRESETS = [
  { label: "Morning", times: ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00"] },
  { label: "Afternoon", times: ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] },
  { label: "Evening", times: ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"] },
  { label: "Night", times: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"] },
]

/**
 * Time picker with intuitive grid layout.
 * Select hour from grid, then fine-tune minutes.
 */
function TimePicker({
  value,
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"hour" | "minute">("hour")

  // Parse current value
  const [selectedHour, selectedMinute] = React.useMemo(() => {
    if (!value) return ["12", "00"]
    const [h, m] = value.split(":")
    return [h || "12", m || "00"]
  }, [value])

  // Reset to hour mode when opening
  React.useEffect(() => {
    if (open) setMode("hour")
  }, [open])

  const handleHourSelect = (hour: string) => {
    const newValue = `${hour}:${selectedMinute}`
    onChange?.(newValue)
    setMode("minute")
  }

  const handleMinuteSelect = (minute: string) => {
    const newValue = `${selectedHour}:${minute}`
    onChange?.(newValue)
    setOpen(false)
  }

  return (
    <div className={cn("flex gap-1.5", className)}>
      <TimeInput
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            className="h-10 w-10 shrink-0"
            aria-label="Pick time"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 space-y-3">
            {/* Mode indicator */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode("hour")}
                className={cn(
                  "text-2xl font-mono tracking-tight transition-colors",
                  mode === "hour" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {selectedHour}
              </button>
              <span className="text-2xl font-mono text-muted-foreground/30">:</span>
              <button
                type="button"
                onClick={() => setMode("minute")}
                className={cn(
                  "text-2xl font-mono tracking-tight transition-colors",
                  mode === "minute" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {selectedMinute}
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {mode === "hour" ? (
              /* Hour selection - 4 rows of 6 hours */
              <div className="space-y-2">
                {TIME_PRESETS.map(({ label, times }) => (
                  <div key={label}>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-0.5">
                      {label}
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {times.map((time) => {
                        const hour = time.split(":")[0]
                        const isSelected = hour === selectedHour
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleHourSelect(hour)}
                            className={cn(
                              "h-9 rounded-lg font-mono text-sm transition-all duration-150",
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
                ))}
              </div>
            ) : (
              /* Minute selection - 2 rows of 6 */
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-0.5">
                  Minutes
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((minute) => {
                    const isSelected = minute === selectedMinute
                    return (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => handleMinuteSelect(minute)}
                        className={cn(
                          "h-9 rounded-lg font-mono text-sm transition-all duration-150",
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
                {/* Quick confirm current selection */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
TimePicker.displayName = "TimePicker"

export { TimePicker }
