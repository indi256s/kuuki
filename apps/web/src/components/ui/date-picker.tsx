"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { enUS, ru } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
        <Button
          variant="outline"
          disabled={disabled}
          data-empty={!dateValue}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal",
            className
          )}
        >
          <CalendarIcon />
          <span className="font-mono">
            {dateValue
              ? format(dateValue, "d MMM yyyy", { locale })
              : t("common.pickDate", "Pick a date")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          locale={locale}
          initialFocus
        />
        <div className="border-border/40 border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleToday}
            className="h-7 px-2 text-xs"
          >
            {t("common.today", "Today")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
DatePicker.displayName = "DatePicker"

export { DatePicker }
