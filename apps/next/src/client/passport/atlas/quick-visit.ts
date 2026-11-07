'use client'
// The write behind a torn sticker: one ground visit with the tab's way, optimistic, with Undo and Retry on the toast.

import { useCallback, useLayoutEffect, useRef } from 'react'
import { getAuthGeneration } from '@kuuki/client/apiClient'
import { addGroundVisit, deleteGroundVisit } from '@kuuki/client/passport'
import { trackPrivateOperation } from '../../activity'
import { notificationStorage } from '../../profile/storage'
import { useToast } from '../../ui/toast'
import { useWriteFeedback } from '../../write-feedback'
import { countryNamer } from '../model'
import { markSeen } from '../new-stamps'
import { wayPayload, type VisitWay } from '../visit-ways'

/** How long the recorded toast, and with it the landed stamp, stays. */
export const RECORDED_TOAST_MS = 8000

/** The atlas's side of a write: what to draw when the write is taken back, and when a retry lands it. */
export type TearView = {
  /** Undo or failure: the sticker fades back over the country; the fill and the stamp leave. */
  revert: () => void
  /** A retry succeeded without a tear: ink the country and land its stamp. */
  land: () => void
}

/** Starts the write at once; `announce` shows the toast, called by the atlas at the stamp's impact. */
export type RecordVisit = (code: string, way: VisitWay, view: TearView) => { announce: () => void }

const names = { en: countryNamer('en'), ru: countryNamer('ru') }

/**
 * Owner-only. Starts the POST at the tear, marks the country seen so the cards never replay it, refreshes the passport
 * on the ack and offers Undo. Undo waits for a POST still in flight, then deletes exactly the row it created.
 */
export function useRecordVisit(ownerId: string, refresh: () => Promise<void>): RecordVisit {
  const toast = useToast()
  const feedback = useWriteFeedback(ownerId)
  const latest = useRef({ toast, feedback, refresh })
  useLayoutEffect(() => {
    latest.current = { toast, feedback, refresh }
  })

  return useCallback<RecordVisit>(
    function record(code, way, view) {
      const controller = new AbortController()
      const release = trackPrivateOperation(controller)
      const generation = getAuthGeneration()
      const current = () => !controller.signal.aborted && generation === getAuthGeneration()
      const country = { en: names.en(code), ru: names.ru(code) }
      markSeen(ownerId, code, notificationStorage())

      let undone = false
      let shown: number | null = null
      const write = addGroundVisit(ownerId, code, wayPayload(way))

      const undo = () => {
        undone = true
        if (shown !== null) latest.current.toast.dismiss(shown)
        view.revert()
        void write
          .then(
            (visit) => deleteGroundVisit(ownerId, visit.id),
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
      const announce = () => {
        if (undone || failed || shown !== null) return
        shown = latest.current.toast.show({
          message: { en: `${country.en} is in your passport.`, ru: `${country.ru} в паспорте.` },
          duration: RECORDED_TOAST_MS,
          actionLabel: { en: 'Undo', ru: 'Отменить' },
          onAction: undo,
        })
      }

      write
        .then(
          (ack) => {
            if (undone || !current()) return
            latest.current.feedback.acknowledge(ack)
            // A failed refresh is the page's own "could not refresh" note; the visit is saved either way.
            return latest.current.refresh().catch(() => undefined)
          },
          () => {
            failed = true
            if (undone || !current()) return
            if (shown !== null) latest.current.toast.dismiss(shown)
            view.revert()
            latest.current.toast.show({
              kind: 'error',
              message: {
                en: `Could not add ${country.en}. Check your connection and try again.`,
                ru: `Не удалось добавить страну «${country.ru}». Проверьте сеть и повторите.`,
              },
              actionLabel: { en: 'Try again', ru: 'Повторить' },
              onAction: () => {
                view.land()
                record(code, way, view).announce()
              },
            })
          },
        )
        .finally(release)
      return { announce }
    },
    [ownerId],
  )
}
