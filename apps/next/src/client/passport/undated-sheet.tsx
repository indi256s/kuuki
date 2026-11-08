'use client'
// The round-up: ground visits without a year, each set on a year drum. The list is a snapshot taken on open, so a row
// whose year was just set stays under the finger and shows it; the page refreshes once, when the sheet closes.

import { useMemo, useRef, useState } from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { updateGroundVisit } from '@kuuki/client/passport'
import { trackPrivateOperation } from '../activity'
import { Sheet } from '../ui/sheet'
import { formatCount, type CountForms, type Locale } from '../../lib/format'
import type { PassportData } from '../../server/passport'
import { WAY_LABELS, wayOf } from './visit-ways'
import { YearDrum, yearLabel, type YearDrumResult, type YearValue } from './year-drum'
import './passport.css'

export type UndatedVisit = PassportData['groundVisits'][number]

/** The owner's ground visits that carry no year, whatever their way; hidden countries are out of the passport, so out of here. */
export const undatedOf = (visits: readonly UndatedVisit[], hidden: readonly string[] = []) =>
  visits.filter((visit) => visit.visit_year === null && !hidden.includes(visit.country_code))

const UNDATED_FORMS: CountForms = {
  en: { one: '{count} visit without a year', other: '{count} visits without a year' },
  ru: {
    one: '{count} визит без года',
    few: '{count} визита без года',
    many: '{count} визитов без года',
    other: '{count} визита без года',
  },
}
/** «3 визита без года», the label of the entry that opens the round-up. */
export const undatedLabel = (locale: Locale, count: number) =>
  formatCount(locale, count, UNDATED_FORMS)

const LAND: Record<Locale, string> = { en: 'By land', ru: 'По суше' }
const YEAR_OF_VISIT: Record<Locale, string> = { en: 'Year of visit', ru: 'Год визита' }
const CONFLICT: Record<Locale, string> = {
  en: 'This visit changed elsewhere. The list refreshes when you close this.',
  ru: 'Этот визит изменился в другом месте. Список обновится, когда вы закроете окно.',
}
const FAILED: Record<Locale, string> = {
  en: 'Could not save the year. Check your connection and try again.',
  ru: 'Не удалось сохранить год. Проверьте сеть и повторите.',
}

export function UndatedSheet({
  open,
  onOpenChange,
  locale,
  mobile,
  ownerId,
  visits,
  name,
  onChanged,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  mobile: boolean
  ownerId: string
  /** The undated visits as the page has them now; the sheet keeps the ones it saw on open. */
  visits: readonly UndatedVisit[]
  name: (code: string) => string
  /** Something was written (or found changed): refetch the passport. Called once, on close. */
  onChanged: () => Promise<void> | void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const [snapshot, setSnapshot] = useState(visits)
  const [wasOpen, setWasOpen] = useState(open)
  const [years, setYears] = useState<Record<string, YearValue>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [instant, setInstant] = useState(false)
  const editingRef = useRef<string | null>(null)
  const dirty = useRef(false)
  // Per row: writes run one after another, and only the latest edit may speak for the row when one fails.
  const queues = useRef(new Map<string, Promise<void>>())
  const edits = useRef(new Map<string, number>())
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSnapshot(visits)
      setYears({})
      setNotes({})
      setEditing(null)
    }
  }
  const rows = useMemo(
    () =>
      [...snapshot].sort((a, b) =>
        name(a.country_code).localeCompare(name(b.country_code), locale),
      ),
    [snapshot, name, locale],
  )

  const edit = (id: string | null) => {
    editingRef.current = id
    setEditing(id)
  }

  function commit(visit: UndatedVisit, result: YearDrumResult) {
    edit(null)
    const { id } = visit
    if (result.refocus) buttons.current.get(id)?.focus({ preventScroll: true })
    if (!result.changed) return
    const before = years[id] ?? null
    const generation = (edits.current.get(id) ?? 0) + 1
    edits.current.set(id, generation)
    setYears((current) => ({ ...current, [id]: result.year }))
    setNotes((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    const run = async () => {
      const controller = new AbortController()
      const release = trackPrivateOperation(controller)
      const auth = getAuthGeneration()
      try {
        await updateGroundVisit(ownerId, id, { visitYear: result.year })
        dirty.current = true
      } catch (error) {
        if (controller.signal.aborted || auth !== getAuthGeneration()) return
        const conflict = (error as { status?: number }).status === 409
        // A conflict means the row changed elsewhere: the list refreshes on close either way.
        if (conflict) dirty.current = true
        // A newer edit of this row owns what it shows; an older failure must not overwrite it.
        if (edits.current.get(id) !== generation) return
        setYears((current) => ({ ...current, [id]: before }))
        setNotes((current) => ({ ...current, [id]: conflict ? CONFLICT[locale] : FAILED[locale] }))
      } finally {
        release()
      }
    }
    const queued = (queues.current.get(id) ?? Promise.resolve()).then(run)
    queues.current.set(id, queued)
  }

  function changeOpen(next: boolean) {
    if (!next) {
      // Closed with a year still saving: refresh once every write has settled, not before.
      const pending = [...queues.current.values()]
      queues.current.clear()
      void Promise.allSettled(pending).then(() => {
        if (!dirty.current) return
        dirty.current = false
        void onChanged()
      })
    }
    onOpenChange(next)
  }

  const ru = locale === 'ru'
  return (
    <Sheet
      open={open}
      onOpenChange={changeOpen}
      side={mobile ? 'bottom' : 'right'}
      className="passport-sheet-panel"
      title={ru ? 'Без года' : 'No year'}
      closeLabel={ru ? 'Закрыть' : 'Close'}
      // Escape closes the drum first; the sheet needs a second press.
      onEscapeKeyDown={(event) => {
        if (editingRef.current) event.preventDefault()
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="passport-sheet">
        <ul className="passport-list passport-undated" aria-label={ru ? 'Без года' : 'No year'}>
          {rows.map((visit) => {
            const way = wayOf({ entryMethod: visit.entry_method, mode: visit.mode })
            const year = visit.id in years ? years[visit.id] : null
            const country = name(visit.country_code)
            return (
              <li key={visit.id}>
                <span className="passport-undated-what">
                  <span>{country}</span>
                  <span className="passport-undated-way">
                    {way === 'land' ? LAND[locale] : WAY_LABELS[way][locale]}
                  </span>
                </span>
                <span className="passport-undated-year">
                  <button
                    ref={(node) => {
                      if (node) buttons.current.set(visit.id, node)
                      else buttons.current.delete(visit.id)
                    }}
                    type="button"
                    className="passport-undated-button"
                    data-set={year !== null || undefined}
                    aria-label={`${YEAR_OF_VISIT[locale]}: ${country}, ${yearLabel(year, locale)}`}
                    aria-expanded={editing === visit.id}
                    onClick={(event) => {
                      if (editing === visit.id) return
                      setInstant(event.detail === 0)
                      edit(visit.id)
                    }}
                  >
                    {year ?? '—'}
                  </button>
                  {editing === visit.id ? (
                    <YearDrum
                      value={year}
                      locale={locale}
                      instant={instant}
                      trigger={() => buttons.current.get(visit.id) ?? null}
                      onClose={(result) => commit(visit, result)}
                    />
                  ) : null}
                </span>
                {notes[visit.id] ? (
                  <p className="passport-note passport-undated-note" role="status">
                    {notes[visit.id]}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
