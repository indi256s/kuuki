import { flushSync } from 'react-dom'

export type MorphDirection = 'forward' | 'back'

type StartViewTransition = (update: () => void) => { finished: Promise<void> }

let latest = 0

export function morph(direction: MorphDirection | 'layout', update: () => void) {
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
      if (id === latest) delete root.dataset.welcomeMorph
    })
}
