'use client'

import { useEffect, useRef } from 'react'
import { matches } from '@kuuki/shared/overview/filter'
import { acceptAircraftBatch, enrichAircraft } from '../../../import/import-api'
import { MissingAircraftReview, payloadMissingAircraft } from '../../missing-aircraft'
import { useOverview } from '../../store/overview-context'

type Overview = ReturnType<typeof useOverview>

/** Flights still missing an aircraft, or null when the review has nothing to act on (no payload, aggregated rows, the dev owner or no scope). */
function missingCount({ payload, aggregate, ownerKey, scope }: Overview) {
  if (!payload || aggregate || ownerKey === 'dev' || !scope) return null
  return scope.coverage.total - scope.coverage.typed
}

/** The count the review offers to fix; null whenever `PayloadAircraftReview` would render nothing. */
export function useAircraftReviewCount(): number | null {
  const count = missingCount(useOverview())
  return count !== null && count > 0 ? count : null
}

export function PayloadAircraftReview() {
  const overview = useOverview()
  const latest = useRef(overview)
  useEffect(() => {
    latest.current = overview
  }, [overview])
  const saved = useRef(new Set<number>())
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    const stop = () => request.current?.abort()
    window.addEventListener('kuuki:identity-reset', stop)
    return () => {
      stop()
      window.removeEventListener('kuuki:identity-reset', stop)
    }
  }, [])
  const { ownerKey, locale } = overview
  // Not the hook's null-at-zero: the open dialog keeps rendering as its last flights are saved.
  const count = missingCount(overview)
  if (count === null) return null
  const rows = () => {
    const current = latest.current
    if (!current.isCurrent() || !current.payload || current.aggregate)
      throw new DOMException('Session changed', 'AbortError')
    return current.payload.rows.filter(
      (row) => matches(row, current.filter, current.payload!.refs) && !saved.current.has(row.id),
    )
  }
  const current = () => {
    if (!latest.current.isCurrent() || latest.current.ownerKey !== ownerKey)
      throw new DOMException('Session changed', 'AbortError')
  }
  return (
    <MissingAircraftReview
      key={ownerKey}
      locale={locale}
      count={count}
      actionLabel={locale === 'ru' ? 'Указать самолёт' : 'Add aircraft'}
      read={async (after, signal) => {
        current()
        return payloadMissingAircraft(rows(), after, signal)
      }}
      onConfirmedSaved={(run) => {
        for (const [id, row] of run.rows) if (row.status === 'saved') saved.current.add(id)
        void latest.current.revalidate()
      }}
      aircraftApi={{
        enrich: async (flights) => {
          current()
          request.current?.abort()
          const controller = new AbortController()
          request.current = controller
          const result = await enrichAircraft(flights, controller.signal)
          current()
          return result
        },
        accept: async (items) => {
          current()
          const result = await acceptAircraftBatch(items)
          current()
          return result
        },
      }}
    />
  )
}
