import { useMemo, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
} from 'react-simple-maps'
import { useRecentFlights } from '@/hooks/useFlights'
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
  interactive?: boolean
  onExpand?: () => void
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
  interactive = false,
  onExpand,
  onCountryClick,
}: RouteMapWithCountriesProps) {
  const { t } = useTranslation()
  const { data: recentFlights = [] } = useRecentFlights(50)

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

  // Calculate dynamic viewport based on flight data
  const viewport = useMemo(() => {
    if (airports.length === 0) {
      // Default world view
      return { center: [10, 30] as [number, number], scale: 120 }
    }

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
    for (const airport of airports) {
      minLat = Math.min(minLat, airport.lat)
      maxLat = Math.max(maxLat, airport.lat)
      minLon = Math.min(minLon, airport.lon)
      maxLon = Math.max(maxLon, airport.lon)
    }

    // Add padding (10% of the bounds)
    const latPadding = (maxLat - minLat) * 0.15 || 10
    const lonPadding = (maxLon - minLon) * 0.15 || 10
    minLat = Math.max(-85, minLat - latPadding)
    maxLat = Math.min(85, maxLat + latPadding)
    minLon = Math.max(-180, minLon - lonPadding)
    maxLon = Math.min(180, maxLon + lonPadding)

    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2

    // Calculate scale based on the span (larger span = smaller scale)
    const latSpan = maxLat - minLat
    const lonSpan = maxLon - minLon
    const maxSpan = Math.max(latSpan, lonSpan)

    // Map span to scale (heuristic: 10° span -> scale ~400, 180° span -> scale ~100)
    // Scale = 4000 / maxSpan, clamped between 100 and 800
    const scale = Math.min(800, Math.max(100, 3500 / Math.max(maxSpan, 5)))

    return { center: [centerLon, centerLat] as [number, number], scale }
  }, [airports])

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
    return '#1e293b'
  }, [visitedSet])

  const handleClick = useCallback(() => {
    if (onExpand) onExpand()
  }, [onExpand])

  // Empty state
  if (flights.length === 0 && visitedCountries.length === 0) {
    return (
      <div className={cn('relative overflow-hidden flex items-center justify-center bg-[#0a0f18] rounded-xl', className)} style={{ height }}>
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className="text-xs text-slate-500">{t('dashboard.noRouteData', 'Add flights to see your map')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#0a0f18] rounded-xl',
        !interactive && onExpand && 'cursor-pointer group',
        className
      )}
      style={{ height }}
      onClick={!interactive ? handleClick : undefined}
      onKeyDown={!interactive && onExpand ? (e) => e.key === 'Enter' && handleClick() : undefined}
      role={!interactive && onExpand ? 'button' : undefined}
      tabIndex={!interactive && onExpand ? 0 : undefined}
      aria-label={!interactive && onExpand ? t('dashboard.expandMap', 'Expand map') : undefined}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: viewport.scale,
          center: viewport.center,
        }}
        style={{ width: '100%', height: '100%' }}
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
                  stroke="#334155"
                  strokeWidth={0.3}
                  style={{
                    default: {
                      outline: 'none',
                      opacity: isVisited ? 0.85 : 0.6,
                    },
                    hover: {
                      outline: 'none',
                      opacity: 1,
                      fill: isVisited ? getCountryColor(geo) : '#334155',
                    },
                    pressed: { outline: 'none' },
                  }}
                  onClick={() => handleCountryClick(geo)}
                />
              )
            })
          }
        </Geographies>

        {/* Flight routes - simple lines, no animation */}
        {arcs.map((arc) => (
          <Line
            key={arc.id}
            from={[arc.origin.lon, arc.origin.lat]}
            to={[arc.destination.lon, arc.destination.lat]}
            stroke={arc.airlineColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeOpacity={0.7}
          />
        ))}

        {/* Airport markers */}
        {airports.map((airport) => (
          <Marker key={airport.iata} coordinates={[airport.lon, airport.lat]}>
            <circle r={2.5} fill="white" opacity={0.9} aria-hidden="true" />
            {(interactive || airports.length < 15) && (
              <text
                textAnchor="middle"
                y={-6}
                aria-hidden="true"
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '6px',
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

      {/* Expand hint */}
      {onExpand && !interactive && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 px-2 py-1 bg-white/10 backdrop-blur rounded text-[9px] text-white/70 uppercase tracking-wider">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            expand
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(RouteMapWithCountries)
