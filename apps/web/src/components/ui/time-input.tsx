import * as React from 'react'
import { cn } from '@/lib/utils'

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  /** Value in HH:MM format (24-hour) */
  value?: string
  /** Called with value in HH:MM format */
  onChange?: (value: string) => void
}

/**
 * Time input that enforces 24-hour format (HH:MM).
 * Auto-inserts colon as user types.
 */
const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value || '')

    // Sync displayValue when value prop changes
    React.useEffect(() => {
      setDisplayValue(value || '')
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      const digits = input.replace(/\D/g, '')

      if (digits.length <= 4) {
        let formatted = ''
        if (digits.length > 0) {
          formatted += digits.slice(0, 2)
        }
        if (digits.length > 2) {
          formatted += ':' + digits.slice(2, 4)
        }
        setDisplayValue(formatted)

        // Validate and call onChange when complete
        if (digits.length === 4) {
          const hours = parseInt(digits.slice(0, 2), 10)
          const minutes = parseInt(digits.slice(2, 4), 10)

          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            onChange?.(formatted)
          }
        } else if (digits.length === 0) {
          onChange?.('')
        }
      }
    }

    const handleBlur = () => {
      // Validate on blur
      const match = displayValue.match(/^(\d{2}):(\d{2})$/)
      if (match) {
        const hours = parseInt(match[1], 10)
        const minutes = parseInt(match[2], 10)
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          onChange?.(displayValue)
          return
        }
      }
      // Invalid - clear or reset
      if (value && value !== displayValue) {
        setDisplayValue(value)
      } else if (!value) {
        setDisplayValue('')
        onChange?.('')
      }
    }

    return (
      <input
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
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
        maxLength={5}
        {...props}
      />
    )
  }
)
TimeInput.displayName = 'TimeInput'

export { TimeInput }
