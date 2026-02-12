import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
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
  ResponsiveContainer,
  Tooltip,
  RadarChart,
  Radar as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAdvancedStats } from '@/hooks/useAdvancedStats'
import { useFlightDurations } from '@/hooks/useFlightDurations'
import type { FlightDuration } from '@/hooks/useFlightDurations'
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

/** Distribute exactly 64 squares using the largest remainder method */
function allocateWaffleSquares(
  manufacturers: Array<{ name: string; count: number }>
): WaffleAllocation[] {
  if (manufacturers.length === 0) return []
  const total = manufacturers.reduce((s, m) => s + m.count, 0)
  if (total === 0) return []

  const sorted = [...manufacturers].sort((a, b) => b.count - a.count)

  // Compute ideal shares, assign floor (min 1 for entries with >0)
  const entries = sorted.map((m) => {
    const ideal = (m.count / total) * 64
    return {
      name: m.name,
      count: m.count,
      ideal,
      squares: Math.max(1, Math.floor(ideal)),
      pct: Math.round(((m.count / total) * 100) * 10) / 10,
    }
  })

  let assigned = entries.reduce((s, e) => s + e.squares, 0)

  // If min-1 guarantee pushed sum > 64, reduce the largest allocations
  while (assigned > 64) {
    const largest = entries.find((e) => e.squares > 1)
    if (!largest) break
    largest.squares--
    assigned--
  }

  // Distribute remaining squares by largest fractional remainder
  const remaining = 64 - assigned
  if (remaining > 0) {
    const byRemainder = [...entries]
      .filter((e) => e.squares < 64)
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
        'rounded-2xl border border-border/50 bg-card p-3 h-full flex flex-col',
        'transition-shadow duration-300 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted/30">
          <Icon className="w-4 h-4 text-muted-foreground" />
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
// Gaussian KDE + Ridgeline Chart
// ============================================================================

function gaussianKDE(values: number[], bandwidth: number, points: number[]): number[] {
  const n = values.length
  return points.map((x) => {
    let sum = 0
    for (const v of values) {
      const z = (x - v) / bandwidth
      sum += Math.exp(-0.5 * z * z)
    }
    return sum / (n * bandwidth * Math.sqrt(2 * Math.PI))
  })
}

function silvermanBandwidth(values: number[]): number {
  const n = values.length
  if (n < 2) return 30
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  const stddev = Math.sqrt(variance)
  return Math.max(10, 1.06 * stddev * n ** -0.2)
}

interface RidgelineRow {
  icao: string
  label: string
  manufacturer: string
  count: number
  avgDuration: number
  densityPoints: { x: number; y: number }[]
  maxDensity: number
}

function buildRidgelineData(
  aircraftBreakdown: Record<string, number>,
  durations: FlightDuration[]
): RidgelineRow[] {
  // Group durations by ICAO
  const byIcao = new Map<string, number[]>()
  for (const d of durations) {
    const arr = byIcao.get(d.aircraft_icao) ?? []
    arr.push(d.duration_minutes)
    byIcao.set(d.aircraft_icao, arr)
  }

  // Top 5 by flight count that have ≥ 3 duration data points
  const top = Object.entries(aircraftBreakdown)
    .sort(([, a], [, b]) => b - a)
    .filter(([icao]) => (byIcao.get(icao)?.length ?? 0) >= 3)
    .slice(0, 5)

  if (top.length === 0) return []

  // Shared x-axis: from 0 to max duration + padding
  const allDurations = durations.map((d) => d.duration_minutes)
  const maxDur = Math.max(...allDurations)
  const xMin = 0
  const xMax = Math.ceil(maxDur / 30) * 30 + 30
  const numPoints = 80
  const step = (xMax - xMin) / (numPoints - 1)
  const xPoints = Array.from({ length: numPoints }, (_, i) => xMin + i * step)

  return top.map(([icao, count]) => {
    const vals = byIcao.get(icao) ?? []
    const bw = silvermanBandwidth(vals)
    const density = gaussianKDE(vals, bw, xPoints)
    const maxD = Math.max(...density)
    const aircraft = findAircraft(icao)
    const avgDuration = vals.reduce((s, v) => s + v, 0) / vals.length

    return {
      icao,
      label: aircraft?.model ?? icao,
      manufacturer: aircraft?.manufacturer ?? 'Unknown',
      count,
      avgDuration,
      densityPoints: xPoints.map((x, i) => ({ x, y: density[i] })),
      maxDensity: maxD,
    }
  })
}

function FleetRidgeline({
  rows,
  mfrColors,
}: {
  rows: RidgelineRow[]
  mfrColors: Map<string, string>
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, rowIdx: number) => {
      const el = e.currentTarget.closest('svg')
      if (!el) return
      const rect = el.getBoundingClientRect()
      setHoveredRow(rowIdx)
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredRow(null)
    setTooltipPos(null)
  }, [])

  // Layout constants
  const labelW = 42
  const padR = 8
  const rowH = 28
  const overlap = 8
  const chartW = Math.max(width - labelW - padR, 60)
  const totalH = rows.length * (rowH - overlap) + overlap + 20 // +20 for x-axis

  // X scale based on density points range
  const xMin = rows[0]?.densityPoints[0]?.x ?? 0
  const xMax = rows[0]?.densityPoints[rows[0].densityPoints.length - 1]?.x ?? 600

  const xScale = (val: number) => ((val - xMin) / (xMax - xMin)) * chartW

  // Global max density for normalization
  const globalMax = Math.max(...rows.map((r) => r.maxDensity))

  // Generate x-axis ticks
  const tickValues = [60, 180, 360, 600].filter((v) => v <= xMax)

  const formatTick = (mins: number) => {
    if (mins < 60) return `${mins}m`
    return t('stats.fleetRidgeline.hours', { count: Math.round(mins / 60) })
  }

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={totalH}
          className="overflow-visible"
          onMouseLeave={handleMouseLeave}
        >
          {rows.map((row, idx) => {
            const yBase = idx * (rowH - overlap) + rowH
            const color = mfrColors.get(row.manufacturer) ?? 'var(--primary)'
            const curveH = rowH - 4
            const isHovered = hoveredRow === idx

            // Build SVG path
            const points = row.densityPoints.map((p) => ({
              px: labelW + xScale(p.x),
              py: yBase - (p.y / globalMax) * curveH,
            }))

            const areaPath = [
              `M ${points[0].px} ${yBase}`,
              `L ${points[0].px} ${points[0].py}`,
              ...points.slice(1).map((p) => `L ${p.px} ${p.py}`),
              `L ${points[points.length - 1].px} ${yBase}`,
              'Z',
            ].join(' ')

            const linePath = [
              `M ${points[0].px} ${points[0].py}`,
              ...points.slice(1).map((p) => `L ${p.px} ${p.py}`),
            ].join(' ')

            return (
              <g
                key={row.icao}
                onMouseMove={(e) => handleMouseMove(e, idx)}
                style={{ cursor: 'default' }}
              >
                {/* Label */}
                <text
                  x={labelW - 4}
                  y={yBase - rowH / 2 + 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  style={{ fontSize: '10px', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {row.label}
                </text>

                {/* Fill */}
                <path
                  d={areaPath}
                  fill={color}
                  opacity={isHovered ? 0.4 : 0.2}
                  className="transition-opacity duration-150"
                />

                {/* Stroke */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={isHovered ? 1 : 0.7}
                  className="transition-opacity duration-150"
                  style={{
                    strokeDasharray: isHovered ? 'none' : 'none',
                    animation: `ridgeline-draw 0.6s ease-out ${idx * 0.08}s both`,
                  }}
                />
              </g>
            )
          })}

          {/* X-axis ticks */}
          {tickValues.map((v) => {
            const x = labelW + xScale(v)
            const y = rows.length * (rowH - overlap) + overlap + 4
            return (
              <g key={v}>
                <line
                  x1={x}
                  y1={y - 2}
                  x2={x}
                  y2={y + 2}
                  stroke="var(--muted-foreground)"
                  strokeWidth={0.5}
                  opacity={0.4}
                />
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: '9px', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {formatTick(v)}
                </text>
              </g>
            )
          })}

          {/* Tooltip */}
          {hoveredRow !== null && tooltipPos && (
            <foreignObject
              x={Math.min(tooltipPos.x + 8, width - 140)}
              y={Math.max(tooltipPos.y - 36, 0)}
              width={130}
              height={44}
              style={{ pointerEvents: 'none' }}
            >
              <div className="bg-card border border-border/50 rounded px-2 py-1 shadow-sm">
                <div className="font-mono text-[10px] font-semibold">{rows[hoveredRow].label}</div>
                <div className="text-[9px] text-muted-foreground">
                  {rows[hoveredRow].count} {t('stats.flights')} · avg {Math.round(rows[hoveredRow].avgDuration)}m
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
      )}

      {/* CSS animation for stroke draw-in */}
      <style>{`
        @keyframes ridgeline-draw {
          from { stroke-dashoffset: 1000; stroke-dasharray: 1000; }
          to   { stroke-dashoffset: 0; stroke-dasharray: none; }
        }
      `}</style>

      {/* Manufacturer color legend */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {[...new Map(rows.map((r) => [r.manufacturer, mfrColors.get(r.manufacturer) ?? 'var(--primary)']))].map(
            ([mfr, color]) => (
              <div key={mfr} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: color }}
                />
                {mfr}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Aircraft Types Card — "Your Fleet" (Hero + Composition + Ridgeline)
// ============================================================================

export function AircraftTypesCard() {
  const { t } = useTranslation()
  const { data: advancedStats } = useAdvancedStats()
  const { data: durations } = useFlightDurations()
  const mfrColors = useManufacturerColorMap(advancedStats?.manufacturerBreakdown)

  const hero = advancedStats?.fleetInsights?.hero
  const typeBreakdown = advancedStats?.aircraftTypeBreakdown?.types

  // Bar chart data: top 3 with "Model · Manufacturer" labels
  const chartData = useMemo(() => {
    if (!advancedStats?.aircraftBreakdown) return []
    return Object.entries(advancedStats.aircraftBreakdown)
      .map(([icao, count]) => {
        const aircraft = findAircraft(icao)
        const label = aircraft
          ? aircraft.model
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

  const top8 = chartData.slice(0, 3)
  const overflowCount = chartData.length - 3
  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.count, 0),
    [chartData]
  )

  // Centralized decision: can we show ridgeline?
  const ridgelineRows = useMemo(() => {
    if (!advancedStats?.aircraftBreakdown || !durations || durations.length === 0) return []
    return buildRidgelineData(advancedStats.aircraftBreakdown, durations)
  }, [advancedStats?.aircraftBreakdown, durations])

  const showRidgeline = ridgelineRows.length >= 2

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

  return (
    <StatCard title={t('stats.aircraftTypesTitle', 'Your Fleet')} icon={Plane}>
      {chartData.length > 0 ? (
        <div className="space-y-1.5">
          {/* 3a. Hero Section */}
          {hero && (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-lg text-primary">{Math.round(hero.pct)}%</span>
                <span className="font-semibold text-sm">{hero.model}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {t(`stats.aircraftTypes.${hero.type}`, hero.type)}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {hero.manufacturer}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">
                {hero.fun_fact}
              </p>
            </div>
          )}

          {/* 3b. Fleet Composition Blocks */}
          {compositionSegments.length > 1 && (
            <div className="space-y-1">
              <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
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

          {/* 3c. Ridgeline or fallback bar chart — decided once in parent */}
          <div className="border-t border-border/30" />
          {showRidgeline ? (
            <FleetRidgeline
              rows={ridgelineRows}
              mfrColors={mfrColors}
            />
          ) : (
            <>
              <FleetBarChart items={top8} total={total} mfrColors={mfrColors} />
              {overflowCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {t('stats.nMore', { count: overflowCount })}
                </p>
              )}
            </>
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
// Fleet Bar Chart (pure CSS)
// ============================================================================

interface FleetBarItem {
  icao: string
  label: string
  count: number
  manufacturer: string
}

function FleetBarChart({
  items,
  total,
  mfrColors,
}: {
  items: FleetBarItem[]
  total: number
  mfrColors: Map<string, string>
}) {
  const maxCount = items.length > 0 ? items[0].count : 1
  return (
    <div className="flex flex-col gap-1">
      {items.map((item, idx) => (
        <FleetBar
          key={item.icao}
          item={item}
          maxCount={maxCount}
          total={total}
          color={mfrColors.get(item.manufacturer) ?? 'var(--primary)'}
          index={idx}
        />
      ))}
    </div>
  )
}

function FleetBar({
  item,
  maxCount,
  total,
  color,
  index,
}: {
  item: FleetBarItem
  maxCount: number
  total: number
  color: string
  index: number
}) {
  const widthPct = (item.count / maxCount) * 100
  const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : '0'

  return (
    <div
      className="group relative flex items-center gap-2 animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100"
      style={{
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="w-[100px] shrink-0 truncate text-[10px] text-muted-foreground">
        {item.label}
      </div>
      <div className="flex-1 h-3.5 rounded-sm bg-muted/20 relative overflow-hidden">
        <div
          className="h-full rounded-sm transition-[filter] duration-150 group-hover:brightness-125"
          style={{
            width: `${widthPct}%`,
            background: color,
          }}
        />
        {/* Hover tooltip */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -top-7 z-10 pointer-events-none',
            'hidden group-hover:block',
            'whitespace-nowrap px-1.5 py-0.5 rounded',
            'bg-card border border-border/50 text-[10px] font-mono shadow-sm'
          )}
        >
          {item.count} flights ({pct}%)
        </div>
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">
        {pct}%
      </span>
    </div>
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
  // Build flat array of 64 squares grouped by manufacturer (largest first)
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
      className="grid grid-cols-8 gap-0.5"
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
              idx < 8 ? 'top-full mt-1' : '-top-8'
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
        <div className="flex flex-col flex-1 gap-1.5">
          {/* 4a. Hero Loyalty Statement */}
          {insights && (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-lg text-primary">{Math.round(insights.pct)}%</span>
                <span className="font-semibold text-sm">{insights.name}</span>
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
              <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">
                {insights.loyalty_quip}
              </p>
            </div>
          )}

          {/* 4b. Waffle Chart */}
          <div className="space-y-2">
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
          <ResponsiveContainer width="100%" height={120}>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {t('stats.longestFlight', 'Longest')}
              </div>
              <div className="font-mono font-semibold text-sm">{stats.longest}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {t('stats.shortestFlight', 'Shortest')}
              </div>
              <div className="font-mono font-semibold text-sm">{stats.shortest}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {t('stats.averageFlight', 'Average')}
              </div>
              <div className="font-mono font-semibold text-sm">{stats.average}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {t('stats.totalTime', 'Total')}
              </div>
              <div className="font-mono font-semibold text-sm">{stats.total}</div>
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
