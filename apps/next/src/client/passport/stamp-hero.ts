type StartViewTransition = (update: () => Promise<void>) => { finished: Promise<void> }

/** How long the sheet's stamp may take to mount before the transition settles for a plain crossfade. */
const SHEET_STAMP_WAIT_MS = 500

let latest = 0

const sheetStamp = (code: string) =>
  document.querySelector<HTMLElement>(`[data-sheet-stamp="${code}"] .country-stamp`)

/** Resolves with the sheet's large stamp once it is in the document, or null after the wait. */
function waitForSheetStamp(code: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const deadline = performance.now() + SHEET_STAMP_WAIT_MS
    const poll = () => {
      const found = sheetStamp(code)
      if (found || performance.now() > deadline) return resolve(found)
      requestAnimationFrame(poll)
    }
    poll()
  })
}

/**
 * Opens a country's sheet as a same-document view transition in which the card's stamp grows into the sheet's large
 * stamp. Both stamps carry one per-country name only while it runs, and the card's name is dropped before the new
 * state is captured (the card stays in the page behind the sheet, and two elements may not share a name).
 * `html[data-stamp-hero]` scopes the transition's CSS (passport.css), so other view transitions never see it.
 *
 * Returns false, having done nothing, when the API is missing, the tab is hidden, a theme switch is running, the user
 * prefers reduced motion or the card has no stamp; the caller then opens the sheet at once.
 */
export function openWithStampHero(card: HTMLElement, code: string, open: () => void): boolean {
  const root = document.documentElement
  const start = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition
  if (typeof start !== 'function' || document.visibilityState !== 'visible') return false
  if (root.dataset.themeSwitching) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  const from = card.querySelector<HTMLElement>('.country-stamp')
  if (!from) return false

  const name = `passport-stamp-${code.toLowerCase()}`
  const id = ++latest
  const hero: { to: HTMLElement | null } = { to: null }
  root.dataset.stampHero = ''
  from.style.viewTransitionName = name
  const transition = start.call(document, async () => {
    from.style.viewTransitionName = ''
    open()
    hero.to = await waitForSheetStamp(code)
    if (hero.to) hero.to.style.viewTransitionName = name
  })
  void transition.finished
    .catch(() => undefined)
    .finally(() => {
      from.style.viewTransitionName = ''
      if (hero.to) hero.to.style.viewTransitionName = ''
      // A newer hero owns the attribute now.
      if (id === latest) delete root.dataset.stampHero
    })
  return true
}
