type StartViewTransition = (update: () => Promise<void>) => { finished: Promise<void> }

const SHEET_STAMP_WAIT_MS = 500

let latest = 0

const sheetStamp = (code: string) =>
  document.querySelector<HTMLElement>(`[data-sheet-stamp="${code}"] .country-stamp`)

function waitForSheetStamp(code: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const settle = (found: HTMLElement | null) => {
      observer.disconnect()
      clearTimeout(timer)
      resolve(found)
    }
    const observer = new MutationObserver(() => {
      const found = sheetStamp(code)
      if (found) settle(found)
    })
    const timer = setTimeout(() => settle(sheetStamp(code)), SHEET_STAMP_WAIT_MS)
    const found = sheetStamp(code)
    if (found) settle(found)
    else observer.observe(document.body, { childList: true, subtree: true })
  })
}

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
      if (id === latest) delete root.dataset.stampHero
    })
  return true
}
