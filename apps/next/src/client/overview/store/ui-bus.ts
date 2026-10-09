export interface OverviewUISnapshot {
  hoverRoute: string | null
  hoverGhost: number | null
  focusRoute: string | null
}
export function createUIBus() {
  const initial: OverviewUISnapshot = { hoverRoute: null, hoverGhost: null, focusRoute: null }
  let snapshot = initial
  const listeners = new Set<() => void>()
  function set<K extends keyof OverviewUISnapshot>(key: K, value: OverviewUISnapshot[K]) {
    if (Object.is(snapshot[key], value)) return
    snapshot = { ...snapshot, [key]: value }
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setHoverRoute: (value: string | null) => set('hoverRoute', value),
    setHoverGhost: (value: number | null) => set('hoverGhost', value),
    setFocusRoute: (value: string | null) => set('focusRoute', value),
  }
}
