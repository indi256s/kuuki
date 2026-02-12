import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plane,
  Building2,
  Globe2,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  RadarChart,
  Radar as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'
import { formatDuration } from '@/lib/formatDuration'
import { findAircraft } from '@kuuki/data'

// ============================================================================
// Shared
// ============================================================================

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

// ============================================================================
// Waffle Chart Utilities
// ============================================================================

interface WaffleAllocation {
  name: string
  count: number
  squares: number
  pct: number
}

/** Distribute exactly 100 squares using the largest remainder method */
function allocateWaffleSquares(
  manufacturers: Array<{ name: string; count: number }>
): WaffleAllocation[] {
  if (manufacturers.length === 0) return []
  const total = manufacturers.reduce((s, m) => s + m.count, 0)
  if (total === 0) return []

  const sorted = [...manufacturers].sort((a, b) => b.count - a.count)

  // Compute ideal shares, assign floor (min 1 for entries with >0)
  const entries = sorted.map((m) => {
    const ideal = (m.count / total) * 100
    return {
      name: m.name,
      count: m.count,
      ideal,
      squares: Math.max(1, Math.floor(ideal)),
      pct: Math.round(ideal * 10) / 10,
    }
  })

  let assigned = entries.reduce((s, e) => s + e.squares, 0)

  // If min-1 guarantee pushed sum > 100, reduce the largest allocations
  while (assigned > 100) {
    const largest = entries.find((e) => e.squares > 1)
    if (!largest) break
    largest.squares--
    assigned--
  }

  // Distribute remaining squares by largest fractional remainder
  const remaining = 100 - assigned
  if (remaining > 0) {
    const byRemainder = [...entries]
      .filter((e) => e.squares < 100)
      .sort((a, b) => (b.ideal - Math.floor(b.ideal)) - (a.ideal - Math.floor(a.ideal)))
    for (let i = 0; i < remaining && i < byRemainder.length; i++) {
      byRemainder[i].squares++
    }
  }

  return entries.map(({ name, count, squares, pct }) => ({ name, count, squares, pct }))
}

/**
 * Brand-inspired manufacturer colors adapted to OKLCH.
 * Each hue is spread across the wheel for max distinction.
 * Matched keys are case-insensitive.
 */
const MANUFACTURER_COLORS: Record<string, string> = {
  airbus:       'oklch(0.56 0.12 250)',  // Airbus corporate blue
  boeing:       'oklch(0.62 0.13 195)',  // Boeing teal-cyan
  embraer:      'oklch(0.72 0.13 85)',   // Brazilian gold
  sukhoi:       'oklch(0.58 0.16 25)',   // Russian red-coral
  atr:          'oklch(0.58 0.12 300)',  // ATR purple
  bombardier:   'oklch(0.65 0.14 155)',  // Bombardier green
  'de havilland': 'oklch(0.65 0.13 45)', // De Havilland orange
  cessna:       'oklch(0.60 0.12 350)',  // Cessna rose
  comac:        'oklch(0.55 0.14 15)',   // COMAC vermillion
  tupolev:      'oklch(0.62 0.10 270)',  // Tupolev indigo
  antonov:      'oklch(0.68 0.11 120)',  // Antonov lime
  mcdonnell:    'oklch(0.58 0.11 220)',  // MD steel blue
  fokker:       'oklch(0.70 0.10 60)',   // Fokker amber
  saab:         'oklch(0.55 0.10 175)',  // Saab dark teal
}

