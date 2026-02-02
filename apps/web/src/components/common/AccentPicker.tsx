import { cn } from '@/lib/utils'

// 15 accent colors from the design system
const ACCENT_COLORS = [
  { name: 'terracotta', value: 'oklch(0.55 0.12 25)', label: 'Terracotta' },
  { name: 'amber', value: 'oklch(0.72 0.14 55)', label: 'Amber' },
  { name: 'orange', value: '#F3904F', label: 'Orange' },
  { name: 'salmon', value: '#F76B6E', label: 'Salmon' },
  { name: 'red', value: '#E5484D', label: 'Red' },
  { name: 'purple', value: '#AF7AF2', label: 'Purple' },
  { name: 'indigo', value: '#5E6AD2', label: 'Indigo' },
  { name: 'blue', value: '#0091FF', label: 'Blue' },
  { name: 'sky', value: '#4EA7F5', label: 'Sky' },
  { name: 'cyan', value: '#26B5CE', label: 'Cyan' },
  { name: 'teal', value: '#2EB88A', label: 'Teal' },
  { name: 'green', value: '#50C086', label: 'Green' },
  { name: 'olive', value: '#8F710A', label: 'Olive' },
  { name: 'yellow', value: '#EBCB4B', label: 'Yellow' },
  { name: 'slate', value: '#939BA5', label: 'Slate' },
] as const

type AccentColor = (typeof ACCENT_COLORS)[number]['name']

interface AccentPickerProps {
  value?: AccentColor
  onChange?: (color: AccentColor) => void
  className?: string
}

export function AccentPicker({ value = 'terracotta', onChange, className }: AccentPickerProps) {
  const handleSelect = (color: AccentColor) => {
    // Set CSS custom property on root
    const colorObj = ACCENT_COLORS.find(c => c.name === color)
    if (colorObj) {
      document.documentElement.style.setProperty('--primary', colorObj.value)
      // Also update ring to match
      document.documentElement.style.setProperty('--ring', colorObj.value)
    }
    onChange?.(color)
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {ACCENT_COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          onClick={() => handleSelect(color.name)}
          className={cn(
            'w-5 h-5 rounded-full transition-all duration-150',
            'hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-offset-background',
            value === color.name && 'ring-2 ring-offset-1 ring-offset-background scale-110'
          )}
          style={{
            backgroundColor: color.value,
            // Use the color itself for the ring when selected
            ['--tw-ring-color' as string]: color.value,
          }}
          title={color.label}
          aria-label={`Select ${color.label} accent color`}
        />
      ))}
    </div>
  )
}

export { ACCENT_COLORS }
export type { AccentColor }
