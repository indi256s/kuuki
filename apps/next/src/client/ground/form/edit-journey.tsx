'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiError } from '@kuuki/client/apiClient'
import type { GroundJourneyDto } from '@kuuki/shared/groundTravel'
import type { Locale } from '../../../lib/format'
import { trackPrivateOperation } from '../../activity'
import { Button } from '../../ui/button'
import { readJourney } from '../api'
import { GroundFormSkeleton } from '../ground-skeleton'
import { JourneyForm } from './journey-form'
import type { RailOcrSlotApi } from './rail-editor'
import type { ReactNode } from 'react'

type Loaded =
  | { id: string; attempt: number; kind: 'ready'; journey: GroundJourneyDto }
  | { id: string; attempt: number; kind: 'missing' }
  | { id: string; attempt: number; kind: 'error' }

/**
 * Loads the stored journey for the form. Another owner's and a missing id read the same (404): no data is
 * revealed. A failed read is an error with Retry, never an empty form.
 */
export function EditJourney({
  ownerId,
  locale,
  id,
  complete,
  returnTo,
  ocrSlot,
}: {
  ownerId: string
  locale: Locale
  id: string
  complete: boolean
  returnTo: string
  ocrSlot?: (api: RailOcrSlotApi) => ReactNode
}) {
  const ru = locale === 'ru'
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    readJourney(id, { signal: controller.signal }).then(
      (journey) => {
        if (!controller.signal.aborted) setLoaded({ id, attempt, kind: 'ready', journey })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const kind =
          error instanceof ApiError && (error.status === 404 || error.status === 410)
            ? 'missing'
            : 'error'
        setLoaded({ id, attempt, kind } as Loaded)
      },
    )
    return () => {
      release()
      controller.abort()
    }
  }, [id, attempt])

  if (!loaded || loaded.id !== id || loaded.attempt !== attempt)
    return <GroundFormSkeleton label={ru ? 'Загружаем путешествие…' : 'Loading the journey…'} />
  if (loaded.kind === 'missing')
    return (
      <div className="gt-notice">
        <p className="gt-notice-title">
          {ru ? 'Этого путешествия нет в вашем списке.' : 'This journey is not in your list.'}
        </p>
        <Link href={returnTo} className="gt-back">
          {ru ? 'К списку' : 'Back to the list'}
        </Link>
      </div>
    )
  if (loaded.kind === 'error')
    return (
      <div className="gt-notice">
        <p className="gt-notice-title" role="alert">
          {ru ? 'Не удалось загрузить путешествие.' : 'Could not load the journey.'}
        </p>
        <div className="gt-actions">
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            {ru ? 'Повторить' : 'Retry'}
          </Button>
          <Link href={returnTo} className="gt-back">
            {ru ? 'К списку' : 'Back to the list'}
          </Link>
        </div>
      </div>
    )
  const { journey } = loaded
  return (
    <JourneyForm
      key={`${journey.id}:${journey.version}`}
      ownerId={ownerId}
      locale={locale}
      mode={journey.mode}
      existing={journey}
      complete={complete && journey.status === 'planned'}
      returnTo={returnTo}
      ocrSlot={ocrSlot}
    />
  )
}
