"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"

// Type for flight search results from AirLabs API
interface FlightScheduleResult {
  airline_iata: string
  flight_number: string
  departure_time: string
  arrival_time: string
  aircraft_icao: string | null
  duration_minutes: number | null
}

interface FlightSuggestionsListProps {
  flights: FlightScheduleResult[]
  onSelect: (flight: FlightScheduleResult) => void
}

/**
 * Display a list of matching flight suggestions based on time search.
 * Shows up to 3 flights with airline, flight number, times, and aircraft.
 */
export function FlightSuggestionsList({
  flights,
  onSelect,
}: FlightSuggestionsListProps) {
  const { t } = useTranslation()

  if (flights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("flights.noFlightsFound", "No flights found for this time window")}
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-2">
      <h4 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
        {t("flights.matchingFlights", "Matching Flights")}
      </h4>
      <div className="space-y-2">
        {flights.map((flight, index) => (
          <button
            key={`${flight.airline_iata}${flight.flight_number}-${index}`}
            type="button"
            onClick={() => onSelect(flight)}
            className="w-full rounded-lg border border-border p-3 text-left transition-all hover:border-primary/30 hover:bg-accent/30"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-mono text-sm font-medium">
                  {flight.airline_iata} {flight.flight_number}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {flight.departure_time} → {flight.arrival_time}
                </div>
              </div>
              {flight.aircraft_icao && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {flight.aircraft_icao}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
