import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plane,
  Building2,
  Globe2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'
import { useBadgeTier } from '@/hooks/useBadgeTier'
import { getTierVisual } from '@/lib/tier-visuals'
import { getFlavorText } from '@/lib/glados-dashboard'
import { formatDuration, type DepartureBucket } from '@/lib/formatDuration'

// ============================================================================
// Shared Types and Components
// ============================================================================

type RevealState = 'hidden' | 'basic' | 'full'

interface StatCardProps {
  title: string
  icon: React.ElementType
  revealState: RevealState
  flavorText?: string
  tierAccent?: string
  tierIconBg?: string
  tierIconText?: string
  children: React.ReactNode
  basicChildren?: React.ReactNode
  className?: string
}

function StatCard({
  title,
  icon: Icon,
  revealState,
  flavorText,
  tierAccent,
  tierIconBg,
  tierIconText,
  children,
  basicChildren,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-5',
        'transition-all duration-300',
        revealState !== 'hidden' && 'hover:shadow-md',
        tierAccent || 'border-border/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', tierIconBg || 'bg-muted/30')}>
          <Icon className={cn('w-[18px] h-[18px]', tierIconText || 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          {flavorText && (
            <p className="text-[11px] italic text-muted-foreground/60 leading-snug mt-0.5 truncate">
              {flavorText}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      {revealState === 'hidden' ? (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            Insufficient data for analysis.
          </span>
        </div>
      ) : revealState === 'basic' ? (
        basicChildren ?? children
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

function getRevealState(tierIndex: number, basicMin: number, fullMin: number): RevealState {
  if (tierIndex >= fullMin) return 'full'
  if (tierIndex >= basicMin) return 'basic'
  return 'hidden'
}

// ============================================================================
// Aircraft Types Card
// ============================================================================

export function AircraftTypesCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { tier, tierIndex, value } = useBadgeTier('aircraft')

  const revealState = getRevealState(tierIndex, 0, 1)
  const visual = getTierVisual(tier)
  const flavorText = getFlavorText('aircraft', tierIndex, value)

  const typeBreakdown = advancedStats?.aircraftTypeBreakdown?.types

  const total = useMemo(() => {
    if (!typeBreakdown) return 0
    return Object.values(typeBreakdown).reduce((sum, count) => sum + count, 0)
  }, [typeBreakdown])

  const types = [
    { key: 'widebody', label: t('stats.aircraft.widebody', 'Widebody'), color: 'bg-chart-1' },
    { key: 'narrowbody', label: t('stats.aircraft.narrowbody', 'Narrowbody'), color: 'bg-chart-2' },
    { key: 'regional', label: t('stats.aircraft.regional', 'Regional'), color: 'bg-chart-3' },
  ]

  // Basic view: only show the top type
  const topType = useMemo(() => {
    if (!typeBreakdown) return null
    return types.reduce<{ key: string; label: string; color: string } | null>((best, t) => {
      const count = typeBreakdown?.[t.key] || 0
      const bestCount = best ? (typeBreakdown?.[best.key] || 0) : 0
      return count > bestCount ? t : best
    }, null)
  }, [typeBreakdown, types])

  return (
    <StatCard
      title={t('stats.aircraftTypes', 'Aircraft Types')}
      icon={Plane}
      revealState={revealState}
      flavorText={flavorText}
      tierAccent={visual.border}
      tierIconBg={visual.iconBg}
      tierIconText={visual.text}
      basicChildren={
        topType && (
          <HorizontalBar
            label={topType.label}
            value={typeBreakdown?.[topType.key] || 0}
            total={total}
            color={topType.color}
          />
        )
      }
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
  Airbus: 'bg-chart-1',
  Boeing: 'bg-chart-4',
  Embraer: 'bg-chart-2',
  Bombardier: 'bg-chart-5',
  ATR: 'bg-chart-3',
}

export function ManufacturerCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { tier, tierIndex, value } = useBadgeTier('aircraft')

  const revealState = getRevealState(tierIndex, 0, 1)
  const visual = getTierVisual(tier)
  const flavorText = getFlavorText('aircraft', tierIndex, value)

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
      revealState={revealState}
      flavorText={flavorText}
      tierAccent={visual.border}
      tierIconBg={visual.iconBg}
      tierIconText={visual.text}
      basicChildren={
        manufacturers.length > 0 ? (
          <HorizontalBar
            label={manufacturers[0].name}
            value={manufacturers[0].count}
            total={total}
            color={MANUFACTURER_COLORS[manufacturers[0].name] || 'bg-primary'}
          />
        ) : undefined
      }
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
  europe: 'bg-chart-1',
  asia: 'bg-chart-5',
  americas: 'bg-chart-2',
  africa: 'bg-chart-3',
  oceania: 'bg-chart-4',
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
  const { tier, tierIndex, value } = useBadgeTier('countries')

  const revealState = getRevealState(tierIndex, 0, 1)
  const visual = getTierVisual(tier)
  const flavorText = getFlavorText('countries', tierIndex, value)

  const continentBreakdown = advancedStats?.continentBreakdown

  const continents = [
    { key: 'europe', label: t('continent.europe', 'Europe') },
    { key: 'asia', label: t('continent.asia', 'Asia') },
    { key: 'americas', label: t('continent.americas', 'Americas') },
    { key: 'africa', label: t('continent.africa', 'Africa') },
    { key: 'oceania', label: t('continent.oceania', 'Oceania') },
  ]

  // Basic view: only the continent with the most countries visited
  const topContinent = useMemo(() => {
    if (!continentBreakdown) return null
    return continents.reduce<{ key: string; label: string } | null>((best, c) => {
      const count = continentBreakdown?.[c.key] || 0
      const bestCount = best ? (continentBreakdown?.[best.key] || 0) : 0
      return count > bestCount ? c : best
    }, null)
  }, [continentBreakdown, continents])

  return (
    <StatCard
      title={t('stats.continents', 'Continents')}
      icon={Globe2}
      revealState={revealState}
      flavorText={flavorText}
      tierAccent={visual.border}
      tierIconBg={visual.iconBg}
      tierIconText={visual.text}
      basicChildren={
        topContinent && (
          <HorizontalBar
            label={`${topContinent.label} (${continentBreakdown?.[topContinent.key] || 0}/${CONTINENT_TOTALS[topContinent.key] || 50})`}
            value={continentBreakdown?.[topContinent.key] || 0}
            total={CONTINENT_TOTALS[topContinent.key] || 50}
            color={CONTINENT_COLORS[topContinent.key]}
          />
        )
      }
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
  red_eye: 'bg-chart-4',
  early: 'bg-chart-3',
  business: 'bg-chart-1',
  evening: 'bg-chart-2',
}

export function DeparturePatternCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { tier, tierIndex, value } = useBadgeTier('flights')

  const revealState = getRevealState(tierIndex, 0, 1)
  const visual = getTierVisual(tier)
  const flavorText = getFlavorText('flights', tierIndex, value)

  const patterns = advancedStats?.departurePatterns
  const total = patterns?.total_with_time || 0

  const patternData = [
    { key: 'red_eye' as DepartureBucket, label: t('stats.pattern.redEye', 'Night Owl'), time: '00:00-06:00' },
    { key: 'early' as DepartureBucket, label: t('stats.pattern.early', 'Early Bird'), time: '06:00-12:00' },
    { key: 'business' as DepartureBucket, label: t('stats.pattern.business', 'Business'), time: '12:00-18:00' },
    { key: 'evening' as DepartureBucket, label: t('stats.pattern.evening', 'Evening'), time: '18:00-00:00' },
  ]

  // Basic view: show dominant pattern only
  const dominant = useMemo(() => {
    if (!patterns) return null
    return patternData.reduce<{ key: DepartureBucket; label: string; time: string } | null>((best, p) => {
      const count = patterns?.[p.key] || 0
      const bestCount = best ? (patterns?.[best.key] || 0) : 0
      return count > bestCount ? p : best
    }, null)
  }, [patterns, patternData])

  return (
    <StatCard
      title={t('stats.departurePatterns', 'Departure Patterns')}
      icon={Clock}
      revealState={revealState}
      flavorText={flavorText}
      tierAccent={visual.border}
      tierIconBg={visual.iconBg}
      tierIconText={visual.text}
      basicChildren={
        dominant && (
          <HorizontalBar
            label={`${dominant.label} (${dominant.time})`}
            value={patterns?.[dominant.key] || 0}
            total={total}
            color={PATTERN_COLORS[dominant.key]}
          />
        )
      }
    >
      <div className="space-y-3">
        {patternData.map(({ key, label, time }) => {
          const val = patterns?.[key] || 0
          return (
            <HorizontalBar
              key={key}
              label={`${label} (${time})`}
              value={val}
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
  const { tier, tierIndex, value } = useBadgeTier('flights')

  const revealState = getRevealState(tierIndex, 0, 1)
  const visual = getTierVisual(tier)
  const flavorText = getFlavorText('flights', tierIndex, value)

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
      revealState={revealState}
      flavorText={flavorText}
      tierAccent={visual.border}
      tierIconBg={visual.iconBg}
      tierIconText={visual.text}
      basicChildren={
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">
              {t('stats.longestFlight', 'Longest')}
            </div>
            <div className="font-mono font-semibold">{stats?.longest || '—'}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">
              {t('stats.averageFlight', 'Average')}
            </div>
            <div className="font-mono font-semibold">{stats?.average || '—'}</div>
          </div>
        </div>
      }
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