/** Build a stable manufacturer → color map, preferring brand colors */
function useManufacturerColorMap(
  manufacturerBreakdown: Record<string, number> | null | undefined
) {
  return useMemo(() => {
    const map = new Map<string, string>()
    if (!manufacturerBreakdown) return map
    let fallbackIdx = 0
    Object.entries(manufacturerBreakdown)
      .sort(([, a], [, b]) => b - a)
      .forEach(([name]) => {
        const key = name.toLowerCase()
        // Try exact match, then partial match (e.g. "McDonnell Douglas" → "mcdonnell")
        const brandColor = MANUFACTURER_COLORS[key]
          ?? Object.entries(MANUFACTURER_COLORS).find(([k]) => key.includes(k))?.[1]
        if (brandColor) {
          map.set(name, brandColor)
        } else {
          map.set(name, CHART_COLORS[fallbackIdx % CHART_COLORS.length])
          fallbackIdx++
        }
      })
    return map
  }, [manufacturerBreakdown])
}

interface StatCardProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}

function StatCard({ title, icon: Icon, children, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-5 h-full flex flex-col',
        'transition-shadow duration-300 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/30">
          <Icon className="w-[18px] h-[18px] text-muted-foreground" />
        </div>
        <h4 className="font-medium text-sm">{title}</h4>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}

// ============================================================================
// Fleet Composition Type Colors
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  widebody:   'oklch(0.55 0.12 250)',  // deep blue — intercontinental heavies
  narrowbody: 'oklch(0.62 0.11 195)',  // teal — the workhorses
  regional:   'oklch(0.68 0.11 80)',   // warm amber — short hops
  turboprop:  'oklch(0.65 0.09 150)',  // sage — prop planes
  bizjet:     'oklch(0.58 0.12 300)',  // violet — premium/private
  piston: 'var(--muted-foreground)',
}

// ============================================================================
// Aircraft Types Card — "Your Fleet" (Hero + Composition + Bar Chart)
// ============================================================================

