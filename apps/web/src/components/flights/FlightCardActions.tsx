import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'

interface FlightCardActionsProps {
  onEdit: () => void
}

/**
 * Edit button for FlightCard.
 *
 * Simple edit button - delete is now handled in the edit modal
 * for a cleaner row experience and to prevent accidental deletions.
 * Designed for mobile-friendly touch targets with 44x44px minimum tap area.
 */
export function FlightCardActions({ onEdit }: FlightCardActionsProps) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onEdit}
      className="p-2 -m-1 rounded-md hover:bg-muted/50 active:bg-muted active:scale-95 transition-all duration-100 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={t('common.edit', 'Edit')}
    >
      <Pencil className="w-4 h-4 text-muted-foreground" />
    </button>
  )
}
