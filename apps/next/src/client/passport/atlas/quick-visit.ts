'use client'

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
import { seaRemark } from './sea-remark'

const RECORDED_TOAST_MS = 8000
export const REVERT_MS = 150

export type TearView = {
  revert: () => void
  land: () => (() => void) | undefined
}

export type SetYear = (year: number | null) => void

export type RecordVisit = (
  code: string,
  way: VisitWay,
  view: TearView,
) => { announce: (onClose?: () => void) => void; setYear: SetYear }

export type QuickWrites = {
  record: RecordVisit
  recording: ReadonlySet<string>
}

const names = { en: countryNamer('en'), ru: countryNamer('ru') }

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
    function record(
      code: string,
      way: VisitWay,
      view: TearView,
      visitId: string = crypto.randomUUID(),
    ) {
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
      const write = addGroundVisit(ownerId, code, wayPayload(way), visitId)
      const flightHref =
        way === 'air'
          ? write.then(
              (visit) => (current() && !undone ? visitFlightHref(visit.id) : null),
              () => null,
            )
          : undefined
      let yearQueue: Promise<void> = Promise.resolve()
      let yearEdit = 0

      const setYear: SetYear = (year) => {
        const edit = ++yearEdit
        yearQueue = yearQueue.then(async () => {
          const visit = await write.catch(() => null)
          if (!visit || undone || !current()) return
          try {
            const ack = await updateGroundVisit(ownerId, visit.id, { visitYear: year })
            if (undone || !current()) return
            latest.current.feedback.acknowledge(ack)
            await latest.current.refresh().catch(() => undefined)
          } catch {
            if (undone || !current()) return
            latest.current.toast.show({
              kind: 'error',
              message: {
                en: `Could not save the year for ${country.en}. The visit is recorded.`,
                ru: `Не удалось сохранить год для страны «${country.ru}». Визит записан.`,
              },
              actionLabel: { en: 'Try again', ru: 'Повторить' },
              onAction: () => {
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
          description: way === 'sea' ? seaRemark(code, country) : undefined,
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
                if (attempts.current.get(code) !== attempt) return
                const retry = record(code, way, view, visitId)
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
