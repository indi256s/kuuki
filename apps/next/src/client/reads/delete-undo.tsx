'use client'

import { forwardRef } from 'react'
import { Button } from '../ui/button'
import { formatCount } from '../../lib/format'
import type { Locale } from '../../server/locale'

const being = {
  en: { one: '{count} flight is being deleted.', other: '{count} flights are being deleted.' },
  ru: { one: '{count} перелёт будет удалён.', few: '{count} перелёта будут удалены.', many: '{count} перелётов будут удалены.', other: '{count} перелёта будут удалены.' },
} as const

/**
 * The pending-delete notice. It is a fixed, always-mounted polite live area, so it stays in view wherever the delete started
 * and screen readers register it before the first message. The text is announced once: the seconds are decoration (aria-hidden)
 * and the sentence does not change while the countdown runs.
 */
export const DeleteUndo = forwardRef<HTMLButtonElement, { locale: Locale; pending: { ids: number[]; seconds: number } | null; submitting: boolean; onUndo: () => void }>(function DeleteUndo({ locale, pending, submitting, onUndo }, ref) {
  const ru = locale === 'ru'
  return <div className="journal-undo" data-active={pending ? 'true' : undefined}>
    <p role="status" className="journal-undo-message">{pending ? formatCount(locale, pending.ids.length, being) : ''}</p>
    {pending && <span className="journal-undo-seconds mono" aria-hidden="true">{pending.seconds} {ru ? 'с' : 's'}</span>}
    {pending && !submitting && <Button ref={ref} variant="primary" dense onClick={onUndo}>{ru ? 'Отменить' : 'Undo'}</Button>}
  </div>
})
