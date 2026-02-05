import { useTranslation } from 'react-i18next'
import { Palette, Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'
import { useAccentColor } from '@/hooks/useAccentColor'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
]

const ACCENT_COLORS = [
  { name: 'blue' as const, bg: '#4EA7F5' },
  { name: 'cyan' as const, bg: '#26B5CE' },
  { name: 'teal' as const, bg: '#2EB88A' },
  { name: 'yellow' as const, bg: '#EBCB4B' },
  { name: 'orange' as const, bg: '#F3904F' },
  { name: 'coral' as const, bg: '#F76B6E' },
  { name: 'red' as const, bg: '#E54D5A' },
  { name: 'purple' as const, bg: '#AF7AF2' },
]

export function AppearanceSection() {
  const { t } = useTranslation()
  const { themeMode, setThemeMode } = useTheme()
  const { accentColor, setAccentColor } = useAccentColor()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          {t('settings.appearance.title')}
        </CardTitle>
        <CardDescription>{t('settings.appearance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme Mode Segmented Control */}
        <div>
          <label className="text-xs text-muted-foreground mb-3 block font-medium">
            {t('settings.appearance.themeLabel')}
          </label>
          <div
            role="radiogroup"
            aria-label={t('settings.appearance.themeLabel')}
            className="bg-muted relative inline-flex rounded-lg p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
          >
            {THEME_OPTIONS.map(({ mode, icon: Icon }) => {
              const isActive = themeMode === mode
              return (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setThemeMode(mode)}
                  className={cn(
                    'relative z-10 flex h-9 items-center gap-2 px-4 text-sm font-medium transition-all duration-200',
                    'hover:text-foreground hover:scale-[1.02] active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`settings.appearance.modes.${mode}`)}
                  {isActive && (
                    <span
                      className="bg-background absolute inset-0 rounded-md border shadow-sm animate-in fade-in-0 zoom-in-98 duration-200 ease-smooth"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>
          {themeMode === 'system' && (
            <p className="text-muted-foreground mt-2 text-xs animate-in fade-in-50 slide-in-from-top-2 duration-300">
              {t('settings.appearance.systemNote')}
            </p>
          )}
        </div>

        {/* Accent Color Picker */}
        <div>
          <label className="text-xs text-muted-foreground mb-3 block font-medium">
            {t('settings.appearance.accentLabel')}
          </label>
          <div className="grid grid-cols-8 gap-2">
            {ACCENT_COLORS.map((color) => {
              const isActive = accentColor === color.name
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setAccentColor(color.name)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150',
                    'hover:scale-110 active:scale-95 cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                  aria-label={`Select ${color.name} accent color`}
                  aria-pressed={isActive}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full transition-all duration-150',
                      isActive && 'ring-2 ring-offset-2 ring-offset-background'
                    )}
                    style={{
                      backgroundColor: color.bg,
                      ['--tw-ring-color' as string]: color.bg,
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
