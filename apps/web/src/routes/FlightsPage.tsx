import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { FlightList } from '@/components/flights/FlightList'
import { FlightForm } from '@/components/flights/FlightForm'
import { AppHeader } from '@/components/common/AppHeader'
import { AppPageShell } from '@/components/layout/AppPageShell'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { FloatingActionButton } from '@/components/common/FloatingActionButton'
import { useSyncUpcomingFlights, useDeleteFlight, type Flight } from '@/hooks/useFlights'
import { Button } from '@/components/ui/button'
import { getFlight } from '@kuuki/client/flights'
import { allowedLegacyReturn, parseLegacyEntry, returnAfterLegacyWrite } from '@/lib/legacyBridge'
import { useAuthStore } from '@/stores/authStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function FlightsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const userId = useAuthStore((state) => state.user?.id)
  const entryHandled = useRef<string | null>(null)
  const returnTo = allowedLegacyReturn(new URLSearchParams(location.search).get('returnTo'))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null)
  const [deleteConfirmFlight, setDeleteConfirmFlight] = useState<Flight | null>(null)
  const [entryError, setEntryError] = useState<string | null>(null)

  useEffect(() => {
    if (import.meta.env.BASE_URL !== '/legacy/' || !userId) return
    const key = `${userId}:${location.search}`
    if (entryHandled.current === key) return
    entryHandled.current = key
    const entry = parseLegacyEntry(location.search)
    if (entry?.action === 'add') {
      setEditingFlight(null)
      setIsFormOpen(true)
    } else if (entry?.action === 'edit') {
      let active = true
      void getFlight(entry.flightId).then((flight) => {
        if (!active) return
        if (!flight) { setEntryError('Flight not found.'); return }
        setEditingFlight(flight)
        setIsFormOpen(true)
      }).catch(() => { if (active) setEntryError('Could not load this flight. Please try again.') })
      return () => { active = false; entryHandled.current = null }
    }
  }, [location.search, userId])

  // Delete mutation
  const deleteFlight = useDeleteFlight()

  // Sync upcoming flights on page load
  useSyncUpcomingFlights()

  const handleAddFlight = () => {
    setEditingFlight(null)
    setIsFormOpen(true)
  }

  const handleEditFlight = (flight: Flight) => {
    setEditingFlight(flight)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingFlight(null)
  }

  const handleDeleteClick = (flight: Flight) => {
    // Close the edit form and show delete confirmation
    setIsFormOpen(false)
    setDeleteConfirmFlight(flight)
  }

  const confirmDelete = async () => {
    if (deleteConfirmFlight) {
      await deleteFlight.mutateAsync(deleteConfirmFlight.id)
      setDeleteConfirmFlight(null)
      setEditingFlight(null)
      returnAfterLegacyWrite(location.search)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmFlight(null)
  }

  return (
    <AppPageShell
      shellClassName="min-h-screen bg-gradient-soft"
      maxWidth="wide"
      className="mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-safe sm:pb-10"
      mobileHeader={<MobileHeader />}
      appHeader={<AppHeader onAddFlight={handleAddFlight} showAddButton />}
      afterMain={
        <>
          <FlightForm
            isOpen={isFormOpen}
            onClose={handleCloseForm}
            onSaved={() => returnAfterLegacyWrite(location.search)}
            editFlight={editingFlight}
            onDelete={handleDeleteClick}
          />

          <Dialog open={deleteConfirmFlight !== null} onOpenChange={(open) => !open && cancelDelete()}>
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

          <FloatingActionButton
            icon={Plus}
            onClick={handleAddFlight}
            label={t('nav.addFlight')}
          />
        </>
      }
      mobileTabBar={<MobileTabBar />}
    >
        {/* Page header */}
        <div className="mb-8 animate-fade-up">
          {returnTo && <a className="mb-4 inline-block text-sm underline" href={returnTo}>Return to Kuuki</a>}
          {entryError && <p role="alert" className="mb-4 text-sm text-destructive">{entryError}</p>}
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t('nav.flights', 'Flights')}
            <span className="ml-3 text-sm font-normal text-muted-foreground hidden sm:inline">
              {t('flights.pageSubtitle', 'Your complete flight history')}
            </span>
          </h1>
        </div>

        {/* Flight list */}
        <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
          <FlightList onEdit={handleEditFlight} />
        </div>
    </AppPageShell>
  )
}
