type BrowserNavigation = { currentEntry?: { index: number } }

/** The current history entry's position: the Navigation API's, else the bootstrap's tag; undefined without either. */
export function entryIndex(): number | undefined {
  const nativeIndex = (window as Window & { navigation?: BrowserNavigation }).navigation
    ?.currentEntry?.index
  const fallback = window.history.state?.__kuukiHistoryIndex
  return nativeIndex ?? (Number.isSafeInteger(fallback) ? fallback : undefined)
}

/**
 * Lets an owner hold a browser traversal (Back, Forward) before Next sees it: on the bootstrap's cancelable gate when it
 * exists, else on popstate in capture. `ask` gets each traversal to another entry with the URL it left; true holds it
 * (the traversal is undone at once, and `rerun` replays it), false lets it through. Without a history index a traversal
 * counts as one step Back. Returns the cleanup.
 */
export function guardTraversals(ask: (from: URL, rerun: () => void) => boolean): () => void {
  let origin = { index: entryIndex(), href: window.location.href }
  const settle = () => {
    origin = { index: entryIndex(), href: window.location.href }
  }
  // The entry being restored after a held traversal; undefined when the platform gives no index.
  let restoring: { to: number | undefined } | null = null
  let permitted = false
  const cancel = (event: Event) => {
    // Cancelling the bootstrap's gate is what keeps Next's own popstate from running; stopping alone is not enough.
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
        // Another traversal landed first: keep steering to the entry being restored.
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
