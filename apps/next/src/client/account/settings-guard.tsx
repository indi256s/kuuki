'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '../ui/dialog'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'

type BrowserNavigation = { currentEntry?: { index: number } }
function entryIndex(): number | undefined {
  return (window as Window & { navigation?: BrowserNavigation }).navigation?.currentEntry?.index
}

/** Settings owns this guard; preserve Next's history payload and restore a traversal before asking. */
export function useSettingsGuard(dirty: boolean, busy: boolean, locale: Locale) {
  const router = useRouter()
  const [pending, setPending] = useState<{ run: () => void } | null>(null)
  const state = useRef({ dirty, busy })
  useLayoutEffect(() => { state.current = { dirty, busy } }, [dirty, busy])
  const permitTraversal = useRef(false)
  const permitUnload = useRef(false)
  const request = (run: () => void) => {
    if (state.current.busy) return
    if (state.current.dirty) setPending({ run })
    else run()
  }
  useEffect(() => {
    let originIndex = entryIndex()
    const hash = () => { originIndex = entryIndex() }
    let restoring = false
    const unload = (event: BeforeUnloadEvent) => {
      if (!permitUnload.current && (state.current.dirty || state.current.busy)) { event.preventDefault(); event.returnValue = '' }
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || anchor.target && anchor.target !== '_self') return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!state.current.dirty && !state.current.busy) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (!state.current.busy) setPending({ run: () => router.push(url.pathname + url.search + url.hash) })
    }
    const pop = (event: PopStateEvent) => {
      if (permitTraversal.current) { permitTraversal.current = false; return }
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return }
      if (!state.current.dirty && !state.current.busy) return
      event.stopImmediatePropagation()
      const destinationIndex = entryIndex()
      // Navigation API supplies traversal direction without modifying or truncating history.
      // Older browsers have no index; a Back traversal is restored by one forward entry.
      const delta = originIndex !== undefined && destinationIndex !== undefined ? destinationIndex - originIndex : -1
      if (!delta) return
      restoring = true
      history.go(-delta)
      if (!state.current.busy) setPending({ run: () => { permitTraversal.current = true; history.go(delta) } })
    }
    window.addEventListener('hashchange', hash)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    window.addEventListener('popstate', pop, true)
    return () => {
      window.removeEventListener('hashchange', hash)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
      window.removeEventListener('popstate', pop, true)
    }
  }, [router])
  const ru = locale === 'ru'
  return {
    request,
    allowDocumentExit: () => { permitUnload.current = true; window.setTimeout(() => { permitUnload.current = false }, 1000) },
    dialog: <Dialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }} title={ru ? 'Выйти без сохранения?' : 'Leave without saving?'} description={ru ? 'Ваши изменения ещё не сохранены.' : 'Your changes have not been saved.'} closeLabel={ru ? 'Закрыть' : 'Close'} footer={<><Button onClick={() => setPending(null)}>{ru ? 'Остаться' : 'Stay'}</Button><Button onClick={() => { const run = pending?.run; setPending(null); run?.() }}>{ru ? 'Выйти без сохранения' : 'Leave without saving'}</Button></>} />,
  }
}
