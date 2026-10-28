'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { readSeen } from './kuukies-storage'

const OPEN_EVENT = 'kuuki:kuukies'
const Notice = dynamic(() => import('./kuukies-notice').then((module) => module.KuukiesNotice), {
  ssr: false,
})

/** Opens the cookie details from Settings. */
export function openKuukies() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function Kuukies() {
  const [notice, setNotice] = useState<{ request: number; opener: HTMLElement | null } | null>(null)
  useEffect(() => {
    // Acknowledged notices download nothing. First visits leave the initial page resources ahead of the notice.
    const timer = readSeen()
      ? undefined
      : window.setTimeout(
          () => setNotice((current) => current ?? { request: 0, opener: null }),
          800,
        )
    const open = () => {
      const active = document.activeElement
      setNotice((current) => ({
        request: (current?.request ?? 0) + 1,
        opener: active instanceof HTMLElement ? active : null,
      }))
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(OPEN_EVENT, open)
    }
  }, [])
  return notice ? <Notice key={notice.request} {...notice} /> : null
}
