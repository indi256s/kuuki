import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { findAircraft, findAirport } from '@kuuki/data'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Flight } from '@/hooks/useFlights'
import type { EnrichmentResult } from '@/hooks/useAircraftEnrichment'

interface AircraftEnrichDialogProps {
  isOpen: boolean
  onClose: () => void
  flights: Flight[]
  results: EnrichmentResult[]
  onAccept: (updates: { id: number; aircraft_icao: string }[]) => Promise<void>
  isApplying: boolean
}

export function AircraftEnrichDialog({
  isOpen,
  onClose,
  flights,
  results,
  onAccept,
  isApplying,
}: AircraftEnrichDialogProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filter results to only show ≥0.7 confidence (hide low-confidence entirely)
  const displayableResults = results.filter(r => r.aircraft_icao && r.confidence >= 0.7)

  // Initialize selection with all displayable results
  useEffect(() => {
    if (isOpen && displayableResults.length > 0) {
      const identifiedIds = new Set(
        displayableResults.map(r => r.flight_id)
      )
      setSelectedIds(identifiedIds)
    }
  }, [isOpen, results])

  // Build a map of results by flight ID for quick lookup
  const resultMap = new Map(results.map(r => [r.flight_id, r]))

  // Count statistics - only count displayable (≥0.7 confidence) results
  const identifiedCount = displayableResults.length
  const selectedCount = selectedIds.size
  const selectableCount = displayableResults.length

  const toggleSelection = (flightId: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(flightId)) {
      newSet.delete(flightId)
    } else {
      newSet.add(flightId)
    }
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    if (selectedCount === selectableCount) {
      setSelectedIds(new Set())
    } else {
      const allSelectable = new Set(
        displayableResults.map(r => r.flight_id)
      )
      setSelectedIds(allSelectable)
    }
  }

  const handleAccept = async () => {
    const updates = Array.from(selectedIds)
      .map(flightId => {
        const result = resultMap.get(flightId)
        const flight = flights.find(f => String(f.id) === flightId)
        if (!result?.aircraft_icao || !flight) return null
        return { id: flight.id, aircraft_icao: result.aircraft_icao }
      })
      .filter((u): u is { id: number; aircraft_icao: string } => u !== null)

    if (updates.length > 0) {
      await onAccept(updates)
    }
    onClose()
  }

  const getConfidenceBadge = (confidence: number) => {
    // Only showing ≥0.7 confidence results, so only two tiers needed
    if (confidence >= 0.9) {
      return (
        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          {Math.round(confidence * 100)}%
        </Badge>
      )
    }
    // 0.7-0.89
    return (
      <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
        {Math.round(confidence * 100)}%
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="gap-0 p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            {t('enrich.resultsTitle', 'Aircraft Identification Results')}
          </DialogTitle>
          <DialogDescription>
            {t('enrich.resultsDescription', '{{identified}} of {{total}} aircraft identified', {
              identified: identifiedCount,
              total: flights.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4">
            {/* Select all toggle */}
            {selectableCount > 0 && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Checkbox
                    checked={selectedCount === selectableCount && selectableCount > 0}
                    className="data-[state=checked]:bg-primary"
                  />
                  {selectedCount === selectableCount
                    ? t('import.review.deselectAll', 'Deselect all')
                    : t('import.review.selectAll', 'Select all')}
                </button>
                <span className="text-sm text-muted-foreground">
                  {t('enrich.selectedCount', '{{selected}} selected', { selected: selectedCount })}
                </span>
              </div>
            )}

            {/* Results list - only show flights with high-confidence results */}
            <div className="space-y-2">
              {flights
                .filter((flight) => {
                  const result = resultMap.get(String(flight.id))
                  // Only show flights with displayable results (≥0.7 confidence)
                  return result?.aircraft_icao && result.confidence >= 0.7
                })
                .map((flight) => {
                  const result = resultMap.get(String(flight.id))!
                  const isSelected = selectedIds.has(String(flight.id))
                  const aircraft = findAircraft(result.aircraft_icao!)
                  const originAirport = findAirport(flight.origin)
                  const destAirport = findAirport(flight.destination)

                  return (
                    <div
                      key={flight.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                        isSelected
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border/50 bg-card hover:bg-muted/30'
                      )}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(String(flight.id))}
                        className={cn(
                          'flex-shrink-0',
                          isSelected && 'data-[state=checked]:bg-primary'
                        )}
                      />

                      {/* Flight info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {flight.airline_iata}{flight.flight_number || ''}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {flight.origin} → {flight.destination}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {originAirport?.city || flight.origin} to {destAirport?.city || flight.destination}
                          {' · '}
                          {new Date(flight.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

                      {/* Result */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-sm font-medium">{result.aircraft_icao}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-32">
                            {aircraft?.model || result.aircraft_name || ''}
                          </div>
                        </div>
                        {getConfidenceBadge(result.confidence)}
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Empty state */}
            {identifiedCount === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {t('enrich.noResults', 'Could not identify any aircraft. Try again or set manually.')}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={selectedCount === 0 || isApplying}
          >
            {isApplying
              ? t('common.saving', 'Saving...')
              : t('enrich.acceptSelected', 'Accept {{count}} Selected', { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
