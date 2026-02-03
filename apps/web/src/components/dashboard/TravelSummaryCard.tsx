import { Plane, Globe2, Ruler } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function TravelSummaryCard() {
    const { t } = useTranslation()
    const { data: stats } = useDashboardStats()

    if (!stats) return null

    const metrics = [
        {
            icon: Plane,
            value: stats.totalFlights,
            label: t('stats.totalFlights', 'Total Flights'),
            percentile: stats.percentiles.flights,
        },
        {
            icon: Globe2,
            value: stats.uniqueCountries,
            label: t('stats.countries', 'Countries'),
            percentile: stats.percentiles.countries,
        },
        {
            icon: Ruler,
            value: `${stats.totalDistance.toLocaleString()} km`,
            label: t('stats.distance', 'Distance'),
            percentile: stats.percentiles.distance,
        },
    ]

    return (
        <div
            className={cn(
                // Base card styles
                'rounded-2xl border border-border/50 bg-card p-6',
                'transition-all duration-300',
                // 2-column span on desktop
                'lg:col-span-2',
                // Hover effect
                'hover:border-primary/30 hover:shadow-glow-sm'
            )}
        >
            <h3 className="text-lg font-semibold mb-6">
                {t('dashboard.travelSummary', 'Travel Summary')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {metrics.map((metric, index) => {
                    const Icon = metric.icon
                    return (
                        <div key={index} className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Icon className="w-6 h-6" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="font-mono text-2xl font-semibold tracking-tight">
                                    {metric.value}
                                </div>
                                <div className="mt-1 text-sm font-medium text-foreground">
                                    {metric.label}
                                </div>
                                {metric.percentile !== null && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Top {metric.percentile}%
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
