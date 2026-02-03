import { useState } from 'react'
import { cn } from '@/lib/utils'

// Curated 4-color palette
// Curated palette from .interface-design/system.md
const ACCENT_COLORS = [
  { name: 'blue', value: '#4EA7F5', label: 'Blue' },
  { name: 'cyan', value: '#26B5CE', label: 'Cyan' },
  { name: 'teal', value: '#2EB88A', label: 'Teal' },
  { name: 'green', value: '#50C086', label: 'Green' },
  { name: 'yellow', value: '#EBCB4B', label: 'Yellow' },
  { name: 'orange', value: '#F3904F', label: 'Orange' },
  { name: 'coral', value: '#F76B6E', label: 'Coral' },
  { name: 'red', value: '#E54D5A', label: 'Red' },
  { name: 'purple', value: '#AF7AF2', label: 'Purple' },
] as const

type AccentColor = (typeof ACCENT_COLORS)[number]['name']

interface AccentPickerProps {
  value?: AccentColor
  onChange?: (color: AccentColor) => void
  className?: string
}

export function AccentPicker({ value = 'red', onChange, className }: AccentPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (color: AccentColor) => {
    const colorObj = ACCENT_COLORS.find(c => c.name === color)
    if (colorObj) {
      document.documentElement.style.setProperty('--primary', colorObj.value)
      document.documentElement.style.setProperty('--ring', colorObj.value)
    }
    onChange?.(color)
  }

  const currentColor = ACCENT_COLORS.find(c => c.name === value)

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button - Compact & Precise */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
          'hover:bg-neutral-100 dark:hover:bg-white/5',
          isOpen && 'bg-neutral-100 dark:bg-white/5'
        )}
        aria-expanded={isOpen}
        aria-label="Choose accent color"
      >
        <div
          className="w-3.5 h-3.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-110"
          style={{ backgroundColor: currentColor?.value }}
        />
      </button>

      {/* Dropdown - Minimalist Float */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Color picker dropdown */}
          <div className={cn(
            'absolute top-full right-0 mt-2 z-50',
            'p-3 rounded-xl',
            'bg-white dark:bg-neutral-900',
            'border border-black/10 dark:border-white/10',
            'shadow-lg shadow-black/10 dark:shadow-black/40',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'w-[max-content] max-w-[200px]'
          )}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Accent Color</p>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_COLORS.map((color) => {
                const isActive = value === color.name
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                      handleSelect(color.name)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'group relative w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150',
                      'hover:bg-neutral-100 dark:hover:bg-white/5'
                    )}
                    title={color.label}
                    aria-label={`Select ${color.label} accent color`}
                  >
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full transition-all duration-200",
                        isActive ? "w-3 h-3 ring-1 ring-offset-1 dark:ring-offset-[#121417]" : "group-hover:scale-110"
                      )}
                      style={{
                        backgroundColor: color.value,
                        boxShadow: !isActive ? '0 0 0 1px rgba(255,255,255,0.1) inset' : undefined,
                        ['--tw-ring-color' as string]: color.value
                      }}
                    />
                    {isActive && (
                      <div className="absolute inset-x-1 -bottom-1 h-px bg-current opacity-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export { ACCENT_COLORS }
export type { AccentColor }
