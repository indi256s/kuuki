'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { allianceAt } from '@kuuki/data/alliance-membership'
import { AllianceMark } from '../ui/category-mark'
import { ConfirmMorph } from '../ui/confirm-morph'
import { ContextMenu, ContextMenuButton, type ContextMenuItem } from '../ui/context-menu'
import { InlineEdit, type InlineEditOutcome } from '../ui/inline-edit'
import type { JournalData } from '../../server/journal'
import type { Locale } from '../../server/locale'
import { formatDateOnly, formatDistanceKm, formatDuration } from '../../lib/format'
import './journal-ledger.css'

type Flight = JournalData['flights'][number]

// The aircraft catalogue and the write module load when the first edit starts, not with the Journal.


const copy = {
  en: { select: 'Select', addAircraft: 'Add aircraft', changeAircraft: 'Change aircraft', aircraft: 'Aircraft', saveAircraft: 'Save aircraft', cancelEdit: 'Cancel editing', saving: 'Saving…', loading: 'Loading aircraft…', loadFailed: 'Could not load the aircraft editor.', retry: 'Try again', hint: 'Enter saves, Escape cancels. Choose an aircraft from the list first.', fullEditor: 'All details', actions: 'Actions', open: 'Open flight', edit: 'Edit flight', delete: 'Delete flight', cancel: 'Cancel', deleteConsequence: 'It leaves the list now. You can undo for six seconds; after that the deletion is sent.', offline: 'Offline. Connect to change flights.', busy: 'Another deletion is still waiting. Undo it or wait for it to finish.', unknown: 'Could not confirm the change: the aircraft may or may not be saved. The list is refreshing. Check it, then save again if needed.' },
  ru: { select: 'Выбрать', addAircraft: 'Добавить самолёт', changeAircraft: 'Изменить самолёт', aircraft: 'Самолёт', saveAircraft: 'Сохранить самолёт', cancelEdit: 'Отменить редактирование', saving: 'Сохраняем…', loading: 'Загружаем самолёты…', loadFailed: 'Не удалось загрузить редактор самолёта.', retry: 'Повторить', hint: 'Enter сохраняет, Escape отменяет. Сначала выберите самолёт из списка.', fullEditor: 'Все данные', actions: 'Действия', open: 'Открыть перелёт', edit: 'Изменить перелёт', delete: 'Удалить перелёт', cancel: 'Отмена', deleteConsequence: 'Перелёт пропадёт из списка сейчас. Отменить можно в течение шести секунд, затем удаление будет отправлено.', offline: 'Нет сети. Подключитесь, чтобы изменить перелёты.', busy: 'Другое удаление ещё ожидает. Отмените его или дождитесь завершения.', unknown: 'Не удалось подтвердить изменение: самолёт мог сохраниться, а мог и нет. Список обновляется. Проверьте его и при необходимости сохраните снова.' },
} as const

export type JournalRowProps = {
  flight: Flight
  locale: Locale
  online: boolean
  offlineId: string
  selected: boolean
  onSelectedChange: (checked: boolean) => void
  onOpen: (id: number, edit?: boolean, field?: 'aircraft') => void
  aircraftEditing: boolean
  onAircraftEditingChange: (editing: boolean) => void
  onSaveAircraft: (id: number, draft: string) => Promise<InlineEditOutcome>
  confirming: boolean
  /** A deletion (this or another flight) is waiting out Undo or being sent. */
  deleteBusy: boolean
  onDeleteAsk: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}

