import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_COLORS, type ThemeColorKey } from '@/lib/profiles'

interface ThemeColorPickerProps {
  value: ThemeColorKey
  onChange: (color: ThemeColorKey) => void
}

export function ThemeColorPicker({ value, onChange }: ThemeColorPickerProps) {
  const { t } = useTranslation()

  const colors = Object.entries(THEME_COLORS) as Array<[ThemeColorKey, string]>

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t('profile.themeColor', 'Theme Color')}
      </label>
      <div className="flex flex-wrap gap-2">
        {colors.map(([colorKey, colorValue]) => (
          <button
            key={colorKey}
            type="button"
            onClick={() => onChange(colorKey)}
            className={cn(
              'w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              value === colorKey ? 'ring-2 ring-offset-2 ring-foreground' : 'hover:scale-110'
            )}
            style={{ backgroundColor: colorValue }}
            title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
          >
            {value === colorKey && (
              <Check className="w-5 h-5 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
