import { useMemo, useState } from 'react'
import { passStack } from '../../iso/passes'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useFigureK } from '../../layout/figure-box'
import '../cookie.css'
import '../../iso/passes.css'

/** The Routes boarding-pass stack for a tile: `share` of its passes carry a red stub; the top pass prints `route`. */
export function usePassFigure(size: FigureSize, share: number, route: string, topRepeat?: boolean) {
  return useFigure(size, `${share}|${route}|${topRepeat}`, (k) =>
    passStack(share, route, k, topRepeat),
  )
}

// Any route prints at the same width, so the scale never depends on which route is on top.
const SIZING_ROUTE = 'AAA ↔ BBB'

/**
 * The stack in the chapter card's figure box (figure-box.ts). `route` is the reading. When it changes by a pick the old top pass is dealt
 * off and the new one rises into place (passes.css); a change that is not a pick (first render, swipe, filter) swaps its print with no
 * motion. `data-deal` alternates 1 and 2 so the next pick deals again; a pick while a deal is still running swaps the new print and the deal
 * settles as it was, never restarting. The leaving pass is drawn only while a deal runs.
 */
export function PassCardFigure({
  share,
  route,
  picked,
  topRepeat,
}: {
  share: number
  route: string
  picked: boolean
  /** Whether the route on the top pass is a repeat; only then does its stub light. */
  topRepeat?: boolean
}) {
  const k = useFigureK(String(share), (k) => passStack(share, SIZING_ROUTE, k))
  const [seen, setSeen] = useState<{
    route: string
    repeat: boolean
    deal: number
    dealing: boolean
    leaving: { route: string; repeat: boolean } | null
  }>({ route, repeat: !!topRepeat, deal: 0, dealing: false, leaving: null })
  let deal = seen.deal
  if (seen.route !== route) {
    // A pick mid-deal keeps the running deal (same part, new print, same leaving pass) and lets it settle from where it is.
    deal = !picked ? 0 : seen.dealing ? seen.deal : seen.deal === 1 ? 2 : 1
    const leaving = !picked
      ? null
      : seen.dealing
        ? seen.leaving
        : { route: seen.route, repeat: seen.repeat }
    setSeen({ route, repeat: !!topRepeat, deal, dealing: deal !== 0, leaving })
  }
  const leaving = seen.dealing ? seen.leaving : null
  const figure = useMemo(
    () => passStack(share, route, k, topRepeat, leaving ?? undefined),
    [share, route, k, topRepeat, leaving],
  )
  return (
    <div
      className="ov3-passes"
      data-deal={deal || undefined}
      onAnimationEnd={() => setSeen((old) => ({ ...old, dealing: false, leaving: null }))}
    >
      <IsoFigure figure={figure} className="iso-passes" />
    </div>
  )
}
