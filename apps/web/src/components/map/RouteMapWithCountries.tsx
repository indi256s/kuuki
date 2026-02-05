import { useMemo, useCallback, memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'
import { useRecentFlights } from '@/hooks/useFlights'
import { useTheme } from '@/hooks/useTheme'
import { findAirport, findAirline } from '@kuuki/data'
import { getCountryData } from '@/lib/countries'
import type { Flight } from '@/hooks/useFlights'
import { cn } from '@/lib/utils'

// Natural Earth 110m TopoJSON - lightweight world map
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface RouteMapWithCountriesProps {
  flights?: Flight[]
  visitedCountries?: string[]
  height?: string
  className?: string
  onCountryClick?: (countryCode: string) => void
}

interface ArcData {
  id: number
  origin: { lat: number; lon: number; iata: string }
  destination: { lat: number; lon: number; iata: string }
  airlineColor: string
}

// ISO numeric to alpha-2 mapping for common countries
const numericToAlpha2: Record<string, string> = {
  '840': 'US', '124': 'CA', '484': 'MX', '076': 'BR', '032': 'AR', '152': 'CL',
  '826': 'GB', '250': 'FR', '276': 'DE', '380': 'IT', '724': 'ES', '620': 'PT',
  '528': 'NL', '056': 'BE', '756': 'CH', '040': 'AT', '616': 'PL', '203': 'CZ',
  '752': 'SE', '578': 'NO', '246': 'FI', '208': 'DK', '372': 'IE', '300': 'GR',
  '643': 'RU', '804': 'UA', '792': 'TR', '392': 'JP', '156': 'CN', '410': 'KR',
  '764': 'TH', '704': 'VN', '360': 'ID', '702': 'SG', '458': 'MY', '608': 'PH',
  '356': 'IN', '036': 'AU', '554': 'NZ', '710': 'ZA', '818': 'EG', '504': 'MA',
  '404': 'KE', '566': 'NG', '784': 'AE', '682': 'SA', '376': 'IL', '634': 'QA',
  '604': 'PE', '170': 'CO', '344': 'HK', '158': 'TW',
}

export function RouteMapWithCountries({
  flights: propFlights,
  visitedCountries = [],
  height = '220px',
  className,
  onCountryClick,
}: RouteMapWithCountriesProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { data: recentFlights = [] } = useRecentFlights(50)

  const flights = propFlights ?? recentFlights

  // Theme-aware colors
  const isLight = resolvedTheme === 'light'
  const mapBg = isLight ? '#f5f7fa' : '#0a0f18'
  const unvisitedCountry = isLight ? '#e2e8f0' : '#1e293b'
  const countryStroke = isLight ? '#cbd5e1' : '#334155'
  const emptyIconColor = isLight ? 'text-slate-400' : 'text-slate-700'
  const emptyTextColor = isLight ? 'text-slate-500' : 'text-slate-500'

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
        airlineColor: airline?.primaryColor || '#64748b',
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

  // Derive visited countries from flight airports
  const flightCountries = useMemo(() => {
    const countries = new Set<string>()
    for (const flight of flights) {
      const origin = findAirport(flight.origin)
      const dest = findAirport(flight.destination)
      if (origin?.country) countries.add(origin.country)
      if (dest?.country) countries.add(dest.country)
    }
    return countries
  }, [flights])

  // Combine explicit visitedCountries with countries derived from flights
  const visitedSet = useMemo(() => {
    const combined = new Set(visitedCountries)
    for (const country of flightCountries) {
      combined.add(country)
    }
    return combined
  }, [visitedCountries, flightCountries])

  // Calculate weighted viewport - focuses on most visited region
  const viewport = useMemo(() => {
    if (flights.length === 0) {
      // Default world view
      return { center: [10, 30] as [number, number], scale: 120 }
    }

    // Count touchpoints per airport (more visits = higher weight)
    const airportWeight = new Map<string, number>()
    for (const flight of flights) {
      airportWeight.set(flight.origin, (airportWeight.get(flight.origin) || 0) + 1)
      airportWeight.set(flight.destination, (airportWeight.get(flight.destination) || 0) + 1)
    }

    // Calculate weighted center
    let totalWeight = 0
    let weightedLat = 0
    let weightedLon = 0

    for (const [iata, weight] of airportWeight) {
      const airport = findAirport(iata)
      if (!airport) continue
      weightedLat += airport.latitude * weight
      weightedLon += airport.longitude * weight
      totalWeight += weight
    }

    if (totalWeight === 0) {
      return { center: [10, 30] as [number, number], scale: 120 }
    }

    const centerLat = weightedLat / totalWeight
    const centerLon = weightedLon / totalWeight

    // Calculate spread of weighted airports for scale calculation
    let maxDistanceSq = 0
    for (const [iata, weight] of airportWeight) {
      const airport = findAirport(iata)
      if (!airport) continue
      // Weight affects how much we care about including this airport
      const distSq = Math.pow(airport.latitude - centerLat, 2) + Math.pow(airport.longitude - centerLon, 2)
      // Scale distance by inverse of weight - frequently visited airports matter more
      maxDistanceSq = Math.max(maxDistanceSq, distSq * Math.min(1, 2 / weight))
    }

    // Convert distance to scale (tighter zoom for concentrated activity)
    const spread = Math.sqrt(maxDistanceSq)
    // Heuristic: 5° spread -> scale ~500, 90° spread -> scale ~120
    const scale = Math.min(600, Math.max(120, 2500 / Math.max(spread, 5)))

    return { center: [centerLon, centerLat] as [number, number], scale }
  }, [flights])

  const handleCountryClick = useCallback((geo: { properties: { ISO_A2?: string; ISO_N3?: string } }) => {
    if (!onCountryClick) return
    const alpha2 = geo.properties.ISO_A2 !== '-99'
      ? geo.properties.ISO_A2
      : numericToAlpha2[geo.properties.ISO_N3 || '']
    if (alpha2) onCountryClick(alpha2)
  }, [onCountryClick])

  const getCountryColor = useCallback((geo: { properties: { ISO_A2?: string; ISO_N3?: string } }) => {
    const alpha2 = geo.properties.ISO_A2 !== '-99'
      ? geo.properties.ISO_A2
      : numericToAlpha2[geo.properties.ISO_N3 || '']

    if (alpha2 && visitedSet.has(alpha2)) {
      const data = getCountryData(alpha2)
      return data?.dominantColor || '#3b82f6'
    }
    return unvisitedCountry
  }, [visitedSet, unvisitedCountry])

  // ZoomableGroup state for interactive pan/zoom
  const [position, setPosition] = useState({
    center: viewport.center,
    zoom: 1,
  })

  // Sync position with viewport when viewport changes (e.g., new flights loaded)
  const initialCenter = viewport.center
  const [lastInitialCenter, setLastInitialCenter] = useState(initialCenter)
  if (initialCenter[0] !== lastInitialCenter[0] || initialCenter[1] !== lastInitialCenter[1]) {
    setLastInitialCenter(initialCenter)
    setPosition({ center: initialCenter, zoom: 1 })
  }

  const handleMoveEnd = useCallback(({ coordinates, zoom }: { coordinates: [number, number]; zoom: number }) => {
    setPosition({ center: coordinates, zoom })
  }, [])

  // Adaptive scaling factor - uses square root for smoother scaling
  // At zoom 1: factor = 1, zoom 4: factor = 2, zoom 8: factor = 2.83
  const scaleFactor = Math.pow(position.zoom, 0.5)

  // Empty state
  if (flights.length === 0 && visitedCountries.length === 0) {
    return (
      <div className={cn('relative overflow-hidden flex items-center justify-center rounded-xl', className)} style={{ height, backgroundColor: mapBg }}>
        <div className="text-center">
          <svg className={cn('w-10 h-10 mx-auto mb-2', emptyIconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className={cn('text-xs', emptyTextColor)}>{t('dashboard.noRouteData', 'Add flights to see your map')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        className
      )}
      style={{ height, backgroundColor: mapBg }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: viewport.scale,
          center: viewport.center,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={position.center}
          zoom={position.zoom}
          minZoom={0.5}
          maxZoom={8}
          onMoveEnd={handleMoveEnd}
        >
          {/* Countries */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const alpha2 = geo.properties.ISO_A2 !== '-99'
                  ? geo.properties.ISO_A2
                  : numericToAlpha2[geo.properties.ISO_N3]
                const isVisited = alpha2 && visitedSet.has(alpha2)

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryColor(geo)}
                    stroke={countryStroke}
                    strokeWidth={0.3 / scaleFactor}
                    style={{
                      default: {
                        outline: 'none',
                        opacity: isVisited ? 0.85 : 0.6,
                      },
                      hover: {
                        outline: 'none',
                        opacity: 1,
                        fill: isVisited ? getCountryColor(geo) : countryStroke,
                      },
                      pressed: { outline: 'none' },
                    }}
                    onClick={() => handleCountryClick(geo)}
                  />
                )
              })
            }
          </Geographies>

          {/* Flight routes - adaptive scaling */}
          {arcs.map((arc) => (
            <Line
              key={arc.id}
              from={[arc.origin.lon, arc.origin.lat]}
              to={[arc.destination.lon, arc.destination.lat]}
              stroke={arc.airlineColor}
              strokeWidth={1.5 / scaleFactor}
              strokeLinecap="round"
              strokeOpacity={0.7}
            />
          ))}

          {/* Airport markers - adaptive scaling */}
          {airports.map((airport) => (
            <Marker key={airport.iata} coordinates={[airport.lon, airport.lat]}>
              <circle r={3 / scaleFactor} fill="white" opacity={0.9} aria-hidden="true" />
              {airports.length < 30 && (
                <text
                  textAnchor="middle"
                  y={-8 / scaleFactor}
                  aria-hidden="true"
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: `${7 / scaleFactor}px`,
                    fontWeight: 600,
                    fill: 'white',
                    opacity: 0.8,
                  }}
                >
                  {airport.iata}
                </text>
              )}
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 text-[10px] text-white/70">
        <span><span className="font-mono font-semibold text-white">{arcs.length}</span> routes</span>
        <span className="text-white/30">•</span>
        <span><span className="font-mono font-semibold text-white">{airports.length}</span> airports</span>
        {visitedCountries.length > 0 && (
          <>
            <span className="text-white/30">•</span>
            <span><span className="font-mono font-semibold text-white">{visitedCountries.length}</span> countries</span>
          </>
        )}
      </div>

    </div>
  )
}

export default memo(RouteMapWithCountries)
