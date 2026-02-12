"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface TimePickerProps {
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
  id?: string
}

function TimePicker({ value, onChange, onClear, disabled, className, id }: TimePickerProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = React.useState(value || "")
  const [error, setError] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setInputValue(value || "")
    setError(false)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 4)
    let formatted = raw
    if (raw.length > 2) {
      formatted = raw.slice(0, 2) + ":" + raw.slice(2)
    }
    setInputValue(formatted)
    setError(false)
  }

  const handleBlur = () => {
    if (!inputValue) {
      onChange?.("")
      return
    }
    const digits = inputValue.replace(/[^\d]/g, "")
    if (digits.length < 3) {
      setError(true)
      return
    }
    const hh = parseInt(digits.slice(0, 2), 10)
    const mm = parseInt(digits.slice(2, 4) || "0", 10)
    if (hh > 23 || mm > 59) {
      setError(true)
      return
    }
    const formatted = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`
    setInputValue(formatted)
    onChange?.(formatted)
  }

  const handleFocus = () => {
    inputRef.current?.select()
  }

  return (
    <div className={cn("relative", className)}>
      <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        className={cn("pl-8 pr-8 font-mono", error && "border-destructive")}
      />
      {value && onClear && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="Clear time"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive">
          {t("flights.invalidTime", "Invalid time format")}
        </p>
      )}
    </div>
  )
}
TimePicker.displayName = "TimePicker"

export { TimePicker }
