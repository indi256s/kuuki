import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlightEditRow } from './FlightEditRow'
import type { ExtractedFlight } from '../../hooks/useImport'

interface ImportReviewProps {
  flights: ExtractedFlight[]
  existingRoutes?: Set<string> // Format: "YYYY-MM-DD:ORIGIN:DESTINATION"
  onSave: (flights: ExtractedFlight[]) => void
  onCancel: () => void
  onManualAdd: () => void
  saving?: boolean
}

export function ImportReview({
  flights: initialFlights,
  existingRoutes = new Set(),
  onSave,
  onCancel,
  onManualAdd,
  saving,
}: ImportReviewProps) {
  const { t } = useTranslation()
  const [flights, setFlights] = useState<ExtractedFlight[]>(initialFlights)
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
        <div className="w-16 h-16 mx-auto mb-4 bg-sky-sunken rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-ink mb-2">
          {t('import.noResults.title', 'No flights found')}
        </h3>
        <p className="text-ink-muted mb-6">
          {t('import.noResults.message', "We couldn't extract flights from this document")}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
          >
            {t('import.noResults.tryAgain', 'Try another file')}
          </button>
          <button
            onClick={onManualAdd}
            className="px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors"
          >
            {t('import.noResults.manual', 'Add manually')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-ink">
            {t('import.review.title', 'Review extracted flights')}
          </h3>
          <p className="text-sm text-ink-muted">
            {t('import.review.count', '{{selected}} of {{total}} flights selected', {
              selected: selectedCount,
              total: totalCount,
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="text-sm text-runway hover:text-runway-hover"
            disabled={selectedCount === totalCount}
          >
            {t('import.review.selectAll', 'Select all')}
          </button>
          <span className="text-ink-faint">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-sm text-runway hover:text-runway-hover"
            disabled={selectedCount === 0}
          >
            {t('import.review.deselectAll', 'Deselect all')}
          </button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateIndices.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-holding bg-holding-muted px-3 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            {t('import.review.duplicatesFound', '{{count}} possible duplicate(s) found', {
              count: duplicateIndices.size,
            })}
          </span>
        </div>
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
      <div className="flex items-center justify-between pt-4 border-t border-edge">
        <button
          onClick={onManualAdd}
          className="text-sm text-runway hover:text-runway-hover"
        >
          {t('import.review.addManually', 'Add manually instead')}
        </button>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
            disabled={saving}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving || selectedCount === 0}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('import.review.saving', 'Saving...')}
              </span>
            ) : (
              t('import.review.saveSelected', 'Save {{count}} flight(s)', { count: selectedCount })
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
