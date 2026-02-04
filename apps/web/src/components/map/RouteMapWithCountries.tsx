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
  visitedCountries?: string[] // ISO alpha-2 country codes
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

// Map dimensions for SVG viewBox
const MAP_WIDTH = 800
const MAP_HEIGHT = 400

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

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const flights = propFlights ?? recentFlights
  const visitedSet = useMemo(() => new Set(visitedCountries), [visitedCountries])

  // Process flights into arc data
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
        origin: {
          lat: originAirport.latitude,
          lon: originAirport.longitude,
          iata: originAirport.iata,
        },
        destination: {
          lat: destAirport.latitude,
          lon: destAirport.longitude,
          iata: destAirport.iata,
        },
        airline: airline?.iata,
        airlineColor: airline?.primaryColor || '#6366f1',
      })
    }

    return result
  }, [flights])

  // Get unique airports
  const airports = useMemo(() => {
    const airportMap = new Map<string, { lat: number; lon: number; iata: string }>()

    for (const arc of arcs) {
      airportMap.set(arc.origin.iata, arc.origin)
      airportMap.set(arc.destination.iata, arc.destination)
    }

    return Array.from(airportMap.values())
  }, [arcs])

  // Convert lat/lon to SVG coordinates (equirectangular projection)
  const toSvgCoords = useCallback((lat: number, lon: number): [number, number] => {
    // Map: -180 to 180 longitude -> 0 to 800 x
    // Map: -60 to 85 latitude -> 400 to 0 y (inverted)
    const x = ((lon + 180) / 360) * MAP_WIDTH
    const y = ((85 - lat) / 145) * MAP_HEIGHT
    return [x, y]
  }, [])

  // Pan/zoom handlers
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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => ({
      ...prev,
      scale: Math.max(1, Math.min(4, prev.scale * delta)),
    }))
  }, [interactive])

  // Reset transform
  const handleReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  // Handle click for expansion
  const handleClick = useCallback(() => {
    if (!isDragging && onExpand) {
      onExpand()
    }
  }, [isDragging, onExpand])

  // Empty state
  if (flights.length === 0 && visitedCountries.length === 0) {
    return (
      <div
        className={cn(
          'bg-card border border-border rounded-xl flex items-center justify-center',
          className
        )}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm">{t('dashboard.noRouteData', 'Add flights to see your route map')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative bg-card border border-border rounded-xl overflow-hidden',
        interactive && 'cursor-grab active:cursor-grabbing',
        !interactive && onExpand && 'cursor-pointer',
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
      {/* Color toggle - only show if we have routes */}
      {arcs.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur rounded-lg p-1">
          <button
            onClick={(e) => { e.stopPropagation(); setColorMode('airline') }}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              colorMode === 'airline'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('map.byAirline', 'Airline')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setColorMode('route') }}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              colorMode === 'route'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('map.byRoute', 'Route')}
          </button>
        </div>
      )}

      {/* Reset button for interactive mode */}
      {interactive && transform.scale > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleReset() }}
          className="absolute top-2 left-2 z-10 px-2 py-1 text-xs bg-background/80 backdrop-blur rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('map.reset', 'Reset')}
        </button>
      )}

      {/* SVG Map */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-full"
        style={{
          background: 'linear-gradient(180deg, oklch(0.25 0.02 240) 0%, oklch(0.15 0.02 240) 100%)',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {/* Ocean/background gradient */}
        <defs>
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.25 0.03 240)" />
            <stop offset="100%" stopColor="oklch(0.15 0.02 240)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGradient)" />

        {/* Grid lines */}
        <g className="opacity-10">
          {/* Latitude lines */}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, y] = toSvgCoords(lat, 0)
            return (
              <line key={lat} x1="0" y1={y} x2={MAP_WIDTH} y2={y} stroke="oklch(0.7 0 0)" strokeWidth="0.5" />
            )
          })}
          {/* Longitude lines */}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
            const [x] = toSvgCoords(0, lon)
            return (
              <line key={lon} x1={x} y1="0" x2={x} y2={MAP_HEIGHT} stroke="oklch(0.7 0 0)" strokeWidth="0.5" />
            )
          })}
        </g>

        {/* Simplified continent outlines with visited country highlights */}
        <g className="continents">
          {/* Base continent shapes - simplified polygons */}
          <ContinentOutlines toSvgCoords={toSvgCoords} />
        </g>

        {/* Visited country highlights */}
        <g className="visited-countries">
          <VisitedCountryHighlights visitedSet={visitedSet} toSvgCoords={toSvgCoords} />
        </g>

        {/* Flight arcs */}
        <g className="flight-routes">
          {arcs.map((arc, i) => {
            const arcPoints = generateGreatCircleArc(
              arc.origin.lat,
              arc.origin.lon,
              arc.destination.lat,
              arc.destination.lon,
              30
            )

            const pathData = arcPoints
              .map((point, idx) => {
                const [x, y] = toSvgCoords(point[1], point[0])
                return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
              })
              .join(' ')

            const color = colorMode === 'airline' ? arc.airlineColor : `oklch(0.7 0.15 ${(i * 47) % 360})`

            return (
              <g key={arc.id}>
                {/* Glow effect */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.3"
                />
                {/* Main line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            )
          })}
        </g>

        {/* Airport dots */}
        <g className="airport-markers">
          {airports.map((airport) => {
            const [x, y] = toSvgCoords(airport.lat, airport.lon)
            return (
              <g key={airport.iata}>
                {/* Glow */}
                <circle cx={x} cy={y} r="6" fill="white" opacity="0.2" />
                {/* Dot */}
                <circle cx={x} cy={y} r="3" fill="white" />
                {/* Label - show in interactive mode or when fewer airports */}
                {(interactive || airports.length < 15) && (
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="8"
                    fontFamily="var(--font-mono), monospace"
                    opacity="0.9"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {airport.iata}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-foreground">
        <span className="font-medium">{arcs.length}</span>
        <span className="text-muted-foreground ml-1">{t('map.routes', 'routes')}</span>
        <span className="mx-2 text-muted-foreground/50">·</span>
        <span className="font-medium">{airports.length}</span>
        <span className="text-muted-foreground ml-1">{t('map.airports', 'airports')}</span>
        {visitedCountries.length > 0 && (
          <>
            <span className="mx-2 text-muted-foreground/50">·</span>
            <span className="font-medium">{visitedCountries.length}</span>
            <span className="text-muted-foreground ml-1">{t('map.countries', 'countries')}</span>
          </>
        )}
      </div>

      {/* Expand hint */}
      {onExpand && !interactive && (
        <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
          {t('map.clickToExpand', 'Click to expand')}
        </div>
      )}
    </div>
  )
}

// Simplified continent outlines component
function ContinentOutlines({
  toSvgCoords
}: {
  toSvgCoords: (lat: number, lon: number) => [number, number]
}) {
  // Simplified continent boundary polygons (very approximate)
  const continents = [
    // North America
    { name: 'NA', points: [[-170, 65], [-60, 65], [-60, 25], [-100, 10], [-120, 25], [-170, 55]], fill: 'oklch(0.35 0.02 100)' },
    // South America
    { name: 'SA', points: [[-80, 10], [-35, 5], [-35, -55], [-70, -55], [-80, -10]], fill: 'oklch(0.35 0.02 140)' },
    // Europe
    { name: 'EU', points: [[-10, 70], [40, 70], [50, 45], [30, 35], [-10, 35]], fill: 'oklch(0.35 0.02 200)' },
    // Africa
    { name: 'AF', points: [[-20, 35], [50, 35], [50, -35], [10, -35], [-20, 5]], fill: 'oklch(0.35 0.02 40)' },
    // Asia
    { name: 'AS', points: [[30, 70], [180, 70], [180, 10], [100, 10], [60, 25], [30, 35]], fill: 'oklch(0.35 0.02 280)' },
    // Oceania
    { name: 'OC', points: [[110, 0], [180, 0], [180, -50], [110, -50]], fill: 'oklch(0.35 0.02 320)' },
  ]

  return (
    <>
      {continents.map((continent) => {
        const pathData = continent.points
          .map((point, idx) => {
            const [x, y] = toSvgCoords(point[1], point[0])
            return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
          })
          .join(' ') + ' Z'

        return (
          <path
            key={continent.name}
            d={pathData}
            fill={continent.fill}
            stroke="oklch(0.5 0.02 0)"
            strokeWidth="0.5"
            opacity="0.6"
          />
        )
      })}
    </>
  )
}

// Visited country highlights with approximate positions and flag colors
function VisitedCountryHighlights({
  visitedSet,
  toSvgCoords
}: {
  visitedSet: Set<string>
  toSvgCoords: (lat: number, lon: number) => [number, number]
}) {
  // Approximate center coordinates for countries
  const countryPositions: Record<string, [number, number]> = {
    US: [-95, 38], CA: [-100, 55], MX: [-102, 23], BR: [-52, -10], AR: [-64, -34],
    GB: [-2, 54], FR: [2, 46], DE: [10, 51], IT: [12, 42], ES: [-4, 40],
    PT: [-8, 39], NL: [5, 52], BE: [4, 51], CH: [8, 47], AT: [14, 47],
    PL: [19, 52], CZ: [15, 50], SE: [15, 62], NO: [9, 62], FI: [26, 64],
    DK: [10, 56], IE: [-8, 53], RU: [100, 60], UA: [32, 49], TR: [35, 39],
    GR: [22, 39], JP: [138, 36], CN: [105, 35], KR: [127, 36], TH: [101, 15],
    VN: [106, 16], ID: [118, -2], SG: [104, 1], MY: [102, 4], PH: [122, 12],
    IN: [78, 22], AU: [134, -25], NZ: [174, -41], ZA: [25, -29], EG: [30, 27],
    MA: [-6, 32], KE: [38, 0], NG: [8, 10], AE: [54, 24], SA: [45, 25],
    IL: [35, 31], QA: [51, 25], // Add more as needed
  }

  return (
    <>
      {Array.from(visitedSet).map((code) => {
        const position = countryPositions[code]
        if (!position) return null

        const countryData = getCountryData(code)
        const color = countryData?.dominantColor || 'oklch(0.6 0.15 200)'
        const [x, y] = toSvgCoords(position[1], position[0])

        return (
          <g key={code}>
            {/* Country highlight circle */}
            <circle
              cx={x}
              cy={y}
              r="12"
              fill={color}
              opacity="0.4"
              style={{ filter: 'blur(4px)' }}
            />
            <circle
              cx={x}
              cy={y}
              r="6"
              fill={color}
              opacity="0.6"
            />
          </g>
        )
      })}
    </>
  )
}
