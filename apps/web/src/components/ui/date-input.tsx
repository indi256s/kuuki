import * as React from 'react'
import { cn } from '@/lib/utils'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  /** Value in YYYY-MM-DD format (internal format) */
  value?: string
  /** Called with value in YYYY-MM-DD format */
  onChange?: (value: string) => void
}

/**
 * Date input that displays dd.mm.yyyy format but stores YYYY-MM-DD internally.
 * Uses a native date picker for selection but formats the display.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    // Format YYYY-MM-DD to dd.mm.yyyy for display
    const formatForDisplay = (isoDate: string): string => {
      if (!isoDate) return ''
      const [year, month, day] = isoDate.split('-')
      if (!year || !month || !day) return ''
      return `${day}.${month}.${year}`
    }

    // Parse dd.mm.yyyy to YYYY-MM-DD
    const parseFromDisplay = (displayDate: string): string => {
      const match = displayDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      if (!match) return ''
      const [, day, month, year] = match
      return `${year}-${month}-${day}`
    }

    const [displayValue, setDisplayValue] = React.useState(() => formatForDisplay(value || ''))

    // Sync displayValue when value prop changes
    React.useEffect(() => {
      setDisplayValue(formatForDisplay(value || ''))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDisplay = e.target.value
      setDisplayValue(newDisplay)

      // Auto-insert dots as user types
      const digits = newDisplay.replace(/\D/g, '')
      if (digits.length <= 8) {
        let formatted = ''
        if (digits.length > 0) formatted += digits.slice(0, 2)
        if (digits.length > 2) formatted += '.' + digits.slice(2, 4)
        if (digits.length > 4) formatted += '.' + digits.slice(4, 8)
        setDisplayValue(formatted)

        // If complete, convert to ISO and call onChange
        if (digits.length === 8) {
          const day = digits.slice(0, 2)
          const month = digits.slice(2, 4)
          const year = digits.slice(4, 8)
          const isoDate = `${year}-${month}-${day}`

          // Validate the date
          const date = new Date(isoDate)
          if (!isNaN(date.getTime()) && date.toISOString().slice(0, 10) === isoDate) {
            onChange?.(isoDate)
          }
        }
      }
    }

    const handleBlur = () => {
      // On blur, try to parse and format
      const parsed = parseFromDisplay(displayValue)
      if (parsed) {
        onChange?.(parsed)
      } else if (value) {
        // Reset to last valid value
        setDisplayValue(formatForDisplay(value))
      }
    }

    return (
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd.mm.yyyy"
        className={cn(
          'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-mono',
          'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={10}
        {...props}
      />
    )
  }
)
DateInput.displayName = 'DateInput'

export { DateInput }
