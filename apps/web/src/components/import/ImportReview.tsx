import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightEditRow } from './FlightEditRow'
import { Button } from '@/components/ui/button'
import { Plane, AlertTriangle, Loader2, CheckSquare, Square, Plus, Copy, Info } from 'lucide-react'
import type { ExtractedFlight, RejectedFlight } from '../../hooks/useImport'

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
}: ImportReviewProps) {
  const { t } = useTranslation()
  const [flights, setFlights] = useState<ExtractedFlight[]>(initialFlights)

  // Convert rejected flights to editable ExtractedFlight objects
  // This allows users to fill in missing airline codes instead of re-entering everything
  const rejectedAsFlights = useMemo(() => {
    if (!rejected || rejected.length === 0) return []
    return rejected.map((r): ExtractedFlight => ({
      date: r.date || '',
      origin: r.origin || '',
      destination: r.destination || '',
      airline_iata: r.airline_iata || '', // Empty - user needs to fill this
      confidence: 0.5,
      enrichment_status: 'pending',
    }))
  }, [rejected])

  // Merge valid flights with rejected flights (to allow editing)
  const allFlights = useMemo(() => {
    if (flights.length > 0) return flights
    // If no valid flights, show rejected ones for manual correction
    return rejectedAsFlights
  }, [flights, rejectedAsFlights])

  const showingRejectedFlights = flights.length === 0 && rejectedAsFlights.length > 0

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    // Pre-select all valid flights, excluding duplicates and placeholder airlines
    const flightsToCheck = initialFlights.length > 0 ? initialFlights : rejectedAsFlights
    return new Set(
      flightsToCheck
        .map((_, i) => i)
        .filter((i) => {
          const f = flightsToCheck[i]
          const isDuplicate = existingRoutes.has(`${f.date}:${f.origin}:${f.destination}`)
          // Don't auto-select flights with placeholder airline
          const hasPlaceholderAirline = f.airline_iata === 'ZZ'
          return (
            !isDuplicate &&
            !hasPlaceholderAirline &&
            f.date &&
            f.origin?.length === 3 &&
            f.destination?.length === 3 &&
            f.airline_iata?.length === 2 &&
            f.origin !== f.destination
          )
        })
    )
  })

  // Check for duplicates
  const duplicateIndices = useMemo(() => {
    const indices = new Set<number>()
    allFlights.forEach((flight, i) => {
      const key = `${flight.date}:${flight.origin}:${flight.destination}`
      if (existingRoutes.has(key)) {
        indices.add(i)
      }
    })
    return indices
  }, [allFlights, existingRoutes])

  // Count flights with placeholder airlines
  const placeholderCount = useMemo(() => {
    return allFlights.filter(f => f.airline_iata === 'ZZ').length
  }, [allFlights])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(allFlights.map((_, i) => i)))
  }, [allFlights])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleExcludeDuplicates = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const idx of duplicateIndices) {
        next.delete(idx)
      }
      return next
    })
  }, [duplicateIndices])

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
    if (showingRejectedFlights) {
      // When editing rejected flights, update the local state
      // (We're not modifying the original flights array since it's empty)
      setFlights((prev) => {
        // If we haven't started editing yet, initialize from rejected flights
        if (prev.length === 0) {
          const updated = [...rejectedAsFlights]
          updated[index] = flight
          return updated
        }
        // Otherwise update normally
        const next = [...prev]
        next[index] = flight
        return next
      })
    } else {
      setFlights((prev) => {
        const next = [...prev]
        next[index] = flight
        return next
      })
    }
  }, [showingRejectedFlights, rejectedAsFlights])

  const handleDelete = useCallback((index: number) => {
    setFlights((prev) => {
      // If editing rejected flights and haven't modified flights yet
      if (showingRejectedFlights && prev.length === 0) {
        return rejectedAsFlights.filter((_, i) => i !== index)
      }
      return prev.filter((_, i) => i !== index)
    })
    setSelectedIds((prev) => {
      const next = new Set<number>()
      prev.forEach((id) => {
        if (id < index) next.add(id)
        else if (id > index) next.add(id - 1)
        // id === index is removed
      })
      return next
    })
  }, [showingRejectedFlights, rejectedAsFlights])

  const handleSave = useCallback(() => {
    // Scroll to top for better UX during save
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const selectedFlights = allFlights.filter((_, i) => selectedIds.has(i))
    onSave(selectedFlights)
  }, [allFlights, selectedIds, onSave])

  const selectedCount = selectedIds.size
  const selectedHasInferredYear = allFlights.some((flight, index) => selectedIds.has(index) && flight.field_confidence?.date_year_explicit === false)
  const totalCount = allFlights.length

  // Empty state - no flights found at all
  if (allFlights.length === 0) {
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
            {showingRejectedFlights
              ? t('import.review.subtitleRejected', 'Fill in missing airline codes to import these flights')
              : t('import.review.subtitle', 'Verify and select which flights to import')}
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

      {/* Banner when showing rejected flights */}
      {showingRejectedFlights && (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.05] overflow-hidden">
          <div className="px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warning-foreground mb-1">
                {t('import.review.missingAirlines', 'Missing airline codes')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('import.review.missingAirlinesHint', 'AI found {{count}} flight(s), but couldn\'t determine the airline. Fill in the 2-letter airline codes (like "LY", "QR", "TK") to import these flights, or skip for now.', {
                  count: geminiCount || rejectedAsFlights.length,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info banner for placeholder airlines */}
      {placeholderCount > 0 && !showingRejectedFlights && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.05]">
          <div className="px-4 py-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">
                {t('import.review.placeholderAirlines', 'Unknown airlines detected')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('import.review.placeholderAirlinesHint', "AI couldn't identify the airline for {{count}} flight(s). You can import them now and add airlines later, or fill them in before importing.", {
                  count: placeholderCount,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action toolbar - minimal floating buttons */}
      {selectedHasInferredYear && (
        <p className="text-sm text-warning" role="alert">
          {t('import.review.confirmYear', 'Confirm the year on each selected flight before importing.')}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          onClick={onManualAdd}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('import.review.addManually', 'Add manually')}
        </button>

        <div className="flex items-center gap-3">
          {showingRejectedFlights ? (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={saving}
                className="rounded-xl"
              >
                {t('import.review.skipForNow', 'Skip for now')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || selectedCount === 0 || selectedHasInferredYear}
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
            </>
          ) : (
            <>
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
                disabled={saving || selectedCount === 0 || selectedHasInferredYear}
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
            </>
          )}
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
          {placeholderCount > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedIds(prev => {
                  const next = new Set(prev)
                  allFlights.forEach((flight, idx) => {
                    if (flight.airline_iata === 'ZZ') {
                      next.add(idx)
                    }
                  })
                  return next
                })
              }}
              className="h-8 px-3 rounded-lg gap-2 text-sm"
            >
              {t('import.review.includeUnknown', 'Include unknown')}
            </Button>
          )}
        </div>

        {/* Warnings summary */}
        <div className="flex items-center gap-3 text-sm">
          {duplicateIndices.size > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span className="text-warning-foreground text-xs font-medium">
                  {t('import.review.duplicatesCount', '{{count}} possible duplicates', {
                    count: duplicateIndices.size,
                  })}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={handleExcludeDuplicates}
                className="h-8 px-3 rounded-lg gap-2 text-sm text-warning-foreground hover:text-warning-foreground hover:bg-warning/10"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('import.review.excludeDuplicates', 'Exclude duplicates')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Flight list - with subtle container */}
      <div className="space-y-3">
        {allFlights.map((flight, index) => (
          <FlightEditRow
            key={index}
            flight={flight}
            index={index}
            selected={selectedIds.has(index)}
            isDuplicate={duplicateIndices.has(index)}
            onSelect={(selected) => handleToggleSelect(index, selected)}
            onChange={(f) => handleFlightChange(index, f)}
            onDelete={() => handleDelete(index)}
          />
        ))}
      </div>

    </div>
  )
}
