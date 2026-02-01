import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightEditRow } from './FlightEditRow'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plane, AlertTriangle, FileText, ChevronDown, Loader2 } from 'lucide-react'
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
  // Normalized text from two-stage parsing (text input only)
  cleanedText?: string
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
}: ImportReviewProps) {
  const { t } = useTranslation()
  const [flights, setFlights] = useState<ExtractedFlight[]>(initialFlights)
  const [showCleanedText, setShowCleanedText] = useState(false)
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
    const selectedFlights = flights.filter((_, i) => selectedIds.has(i))
    onSave(selectedFlights)
  }, [flights, selectedIds, onSave])

  const selectedCount = selectedIds.size
  const totalCount = flights.length

  if (flights.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Plane className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">
          {t('import.noResults.title', 'No flights found')}
        </h3>
        <p className="text-muted-foreground mb-4">
          {t('import.noResults.message', "We couldn't extract flights from this document")}
        </p>

        {/* Diagnostic info when flights were found but rejected */}
        {rejected && rejected.length > 0 && (
          <Card className="text-left border-border/50 mb-6 max-w-md mx-auto">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                {t('import.noResults.diagnostic', 'AI found {{count}} flight(s), but all were rejected during validation:', {
                  count: geminiCount || rejected.length,
                })}
              </p>
              <ul className="space-y-2 text-sm">
                {rejected.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>
                      {r.date && <span className="text-foreground">{r.date}</span>}
                      {r.origin && r.destination && (
                        <span className="text-foreground"> {r.origin} → {r.destination}</span>
                      )}
                      {r.airline_iata && <span className="text-foreground"> ({r.airline_iata})</span>}
                      <span className="text-yellow-600 dark:text-yellow-400">: {r.reason}</span>
                    </span>
                  </li>
                ))}
                {rejected.length > 5 && (
                  <li className="text-muted-foreground">
                    {t('import.noResults.moreRejected', '...and {{count}} more', {
                      count: rejected.length - 5,
                    })}
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                {t('import.noResults.hint', 'Tip: Make sure airline codes are 2 letters (e.g., "LY" not "El Al") and airport codes are 3 letters.')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Show cleaned text for debugging */}
        {cleanedText && (
          <Card className="text-left border-border/50 mb-6 max-w-md mx-auto">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t('import.noResults.normalizedData', 'Normalized data (for debugging):')}
              </p>
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                {cleanedText}
              </pre>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            {t('import.noResults.tryAgain', 'Try another file')}
          </Button>
          <Button onClick={onManualAdd}>
            {t('import.noResults.manual', 'Add manually')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">
            {t('import.review.title', 'Review extracted flights')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('import.review.count', '{{selected}} of {{total}} flights selected', {
              selected: selectedCount,
              total: totalCount,
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="link"
            size="sm"
            onClick={handleSelectAll}
            disabled={selectedCount === totalCount}
            className="p-0 h-auto"
          >
            {t('import.review.selectAll', 'Select all')}
          </Button>
          <span className="text-muted-foreground">|</span>
          <Button
            variant="link"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedCount === 0}
            className="p-0 h-auto"
          >
            {t('import.review.deselectAll', 'Deselect all')}
          </Button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateIndices.size > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            {t('import.review.duplicatesFound', '{{count}} possible duplicate(s) found', {
              count: duplicateIndices.size,
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Cleaned text toggle (for transparency) */}
      {cleanedText && (
        <Card className="border-border/50 overflow-hidden">
          <button
            onClick={() => setShowCleanedText(!showCleanedText)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('import.review.viewNormalized', 'View normalized data')}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCleanedText ? 'rotate-180' : ''}`} />
          </button>
          {showCleanedText && (
            <CardContent className="px-3 py-2 border-t border-border bg-muted">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                {cleanedText}
              </pre>
            </CardContent>
          )}
        </Card>
      )}

      {/* Flight list */}
      <div className="space-y-2">
        {flights.map((flight, index) => (
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

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="link" onClick={onManualAdd} className="p-0 h-auto">
          {t('import.review.addManually', 'Add manually instead')}
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('import.review.saving', 'Saving...')}
              </span>
            ) : (
              t('import.review.saveSelected', 'Save {{count}} flight(s)', { count: selectedCount })
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
