'use client'

import { useState } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import type { Locale } from '../../lib/format'
import './passport.css'

/**
 * The countries the owner hid from the passport, each with Restore. Hiding is presentation only: restoring puts the
 * stamp back in the collection and in the public set, nothing else changes.
 */
export function HiddenSheet({
  open,
  onOpenChange,
  locale,
  mobile,
  codes,
  name,
  onRestored,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  mobile: boolean
  codes: string[]
  name: (code: string) => string
  /** A country was restored: refetch the collection. */
  onRestored: (code: string) => Promise<void> | void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const ru = locale === 'ru'
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function restore(code: string) {
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    setBusy(code)
    setError('')
    try {
      await api.delete(`/api/passport/hidden/${code}`, undefined, { signal: controller.signal })
      if (controller.signal.aborted || generation !== getAuthGeneration()) return
      await onRestored(code)
    } catch {
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setError(
          ru
            ? 'Не удалось вернуть страну. Проверьте сеть и повторите.'
            : 'Could not restore this country. Check your connection and try again.',
        )
    } finally {
      release()
      setBusy(null)
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side={mobile ? 'bottom' : 'right'}
      className="passport-sheet-panel"
      title={ru ? 'Скрытые страны' : 'Hidden countries'}
      description={
        ru
          ? 'Скрытые страны не видны в паспорте и в публичном профиле. Записи и статистика остаются.'
          : 'Hidden countries stay out of your passport and your public profile. Your records and statistics are untouched.'
      }
      closeLabel={ru ? 'Закрыть' : 'Close'}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="passport-sheet">
        {codes.length ? (
          <ul className="passport-list" aria-label={ru ? 'Скрытые страны' : 'Hidden countries'}>
            {codes.map((code) => (
              <li key={code}>
                <span>{name(code)}</span>
                <Button
                  dense
                  loading={busy === code}
                  loadingLabel={ru ? 'Возвращаем…' : 'Restoring…'}
                  aria-label={ru ? `Вернуть: ${name(code)}` : `Restore ${name(code)}`}
                  onClick={() => void restore(code)}
                >
                  {ru ? 'Вернуть' : 'Restore'}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="passport-note" role="status">
            {ru ? 'Скрытых стран нет.' : 'No hidden countries.'}
          </p>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </Sheet>
  )
}
