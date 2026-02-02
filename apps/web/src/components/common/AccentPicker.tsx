import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Palette } from 'lucide-react'

// Curated 4-color palette
const ACCENT_COLORS = [
  { name: 'amber', value: '#E78A45', label: 'Amber' },
  { name: 'teal', value: '#2CB88A', label: 'Teal' },
  { name: 'coral', value: '#F76B6E', label: 'Coral' },
  { name: 'burgundy', value: '#AC524C', label: 'Burgundy' },
] as const

type AccentColor = (typeof ACCENT_COLORS)[number]['name']

interface AccentPickerProps {
  value?: AccentColor
  onChange?: (color: AccentColor) => void
  className?: string
}

export function AccentPicker({ value = 'amber', onChange, className }: AccentPickerProps) {
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
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200',
          'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10',
          'text-foreground/70 hover:text-foreground',
          isOpen && 'bg-black/10 dark:bg-white/10'
        )}
        aria-expanded={isOpen}
        aria-label="Choose accent color"
      >
        <Palette className="w-4 h-4" />
        <div
          className="w-4 h-4 rounded-full ring-1 ring-black/10 dark:ring-white/20"
          style={{ backgroundColor: currentColor?.value }}
        />
      </button>

      {/* Dropdown */}
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
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Accent Color</p>
            <div className="flex gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => {
                    handleSelect(color.name)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all duration-150',
                    'hover:scale-110 ring-offset-background',
                    value === color.name && 'ring-2 ring-offset-2 scale-110'
                  )}
                  style={{
                    backgroundColor: color.value,
                    ['--tw-ring-color' as string]: color.value,
                  }}
                  title={color.label}
                  aria-label={`Select ${color.label} accent color`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export { ACCENT_COLORS }
export type { AccentColor }
