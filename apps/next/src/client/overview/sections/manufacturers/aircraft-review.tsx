'use client'

import { useEffect, useRef } from 'react'
import { matches } from '@kuuki/shared/overview/filter'
import { acceptAircraftBatch, enrichAircraft } from '../../../import/import-api'
import { MissingAircraftReview, payloadMissingAircraft } from '../../missing-aircraft'
import { useOverview } from '../../store/overview-context'

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
  const { payload, aggregate, ownerKey, scope, locale } = overview
  if (!payload || aggregate || ownerKey === 'dev' || !scope) return null
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
      count={scope.coverage.total - scope.coverage.typed}
      actionLabel={locale === 'ru' ? 'Указать самолёт →' : 'Add aircraft →'}
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
