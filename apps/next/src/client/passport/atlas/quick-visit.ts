'use client'
// The write behind a torn sticker: one ground visit with the tab's way, optimistic, with the year, Undo and Retry on the toast.

import { createElement, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { addGroundVisit, deleteGroundVisit, updateGroundVisit } from '@kuuki/client/passport'
import { trackPrivateOperation } from '../../activity'
import { notificationStorage } from '../../profile/storage'
import { useToast } from '../../ui/toast'
import { useWriteFeedback } from '../../write-feedback'
import { countryNamer } from '../model'
import { markSeen } from '../new-stamps'
import { visitFlightHref, wayPayload, type VisitWay } from '../visit-ways'
import { RecordedToast, recordedMessage } from './recorded-toast'

/** How long the recorded toast, and with it the landed stamp, stays (held while its year wheel is open). */
const RECORDED_TOAST_MS = 8000
/** A reverted sticker fades back over the inked country for this long before the fill goes. */
export const REVERT_MS = 150

/** The atlas's side of a write: what to draw when the write is taken back, and when a retry lands it. */
export type TearView = {
  /** Undo or failure: the sticker fades back over the country; the fill and the stamp leave. */
  revert: () => void
  /** A retry started without a tear: land the country's stamp; the returned call takes it away with the toast. */
  land: () => (() => void) | undefined
}

/** Sets or clears the year of the visit a write created. */
export type SetYear = (year: number | null) => void

/**
 * Starts the write at once; `announce` shows the toast, called by the atlas at the stamp's impact, and `onClose` runs
 * when that toast leaves. `setYear` (the toast's year wheel) waits for the write, then edits the row it created; it
 * does nothing after Undo or a failed write.
 */
export type RecordVisit = (
  code: string,
  way: VisitWay,
  view: TearView,
) => { announce: (onClose?: () => void) => void; setYear: SetYear }

export type QuickWrites = {
  record: RecordVisit
  /** Countries with a quick write in flight or awaiting the refresh: inked on the map and never lifted again. */
  recording: ReadonlySet<string>
}

const names = { en: countryNamer('en'), ru: countryNamer('ru') }

/**
 * Owner-only, held by the page so it outlives the atlas. Starts the POST at the tear, marks the country seen so the
 * cards never replay it, refreshes the passport on the ack and offers Undo. Undo waits for a POST still in flight (and a
 * year edit after it), then deletes exactly the row it created. A later tear of the same country retires an earlier write's Retry.
 */
export function useRecordVisit(ownerId: string, refresh: () => Promise<void>): QuickWrites {
  const toast = useToast()
  const feedback = useWriteFeedback(ownerId)
  const latest = useRef({ toast, feedback, refresh })
  useLayoutEffect(() => {
    latest.current = { toast, feedback, refresh }
  })
  const [recording, setRecording] = useState<ReadonlySet<string>>(() => new Set())
  const attempts = useRef(new Map<string, number>())

  const record = useCallback<RecordVisit>(
    function record(code, way, view) {
      const attempt = (attempts.current.get(code) ?? 0) + 1
      attempts.current.set(code, attempt)
      const mark = (on: boolean) =>
        setRecording((set) => {
          if (set.has(code) === on) return set
          const next = new Set(set)
          if (on) next.add(code)
          else next.delete(code)
          return next
        })
      // Only the latest write of a country clears its mark.
      const unmark = () => {
        if (attempts.current.get(code) === attempt) mark(false)
      }
      const takeBack = () => {
        view.revert()
        window.setTimeout(unmark, REVERT_MS)
      }
      mark(true)

      const controller = new AbortController()
      const release = trackPrivateOperation(controller)
      const generation = getAuthGeneration()
      const current = () => !controller.signal.aborted && generation === getAuthGeneration()
      const country = { en: names.en(code), ru: names.ru(code) }
      markSeen(ownerId, code, notificationStorage())

      let undone = false
      let shown: number | null = null
      const write = addGroundVisit(ownerId, code, wayPayload(way))
      const flightHref =
        way === 'air'
          ? write.then(
              (visit) => (current() && !undone ? visitFlightHref(visit.id) : null),
              () => null,
            )
          : undefined
      // Year edits run one after another on the created row; Undo waits for them so its delete is the last word.
      let yearQueue: Promise<void> = Promise.resolve()
      let yearEdit = 0

      const setYear: SetYear = (year) => {
        const edit = ++yearEdit
        yearQueue = yearQueue.then(async () => {
          const visit = await write.catch(() => null)
          // Signed out or switched account while queued: this edit belongs to a session that is gone.
          if (!visit || undone || !current()) return
          try {
            const ack = await updateGroundVisit(ownerId, visit.id, { visitYear: year })
            if (undone || !current()) return
            latest.current.feedback.acknowledge(ack)
            await latest.current.refresh().catch(() => undefined)
          } catch {
            if (undone || !current()) return
            // The visit itself stays recorded; only its year did not save.
            latest.current.toast.show({
              kind: 'error',
              message: {
                en: `Could not save the year for ${country.en}. The visit is recorded.`,
                ru: `Не удалось сохранить год для страны «${country.ru}». Визит записан.`,
              },
              actionLabel: { en: 'Try again', ru: 'Повторить' },
              onAction: () => {
                // A newer year speaks for the visit.
                if (edit === yearEdit) setYear(year)
              },
            })
          }
        })
      }

      const undo = () => {
        undone = true
        if (shown !== null) latest.current.toast.dismiss(shown)
        takeBack()
        void write
          .then(
            (visit) => yearQueue.then(() => deleteGroundVisit(ownerId, visit.id)),
            () => null,
          )
          .then(
            (ack) => {
              if (!ack || !current()) return
              latest.current.feedback.acknowledge(ack)
              return latest.current.refresh().catch(() => undefined)
            },
            async () => {
              if (!current()) return
              // The row stayed: show the truth again rather than a reverted map.
              await latest.current.refresh().catch(() => undefined)
              latest.current.toast.show({
                kind: 'error',
                message: {
                  en: `Could not undo. ${country.en} stays in your passport.`,
                  ru: `Не удалось отменить: страна «${country.ru}» осталась в паспорте.`,
                },
              })
            },
          )
      }

      let failed = false
      const announce = (onClose?: () => void) => {
        if (undone || failed || shown !== null) return onClose?.()
        shown = latest.current.toast.show({
          kind: 'success',
          message: recordedMessage(country),
          duration: RECORDED_TOAST_MS,
          content: (controls) =>
            createElement(RecordedToast, { controls, country, setYear, undo, flightHref }),
          onClose,
        })
      }

      write
        .then(
          async (ack) => {
            if (undone) return
            if (current()) {
              latest.current.feedback.acknowledge(ack)
              // A failed refresh is the page's own "could not refresh" note; the visit is saved either way.
              await latest.current.refresh().catch(() => undefined)
            }
            unmark()
          },
          () => {
            failed = true
            if (undone) return
            if (!current()) return unmark()
            if (shown !== null) latest.current.toast.dismiss(shown)
            takeBack()
            latest.current.toast.show({
              kind: 'error',
              message: {
                en: `Could not add ${country.en}. Check your connection and try again.`,
                ru: `Не удалось добавить страну «${country.ru}». Проверьте сеть и повторите.`,
              },
              actionLabel: { en: 'Try again', ru: 'Повторить' },
              onAction: () => {
                // Superseded by a later tear of the same country: that write already speaks for it.
                if (attempts.current.get(code) !== attempt) return
                const retry = record(code, way, view)
                retry.announce(view.land())
              },
            })
          },
        )
        .finally(release)
      return { announce, setYear }
    },
    [ownerId],
  )
  return useMemo(() => ({ record, recording }), [record, recording])
}
