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
import { useFlightRoutes } from '@/hooks/useFlights'
import { useTheme } from '@/hooks/useTheme'
import { findAirport } from '@kuuki/data'
import { getCountryData } from '@/lib/countries'
import type { FlightRoute } from '@/lib/flights'
import { cn } from '@/lib/utils'

// Natural Earth 110m TopoJSON - lightweight world map
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface RouteMapWithCountriesProps {
  flights?: FlightRoute[]
  visitedCountries?: string[]
  height?: string
  className?: string
  onCountryClick?: (countryCode: string) => void
  showRoutes?: boolean
  heatmapMode?: boolean
  visitCountMap?: Record<string, number>
  countrySourceMap?: Record<string, 'flight' | 'claim' | 'both'>
}

interface ArcData {
  id: number
  origin: { lat: number; lon: number; iata: string }
  destination: { lat: number; lon: number; iata: string }
}

// ISO numeric to alpha-2 mapping for all countries in world-atlas TopoJSON
const numericToAlpha2: Record<string, string> = {
  // Americas
  '840': 'US', '124': 'CA', '484': 'MX', '076': 'BR', '032': 'AR', '152': 'CL',
  '604': 'PE', '170': 'CO', '858': 'UY', '600': 'PY', '068': 'BO', '218': 'EC',
  '862': 'VE', '328': 'GY', '740': 'SR', '591': 'PA', '188': 'CR', '558': 'NI',
  '340': 'HN', '222': 'SV', '320': 'GT', '084': 'BZ', '192': 'CU', '388': 'JM',
  '332': 'HT', '214': 'DO', '630': 'PR', '044': 'BS', '780': 'TT', '238': 'FK',
  // Europe
  '826': 'GB', '250': 'FR', '276': 'DE', '380': 'IT', '724': 'ES', '620': 'PT',
  '528': 'NL', '056': 'BE', '756': 'CH', '040': 'AT', '616': 'PL', '203': 'CZ',
  '752': 'SE', '578': 'NO', '246': 'FI', '208': 'DK', '372': 'IE', '300': 'GR',
  '643': 'RU', '804': 'UA', '792': 'TR', '348': 'HU', '642': 'RO', '100': 'BG',
  '688': 'RS', '191': 'HR', '070': 'BA', '499': 'ME', '008': 'AL', '807': 'MK',
  '703': 'SK', '705': 'SI', '440': 'LT', '428': 'LV', '233': 'EE', '112': 'BY',
  '498': 'MD', '352': 'IS', '442': 'LU', '196': 'CY', '304': 'GL',
  // Middle East & Central Asia 
  '376': 'IL', '400': 'JO', '422': 'LB', '760': 'SY', '368': 'IQ', '364': 'IR',
  '784': 'AE', '682': 'SA', '634': 'QA', '414': 'KW', '512': 'OM', '887': 'YE',
  '051': 'AM', '268': 'GE', '031': 'AZ', '398': 'KZ', '860': 'UZ', '762': 'TJ',
  '417': 'KG', '795': 'TM', '004': 'AF', '275': 'PS',
  // Asia-Pacific
  '392': 'JP', '156': 'CN', '410': 'KR', '408': 'KP', '496': 'MN', '158': 'TW',
  '344': 'HK', '764': 'TH', '704': 'VN', '360': 'ID', '702': 'SG', '458': 'MY',
  '608': 'PH', '096': 'BN', '626': 'TL', '104': 'MM', '418': 'LA', '116': 'KH',
  '356': 'IN', '586': 'PK', '050': 'BD', '144': 'LK', '524': 'NP', '064': 'BT',
  '036': 'AU', '554': 'NZ', '598': 'PG', '090': 'SB', '548': 'VU', '540': 'NC', '242': 'FJ',
  // Africa
  '710': 'ZA', '818': 'EG', '504': 'MA', '404': 'KE', '566': 'NG', '012': 'DZ',
  '434': 'LY', '788': 'TN', '729': 'SD', '148': 'TD', '562': 'NE', '466': 'ML',
  '478': 'MR', '686': 'SN', '270': 'GM', '324': 'GN', '624': 'GW', '694': 'SL',
  '430': 'LR', '384': 'CI', '854': 'BF', '288': 'GH', '768': 'TG', '204': 'BJ',
  '120': 'CM', '140': 'CF', '178': 'CG', '180': 'CD', '800': 'UG', '646': 'RW',
  '108': 'BI', '834': 'TZ', '706': 'SO', '231': 'ET', '232': 'ER', '262': 'DJ',
  '894': 'ZM', '716': 'ZW', '072': 'BW', '516': 'NA', '508': 'MZ', '454': 'MW',
  '426': 'LS', '748': 'SZ', '024': 'AO', '266': 'GA', '226': 'GQ', '450': 'MG',
  '732': 'EH', '728': 'SS',
  // Other
  '010': 'AQ', '260': 'TF',
}


