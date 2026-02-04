import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plane,
  Building2,
  Globe2,
  Clock,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdvancedStats, useUnlockProgress } from '@/hooks/useAdvancedStats'
import { formatDuration, type DepartureBucket } from '@/lib/formatDuration'

// ============================================================================
// Shared Types and Components
// ============================================================================

interface StatCardProps {
  title: string
  icon: React.ElementType
  iconColor?: string
  isLocked: boolean
  unlockProgress?: { current: number; required: number; label: string }
  children: React.ReactNode
  className?: string
}

function StatCard({
  title,
  icon: Icon,
  iconColor = 'bg-primary/10 text-primary',
  isLocked,
  unlockProgress,
  children,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-5',
        'transition-all duration-300',
        !isLocked && 'hover:border-primary/30 hover:shadow-glow-sm',
        isLocked && 'opacity-60',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconColor)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h4 className="font-medium text-sm">{title}</h4>
        {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
      </div>

      {/* Content */}
      {isLocked ? (
        <div className="space-y-3">
          <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          {unlockProgress && (
            <div className="text-xs text-muted-foreground text-center">
              {unlockProgress.current}/{unlockProgress.required} {unlockProgress.label}
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// Horizontal bar component
function HorizontalBar({
  label,
  value,
  total,
  color = 'bg-primary',
}: {
  label: string
  value: number
  total: number
  color?: string
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Aircraft Types Card
// ============================================================================

export function AircraftTypesCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: unlockProgress } = useUnlockProgress()

  const isLocked = !unlockProgress?.aviaGeek.unlocked
  const typeBreakdown = advancedStats?.aircraftTypeBreakdown?.types

  const total = useMemo(() => {
    if (!typeBreakdown) return 0
    return Object.values(typeBreakdown).reduce((sum, count) => sum + count, 0)
  }, [typeBreakdown])

  const types = [
    { key: 'widebody', label: t('stats.aircraft.widebody', 'Widebody'), color: 'bg-blue-500' },
    { key: 'narrowbody', label: t('stats.aircraft.narrowbody', 'Narrowbody'), color: 'bg-emerald-500' },
    { key: 'regional', label: t('stats.aircraft.regional', 'Regional'), color: 'bg-amber-500' },
  ]

  return (
    <StatCard
      title={t('stats.aircraftTypes', 'Aircraft Types')}
      icon={Plane}
      iconColor="bg-blue-500/10 text-blue-500"
      isLocked={isLocked}
      unlockProgress={{
        current: unlockProgress?.aviaGeek.current || 0,
        required: 5,
        label: t('stats.aircraftTypesRequired', 'aircraft types'),
      }}
    >
      <div className="space-y-3">
        {types.map(({ key, label, color }) => (
          <HorizontalBar
            key={key}
            label={label}
            value={typeBreakdown?.[key] || 0}
            total={total}
            color={color}
          />
        ))}
      </div>
    </StatCard>
  )
}

// ============================================================================
// Manufacturer Card
// ============================================================================

const MANUFACTURER_COLORS: Record<string, string> = {
  Airbus: 'bg-blue-500',
  Boeing: 'bg-sky-500',
  Embraer: 'bg-emerald-500',
  Bombardier: 'bg-red-500',
  ATR: 'bg-orange-500',
}

export function ManufacturerCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: unlockProgress } = useUnlockProgress()

  const isLocked = !unlockProgress?.aviaGeek.unlocked

  const manufacturers = useMemo(() => {
    if (!advancedStats?.manufacturerBreakdown) return []
    return Object.entries(advancedStats.manufacturerBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [advancedStats?.manufacturerBreakdown])

  const total = useMemo(() => {
    return manufacturers.reduce((sum, m) => sum + m.count, 0)
  }, [manufacturers])

  return (
    <StatCard
      title={t('stats.manufacturers', 'Manufacturers')}
      icon={Building2}
      iconColor="bg-sky-500/10 text-sky-500"
      isLocked={isLocked}
      unlockProgress={{
        current: unlockProgress?.aviaGeek.current || 0,
        required: 5,
        label: t('stats.aircraftTypesRequired', 'aircraft types'),
      }}
    >
      <div className="space-y-3">
        {manufacturers.map(({ name, count }) => (
          <HorizontalBar
            key={name}
            label={name}
            value={count}
            total={total}
            color={MANUFACTURER_COLORS[name] || 'bg-primary'}
          />
        ))}
      </div>
    </StatCard>
  )
}

// ============================================================================
// Continent Progress Card
// ============================================================================

const CONTINENT_COLORS: Record<string, string> = {
  europe: 'bg-blue-500',
  asia: 'bg-red-500',
  americas: 'bg-emerald-500',
  africa: 'bg-amber-500',
  oceania: 'bg-purple-500',
}

const CONTINENT_TOTALS: Record<string, number> = {
  europe: 44,
  asia: 48,
  americas: 35,
  africa: 54,
  oceania: 14,
}

export function ContinentProgressCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: unlockProgress } = useUnlockProgress()

  const isLocked = !unlockProgress?.countryGeek.unlocked
  const continentBreakdown = advancedStats?.continentBreakdown

  const continents = [
    { key: 'europe', label: t('continent.europe', 'Europe') },
    { key: 'asia', label: t('continent.asia', 'Asia') },
    { key: 'americas', label: t('continent.americas', 'Americas') },
    { key: 'africa', label: t('continent.africa', 'Africa') },
    { key: 'oceania', label: t('continent.oceania', 'Oceania') },
  ]

  return (
    <StatCard
      title={t('stats.continents', 'Continents')}
      icon={Globe2}
      iconColor="bg-emerald-500/10 text-emerald-500"
      isLocked={isLocked}
      unlockProgress={{
        current: unlockProgress?.countryGeek.current || 0,
        required: 5,
        label: t('stats.countriesRequired', 'countries'),
      }}
    >
      <div className="space-y-3">
        {continents.map(({ key, label }) => {
          const visited = continentBreakdown?.[key] || 0
          const total = CONTINENT_TOTALS[key] || 50
          return (
            <HorizontalBar
              key={key}
              label={`${label} (${visited}/${total})`}
              value={visited}
              total={total}
              color={CONTINENT_COLORS[key]}
            />
          )
        })}
      </div>
    </StatCard>
  )
}

// ============================================================================
// Departure Pattern Card
// ============================================================================

const PATTERN_COLORS: Record<DepartureBucket, string> = {
  red_eye: 'bg-indigo-500',
  early: 'bg-amber-500',
  business: 'bg-blue-500',
  evening: 'bg-orange-500',
}

export function DeparturePatternCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: unlockProgress } = useUnlockProgress()

  const isLocked = !unlockProgress?.duration.unlocked
  const patterns = advancedStats?.departurePatterns

  const total = patterns?.total_with_time || 0

  const patternData = [
    { key: 'red_eye' as DepartureBucket, label: t('stats.pattern.redEye', 'Night Owl'), time: '00:00-06:00' },
    { key: 'early' as DepartureBucket, label: t('stats.pattern.early', 'Early Bird'), time: '06:00-12:00' },
    { key: 'business' as DepartureBucket, label: t('stats.pattern.business', 'Business'), time: '12:00-18:00' },
    { key: 'evening' as DepartureBucket, label: t('stats.pattern.evening', 'Evening'), time: '18:00-00:00' },
  ]

  return (
    <StatCard
      title={t('stats.departurePatterns', 'Departure Patterns')}
      icon={Clock}
      iconColor="bg-indigo-500/10 text-indigo-500"
      isLocked={isLocked}
      unlockProgress={{
        current: unlockProgress?.duration.current || 0,
        required: 10,
        label: t('stats.flightsRequired', 'flights'),
      }}
    >
      <div className="space-y-3">
        {patternData.map(({ key, label, time }) => {
          const value = patterns?.[key] || 0
          return (
            <HorizontalBar
              key={key}
              label={`${label} (${time})`}
              value={value}
              total={total}
              color={PATTERN_COLORS[key]}
            />
          )
        })}
      </div>
    </StatCard>
  )
}

// ============================================================================
// Duration Stats Card
// ============================================================================

export function DurationStatsCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: unlockProgress } = useUnlockProgress()

  const isLocked = !unlockProgress?.duration.unlocked
  const durationStats = advancedStats?.durationStats

  const stats = useMemo(() => {
    if (!durationStats) return null

    return {
      longest: formatDuration(durationStats.longest_minutes || 0),
      shortest: formatDuration(durationStats.shortest_minutes || 0),
      average: formatDuration(durationStats.avg_minutes || 0),
      total: formatDuration(durationStats.total_minutes || 0),
    }
  }, [durationStats])

  return (
    <StatCard
      title={t('stats.durationStats', 'Flight Duration')}
      icon={Clock}
      iconColor="bg-amber-500/10 text-amber-500"
      isLocked={isLocked}
      unlockProgress={{
        current: unlockProgress?.duration.current || 0,
        required: 10,
        label: t('stats.flightsRequired', 'flights'),
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">
            {t('stats.longestFlight', 'Longest')}
          </div>
          <div className="font-mono font-semibold">{stats?.longest || '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">
            {t('stats.shortestFlight', 'Shortest')}
          </div>
          <div className="font-mono font-semibold">{stats?.shortest || '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">
            {t('stats.averageFlight', 'Average')}
          </div>
          <div className="font-mono font-semibold">{stats?.average || '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">
            {t('stats.totalTime', 'Total')}
          </div>
          <div className="font-mono font-semibold">{stats?.total || '—'}</div>
        </div>
      </div>
    </StatCard>
  )
}
