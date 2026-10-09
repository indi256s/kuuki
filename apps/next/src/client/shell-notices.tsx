'use client'

import { useEffect, type ReactNode } from 'react'
import { ToastProvider, useToast, type ToastInput } from './ui/toast'
import type { Locale } from '../server/locale'

type Host = { ownerId: string; show: (toast: ToastInput) => number }
type Notice = { ownerId: string; at: number; toast: ToastInput }

/** Long enough to cross one navigation commit; a notice no shell picked up by then is stale and dropped. */
const CARRY_MS = 5000
const hosts = new Set<Host>()
let queued: Notice[] = []

function deliver() {
  const now = Date.now()
  queued = queued.filter((notice) => {
    if (now - notice.at > CARRY_MS) return false
    const host = [...hosts].find((candidate) => candidate.ownerId === notice.ownerId)
    if (!host) return true
    host.show(notice.toast)
    return false
  })
}

/**
 * Shows a notice in the owner's member shell, including from an unmount cleanup. Delivery waits for the current commit to
 * finish, so a notice sent while one shell layout replaces another (/journal to /leaderboard) reaches the shell that stays.
 * Only a shell of the same owner shows it.
 */
export function announceShellNotice(ownerId: string, toast: ToastInput) {
  queued.push({ ownerId, at: Date.now(), toast })
  queueMicrotask(deliver)
}

function Host({ ownerId }: { ownerId: string }) {
  const { show } = useToast()
  useEffect(() => {
    const host = { ownerId, show }
    hosts.add(host)
    deliver()
    return () => {
      hosts.delete(host)
    }
  }, [ownerId, show])
  return null
}

/** The member shell's toast host, mounted once per owner shell so notices survive client navigation between member routes. */
export function ShellNotices({
  ownerId,
  locale,
  children,
}: {
  ownerId: string
  locale: Locale
  children: ReactNode
}) {
  const ru = locale === 'ru'
  return (
    <ToastProvider
      dismissLabel={ru ? 'Закрыть' : 'Dismiss'}
      kindLabels={{
        info: ru ? 'Уведомление' : 'Notice',
        success: ru ? 'Успех' : 'Success',
        error: ru ? 'Ошибка' : 'Error',
      }}
    >
      <Host ownerId={ownerId} />
      {children}
    </ToastProvider>
  )
}
