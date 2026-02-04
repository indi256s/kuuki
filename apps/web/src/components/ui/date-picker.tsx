"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { DateInput } from "@/components/ui/date-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** Value in YYYY-MM-DD format */
  value?: string
  /** Called with value in YYYY-MM-DD format */
  onChange?: (value: string) => void
  /** Optional label for the input */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional class names for the wrapper */
  className?: string
}

/**
 * Date picker combining manual input (dd.mm.yyyy) with a calendar popover.
 * Stores dates in YYYY-MM-DD format internally.
 */
function DatePicker({
  value,
  onChange,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert YYYY-MM-DD string to Date object for Calendar
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    const date = parse(value, "yyyy-MM-dd", new Date())
    return isNaN(date.getTime()) ? undefined : date
  }, [value])

  // Handle calendar selection
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd")
      onChange?.(formatted)
    }
    setOpen(false)
  }

  return (
    <div className={cn("flex gap-1.5", className)}>
      <DateInput
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
            aria-label="Pick date from calendar"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
DatePicker.displayName = "DatePicker"

export { DatePicker }
