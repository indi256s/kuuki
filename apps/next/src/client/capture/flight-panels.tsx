'use client'
import { useRouter } from 'next/navigation'
import type { Locale } from '../../lib/format'
import { Dialog } from '../ui/dialog'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import { FlightForm } from './flight-form'

/** Shared Journal detail: omit `initialEditing` to open the Ticket with named edit/delete actions. */
export function FlightDetailSheet({ ownerId, locale, flightId, open = true, onOpenChange, onDelete, initialEditing = false, focusField, onCloseAutoFocus }: {
  ownerId: string; locale: Locale; flightId: number; open?: boolean; onOpenChange?: (open: boolean) => void; initialEditing?: boolean; onDelete?: (id: number) => void
  /** Opens the editor on Optional details and focuses this field ("Add aircraft"). */
  focusField?: 'aircraft'
  /** Focus is about to leave the closing sheet; `preventDefault()` lets the caller place it (the row that opened the sheet). */
  onCloseAutoFocus?: (event: Event) => void
}) {
  const router = useRouter()
  const mobile = useMobile()
  if (!open || mobile === null) return null
  return <FlightForm key={flightId} ownerId={ownerId} locale={locale} editId={flightId} onDelete={onDelete} initialEditing={initialEditing} focusField={focusField} onOpenJournal={onOpenChange ? () => onOpenChange(false) : undefined} onCancel={() => { if (onOpenChange) onOpenChange(false); else router.push('/journal') }} surface={(content, footer) => <Sheet open={open} onOpenChange={onOpenChange ?? (next => { if (!next) router.push('/journal') })} title={locale === 'ru' ? 'Перелёт' : 'Flight'} closeLabel={locale === 'ru' ? 'Закрыть перелёт' : 'Close flight'} side={mobile ? 'bottom' : 'right'} className={mobile ? 'flight-full-sheet' : ''} onCloseAutoFocus={onCloseAutoFocus} footer={footer}>{content}</Sheet>} />
}
export function FlightCaptureDialog({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const router = useRouter()
  const mobile = useMobile()
  if (mobile === null) return null
  const Panel = mobile ? Sheet : Dialog
  return <FlightForm ownerId={ownerId} locale={locale} onCancel={() => router.push('/journal')} surface={(content, footer) => <Panel open onOpenChange={next => { if (!next) router.push('/journal') }} title={locale === 'ru' ? 'Новый перелёт' : 'Add a flight'} closeLabel={locale === 'ru' ? 'Закрыть' : 'Close'} className={mobile ? 'flight-full-sheet' : 'flight-add-dialog'} footer={footer}>{content}</Panel>} />
}
