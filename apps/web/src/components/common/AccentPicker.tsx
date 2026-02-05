import { useState } from 'react'
import { cn } from '@/lib/utils'

// Curated palette from Nordic Skies design system
// Each color includes foreground for proper button text contrast
const ACCENT_COLORS = [
  { name: 'blue', bg: '#4EA7F5', fg: '#ffffff', label: 'Blue' },
  { name: 'cyan', bg: '#26B5CE', fg: '#0a2e35', label: 'Cyan' },
  { name: 'teal', bg: '#2EB88A', fg: '#0a2e1f', label: 'Teal' },
  { name: 'yellow', bg: '#EBCB4B', fg: '#3d3314', label: 'Yellow' },
  { name: 'orange', bg: '#F3904F', fg: '#ffffff', label: 'Orange' },
  { name: 'coral', bg: '#F76B6E', fg: '#ffffff', label: 'Coral' },
  { name: 'red', bg: '#E54D5A', fg: '#ffffff', label: 'Red' },
  { name: 'purple', bg: '#AF7AF2', fg: '#ffffff', label: 'Purple' },
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
      document.documentElement.style.setProperty('--primary', colorObj.bg)
      document.documentElement.style.setProperty('--primary-foreground', colorObj.fg)
      document.documentElement.style.setProperty('--ring', colorObj.bg)
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
          'hover:bg-muted',
          isOpen && 'bg-muted'
        )}
        aria-expanded={isOpen}
        aria-label="Choose accent color"
      >
        <div
          className="w-3.5 h-3.5 rounded-full ring-1 ring-border/50 transition-transform group-hover:scale-110"
          style={{ backgroundColor: currentColor?.bg }}
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
            'bg-popover',
            'border border-border',
            'shadow-lg shadow-black/10 dark:shadow-black/30',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'w-[max-content]'
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
                      'hover:bg-muted'
                    )}
                    title={color.label}
                    aria-label={`Select ${color.label} accent color`}
                  >
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full transition-all duration-200",
                        isActive ? "w-3 h-3 ring-1 ring-offset-1 ring-offset-popover" : "group-hover:scale-110"
                      )}
                      style={{
                        backgroundColor: color.bg,
                        ['--tw-ring-color' as string]: color.bg
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
