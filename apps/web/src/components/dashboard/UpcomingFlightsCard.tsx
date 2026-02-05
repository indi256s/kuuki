import { useState } from 'react'
import { Plane, Clock } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useFlight } from '@/hooks/useFlights'
import { useTranslation } from 'react-i18next'
import { FlightForm } from '@/components/flights/FlightForm'
import { cn } from '@/lib/utils'

export function UpcomingFlightsCard({ className }: { className?: string }) {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()
    const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
    const { data: selectedFlight } = useFlight(selectedFlightId)

    const upcomingFlights = stats?.upcomingFlights || []

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
                    'rounded-2xl border border-border/50 bg-card p-5 h-full',
                    'transition-all duration-200',
                    'hover:border-primary/30 hover:shadow-glow-sm',
                    'flex flex-col relative overflow-hidden',
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 z-10">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {t('dashboard.nextMission', 'Next Assignment')}
                    </h3>
                    {upcomingFlights.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                            <Clock className="w-3 h-3" />
                            {getCountdown(upcomingFlights[0].date)}
                        </div>
                    )}
                </div>

                {/* Main Content - Centered */}
                <div className="flex-1 flex flex-col justify-center z-10">
                    {upcomingFlights.length > 0 ? (
                        <button
                            onClick={() => setSelectedFlightId(upcomingFlights[0].id)}
                            aria-label={`View flight from ${upcomingFlights[0].origin} to ${upcomingFlights[0].destination}`}
                            className="text-left w-full group cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-3xl font-bold font-mono tracking-tight group-hover:text-primary transition-colors">
                                    {upcomingFlights[0].origin}
                                </div>
                                <Plane className="w-5 h-5 text-muted-foreground/50 rotate-90" />
                                <div className="text-3xl font-bold font-mono tracking-tight group-hover:text-primary transition-colors">
                                    {upcomingFlights[0].destination}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center justify-between">
                                <span>{upcomingFlights[0].airline_iata} {upcomingFlights[0].flight_number}</span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary text-[10px] uppercase tracking-wider">
                                    View Data &rarr;
                                </span>
                            </div>
                        </button>
                    ) : (
                        <div className="text-center">
                            <Plane className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                                {t('dashboard.noUpcoming', 'No upcoming flights')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer / Count */}
                {upcomingFlights.length > 1 && (
                    <div className="mt-auto pt-3 border-t border-border/30 flex justify-between items-center text-[10px] text-muted-foreground z-10">
                        <span>+ {upcomingFlights.length - 1} pending</span>
                    </div>
                )}

                {/* Background decoration */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl z-0" />
            </div>

            {/* Flight edit dialog */}
            {selectedFlightId && selectedFlight && (
                <FlightForm
                    isOpen={true}
                    onClose={() => setSelectedFlightId(null)}
                    editFlight={selectedFlight}
                />
            )}
        </>
    )
}
