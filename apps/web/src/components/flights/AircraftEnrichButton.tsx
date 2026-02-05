import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findAirline } from '@kuuki/data'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { AircraftEnrichDialog } from './AircraftEnrichDialog'
import {
  useAircraftEnrichment,
  useUpdateFlightAircraft,
  type EnrichmentResult,
  type FlightToEnrich,
} from '@/hooks/useAircraftEnrichment'
import type { Flight } from '@/hooks/useFlights'

interface AircraftEnrichButtonProps {
  /** Flights to enrich (should be flights missing aircraft_icao) */
  flights: Flight[]
  /** Variant for different contexts */
  variant?: 'default' | 'outline' | 'ghost'
  /** Size of the button */
  size?: 'default' | 'lg'
  /** Additional class names */
  className?: string
  /** Called after successful enrichment */
  onComplete?: () => void
}

export function AircraftEnrichButton({
  flights,
  variant = 'outline',
  size = 'default',
  className,
  onComplete,
}: AircraftEnrichButtonProps) {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [results, setResults] = useState<EnrichmentResult[]>([])

  const enrichMutation = useAircraftEnrichment()
  const updateMutation = useUpdateFlightAircraft()

  // Only show button if there are flights to enrich
  if (flights.length === 0) {
    return null
  }

  const handleClick = async () => {
    // Prepare flights for the API, including airline names for better search
    const flightsToEnrich: FlightToEnrich[] = flights.map(f => {
      const airline = f.airline_iata ? findAirline(f.airline_iata) : null
      return {
        id: String(f.id),
        flight_number: f.flight_number,
        airline_iata: f.airline_iata,
        airline_name: airline?.name ?? null,
        date: f.date,
        origin: f.origin,
        destination: f.destination,
      }
    })

    try {
      const response = await enrichMutation.mutateAsync(flightsToEnrich)
      setResults(response.results)
      setIsDialogOpen(true)
    } catch (error) {
      console.error('Aircraft enrichment failed:', error)
      // Could show a toast here
    }
  }

  const handleAccept = async (updates: { id: number; aircraft_icao: string }[]) => {
    await updateMutation.mutateAsync(updates)
    onComplete?.()
  }

  const handleClose = () => {
    setIsDialogOpen(false)
    setResults([])
  }

  const isLoading = enrichMutation.isPending

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('enrich.searching', 'Searching...')}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {flights.length === 1
              ? t('enrich.findAircraft', 'Find Aircraft')
              : t('enrich.findAircraftCount', 'Find Aircraft ({{count}})', { count: flights.length })}
          </>
        )}
      </Button>

      <AircraftEnrichDialog
        isOpen={isDialogOpen}
        onClose={handleClose}
        flights={flights}
        results={results}
        onAccept={handleAccept}
        isApplying={updateMutation.isPending}
      />
    </>
  )
}
