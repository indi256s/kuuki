'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateOnly, type Locale } from '../../lib/format'
import { announceShellNotice } from '../shell-notices'
import { followPublication } from '../write-feedback'
import { addOrigin } from './add-origin'
import { Dialog } from '../ui/dialog'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import { FlightForm } from './flight-form'

/** Shared Journal detail: omit `initialEditing` to open the Ticket with named edit/delete actions. */
export function FlightDetailSheet({
  ownerId,
  locale,
  flightId,
  open = true,
  onOpenChange,
  onDelete,
  initialEditing = false,
  focusField,
  onCloseAutoFocus,
}: {
  ownerId: string
  locale: Locale
  flightId: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialEditing?: boolean
  onDelete?: (id: number) => void
  /** Opens the editor on Optional details and focuses this field ("Add aircraft"). */
  focusField?: 'aircraft'
  /** Focus is about to leave the closing sheet; `preventDefault()` lets the caller place it (the row that opened the sheet). */
  onCloseAutoFocus?: (event: Event) => void
}) {
  const router = useRouter()
  const mobile = useMobile()
  if (!open || mobile === null) return null
  return (
    <FlightForm
      key={flightId}
      ownerId={ownerId}
      locale={locale}
      editId={flightId}
      onDelete={onDelete}
      initialEditing={initialEditing}
      focusField={focusField}
      onOpenJournal={onOpenChange ? () => onOpenChange(false) : undefined}
      onCancel={() => {
        if (onOpenChange) onOpenChange(false)
        else router.push('/journal')
      }}
      surface={(content, footer) => (
        <Sheet
          initialDetent={1}
          open={open}
          onOpenChange={
            onOpenChange ??
            ((next) => {
              if (!next) router.push('/journal')
            })
          }
          title={locale === 'ru' ? 'Перелёт' : 'Flight'}
          closeLabel={locale === 'ru' ? 'Закрыть перелёт' : 'Close flight'}
          side={mobile ? 'bottom' : 'right'}
          className={mobile ? 'flight-full-sheet' : ''}
          onCloseAutoFocus={onCloseAutoFocus}
          footer={footer}
        >
          {content}
        </Sheet>
      )}
    />
  )
}
/** Add a flight. A confirmed save closes it, returns to the screen it was opened from and reports the save in a toast. */
export function FlightCaptureDialog({ ownerId, locale }: { ownerId: string; locale: Locale }) {
  const router = useRouter()
  const mobile = useMobile()
  const ru = locale === 'ru'
  // Read once: the tracker would otherwise record /add's own successor while it closes.
  const origin = useRef<string | null>(null)
  useEffect(() => {
    origin.current = addOrigin()
  }, [])
  const leave = () => router.push(origin.current ?? addOrigin())
  if (mobile === null) return null
  const Panel = mobile ? Sheet : Dialog
  return (
    <FlightForm
      ownerId={ownerId}
      locale={locale}
      onCancel={leave}
      onCreated={(flight, route) => {
        const totals =
          flight.derived_state === 'ready'
            ? ru
              ? 'Итоги обновлены.'
              : 'Totals updated.'
            : flight.derived_state === 'pending' && typeof flight.revision === 'number'
              ? ru
                ? 'Итоги обновляются.'
                : 'Totals are updating.'
              : ru
                ? 'Итоги ещё не подтвердили обновление.'
                : 'Totals have not confirmed publication yet.'
        announceShellNotice(ownerId, {
          kind: 'success',
          duration: 8000,
          message: ru ? 'Перелёт сохранён' : 'Flight saved',
          description: `${route.origin} → ${route.destination} · ${formatDateOnly(locale, route.date)}\n${totals}`,
          actionLabel: ru ? 'Открыть перелёт' : 'View flight',
          onAction: () => router.push(`/journal?flight=${flight.id}`),
        })
        followPublication(flight, () => router.refresh())
        leave()
      }}
      surface={(content, footer) => (
        <Panel
          {...(mobile ? { initialDetent: 1 } : {})}
          open
          onOpenChange={(next) => {
            if (!next) leave()
          }}
          title={ru ? 'Новый перелёт' : 'Add a flight'}
          closeLabel={ru ? 'Закрыть' : 'Close'}
          className={mobile ? 'flight-full-sheet' : 'flight-add-dialog'}
          footer={footer}
        >
          {content}
        </Panel>
      )}
    />
  )
}
