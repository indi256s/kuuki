import { useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRecentFlights } from '@/hooks/useFlights'
import { findAirport, findAirline } from '@kuuki/data'
import { generateGreatCircleArc } from '@/lib/geo'
import { getCountryData } from '@/lib/countries'
import type { Flight } from '@/hooks/useFlights'
import { cn } from '@/lib/utils'

interface RouteMapWithCountriesProps {
  flights?: Flight[]
  visitedCountries?: string[]
  height?: string
  className?: string
  interactive?: boolean
  onExpand?: () => void
}

interface ArcData {
  id: number
  origin: { lat: number; lon: number; iata: string }
  destination: { lat: number; lon: number; iata: string }
  airline?: string
  airlineColor?: string
}

const MAP_WIDTH = 960
const MAP_HEIGHT = 480

export function RouteMapWithCountries({
  flights: propFlights,
  visitedCountries = [],
  height = '300px',
  className,
  interactive = false,
  onExpand,
}: RouteMapWithCountriesProps) {
  const { t } = useTranslation()
  const { data: recentFlights = [] } = useRecentFlights(50)
  const [colorMode, setColorMode] = useState<'airline' | 'route'>('airline')

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const flights = propFlights ?? recentFlights
  const visitedSet = useMemo(() => new Set(visitedCountries), [visitedCountries])

  const arcs = useMemo<ArcData[]>(() => {
    const result: ArcData[] = []
    const seen = new Set<string>()

    for (const flight of flights) {
      const key = `${flight.origin}-${flight.destination}`
      if (seen.has(key)) continue
      seen.add(key)

      const originAirport = findAirport(flight.origin)
      const destAirport = findAirport(flight.destination)
      if (!originAirport || !destAirport) continue

      const airline = flight.airline_iata ? findAirline(flight.airline_iata) : null

      result.push({
        id: flight.id,
        origin: { lat: originAirport.latitude, lon: originAirport.longitude, iata: originAirport.iata },
        destination: { lat: destAirport.latitude, lon: destAirport.longitude, iata: destAirport.iata },
        airline: airline?.iata,
        airlineColor: airline?.primaryColor || '#94a3b8',
      })
    }
    return result
  }, [flights])

  const airports = useMemo(() => {
    const airportMap = new Map<string, { lat: number; lon: number; iata: string }>()
    for (const arc of arcs) {
      airportMap.set(arc.origin.iata, arc.origin)
      airportMap.set(arc.destination.iata, arc.destination)
    }
    return Array.from(airportMap.values())
  }, [arcs])

  const toSvgCoords = useCallback((lat: number, lon: number): [number, number] => {
    const x = ((lon + 180) / 360) * MAP_WIDTH
    const y = ((85 - lat) / 145) * MAP_HEIGHT
    return [x, y]
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [interactive, transform.x, transform.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !interactive) return
    const maxPan = 200 * transform.scale
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStart.x))
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStart.y))
    setTransform(prev => ({ ...prev, x: newX, y: newY }))
  }, [isDragging, interactive, dragStart, transform.scale])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => ({ ...prev, scale: Math.max(1, Math.min(4, prev.scale * delta)) }))
  }, [interactive])

  const handleReset = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [])

  const handleClick = useCallback(() => {
    if (!isDragging && onExpand) onExpand()
  }, [isDragging, onExpand])

  // Empty state
  if (flights.length === 0 && visitedCountries.length === 0) {
    return (
      <div className={cn('relative overflow-hidden flex items-center justify-center bg-[#080d14]', className)} style={{ height }}>
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.08) 0%, transparent 60%)' }} />
        <div className="relative text-center z-10">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className="text-sm text-slate-500 font-medium tracking-wide">
            {t('dashboard.noRouteData', 'Add flights to see your route map')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#080d14]',
        interactive && 'cursor-grab active:cursor-grabbing',
        !interactive && onExpand && 'cursor-pointer group',
        className
      )}
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={!interactive ? handleClick : undefined}
    >
      {/* Atmospheric glow at top */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none z-[1]"
        style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(56, 189, 248, 0.06) 0%, transparent 70%)' }}
      />

      {/* Color mode toggle */}
      {arcs.length > 0 && (
        <div className="absolute top-3 right-3 z-20 flex bg-black/40 backdrop-blur-md rounded-full p-0.5 border border-white/5">
          {(['airline', 'route'] as const).map((mode) => (
            <button
              key={mode}
              onClick={(e) => { e.stopPropagation(); setColorMode(mode) }}
              className={cn(
                'px-3 py-1 text-[10px] uppercase tracking-widest font-medium rounded-full transition-all duration-200',
                colorMode === mode
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      )}

      {/* Reset button */}
      {interactive && transform.scale > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleReset() }}
          className="absolute top-3 left-3 z-20 px-3 py-1 text-[10px] uppercase tracking-widest font-medium bg-black/40 backdrop-blur-md rounded-full text-white/50 hover:text-white/90 transition-colors border border-white/5"
        >
          Reset
        </button>
      )}

      {/* SVG Map */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <defs>
          {/* Ocean gradient */}
          <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c1421" />
            <stop offset="100%" stopColor="#060a10" />
          </linearGradient>

          {/* Land gradient */}
          <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a2536" />
            <stop offset="100%" stopColor="#0f1724" />
          </linearGradient>

          {/* Route glow filter */}
          <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Country glow */}
          <filter id="countryGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Ocean */}
        <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGrad)" />

        {/* Subtle coordinate grid */}
        <g opacity="0.08">
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, y] = toSvgCoords(lat, 0)
            return (
              <line key={`lat-${lat}`} x1="0" y1={y} x2={MAP_WIDTH} y2={y} stroke="#64748b" strokeWidth="0.5" strokeDasharray={lat === 0 ? 'none' : '2 6'} />
            )
          })}
          {[-120, -60, 0, 60, 120].map((lon) => {
            const [x] = toSvgCoords(0, lon)
            return (
              <line key={`lon-${lon}`} x1={x} y1="0" x2={x} y2={MAP_HEIGHT} stroke="#64748b" strokeWidth="0.5" strokeDasharray={lon === 0 ? 'none' : '2 6'} />
            )
          })}
        </g>

        {/* Continent shapes */}
        <ContinentShapes toSvgCoords={toSvgCoords} />

        {/* Visited countries */}
        <VisitedCountryHighlights visitedSet={visitedSet} toSvgCoords={toSvgCoords} />

        {/* Flight routes */}
        <g className="flight-routes">
          {arcs.map((arc, i) => {
            const arcPoints = generateGreatCircleArc(arc.origin.lat, arc.origin.lon, arc.destination.lat, arc.destination.lon, 40)
            const pathData = arcPoints.map((p, idx) => {
              const [x, y] = toSvgCoords(p[1], p[0])
              return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
            }).join(' ')

            const baseColor = colorMode === 'airline' ? arc.airlineColor : `hsl(${(i * 47 + 200) % 360}, 70%, 65%)`

            return (
              <g key={arc.id}>
                {/* Soft outer glow */}
                <path d={pathData} fill="none" stroke={baseColor} strokeWidth="8" strokeLinecap="round" opacity="0.08" filter="url(#routeGlow)" />
                {/* Mid glow */}
                <path d={pathData} fill="none" stroke={baseColor} strokeWidth="3" strokeLinecap="round" opacity="0.25" />
                {/* Core line */}
                <path d={pathData} fill="none" stroke={baseColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
                {/* Animated dash */}
                <path d={pathData} fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeDasharray="1 16" opacity="0.4" className="animate-[dash_3s_linear_infinite]" />
              </g>
            )
          })}
        </g>

        {/* Airport markers */}
        <g className="airport-markers">
          {airports.map((airport) => {
            const [x, y] = toSvgCoords(airport.lat, airport.lon)
            return (
              <g key={airport.iata}>
                {/* Pulse ring */}
                <circle cx={x} cy={y} r="6" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" className="animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ transformOrigin: `${x}px ${y}px` }} />
                {/* Glow */}
                <circle cx={x} cy={y} r="4" fill="white" opacity="0.1" />
                {/* Core */}
                <circle cx={x} cy={y} r="2" fill="white" opacity="0.9" />
                {/* Label */}
                {(interactive || airports.length < 20) && (
                  <text x={x} y={y - 8} textAnchor="middle" fill="white" fontSize="6" fontFamily="ui-monospace, monospace" fontWeight="600" letterSpacing="0.1em" opacity="0.7">
                    {airport.iata}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Bottom gradient overlay with stats */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-12 pb-4 px-4 z-10">
        <div className="flex items-center gap-5 text-[11px] tracking-wide">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-white font-semibold">{arcs.length}</span>
            <span className="text-white/50 uppercase text-[9px] tracking-widest">{t('map.routes', 'Routes')}</span>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-white font-semibold">{airports.length}</span>
            <span className="text-white/50 uppercase text-[9px] tracking-widest">{t('map.airports', 'Airports')}</span>
          </div>
          {visitedCountries.length > 0 && (
            <>
              <div className="w-px h-3 bg-white/20" />
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-white font-semibold">{visitedCountries.length}</span>
                <span className="text-white/50 uppercase text-[9px] tracking-widest">{t('map.countries', 'Countries')}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expand hint on hover */}
      {onExpand && !interactive && (
        <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-[10px] text-white/70 font-medium tracking-wide uppercase">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Expand</span>
          </div>
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes dash { to { stroke-dashoffset: -34; } }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.2; } 75%, 100% { transform: scale(2.5); opacity: 0; } }
      `}</style>
    </div>
  )
}

// Refined continent shapes
function ContinentShapes({ toSvgCoords }: { toSvgCoords: (lat: number, lon: number) => [number, number] }) {
  const continents = [
    // North America - refined shape
    { name: 'na', points: [[-168, 66], [-141, 70], [-95, 72], [-85, 68], [-75, 58], [-57, 50], [-67, 44], [-75, 35], [-82, 25], [-88, 19], [-97, 18], [-105, 22], [-118, 33], [-125, 40], [-125, 50], [-140, 60], [-168, 66]] },
    // Central America
    { name: 'ca', points: [[-88, 19], [-85, 14], [-82, 9], [-78, 8], [-80, 15], [-88, 19]] },
    // South America
    { name: 'sa', points: [[-82, 10], [-77, 5], [-70, 12], [-60, 5], [-50, 0], [-35, -5], [-38, -15], [-42, -23], [-48, -28], [-58, -38], [-68, -55], [-75, -50], [-70, -18], [-78, -5], [-82, 10]] },
    // Europe
    { name: 'eu', points: [[-10, 36], [0, 38], [3, 43], [-2, 44], [-9, 44], [-9, 52], [0, 52], [5, 54], [12, 55], [10, 58], [18, 60], [28, 70], [32, 70], [38, 68], [30, 55], [25, 45], [15, 38], [5, 36], [-10, 36]] },
    // Africa
    { name: 'af', points: [[-17, 15], [-17, 22], [-5, 36], [10, 37], [32, 32], [43, 12], [52, 12], [40, -12], [35, -22], [28, -33], [18, -35], [12, -28], [20, -18], [15, 0], [-5, 5], [-17, 15]] },
    // Asia main
    { name: 'as', points: [[30, 42], [40, 45], [60, 55], [70, 70], [100, 78], [140, 72], [170, 63], [160, 55], [143, 45], [135, 35], [122, 25], [108, 22], [105, 10], [100, 3], [95, 6], [85, 22], [68, 24], [60, 30], [42, 32], [30, 42]] },
    // India
    { name: 'in', points: [[68, 24], [72, 22], [78, 8], [80, 12], [88, 22], [95, 20], [92, 26], [85, 28], [68, 24]] },
    // Southeast Asia
    { name: 'sea', points: [[95, 20], [100, 3], [103, 1], [105, 6], [108, 16], [106, 22], [95, 20]] },
    // Australia
    { name: 'au', points: [[114, -20], [130, -12], [142, -11], [152, -23], [154, -28], [150, -37], [145, -39], [136, -35], [129, -32], [115, -35], [114, -26], [114, -20]] },
    // Japan
    { name: 'jp', points: [[130, 31], [132, 34], [136, 35], [140, 38], [142, 43], [145, 45], [143, 42], [140, 40], [138, 35], [134, 34], [130, 31]] },
    // UK
    { name: 'uk', points: [[-6, 50], [2, 51], [2, 55], [-2, 58], [-5, 58], [-8, 55], [-10, 52], [-6, 50]] },
    // New Zealand
    { name: 'nz', points: [[166, -35], [175, -37], [178, -42], [174, -46], [168, -46], [166, -42], [166, -35]] },
    // Indonesia (simplified)
    { name: 'id', points: [[95, 6], [108, 6], [115, -3], [140, -3], [140, -8], [115, -8], [105, 0], [95, 6]] },
  ]

  return (
    <g className="continents">
      {continents.map((c) => {
        const d = c.points.map((point, idx) => {
          const [x, y] = toSvgCoords(point[1], point[0])
          return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
        }).join(' ') + ' Z'

        return (
          <path
            key={c.name}
            d={d}
            fill="url(#landGrad)"
            stroke="#334155"
            strokeWidth="0.3"
            opacity="0.9"
          />
        )
      })}
    </g>
  )
}

// Visited country highlights
function VisitedCountryHighlights({ visitedSet, toSvgCoords }: { visitedSet: Set<string>; toSvgCoords: (lat: number, lon: number) => [number, number] }) {
  const positions: Record<string, [number, number]> = {
    US: [-95, 38], CA: [-100, 55], MX: [-102, 23], BR: [-52, -10], AR: [-64, -34],
    GB: [-2, 54], FR: [2, 46], DE: [10, 51], IT: [12, 42], ES: [-4, 40],
    PT: [-8, 39], NL: [5, 52], BE: [4, 51], CH: [8, 47], AT: [14, 47],
    PL: [19, 52], CZ: [15, 50], SE: [18, 60], NO: [9, 62], FI: [26, 64],
    DK: [10, 56], IE: [-8, 53], RU: [100, 60], UA: [32, 49], TR: [35, 39],
    GR: [22, 39], JP: [138, 36], CN: [105, 35], KR: [127, 36], TH: [101, 15],
    VN: [106, 16], ID: [118, -2], SG: [104, 1], MY: [102, 4], PH: [122, 12],
    IN: [78, 22], AU: [134, -25], NZ: [174, -41], ZA: [25, -29], EG: [30, 27],
    MA: [-6, 32], KE: [38, 0], NG: [8, 10], AE: [54, 24], SA: [45, 25],
    IL: [35, 31], QA: [51, 25], CL: [-71, -33], PE: [-76, -10], CO: [-74, 4],
    HK: [114, 22], TW: [121, 24],
  }

  return (
    <g className="visited-highlights">
      {Array.from(visitedSet).map((code) => {
        const pos = positions[code]
        if (!pos) return null
        const data = getCountryData(code)
        const color = data?.dominantColor || '#38bdf8'
        const [x, y] = toSvgCoords(pos[1], pos[0])

        return (
          <g key={code}>
            <circle cx={x} cy={y} r="18" fill={color} opacity="0.06" filter="url(#countryGlow)" />
            <circle cx={x} cy={y} r="8" fill={color} opacity="0.2" />
            <circle cx={x} cy={y} r="3" fill={color} opacity="0.7" />
          </g>
        )
      })}
    </g>
  )
}
