import { Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/**
 * Theme toggle — currently dark mode only.
 * Shows moon icon to indicate current theme. Non-interactive for now.
 */
export function ThemeToggle() {
  const { t } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('theme.darkMode', 'Dark mode')}
      className="h-9 w-9 cursor-default"
      disabled
    >
      <Moon className="h-4 w-4" />
    </Button>
  )
}
