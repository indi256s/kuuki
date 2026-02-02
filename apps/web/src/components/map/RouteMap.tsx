import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRecentFlights } from '@/hooks/useFlights'
import { findAirport, findAirline } from '@kuuki/data'
import { generateGreatCircleArc } from '@/lib/geo'
import type { Flight } from '@/hooks/useFlights'

// Note: For full Mapbox GL JS integration, install:
// pnpm add mapbox-gl react-map-gl @types/mapbox-gl
// And add your Mapbox access token to .env as VITE_MAPBOX_TOKEN
// This is a simplified SVG-based map for now

interface RouteMapProps {
  flights?: Flight[]
  height?: string
}

interface ArcData {
  id: number
  origin: { lat: number; lon: number; iata: string }
  destination: { lat: number; lon: number; iata: string }
  airline?: string
  airlineColor?: string
}

export function RouteMap({ flights: propFlights, height = '300px' }: RouteMapProps) {
  const { t } = useTranslation()
  const { data: recentFlights = [] } = useRecentFlights(50)
  const [colorMode, setColorMode] = useState<'airline' | 'route'>('airline')

  const flights = propFlights ?? recentFlights

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

  // Convert lat/lon to SVG coordinates (simple equirectangular projection)
  const toSvgCoords = useCallback((lat: number, lon: number): [number, number] => {
    // Map: -180 to 180 longitude -> 0 to 800 x
    // Map: -60 to 85 latitude -> 400 to 0 y (inverted)
    const x = ((lon + 180) / 360) * 800
    const y = ((85 - lat) / 145) * 400
    return [x, y]
  }, [])

  if (flights.length === 0) {
    return (
      <div
        className="bg-card border border-border rounded-xl flex items-center justify-center"
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
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height }}>
      {/* Color toggle */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur rounded-lg p-1">
        <button
          onClick={() => setColorMode('airline')}
          className={`px-2 py-1 text-xs rounded ${
            colorMode === 'airline'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('map.byAirline', 'Airline')}
        </button>
        <button
          onClick={() => setColorMode('route')}
          className={`px-2 py-1 text-xs rounded ${
            colorMode === 'route'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('map.byRoute', 'Route')}
        </button>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 800 400"
        className="w-full h-full"
        style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)' }}
      >
        {/* Simple world outline */}
        <g className="opacity-20">
          {/* Continents rough outlines */}
          <ellipse cx="400" cy="200" rx="380" ry="180" fill="none" stroke="#64748b" strokeWidth="0.5" />
        </g>

        {/* Grid lines */}
        <g className="opacity-10">
          {/* Latitude lines */}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, y] = toSvgCoords(lat, 0)
            return (
              <line key={lat} x1="0" y1={y} x2="800" y2={y} stroke="#64748b" strokeWidth="0.5" />
            )
          })}
          {/* Longitude lines */}
          {[-120, -60, 0, 60, 120].map((lon) => {
            const [x] = toSvgCoords(0, lon)
            return (
              <line key={lon} x1={x} y1="0" x2={x} y2="400" stroke="#64748b" strokeWidth="0.5" />
            )
          })}
        </g>

        {/* Flight arcs */}
        <g>
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

            const color = colorMode === 'airline' ? arc.airlineColor : `hsl(${(i * 47) % 360}, 70%, 60%)`

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
        <g>
          {airports.map((airport) => {
            const [x, y] = toSvgCoords(airport.lat, airport.lon)
            return (
              <g key={airport.iata}>
                {/* Glow */}
                <circle cx={x} cy={y} r="6" fill="white" opacity="0.2" />
                {/* Dot */}
                <circle cx={x} cy={y} r="3" fill="white" />
                {/* Label */}
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontFamily="monospace"
                  opacity="0.8"
                >
                  {airport.iata}
                </text>
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
      </div>
    </div>
  )
}
