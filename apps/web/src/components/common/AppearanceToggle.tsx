import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/useTheme'
import { useAccentColor, ACCENT_COLORS_LIST } from '@/hooks/useAccentColor'
import { cn } from '@/lib/utils'

export function AppearanceToggle() {
    const { t } = useTranslation()
    const { themeMode, setThemeMode } = useTheme()
    const { accentColor, setAccentColor } = useAccentColor()

    const THEME_ICONS = {
        light: Sun,
        dark: Moon,
        system: Monitor,
    }

    const CurrentIcon = THEME_ICONS[themeMode]

    // Find the current accent color object for the dot indicator
    const currentAccent = ACCENT_COLORS_LIST.find(c => c.name === accentColor)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                    <CurrentIcon className="w-[1.125rem] h-[1.125rem] transition-transform duration-200" />
                    <span className="sr-only">{t('settings.appearance.title', 'Appearance')}</span>

                    {/* Subtle indicator of current accent color */}
                    <span
                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full ring-2 ring-background transition-colors duration-200"
                        style={{ backgroundColor: currentAccent?.bg }}
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-3">
                {/* Theme Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <DropdownMenuLabel className="p-0 text-xs font-medium text-muted-foreground">
                            {t('settings.appearance.themeLabel', 'Theme')}
                        </DropdownMenuLabel>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
                        {(['light', 'dark', 'system'] as const).map((mode) => {
                            const Icon = THEME_ICONS[mode]
                            const isActive = themeMode === mode

                            return (
                                <button
                                    key={mode}
                                    onClick={() => setThemeMode(mode)}
                                    className={cn(
                                        "flex items-center justify-center h-7 rounded-md text-xs font-medium transition-all duration-200",
                                        isActive
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                    )}
                                    title={t(`settings.appearance.modes.${mode}`, mode)}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                </button>
                            )
                        })}
                    </div>
                </div>

                <DropdownMenuSeparator className="my-3" />

                {/* Accent Color Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <DropdownMenuLabel className="p-0 text-xs font-medium text-muted-foreground">
                            {t('settings.appearance.accentLabel', 'Accent Color')}
                        </DropdownMenuLabel>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {ACCENT_COLORS_LIST.map((color) => {
                            const isActive = accentColor === color.name
                            return (
                                <button
                                    key={color.name}
                                    onClick={() => setAccentColor(color.name)}
                                    className={cn(
                                        'group relative w-full aspect-square rounded-md flex items-center justify-center transition-all duration-200',
                                        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                        isActive && 'bg-muted'
                                    )}
                                    title={color.label}
                                >
                                    <div
                                        className={cn(
                                            "w-3.5 h-3.5 rounded-full transition-all duration-200",
                                            isActive ? "scale-125 ring-2 ring-offset-2 ring-offset-muted" : "group-hover:scale-110"
                                        )}
                                        style={{
                                            backgroundColor: color.bg,
                                            ['--tw-ring-color' as string]: color.bg
                                        }}
                                    />
                                </button>
                            )
                        })}
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
