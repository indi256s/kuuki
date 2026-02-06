"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { enUS, ru } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
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
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional class names for the wrapper */
  className?: string
}

const localeMap: Record<string, typeof enUS> = {
  en: enUS,
  ru: ru,
}

/**
 * Unified date picker with locale-aware formatting, month/year dropdown navigation,
 * and a "Today" shortcut.
 */
function DatePicker({
  value,
  onChange,
  disabled,
  className,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)

  const locale = localeMap[i18n.language] || enUS

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

  const handleToday = () => {
    handleSelect(new Date())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("common.pickDate", "Pick a date")}
          aria-disabled={disabled}
          className={cn(
            "border-input flex h-10 w-full cursor-pointer items-center rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-colors md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "outline-none",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            !dateValue && "text-muted-foreground",
            className
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setOpen(true)
            }
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-mono">
            {dateValue
              ? format(dateValue, "d MMM yyyy", { locale })
              : t("common.pickDate", "Pick a date")}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          locale={locale}
          initialFocus
        />
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={handleToday}
            className="text-sm text-primary hover:underline"
          >
            {t("common.today", "Today")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
DatePicker.displayName = "DatePicker"

export { DatePicker }