export function AircraftTypesCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const mfrColors = useManufacturerColorMap(advancedStats?.manufacturerBreakdown)

  const hero = advancedStats?.fleetInsights?.hero
  const typeBreakdown = advancedStats?.aircraftTypeBreakdown?.types

  // Bar chart data: top 8 with "Model · Manufacturer" labels
  const chartData = useMemo(() => {
    if (!advancedStats?.aircraftBreakdown) return []
    return Object.entries(advancedStats.aircraftBreakdown)
      .map(([icao, count]) => {
        const aircraft = findAircraft(icao)
        const label = aircraft
          ? `${aircraft.model} · ${aircraft.manufacturer}`
          : icao
        return {
          icao,
          label,
          count,
          manufacturer: aircraft?.manufacturer ?? 'Unknown',
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [advancedStats?.aircraftBreakdown])

  const top8 = chartData.slice(0, 8)
  const overflowCount = chartData.length - 8
  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.count, 0),
    [chartData]
  )

  // Fleet composition segments
  const compositionSegments = useMemo(() => {
    if (!typeBreakdown) return []
    const entries = Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a)
    const totalTypes = entries.reduce((s, [, c]) => s + c, 0)
    return entries.map(([type, count]) => ({
      type,
      count,
      pct: totalTypes > 0 ? (count / totalTypes) * 100 : 0,
    }))
  }, [typeBreakdown])

  const barHeight = Math.max(top8.length * 28, 60)

  return (
    <StatCard title={t('stats.aircraftTypesTitle', 'Your Fleet')} icon={Plane}>
      {chartData.length > 0 ? (
        <div className="space-y-4">
          {/* 3a. Hero Section */}
          {hero && (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-semibold text-lg">
                  {hero.model} <span className="text-muted-foreground font-normal">·</span> {hero.manufacturer}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {hero.count} {t('stats.flights', 'flights')}
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {t(`stats.aircraftTypes.${hero.type}`, hero.type)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {hero.fun_fact}
              </p>
            </div>
          )}

          {/* 3b. Fleet Composition Blocks */}
          {compositionSegments.length > 1 && (
            <div className="space-y-1.5">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {compositionSegments.map(({ type, pct }) => (
                  <div
                    key={type}
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      background: TYPE_COLORS[type] ?? 'var(--muted)',
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {compositionSegments.map(({ type, count }) => (
                  <div key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: TYPE_COLORS[type] ?? 'var(--muted)' }}
                    />
                    {t(`stats.aircraftTypes.${type}`, type)} {count}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3c. Improved Bar Chart (top 8) */}
          <div className="border-t border-border/30" />
          <ResponsiveContainer width="100%" height={Math.min(barHeight, 220)}>
            <BarChart
              data={top8}
              layout="vertical"
              margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={100}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number) => {
                  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0'
                  return [`${value} flights (${pct}%)`, '']
                }) as any}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                cursor={{ fill: 'color-mix(in srgb, var(--muted) 30%, transparent)' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                {top8.map((entry) => (
                  <Cell
                    key={entry.icao}
                    fill={mfrColors.get(entry.manufacturer) ?? 'var(--primary)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {overflowCount > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {t('stats.nMore', { count: overflowCount })}
            </p>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Waffle Chart Components
// ============================================================================

function WaffleGrid({
  allocations,
  colorMap,
}: {
  allocations: WaffleAllocation[]
  colorMap: Map<string, string>
}) {
  // Build flat array of 100 squares grouped by manufacturer (largest first)
  const squares = useMemo(() => {
    const result: Array<{ name: string; count: number; pct: number; color: string }> = []
    for (const alloc of allocations) {
      const color = colorMap.get(alloc.name) ?? 'var(--primary)'
      for (let i = 0; i < alloc.squares; i++) {
        result.push({ name: alloc.name, count: alloc.count, pct: alloc.pct, color })
      }
    }
    return result
  }, [allocations, colorMap])

  return (
    <div
      className="grid grid-cols-10 gap-0.5"
      role="img"
      aria-label="Manufacturer distribution waffle chart"
    >
      {squares.map((sq, idx) => (
        <div key={idx} className="group relative aspect-square">
          <div
            className="w-full h-full rounded-sm transition-transform duration-150 group-hover:scale-[1.2] animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100"
            style={{
              background: sq.color,
              animationDelay: `${idx * 8}ms`,
              animationFillMode: 'backwards',
            }}
            role="img"
            aria-label={`${sq.name}: ${sq.count} flights (${sq.pct}%)`}
          />
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none',
              'hidden group-hover:block',
              'whitespace-nowrap px-1.5 py-0.5 rounded',
              'bg-card border border-border/50 text-[10px] font-mono shadow-sm',
              idx < 10 ? 'top-full mt-1' : '-top-8'
            )}
          >
            {sq.name} · {sq.count} ({sq.pct}%)
          </div>
        </div>
      ))}
    </div>
  )
}

function WaffleLegend({
  allocations,
  colorMap,
}: {
  allocations: WaffleAllocation[]
  colorMap: Map<string, string>
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {allocations.map(({ name, count, pct }) => (
        <div key={name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ background: colorMap.get(name) ?? 'var(--primary)' }}
          />
          <span>{name}</span>
          <span className="font-mono">· {count} ({pct}%)</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Manufacturer Card — Hero Loyalty + Waffle Chart
// ============================================================================

export function ManufacturerCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const mfrColors = useManufacturerColorMap(advancedStats?.manufacturerBreakdown)

  const insights = advancedStats?.manufacturerInsights?.dominant

  const manufacturers = useMemo(() => {
    if (!advancedStats?.manufacturerBreakdown) return []
    return Object.entries(advancedStats.manufacturerBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [advancedStats?.manufacturerBreakdown])

  const allocations = useMemo(
    () => allocateWaffleSquares(manufacturers),
    [manufacturers]
  )

  return (
    <StatCard title={t('stats.manufacturers', 'Manufacturers')} icon={Building2}>
      {manufacturers.length > 0 ? (
        <div className="flex flex-col flex-1 gap-4">
          {/* 4a. Hero Loyalty Statement */}
          {insights && (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-2xl text-primary">{Math.round(insights.pct)}%</span>
                <span className="font-semibold text-base">{insights.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {insights.loyalty_label}
                </span>
                {insights.types_count > 1 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {t('stats.typesCount', { count: insights.types_count })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {insights.loyalty_quip}
              </p>
            </div>
          )}

          {/* 4b. Waffle Chart */}
          <div className="space-y-3">
            <WaffleGrid allocations={allocations} colorMap={mfrColors} />
            <WaffleLegend allocations={allocations} colorMap={mfrColors} />
          </div>
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Continent Progress Card (Radar)
// ============================================================================

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

  const continentBreakdown = advancedStats?.continentBreakdown

  const radarData = useMemo(() => {
    const continents = [
      { key: 'europe', label: t('continent.europe', 'Europe') },
      { key: 'asia', label: t('continent.asia', 'Asia') },
      { key: 'americas', label: t('continent.americas', 'Americas') },
      { key: 'africa', label: t('continent.africa', 'Africa') },
      { key: 'oceania', label: t('continent.oceania', 'Oceania') },
    ]
    return continents.map(({ key, label }) => {
      const visited = continentBreakdown?.[key] || 0
      const total = CONTINENT_TOTALS[key]
      return {
        continent: label,
        coverage: Math.round((visited / total) * 100),
        visited,
        total,
      }
    })
  }, [continentBreakdown, t])

  return (
    <StatCard title={t('stats.continentsTitle', 'World Coverage')} icon={Globe2}>
      {continentBreakdown ? (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="continent"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              />
              <RechartsRadar
                dataKey="coverage"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--primary)' }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, _name: string, props: any) => {
                  const p = props?.payload
                  return [`${p?.visited ?? 0}/${p?.total ?? 0} (${value}%)`, '']
                }) as any}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          {advancedStats?.cardInsights?.continent && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {advancedStats.cardInsights.continent}
            </p>
          )}
        </>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}

// ============================================================================
// Duration Stats Card (Enhanced)
// ============================================================================

export function DurationStatsCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()

  const durationStats = advancedStats?.durationStats
  const yearComparison = advancedStats?.durationYearComparison

  const stats = useMemo(() => {
    if (!durationStats) return null
    return {
      longest: formatDuration(durationStats.longest_minutes || 0),
      shortest: formatDuration(durationStats.shortest_minutes || 0),
      average: formatDuration(durationStats.avg_minutes || 0),
      total: formatDuration(durationStats.total_minutes || 0),
    }
  }, [durationStats])

  const deltaLabel = useMemo(() => {
    if (!yearComparison) return null
    if (yearComparison.previous_total_minutes === 0) {
      return { text: t('stats.firstYear', 'First year tracking'), positive: true }
    }
    const delta = yearComparison.delta_percent
    const sign = delta >= 0 ? '+' : ''
    return {
      text: `${sign}${Math.round(delta)}% ${t('stats.vsLastYear', 'vs last year')}`,
      positive: delta >= 0,
    }
  }, [yearComparison, t])

  return (
    <StatCard title={t('stats.durationStats', 'Flight Duration')} icon={Clock}>
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.longestFlight', 'Longest')}
              </div>
              <div className="font-mono font-semibold">{stats.longest}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.shortestFlight', 'Shortest')}
              </div>
              <div className="font-mono font-semibold">{stats.shortest}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.averageFlight', 'Average')}
              </div>
              <div className="font-mono font-semibold">{stats.average}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                {t('stats.totalTime', 'Total')}
              </div>
              <div className="font-mono font-semibold">{stats.total}</div>
              {deltaLabel && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                    deltaLabel.positive
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {deltaLabel.positive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {deltaLabel.text}
                </div>
              )}
            </div>
          </div>

          {advancedStats?.cardInsights?.duration && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              {advancedStats.cardInsights.duration}
            </p>
          )}
        </>
      ) : (
        <div className="h-16 rounded-lg bg-muted/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 italic">
            {t('stats.noData', 'No data yet')}
          </span>
        </div>
      )}
    </StatCard>
  )
}
