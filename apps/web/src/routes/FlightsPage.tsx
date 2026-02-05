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
      <main className="max-w-7xl 3xl:max-w-[1800px] mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-safe sm:pb-10">
        {/* Page header - strong hierarchy with breathing room */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {t('nav.flights', 'Flights')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[60px] hidden sm:block">
            {t('flights.pageSubtitle', 'Your complete flight history')}
          </p>
        </div>

        {/* Flight list with conditional sidebar */}
        <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
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
