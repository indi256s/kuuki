import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightEditRow } from './FlightEditRow'
import { EnrichmentErrorBanner } from './EnrichmentErrorBanner'
import { Button } from '@/components/ui/button'
import { Plane, AlertTriangle, FileText, ChevronDown, Loader2, CheckSquare, Square, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEnrichmentPolling, type ExtractedFlight, type RejectedFlight } from '../../hooks/useImport'

interface ImportReviewProps {
  flights: ExtractedFlight[]
  existingRoutes?: Set<string> // Format: "YYYY-MM-DD:ORIGIN:DESTINATION"
  onSave: (flights: ExtractedFlight[]) => void
  onCancel: () => void
  onManualAdd: () => void
  saving?: boolean
  // Diagnostic info for when flights are rejected
  rejected?: RejectedFlight[]
  geminiCount?: number
  // Normalized text from two-stage parsing (text input only)
  cleanedText?: string
  // Two-phase import: enrichment job ID for polling
  enrichmentJobId?: string
  // Callback when enrichment completes (to update parent state)
  onEnrichmentComplete?: (flights: ExtractedFlight[]) => void
}

export function ImportReview({
  flights: initialFlights,
  existingRoutes = new Set(),
  onSave,
  onCancel,
  onManualAdd,
  saving,
  rejected,
  geminiCount,
  cleanedText,
  enrichmentJobId,
  onEnrichmentComplete,
}: ImportReviewProps) {
  const { t } = useTranslation()
  const [flights, setFlights] = useState<ExtractedFlight[]>(initialFlights)
  const [showCleanedText, setShowCleanedText] = useState(false)
  const [isEnriching, setIsEnriching] = useState(!!enrichmentJobId)
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    // Pre-select all valid flights
    return new Set(
      initialFlights
        .map((_, i) => i)
        .filter((i) => {
          const f = initialFlights[i]
          return (
            f.date &&
            f.origin?.length === 3 &&
            f.destination?.length === 3 &&
            f.airline_iata?.length === 2 &&
            f.origin !== f.destination
          )
        })
    )
  })

  // Handle enrichment completion - merge enriched data into flights
  const handleEnrichmentComplete = useCallback((enrichedFlights: ExtractedFlight[]) => {
    setIsEnriching(false)
    setEnrichmentError(null)

    // Merge enriched flights with current flights (match by date + route)
    setFlights(prev => {
      return prev.map(basicFlight => {
        // Find matching enriched flight
        const enriched = enrichedFlights.find(
          ef => ef.date === basicFlight.date &&
                ef.origin === basicFlight.origin &&
                ef.destination === basicFlight.destination
        )

        if (enriched) {
          // Merge enriched data, keeping any user edits
          return {
            ...basicFlight,
            // Only update fields that weren't manually edited (still have original values)
            aircraft_icao: basicFlight.aircraft_icao || enriched.aircraft_icao,
            departure_time: basicFlight.departure_time || enriched.departure_time,
            arrival_time: basicFlight.arrival_time || enriched.arrival_time,
            confidence: enriched.confidence,
            enrichment_status: enriched.enrichment_status,
            field_confidence: enriched.field_confidence,
          }
        }
        return basicFlight
      })
    })

    // Notify parent
    onEnrichmentComplete?.(enrichedFlights)
  }, [onEnrichmentComplete])

  // Handle enrichment error
  const handleEnrichmentError = useCallback((error: string) => {
    setIsEnriching(false)
    setEnrichmentError(error)
  }, [])

  // Poll for enrichment completion
  useEnrichmentPolling(
    enrichmentJobId,
    handleEnrichmentComplete,
    handleEnrichmentError,
    isEnriching
  )

  // Check for duplicates
  const duplicateIndices = useMemo(() => {
    const indices = new Set<number>()
    flights.forEach((flight, i) => {
      const key = `${flight.date}:${flight.origin}:${flight.destination}`
      if (existingRoutes.has(key)) {
        indices.add(i)
      }
    })
    return indices
  }, [flights, existingRoutes])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(flights.map((_, i) => i)))
  }, [flights])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleToggleSelect = useCallback((index: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(index)
      } else {
        next.delete(index)
      }
      return next
    })
  }, [])

  const handleFlightChange = useCallback((index: number, flight: ExtractedFlight) => {
    setFlights((prev) => {
      const next = [...prev]
      next[index] = flight
      return next
    })
  }, [])

  const handleDelete = useCallback((index: number) => {
    setFlights((prev) => prev.filter((_, i) => i !== index))
    setSelectedIds((prev) => {
      const next = new Set<number>()
      prev.forEach((id) => {
        if (id < index) next.add(id)
        else if (id > index) next.add(id - 1)
        // id === index is removed
      })
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    // Scroll to top for better UX during save
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const selectedFlights = flights.filter((_, i) => selectedIds.has(i))
    onSave(selectedFlights)
  }, [flights, selectedIds, onSave])

  const selectedCount = selectedIds.size
  const totalCount = flights.length

  // Empty state - no flights found
  if (flights.length === 0) {
    return (
      <div className="text-center py-16">
        {/* Elegant empty icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 rounded-2xl rotate-6" />
          <div className="absolute inset-0 bg-card border border-border/60 rounded-2xl flex items-center justify-center shadow-sm">
            <Plane className="w-8 h-8 text-muted-foreground/60" />
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2 tracking-tight">
          {t('import.noResults.title', 'No flights found')}
        </h3>
        <p className="text-muted-foreground max-w-sm mx-auto mb-8">
          {t('import.noResults.message', "We couldn't extract flights from this document")}
        </p>

        {/* Diagnostic info when flights were found but rejected */}
        {rejected && rejected.length > 0 && (
          <div className="text-left max-w-md mx-auto mb-8 rounded-xl border border-warning/30 bg-warning/[0.03] overflow-hidden">
            <div className="px-4 py-3 border-b border-warning/20 bg-warning/[0.05]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium text-warning-foreground">
                  {t('import.noResults.diagnostic', 'AI found {{count}} flight(s), but all were rejected during validation:', {
                    count: geminiCount || rejected.length,
                  })}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {rejected.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-warning/60 mt-0.5">•</span>
                  <div className="min-w-0">
                    <span className="font-mono text-foreground">
                      {r.date && <span>{r.date}</span>}
                      {r.origin && r.destination && (
                        <span> {r.origin}→{r.destination}</span>
                      )}
                      {r.airline_iata && <span> ({r.airline_iata})</span>}
                    </span>
                    <span className="text-muted-foreground ml-2">{r.reason}</span>
                  </div>
                </div>
              ))}
              {rejected.length > 5 && (
                <p className="text-sm text-muted-foreground pl-4">
                  {t('import.noResults.moreRejected', '...and {{count}} more', {
                    count: rejected.length - 5,
                  })}
                </p>
              )}
            </div>
            <div className="px-4 py-3 bg-muted/30 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                💡 {t('import.noResults.hint', 'Tip: Make sure airline codes are 2 letters (e.g., "LY" not "El Al") and airport codes are 3 letters.')}
              </p>
            </div>
          </div>
        )}

        {/* Show cleaned text for debugging */}
        {cleanedText && (
          <div className="text-left max-w-md mx-auto mb-8 rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
              <span className="text-sm text-muted-foreground">
                {t('import.noResults.normalizedData', 'Normalized data (for debugging):')}
              </span>
            </div>
            <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
              {cleanedText}
            </pre>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            {t('import.noResults.tryAgain', 'Try another file')}
          </Button>
          <Button onClick={onManualAdd} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t('import.noResults.manual', 'Add manually')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Flight Manifest style */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">
            {t('import.review.title', 'Review extracted flights')}
          </h2>
          <p className="text-muted-foreground">
            {t('import.review.subtitle', 'Verify and select which flights to import')}
          </p>
        </div>

        {/* Selection summary badge */}
        <div className="flex-shrink-0 px-4 py-2 rounded-xl bg-primary/[0.08] border border-primary/20">
          <span className="text-sm font-medium">
            <span className="text-primary">{selectedCount}</span>
            <span className="text-muted-foreground"> / {totalCount}</span>
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {t('import.review.selected', 'selected')}
          </span>
        </div>
      </div>

      {/* Action toolbar - minimal floating buttons */}
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          onClick={onManualAdd}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('import.review.addManually', 'Add manually')}
        </button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="rounded-xl min-w-[140px]"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('import.review.saving', 'Saving...')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plane className="w-4 h-4" />
                {t('import.review.saveSelected', 'Import {{count}}', { count: selectedCount })}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
        {/* Selection controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={handleSelectAll}
            disabled={selectedCount === totalCount}
            className="h-8 px-3 rounded-lg gap-2 text-sm"
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{t('import.review.selectAll', 'Select all')}</span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleDeselectAll}
            disabled={selectedCount === 0}
            className="h-8 px-3 rounded-lg gap-2 text-sm"
          >
            <Square className="w-4 h-4" />
            <span className="hidden sm:inline">{t('import.review.deselectAll', 'Clear')}</span>
          </Button>
        </div>

        {/* Warnings summary */}
        <div className="flex items-center gap-3 text-sm">
          {duplicateIndices.size > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <span className="text-warning-foreground text-xs font-medium">
                {t('import.review.duplicatesCount', '{{count}} possible duplicates', {
                  count: duplicateIndices.size,
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cleaned text toggle (for transparency) */}
      {cleanedText && (
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          <button
            onClick={() => setShowCleanedText(!showCleanedText)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('import.review.viewNormalized', 'View normalized data')}
            </span>
            <ChevronDown aria-hidden="true" className={cn(
              "w-4 h-4 transition-transform duration-200 ease-out",
              showCleanedText && "rotate-180"
            )} />
          </button>
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            showCleanedText ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="px-4 py-3 border-t border-border/50 bg-muted/30">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                {cleanedText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Enrichment error banner */}
      {enrichmentError && (
        <EnrichmentErrorBanner
          error={enrichmentError}
          onRetry={() => {
            // Can't retry without re-parsing - just dismiss the error
            setEnrichmentError(null)
          }}
          onSkip={() => setEnrichmentError(null)}
        />
      )}

      {/* Enrichment progress indicator with skip option */}
      {isEnriching && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary">
              {t('import.review.enrichingFlights', 'Fetching aircraft and timing details...')}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {t('import.review.enrichingContinues', 'You can import now - enrichment continues in background')}
          </span>
        </div>
      )}

      {/* Flight list - with subtle container */}
      <div className="space-y-3">
        {flights.map((flight, index) => (
          <FlightEditRow
            key={index}
            flight={flight}
            index={index}
            selected={selectedIds.has(index)}
            isDuplicate={duplicateIndices.has(index)}
            isEnriching={isEnriching}
            onSelect={(selected) => handleToggleSelect(index, selected)}
            onChange={(f) => handleFlightChange(index, f)}
            onDelete={() => handleDelete(index)}
          />
        ))}
      </div>

    </div>
  )
}
