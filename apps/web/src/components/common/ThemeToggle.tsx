import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
    const { resolvedTheme, toggleTheme } = useTheme()

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-9 w-9"
        >
            {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 transition-transform duration-200" />
            ) : (
                <Moon className="h-4 w-4 transition-transform duration-200" />
            )}
        </Button>
    )
}
