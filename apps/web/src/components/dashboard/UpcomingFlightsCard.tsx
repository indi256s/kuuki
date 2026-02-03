import { useState } from 'react'
import { Plane, Clock } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { FlightForm } from '@/components/flights/FlightForm'
import { gladosText } from '@/lib/glados-text'
import { cn } from '@/lib/utils'

export function UpcomingFlightsCard() {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()
    const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)

    const upcomingFlights = stats?.upcomingFlights || []
    const hasUpcoming = upcomingFlights.length > 0

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
                    // 2-column span on desktop
                    'lg:col-span-2',
                    // Hover effect
                    hasUpcoming && 'hover:border-primary/30 hover:shadow-glow-sm'
                )}
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold">
                        {t('dashboard.upcomingFlights', 'Upcoming Flights')}
                    </h3>
                </div>

                {hasUpcoming ? (
                    <div className="space-y-3">
                        {upcomingFlights.map((flight) => (
                            <button
                                key={flight.id}
                                onClick={() => setSelectedFlightId(flight.id)}
                                className={cn(
                                    'w-full p-4 rounded-xl border border-border/50',
                                    'bg-muted/30 hover:bg-muted/50',
                                    'transition-all duration-200',
                                    'text-left group'
                                )}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    {/* Route */}
                                    <div className="flex items-center gap-3 flex-1">
                                        <Plane className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold">
                                                {flight.origin}
                                            </span>
                                            <span className="text-muted-foreground">→</span>
                                            <span className="font-mono font-semibold">
                                                {flight.destination}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Countdown */}
                                    <div className="text-sm text-muted-foreground">
                                        {getCountdown(flight.date)}
                                    </div>
                                </div>

                                {/* Flight details */}
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {flight.airline_iata}
                                    {flight.flight_number && ` ${flight.flight_number}`}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        {gladosText.emptyStates.noUpcomingFlights}
                    </div>
                )}
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
