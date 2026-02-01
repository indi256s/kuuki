import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FlightList } from '@/components/flights/FlightList'
import { FlightForm } from '@/components/flights/FlightForm'
import { useSyncUpcomingFlights, type Flight } from '@/hooks/useFlights'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

export function FlightsPage() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { currentLanguage, toggleLanguage } = useLanguage()
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
    <div className="min-h-screen bg-sky">
      {/* Header */}
      <header className="bg-sky-raised border-b border-edge sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-xl font-semibold text-ink">
              {t('common.appName')}
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {t('nav.dashboard', 'Dashboard')}
              </Link>
              <span className="text-sm text-runway font-medium">
                {t('nav.flights', 'Flights')}
              </span>
              <Link
                to="/import"
                className="text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {t('nav.import', 'Import')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAddFlight}
              className="flex items-center gap-2 px-4 py-2 bg-runway text-ink-inverse font-medium rounded-lg hover:bg-runway-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('flights.addFlight', 'Add Flight')}
            </button>
            <button
              onClick={toggleLanguage}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {currentLanguage === 'en' ? 'RU' : 'EN'}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <FlightList onEdit={handleEditFlight} />
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
