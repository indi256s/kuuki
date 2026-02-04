import { useState } from 'react'
import { Plane, Clock } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { FlightForm } from '@/components/flights/FlightForm'
import { cn } from '@/lib/utils'

export function UpcomingFlightsCard() {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()
    const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)

    const upcomingFlights = stats?.upcomingFlights || []

    // Return null if no upcoming flights - hide the card entirely
    if (upcomingFlights.length === 0) {
        return null
    }

    // Calculate countdown
    const getCountdown = (dateStr: string) => {
        const flightDate = new Date(dateStr)
        const now = new Date()
        const diffMs = flightDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return t('dashboard.today', 'Today')
        if (diffDays === 1) return t('dashboard.tomorrow', 'Tomorrow')
        return t('dashboard.daysUntil', `${diffDays} days`)
    }

    return (
        <>
            <div
                className={cn(
                    // Base card styles
                    'rounded-2xl border border-border/50 bg-card p-6',
                    'transition-all duration-300',
                    // Full width - spans all columns
                    'lg:col-span-3',
                    // Hover effect
                    'hover:border-primary/30 hover:shadow-glow-sm'
                )}
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">
                            {t('dashboard.upcomingFlights', 'Upcoming Flights')}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {upcomingFlights.length} {t('dashboard.flightsPlanned', 'flights planned')}
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {upcomingFlights.slice(0, 5).map((flight) => (
                        <button
                            key={flight.id}
                            onClick={() => setSelectedFlightId(flight.id)}
                            className={cn(
                                'p-4 rounded-xl border border-border/50',
                                'bg-muted/30 hover:bg-muted/50',
                                'transition-all duration-200',
                                'text-left group'
                            )}
                        >
                            {/* Route */}
                            <div className="flex items-center gap-2 mb-2">
                                <Plane className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono font-semibold">
                                        {flight.origin}
                                    </span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="font-mono font-semibold">
                                        {flight.destination}
                                    </span>
                                </div>
                            </div>

                            {/* Countdown badge */}
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {getCountdown(flight.date)}
                            </div>

                            {/* Flight details */}
                            <div className="mt-2 text-xs text-muted-foreground truncate">
                                {flight.airline_iata}
                                {flight.flight_number && ` ${flight.flight_number}`}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Flight edit dialog */}
            {selectedFlightId && (
                <FlightForm
                    isOpen={true}
                    onClose={() => setSelectedFlightId(null)}
                />
            )}
        </>
    )
}
