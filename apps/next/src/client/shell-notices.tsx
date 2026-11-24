'use client'

import { useLocale } from './preferences'

import { useEffect, useRef, type ReactNode } from 'react'
import { useOnline } from './awaiting'
import { ToastProvider, useToast, type ToastInput } from './ui/toast'
import type { Locale } from '../server/locale'

type Host = { ownerId: string; show: (toast: ToastInput) => number }
type Notice = { ownerId: string; at: number; toast: ToastInput }

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

export function announceShellNotice(ownerId: string, toast: ToastInput) {
  queued.push({ ownerId, at: Date.now(), toast })
  queueMicrotask(deliver)
}

function Host({ ownerId }: { ownerId: string }) {
  const { show, dismiss } = useToast()
  const offline = useRef<number | null>(null)
  const online = useOnline()
  useEffect(() => {
    if (online) {
      if (offline.current !== null) dismiss(offline.current)
    } else if (offline.current === null) {
      offline.current = show({
        message: { en: 'You are offline.', ru: 'Нет сети.' },
        duration: 0,
        onClose: () => {
          offline.current = null
        },
      })
    }
  }, [online, show, dismiss])
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

export function ShellNotices({
  ownerId,
  locale: initialLocale,
  children,
}: {
  ownerId: string
  locale: Locale
  children: ReactNode
}) {
  const locale = useLocale(initialLocale)
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