export function RouteMapWithCountries({
  flights: propFlights,
  visitedCountries = [],
  height = '220px',
  className,
  onCountryClick,
  showRoutes = true,
  heatmapMode = false,
  visitCountMap,
  countrySourceMap,
}: RouteMapWithCountriesProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { data: allRoutes = [] } = useFlightRoutes()

  const flights = propFlights ?? allRoutes

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

      result.push({
        id: flight.id,
        origin: { lat: originAirport.latitude, lon: originAirport.longitude, iata: originAirport.iata },
        destination: { lat: destAirport.latitude, lon: destAirport.longitude, iata: destAirport.iata },
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

  // Calculate viewport by fitting a bounding box around all airports
  const viewport = useMemo(() => {
    if (airports.length === 0) {
      return { center: [10, 30] as [number, number], scale: 120 }
    }

    // Calculate bounding box of all airports
    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity

    for (const airport of airports) {
      minLat = Math.min(minLat, airport.lat)
      maxLat = Math.max(maxLat, airport.lat)
      minLon = Math.min(minLon, airport.lon)
      maxLon = Math.max(maxLon, airport.lon)
    }

    // Add padding (20% of span, minimum 5°)
    const latSpan = maxLat - minLat
    const lonSpan = maxLon - minLon
    const latPad = Math.max(5, latSpan * 0.2)
    const lonPad = Math.max(5, lonSpan * 0.2)

    const centerLat = (minLat + maxLat) / 2
    const centerLon = (minLon + maxLon) / 2
    const paddedLatSpan = latSpan + latPad * 2
    const paddedLonSpan = lonSpan + lonPad * 2

    // Convert span to Mercator scale
    // Larger span = smaller scale number
    const span = Math.max(paddedLatSpan, paddedLonSpan)
    const scale = Math.min(800, Math.max(100, 3000 / Math.max(span, 4)))

    return { center: [centerLon, centerLat] as [number, number], scale }
  }, [airports])

  const handleCountryClick = useCallback((geo: { id?: string }) => {
    if (!onCountryClick) return
    const alpha2 = geo.id ? numericToAlpha2[geo.id] : undefined
    if (alpha2) onCountryClick(alpha2)
  }, [onCountryClick])

  // Max visit count for heatmap scaling
  const maxVisitCount = useMemo(() => {
    if (!heatmapMode || !visitCountMap) return 1
    return Math.max(1, ...Object.values(visitCountMap))
  }, [heatmapMode, visitCountMap])

  const getCountryColor = useCallback((geo: { id?: string }) => {
    const alpha2 = geo.id ? numericToAlpha2[geo.id] : undefined

    if (alpha2 && visitedSet.has(alpha2)) {
      const data = getCountryData(alpha2)
      return data?.dominantColor || '#3b82f6'
    }
    return unvisitedCountry
  }, [visitedSet, unvisitedCountry])

  const getCountryOpacity = useCallback((alpha2: string | undefined, isVisited: boolean) => {
    if (!isVisited) return 0.6

    if (heatmapMode && visitCountMap && alpha2) {
      const count = visitCountMap[alpha2] || 1
      return 0.3 + (count / maxVisitCount) * 0.6
    }

    // Subtle distinction for claim-only countries
    if (countrySourceMap && alpha2 && countrySourceMap[alpha2] === 'claim') {
      return 0.65
    }

    return 0.85
  }, [heatmapMode, visitCountMap, maxVisitCount, countrySourceMap])

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
                const alpha2 = geo.id ? numericToAlpha2[geo.id] : undefined
                const isVisited = alpha2 && visitedSet.has(alpha2)

                const opacity = getCountryOpacity(alpha2, !!isVisited)
                const claimOnly = countrySourceMap && alpha2 && countrySourceMap[alpha2] === 'claim'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryColor(geo)}
                    stroke={countryStroke}
                    strokeWidth={claimOnly ? 0.6 / scaleFactor : 0.3 / scaleFactor}
                    strokeDasharray={claimOnly ? '2,1' : undefined}
                    style={{
                      default: {
                        outline: 'none',
                        opacity,
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

          {/* Flight routes - unified primary color */}
          {showRoutes && arcs.map((arc) => (
            <Line
              key={arc.id}
              from={[arc.origin.lon, arc.origin.lat]}
              to={[arc.destination.lon, arc.destination.lat]}
              stroke="var(--primary)"
              strokeWidth={1.5 / scaleFactor}
              strokeLinecap="round"
              strokeOpacity={0.7}
            />
          ))}

          {/* Airport markers - adaptive scaling */}
          {showRoutes && airports.map((airport) => (
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
