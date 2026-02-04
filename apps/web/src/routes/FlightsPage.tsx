import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Plane } from 'lucide-react'
import { FlightList } from '@/components/flights/FlightList'
import { FlightForm } from '@/components/flights/FlightForm'
import { AppHeader } from '@/components/common/AppHeader'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { FloatingActionButton } from '@/components/common/FloatingActionButton'
import { useSyncUpcomingFlights, type Flight } from '@/hooks/useFlights'

export function FlightsPage() {
  const { t } = useTranslation()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null)

  // Detect large screen for sidebar layout
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  useEffect(() => {
    // 3xl breakpoint = 1920px
    const mediaQuery = window.matchMedia('(min-width: 1920px)')
    setIsLargeScreen(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

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

      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop header */}
      <AppHeader onAddFlight={handleAddFlight} showAddButton />

      {/* Content - wider container, tighter spacing */}
      <main className="max-w-7xl 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe sm:pb-6">
        {/* Page header - compact single line */}
        <div className="flex items-center gap-3 mb-4 animate-fade-up">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Plane className="w-[18px] h-[18px] text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {t('nav.flights', 'Flights')}
            </h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {t('flights.pageSubtitle', 'Your complete flight history')}
            </span>
          </div>
        </div>

        {/* Flight list with conditional sidebar */}
        <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
          <FlightList
            onEdit={handleEditFlight}
            showSidebar={isLargeScreen}
          />
        </div>
      </main>

      {/* Flight form modal */}
      <FlightForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        editFlight={editingFlight}
      />

      {/* Mobile FAB for adding flights */}
      <FloatingActionButton
        icon={Plus}
        onClick={handleAddFlight}
        label={t('nav.addFlight')}
      />

      {/* Mobile tab bar */}
      <MobileTabBar />
    </div>
  )
}
