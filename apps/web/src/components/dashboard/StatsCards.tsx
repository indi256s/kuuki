import { useTranslation } from 'react-i18next'
import { useFlightStats } from '@/hooks/useStats'
import { formatDistance } from '@/lib/geo'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plane, TrendingUp, Globe2, Building2 } from 'lucide-react'

export function StatsCards() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useFlightStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-5">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm text-destructive">
            {t('errors.loadingStats', 'Failed to load stats')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const statItems = [
    {
      label: t('dashboard.totalFlights', 'Total Flights'),
      value: stats?.totalFlights.toString() || '0',
      icon: Plane,
      gradient: 'from-primary/10 to-primary/5',
      iconColor: 'text-primary',
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      value: stats?.totalDistance ? formatDistance(stats.totalDistance) : '0 km',
      icon: TrendingUp,
      gradient: 'from-chart-2/10 to-chart-2/5',
      iconColor: 'text-chart-2',
    },
    {
      label: t('dashboard.countriesVisited', 'Countries'),
      value: stats?.countriesVisited.toString() || '0',
      icon: Globe2,
      gradient: 'from-chart-3/10 to-chart-3/5',
      iconColor: 'text-chart-3',
    },
    {
      label: t('dashboard.airlinesFlown', 'Airlines'),
      value: stats?.airlinesFlown.toString() || '0',
      icon: Building2,
      gradient: 'from-chart-4/10 to-chart-4/5',
      iconColor: 'text-chart-4',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
      {statItems.map((stat) => (
        <Card
          key={stat.label}
          className="group relative overflow-hidden border-border/50 hover:border-border hover:shadow-md transition-all duration-300"
        >
          {/* Subtle gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

          <CardContent className="relative p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <p className="text-3xl font-semibold tracking-tight font-data">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl bg-secondary/50 ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
