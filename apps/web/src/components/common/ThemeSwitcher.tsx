import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

export function ThemeSwitcher() {
  const { themeMode, setThemeMode } = useTheme()
  const CurrentIcon = THEME_ICONS[themeMode]

  const handleToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'group flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
        'hover:bg-muted',
        'text-muted-foreground hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      aria-label={`Theme: ${themeMode}`}
      title={`Current theme: ${themeMode}. Click to cycle.`}
    >
      <CurrentIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
    </button>
  )
}
