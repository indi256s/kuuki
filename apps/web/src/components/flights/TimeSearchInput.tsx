"use client"

import { useTranslation } from "react-i18next"
import { TimePicker } from "@/components/ui/time-picker"
import { Badge } from "@/components/ui/badge"

interface TimeSearchInputProps {
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
}

/**
 * Time search input for finding flights within a ±3 hour window.
 * Wraps the existing TimePicker component with a label and time window badge.
 */
export function TimeSearchInput({
  value,
  onChange,
  onClear,
  disabled,
  className,
}: TimeSearchInputProps) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t("flights.searchTime", "Search Time (optional)")}
        </label>
        <Badge variant="secondary" className="text-xs font-mono">
          {t("flights.searchTimeWindow", "±3 hours")}
        </Badge>
      </div>
      <TimePicker
        value={value}
        onChange={onChange}
        onClear={onClear}
        disabled={disabled}
      />
    </div>
  )
}
