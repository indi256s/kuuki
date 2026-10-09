'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '../../lib/format'
import type { AwaitingQueue } from '../awaiting'
import { LIFECYCLE_CHANGED_EVENT } from '../lifecycle-sync'
import { confirmFlights } from './confirm-flights'
import type { JournalFlight } from './model'

const copy = {
  en: { busy: 'Confirming…', confirmed: (route: string) => `Confirmed ${route}.`, pending: 'Your passport is updating…',
    unknown: 'Could not check whether the flight was confirmed. The list is refreshing; check it before trying again.',
    failed: 'Could not confirm the flight. The list is refreshing; try again later.' },
  ru: { busy: 'Подтверждаем…', confirmed: (route: string) => `Перелёт ${route} подтверждён.`, pending: 'Паспорт обновляется…',
    unknown: 'Не удалось проверить, подтверждён ли перелёт. Список обновляется; проверьте его, прежде чем повторить.',
    failed: 'Не удалось подтвердить перелёт. Список обновляется; повторите позже.' },
}

// Swipe and the card menu share the guarded confirmation transport with bulk/review actions.
export function useMobileConfirmation({ locale, queue, online, refresh }: {
  locale: Locale; queue: AwaitingQueue | null; online: boolean; refresh: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; alert: boolean } | null>(null)
  const operation = useRef<AbortController | null>(null)
  useEffect(() => () => operation.current?.abort(), [])
  const confirm = async (flight: JournalFlight) => {
    if (!online || operation.current || flight.lifecycle_state !== 'awaiting') return
    const controller = new AbortController()
    operation.current = controller
    const t = copy[locale]
    setBusy(true)
    setNote({ text: t.busy, alert: false })
    try {
      const result = await confirmFlights({ flights: [flight], queue, signal: controller.signal })
      if (result.outcome === 'stale' || controller.signal.aborted) return
      void refresh()
      if (result.confirmed.length) window.dispatchEvent(new CustomEvent(LIFECYCLE_CHANGED_EVENT))
      setNote(result.confirmed.includes(flight.id)
        ? { text: `${t.confirmed(`${flight.origin} → ${flight.destination}`)}${result.derivedState === 'pending' ? ` ${t.pending}` : ''}`, alert: false }
        : { text: result.outcome === 'unknown' ? t.unknown : t.failed, alert: true })
    } finally {
      operation.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return { confirm, busy, note }
}
