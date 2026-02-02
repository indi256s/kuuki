import { Moon, Sun, Monitor, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
]

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, resolvedTheme, setTheme } = useTheme()

  // Get the icon for the current resolved theme (what's actually showing)
  const TriggerIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('theme.toggle', 'Change theme')}
          className="h-9 w-9"
        >
          <TriggerIcon className="h-4 w-4 transition-transform duration-200" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => {
          const isSelected = theme === value

          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center justify-between gap-2',
                isSelected && 'bg-accent'
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{t(labelKey, value.charAt(0).toUpperCase() + value.slice(1))}</span>
              </span>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          )
        })}

        {/* System preference hint when "System" is selected */}
        {theme === 'system' && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1 pt-1">
            {t('theme.currentlyUsing', 'Currently: {{mode}}', {
              mode: t(`theme.${resolvedTheme}`, resolvedTheme),
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
