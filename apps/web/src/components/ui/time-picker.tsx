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
import { ScrollArea } from "@/components/ui/scroll-area"

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

// Generate hours 00-23 and minutes 00-59
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"))

/**
 * Time picker combining manual input (HH:MM) with a visual time selector.
 * Uses 24-hour format throughout.
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
  }

  const handleMinuteSelect = (minute: string) => {
    const newValue = `${selectedHour}:${minute}`
    onChange?.(newValue)
    setOpen(false) // Close after minute selection
  }

  // Scroll selected values into view when opening
  const hourRef = React.useRef<HTMLDivElement>(null)
  const minuteRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) {
      // Small delay to ensure popover is rendered
      setTimeout(() => {
        hourRef.current?.querySelector(`[data-hour="${selectedHour}"]`)?.scrollIntoView({ block: "center" })
        minuteRef.current?.querySelector(`[data-minute="${selectedMinute}"]`)?.scrollIntoView({ block: "center" })
      }, 50)
    }
  }, [open, selectedHour, selectedMinute])

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
          <div className="flex">
            {/* Hours column */}
            <div className="border-r border-border">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center border-b border-border">
                Hour
              </div>
              <ScrollArea className="h-[200px]" ref={hourRef}>
                <div className="flex flex-col p-1">
                  {HOURS.map((hour) => (
                    <Button
                      key={hour}
                      variant={hour === selectedHour ? "default" : "ghost"}
                      size="default"
                      data-hour={hour}
                      className={cn(
                        "w-12 justify-center font-mono",
                        hour === selectedHour && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleHourSelect(hour)}
                    >
                      {hour}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Minutes column */}
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center border-b border-border">
                Min
              </div>
              <ScrollArea className="h-[200px]" ref={minuteRef}>
                <div className="flex flex-col p-1">
                  {MINUTES.map((minute) => (
                    <Button
                      key={minute}
                      variant={minute === selectedMinute ? "default" : "ghost"}
                      size="default"
                      data-minute={minute}
                      className={cn(
                        "w-12 justify-center font-mono",
                        minute === selectedMinute && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleMinuteSelect(minute)}
                    >
                      {minute}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
TimePicker.displayName = "TimePicker"

export { TimePicker }
