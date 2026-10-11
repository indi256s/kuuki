import { flushSync } from 'react-dom'

export type MorphDirection = 'forward' | 'back'

type StartViewTransition = (update: () => void) => { finished: Promise<void> }

let latest = 0

/**
 * Runs a card state change (create → name, one step to another) as a same-document view transition, so the card
 * grows, the passport opens and the step content cross-slides instead of snapping. `html[data-welcome-morph]` names
 * the morphing parts only while it runs, so the theme sweep's own view transition never sees them. Without the API,
 * with the tab hidden or during a theme switch, the change applies at once.
 */
export function morph(direction: MorphDirection, update: () => void) {
  const root = document.documentElement
  const start = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition
  if (typeof start !== 'function' || document.visibilityState !== 'visible') return update()
  if (root.dataset.themeSwitching) return update()
  const id = ++latest
  root.dataset.welcomeMorph = direction
  const transition = start.call(document, () => flushSync(update))
  void transition.finished
    .catch(() => undefined)
    .finally(() => {
      // A newer morph owns the attribute now.
      if (id === latest) delete root.dataset.welcomeMorph
    })
}
