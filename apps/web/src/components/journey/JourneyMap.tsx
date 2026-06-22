
import { useMemo, memo } from 'react'
import {
    ComposableMap,
    Geographies,
    Geography,
    Line,
    Marker,
    ZoomableGroup,
} from 'react-simple-maps'
import { findAirport, findAirline } from '@kuuki/data'
import { MAP_CSS_VARS } from '@/lib/mapColors'
import type { JourneyLeg } from '@/types/journey'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface JourneyMapProps {
    legs: JourneyLeg[]
}

export const JourneyMap = memo(function JourneyMap({ legs }: JourneyMapProps) {
    const { arcs, airports } = useMemo(() => {
        const computedArcs = []
        const airportMap = new Map()

        for (const leg of legs) {
            const origin = findAirport(leg.origin)
            const dest = findAirport(leg.destination)
            const airline = findAirline(leg.airline)

            if (origin && dest) {
                computedArcs.push({
                    id: leg.id,
                    origin: { lat: origin.latitude, lon: origin.longitude },
                    destination: { lat: dest.latitude, lon: dest.longitude },
                    color: airline?.primaryColor || MAP_CSS_VARS.routeFallback,
                })

                if (!airportMap.has(leg.origin)) airportMap.set(leg.origin, { ...origin, iata: leg.origin })
                if (!airportMap.has(leg.destination)) airportMap.set(leg.destination, { ...dest, iata: leg.destination })
            }
        }

        return {
            arcs: computedArcs,
            airports: Array.from(airportMap.values())
        }
    }, [legs, MAP_CSS_VARS.routeFallback])

    const center = useMemo(() => {
        if (airports.length > 0) {
            return [airports[0].longitude, airports[0].latitude] as [number, number]
        }
        return [0, 20] as [number, number]
    }, [airports])

    return (
        <div className="w-full h-full bg-transparent">
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 150,
                }}
                style={{ width: '100%', height: '100%' }}
            >
                <ZoomableGroup
                    center={center}
                    zoom={2}
                    minZoom={1}
                    maxZoom={8}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map((geo) => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={MAP_CSS_VARS.country}
                                    stroke={MAP_CSS_VARS.stroke}
                                    strokeWidth={0.5}
                                    style={{
                                        default: { outline: 'none' },
                                        hover: { outline: 'none', fill: MAP_CSS_VARS.countryHover },
                                        pressed: { outline: 'none' },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {arcs.map((arc) => (
                        <Line
                            key={arc.id}
                            from={[arc.origin.lon, arc.origin.lat]}
                            to={[arc.destination.lon, arc.destination.lat]}
                            stroke={arc.color}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeOpacity={0.8}
                        />
                    ))}

                    {airports.map((airport) => (
                        <Marker key={airport.iata} coordinates={[airport.longitude, airport.latitude]}>
                            <circle r={4} fill="var(--card)" stroke={MAP_CSS_VARS.stroke} strokeWidth={1} />
                            <text
                                textAnchor="middle"
                                y={-10}
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '10px',
                                    fill: MAP_CSS_VARS.markerLabel,
                                    fontWeight: 'bold'
                                }}
                            >
                                {airport.iata}
                            </text>
                        </Marker>
                    ))}
                </ZoomableGroup>
            </ComposableMap>
        </div>
    )
})
