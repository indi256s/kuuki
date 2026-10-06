import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useFlight, useDeleteFlight, type Flight } from '@/hooks/useFlights'
import { useTranslation } from 'react-i18next'
import { daysUntilFlight } from '@kuuki/client/geo'
import { FlightForm } from '@/components/flights/FlightForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function UpcomingFlightsBanner() {
  const { t } = useTranslation()
  const { data: stats } = useDashboardStats()
  const [editFlightId, setEditFlightId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const { data: editFlight } = useFlight(editFlightId)
  const deleteFlight = useDeleteFlight()

  const upcomingFlights = stats?.upcomingFlights || []
  const upcomingFlightCount = stats?.upcomingFlightCount ?? 0

  if (upcomingFlights.length === 0) return null

  const next = upcomingFlights[0]
  const days = daysUntilFlight(next.date)

  const countdownLabel =
    days === 0
      ? t('dashboard.today', 'Today')
      : days === 1
        ? t('dashboard.tomorrow', 'Tomorrow')
        : t('dashboard.daysUntil', '{{count}}d', { count: days })

  const handleDeleteClick = (flight: Flight) => {
    setEditFlightId(null)
    setDeleteConfirmId(flight.id)
  }

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      await deleteFlight.mutateAsync(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmId(null)
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-2.5">
        {/* Countdown badge */}
        <Badge variant="default" className="shrink-0 text-[10px] font-bold uppercase">
          {countdownLabel}
        </Badge>

        {/* Route + flight info */}
        <button
          onClick={() => setEditFlightId(next.id)}
          className="flex items-center gap-2 min-w-0 group cursor-pointer"
        >
          <span className="font-mono text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
            {next.origin}
          </span>
          <span className="text-muted-foreground text-xs">&rarr;</span>
          <span className="font-mono text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
            {next.destination}
          </span>
          {(next.airline_iata || next.flight_number) && (
            <span className="text-xs text-muted-foreground truncate">
              {next.airline_iata}{next.flight_number ? ` ${next.flight_number}` : ''}
            </span>
          )}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Pending count */}
        {upcomingFlightCount > 1 && (
          <span className="text-xs text-muted-foreground shrink-0">
            +{upcomingFlightCount - 1} {t('dashboard.pending', 'pending')}
          </span>
        )}

        {/* Edit button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => setEditFlightId(next.id)}
          aria-label={t('common.edit', 'Edit')}
        >
          <Pencil className="size-3.5" />
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteConfirmId(next.id)}
          aria-label={t('common.delete', 'Delete')}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Flight edit dialog */}
      {editFlightId && editFlight && (
        <FlightForm
          isOpen={true}
          onClose={() => setEditFlightId(null)}
          editFlight={editFlight}
          onDelete={handleDeleteClick}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('flights.deleteConfirmTitle', 'Delete Flight?')}</DialogTitle>
            <DialogDescription>
              {t('flights.deleteConfirmMessage', 'This action cannot be undone. The flight will be permanently removed from your log.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteFlight.isPending}
            >
              {deleteFlight.isPending ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
