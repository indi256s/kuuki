import { useTranslation } from 'react-i18next'
import { Plane, TrendingUp, Globe2, Building2, MapPin, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistance } from '@/lib/geo'
import type { UserStats } from '@/lib/profiles'

interface ProfileStatsProps {
  stats: UserStats | null
  isLoading?: boolean
  /** Whether to hide the section title (useful when wrapped in ProfileSection) */
  hideTitle?: boolean
}

export function ProfileStats({ stats, isLoading, hideTitle = false }: ProfileStatsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  // Determine visual density based on travel volume
  // More flights = more stats shown
  const showExtended = (stats.total_flights ?? 0) >= 10
  const showAdvanced = (stats.total_flights ?? 0) >= 25

  const coreStats = [
    {
      label: t('dashboard.totalFlights', 'Flights'),
      value: (stats.total_flights ?? 0).toLocaleString(),
      icon: Plane,
      gradient: 'from-primary/10 to-primary/5',
      iconColor: 'text-primary',
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      value: formatDistance(stats.total_distance_km ?? 0),
      icon: TrendingUp,
      gradient: 'from-chart-2/10 to-chart-2/5',
      iconColor: 'text-chart-2',
    },
    {
      label: t('stats.countries', 'Countries'),
      value: (stats.countries_count ?? 0).toString(),
      icon: Globe2,
      gradient: 'from-chart-3/10 to-chart-3/5',
      iconColor: 'text-chart-3',
    },
    {
      label: t('stats.airlines', 'Airlines'),
      value: (stats.airlines_count ?? 0).toString(),
      icon: Building2,
      gradient: 'from-chart-4/10 to-chart-4/5',
      iconColor: 'text-chart-4',
    },
  ]

  const extendedStats = showExtended ? [
    {
      label: t('stats.cities', 'Cities'),
      value: (stats.cities_count ?? 0).toString(),
      icon: MapPin,
      gradient: 'from-chart-5/10 to-chart-5/5',
      iconColor: 'text-chart-5',
    },
    {
      label: t('stats.aircraftTypes', 'Aircraft'),
      value: (stats.aircraft_count ?? 0).toString(),
      icon: Layers,
      gradient: 'from-chart-1/10 to-chart-1/5',
      iconColor: 'text-chart-1',
    },
  ] : []

  const allStats = [...coreStats, ...extendedStats]

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h2 className="text-lg font-semibold">
          {t('stats.title', 'Stats')}
        </h2>
      )}

      <div className={`grid gap-4 ${showExtended ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
        {allStats.map((stat) => (
          <Card
            key={stat.label}
            className="group relative overflow-hidden border-border/50 hover:border-border hover:shadow-md transition-all duration-300"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

            <CardContent className="relative p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-2xl md:text-3xl font-semibold tracking-tight font-data">
                    {stat.value}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
                <div className={`p-2 rounded-lg bg-secondary/50 ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fun facts for advanced travelers */}
      {showAdvanced && (
        <div className="mt-6 p-4 rounded-xl bg-secondary/30 text-sm text-muted-foreground">
          <p>
            {(stats.continents_count ?? 0) >= 3 && (
              <span className="block">
                {t('stats.funFacts.continents', 'Visited {{count}} continents', { count: stats.continents_count ?? 0 })}
              </span>
            )}
            {(stats.total_distance_km ?? 0) >= 40075 && (
              <span className="block">
                {t('stats.funFacts.earthTrips', "You've flown {{count}} trips around Earth", {
                  count: Math.floor((stats.total_distance_km ?? 0) / 40075),
                })}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
