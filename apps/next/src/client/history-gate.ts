type BrowserNavigation = { currentEntry?: { index: number } }

export function entryIndex(): number | undefined {
  const nativeIndex = (window as Window & { navigation?: BrowserNavigation }).navigation
    ?.currentEntry?.index
  const fallback = window.history.state?.__kuukiHistoryIndex
  return nativeIndex ?? (Number.isSafeInteger(fallback) ? fallback : undefined)
}

export function guardTraversals(ask: (from: URL, rerun: () => void) => boolean): () => void {
  let origin = { index: entryIndex(), href: window.location.href }
  const settle = () => {
    origin = { index: entryIndex(), href: window.location.href }
  }
  let restoring: { to: number | undefined } | null = null
  let permitted = false
  const cancel = (event: Event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const pop = (event: Event) => {
    if (permitted) {
      permitted = false
      settle()
      return
    }
    if (restoring) {
      cancel(event)
      const at = entryIndex()
      if (restoring.to !== undefined && at !== undefined && at !== restoring.to) {
        window.history.go(restoring.to - at)
        return
      }
      restoring = null
      settle()
      return
    }
    const at = entryIndex()
    const delta = origin.index !== undefined && at !== undefined ? at - origin.index : -1
    const rerun = () => {
      permitted = true
      window.history.go(delta)
    }
    if (!delta || !ask(new URL(origin.href), rerun)) {
      settle()
      return
    }
    cancel(event)
    restoring = { to: origin.index }
    window.history.go(-delta)
  }
  const popEvent = (window as Window & { __kuukiHistoryGate?: boolean }).__kuukiHistoryGate
    ? 'kuuki:before-popstate'
    : 'popstate'
  window.addEventListener(popEvent, pop, true)
  window.addEventListener('kuuki:history-index', settle)
  window.addEventListener('hashchange', settle)
  return () => {
    window.removeEventListener(popEvent, pop, true)
    window.removeEventListener('kuuki:history-index', settle)
    window.removeEventListener('hashchange', settle)
  }
}
