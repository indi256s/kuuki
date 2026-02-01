import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightList } from '@/components/flights/FlightList'
import { FlightForm } from '@/components/flights/FlightForm'
import { AppHeader } from '@/components/common/AppHeader'
import { useSyncUpcomingFlights, type Flight } from '@/hooks/useFlights'

export function FlightsPage() {
  const { t } = useTranslation()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null)

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

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader onAddFlight={handleAddFlight} showAddButton />

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t('nav.flights', 'Flights')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('flights.pageSubtitle', 'Your complete flight history')}
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
          <FlightList onEdit={handleEditFlight} />
        </div>
      </main>

      {/* Flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        editFlight={editingFlight}
      />
    </div>
  )
}
