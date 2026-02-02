import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'

interface FlightCardActionsProps {
  onEdit: () => void
  onDelete: () => void
}

/**
 * Overflow menu for FlightCard actions (Edit, Delete).
 *
 * Renders as a vertical ellipsis (⋮) button that opens a dropdown
 * menu with action options. Designed for mobile-friendly touch targets
 * with 44x44px minimum tap area.
 */
export function FlightCardActions({ onEdit, onDelete }: FlightCardActionsProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2.5 -m-2 rounded-full hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
          aria-label={t('common.moreActions', 'More actions')}
        >
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer">
          <Pencil className="w-4 h-4" />
          {t('common.edit', 'Edit')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
          {t('common.delete', 'Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
