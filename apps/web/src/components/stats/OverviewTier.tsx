import { useTranslation } from 'react-i18next'
import { useFlightStats } from '@/hooks/useStats'
import { formatDistance } from '@/lib/geo'
import { Plane, Route, Globe2, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  icon: React.ElementType
  colorClass: string
  glowClass: string
  delay: number
}

function StatCard({ label, value, icon: Icon, colorClass, glowClass, delay }: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-border/50 bg-card p-5',
        'hover:border-border hover:shadow-lg',
        'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'hover:translate-y-[-2px]',
        // Linear-style glow on hover
        'hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
        'dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
        'opacity-0 animate-[fade-slide-up_0.5s_ease-out_forwards]'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100',
          'transition-opacity duration-300',
          'bg-gradient-to-br',
          colorClass
        )}
      />

      {/* Glow effect */}
      <div
        className={cn(
          'absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100',
          'transition-opacity duration-500 blur-xl',
          glowClass
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight font-data">
            {value}
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            {label}
          </p>
        </div>

        <div
          className={cn(
            'p-3 rounded-xl bg-secondary/60',
            'group-hover:scale-110 group-hover:bg-secondary/80',
            'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
          )}
        >
          <Icon
            className={cn(
              'w-5 h-5 text-muted-foreground',
              'group-hover:text-foreground',
              'transition-colors duration-300'
            )}
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  )
}

export function OverviewTier() {
  const { t } = useTranslation()
  const { data: stats, isLoading } = useFlightStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-8 w-16 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="w-11 h-11 bg-muted rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      label: t('dashboard.totalFlights', 'Total Flights'),
      value: stats?.totalFlights.toString() || '0',
      icon: Plane,
      colorClass: 'from-primary/10 to-primary/5',
      glowClass: 'bg-primary/20',
    },
    {
      label: t('dashboard.totalDistance', 'Distance'),
      value: stats?.totalDistance ? formatDistance(stats.totalDistance) : '0 km',
      icon: Route,
      colorClass: 'from-chart-2/10 to-chart-2/5',
      glowClass: 'bg-chart-2/20',
    },
    {
      label: t('dashboard.countriesVisited', 'Countries'),
      value: stats?.countriesVisited.toString() || '0',
      icon: Globe2,
      colorClass: 'from-chart-3/10 to-chart-3/5',
      glowClass: 'bg-chart-3/20',
    },
    {
      label: t('dashboard.airlinesFlown', 'Airlines'),
      value: stats?.airlinesFlown.toString() || '0',
      icon: Building2,
      colorClass: 'from-chart-4/10 to-chart-4/5',
      glowClass: 'bg-chart-4/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat, index) => (
        <StatCard
          key={stat.label}
          {...stat}
          delay={index * 75}
        />
      ))}
    </div>
  )
}