/** One ledger row: the open button, selection, the aircraft cell with inline edit, the actions menu and the single-flight delete question. */
export function JournalRow({ flight, locale, online, offlineId, selected, onSelectedChange, onOpen, aircraftEditing, onAircraftEditingChange, onSaveAircraft, confirming, deleteBusy, onDeleteAsk, onDeleteCancel, onDeleteConfirm }: JournalRowProps) {
  const t = copy[locale]
  const openButton = useRef<HTMLButtonElement>(null)
  const [editor, setEditor] = useState<typeof import('./journal-aircraft') | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  useEffect(() => {
    if (!aircraftEditing || editor) return
    let active = true
    void import('./journal-aircraft').then(
      mod => { if (active) { setEditor(mod); setLoadFailed(false) } },
      () => { if (active) setLoadFailed(true) },
    )
    return () => { active = false }
  }, [aircraftEditing, editor, loadAttempt])
  const alliance = allianceAt(flight.airline_iata, flight.date)
  const route = locale === 'ru' ? `из ${flight.origin} в ${flight.destination}` : `${flight.origin} to ${flight.destination}`
  const date = formatDateOnly(locale, flight.date, 'long')
  const duration = flight.duration_minutes ? `${flight.duration_source === 'estimate' ? '≈ ' : ''}${formatDuration(locale, flight.duration_minutes)}` : null
  const distance = flight.distance_km ? formatDistanceKm(locale, flight.distance_km) : null
  const name = [route, date, flight.flight_number ?? flight.airline_iata, flight.aircraft_icao, duration, distance].filter(Boolean).join(', ')
  const aircraft = flight.aircraft_icao ?? ''
  const deleteReason = !online ? t.offline : deleteBusy ? t.busy : null
  const items: ContextMenuItem[] = [
    { id: 'open', label: t.open, onSelect: () => onOpen(flight.id) },
    { id: 'edit', label: t.edit, onSelect: () => onOpen(flight.id, true) },
    { id: 'delete', label: t.delete, danger: true, disabled: deleteReason !== null, onSelect: onDeleteAsk },
  ]
  return <ContextMenu className="journal-entry" data-confirming={confirming || undefined} label={`${t.actions}: ${route}, ${date}`} items={items} reason={deleteReason} returnFocus={() => openButton.current}>
    <label className="journal-checkbox"><input type="checkbox" aria-label={`${t.select}: ${route}, ${date}`} checked={selected} onChange={event => onSelectedChange(event.target.checked)} /></label>
    <div className="flight-row">
      <button ref={openButton} type="button" className="flight-row-open" data-flight-row={flight.id} aria-label={name} onClick={() => onOpen(flight.id)} />
      <span className="flight-row-date mono" aria-hidden="true">{formatDateOnly(locale, flight.date, 'padded')}</span>
      <strong className="flight-row-route mono" aria-hidden="true">{flight.origin} → {flight.destination}</strong>
      <span className="flight-row-number">{alliance ? <><AllianceMark alliance={alliance} size={12} />{' '}</> : null}<span aria-hidden="true">{flight.flight_number ?? flight.airline_iata ?? '—'}</span></span>
      <div className="journal-aircraft-cell" data-action={aircraft ? undefined : 'add-aircraft'} data-editing={aircraftEditing || undefined}>
        <InlineEdit value={aircraft} empty={!aircraft} display={aircraft || t.addAircraft} disabled={!online} disabledReasonId={!online ? offlineId : undefined}
          triggerLabel={aircraft ? `${t.changeAircraft} ${aircraft}, ${route}, ${date}` : `${t.addAircraft}, ${route}, ${date}`}
          copy={{ group: t.aircraft, save: t.saveAircraft, cancel: t.cancelEdit, saving: t.saving, hint: t.hint, unknown: t.unknown, fullEditor: t.fullEditor }}
          editing={aircraftEditing} onEditingChange={onAircraftEditingChange} onFullEditor={() => onOpen(flight.id, true, 'aircraft')}
          onSave={draft => onSaveAircraft(flight.id, draft)}
          renderField={field => editor ? <editor.AircraftField locale={locale} {...field} /> : loadFailed
            ? <div role="alert">{t.loadFailed} <Button dense onClick={() => { setLoadFailed(false); setLoadAttempt(attempt => attempt + 1) }}>{t.retry}</Button></div>
            : <p role="status" className="arc-inline-status">{t.loading}</p>} />
      </div>
      <span className="flight-row-duration" aria-hidden="true">{duration ?? '—'}</span>
      <span className="flight-row-distance mono" aria-hidden="true">{distance ?? '—'}</span>
    </div>
    <ContextMenuButton label={`${t.actions}: ${route}, ${date}`} className="journal-entry-actions" />
    <ConfirmMorph className="journal-entry-confirm" open={confirming} prompt={locale === 'ru' ? `Удалить перелёт ${route}, ${date}?` : `Delete ${route}, ${date}?`} consequence={t.deleteConsequence}
      confirmLabel={t.delete} cancelLabel={t.cancel} disabledReason={deleteReason} onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} />
  </ContextMenu>
}
