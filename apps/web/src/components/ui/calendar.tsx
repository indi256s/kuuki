"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const currentYear = new Date().getFullYear()

/**
 * Calendar with aviation-inspired aesthetics.
 * Supports month/year dropdown navigation for fast selection.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      startMonth={new Date(2000, 0)}
      endMonth={new Date(currentYear + 1, 11)}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        caption: "flex justify-between items-center px-1 mb-2",
        caption_label: "text-sm font-medium tracking-wide",
        dropdowns: "flex items-center gap-1.5",
        dropdown: cn(
          "font-mono text-sm rounded-md border border-input bg-transparent px-1.5 py-0.5",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "outline-none cursor-pointer"
        ),
        nav: "flex items-center gap-1",
        nav_button: cn(
          "inline-flex items-center justify-center rounded-lg w-8 h-8",
          "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50",
          "transition-colors duration-150",
          "disabled:opacity-30 disabled:pointer-events-none"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell: cn(
          "text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60",
          "w-10 h-6 flex items-center justify-center"
        ),
        row: "flex w-full",
        cell: cn(
          "relative p-0.5 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-transparent"
        ),
        day: cn(
          "inline-flex items-center justify-center",
          "w-9 h-9 rounded-lg font-mono text-sm",
          "transition-colors duration-150",
          "hover:bg-accent/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground",
          "hover:bg-primary hover:text-primary-foreground",
          "shadow-sm shadow-primary/25"
        ),
        day_today: cn(
          "relative font-semibold text-primary",
          "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2",
          "after:w-1 after:h-1 after:rounded-full after:bg-primary"
        ),
        day_outside: "text-muted-foreground/40 hover:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/30 pointer-events-none",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
