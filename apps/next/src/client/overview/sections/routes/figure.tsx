import { useMemo, useState } from 'react'
import { passStack } from '../../iso/passes'
import { fitBox } from '../../iso/scene'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
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
 * The stack in the chapter card's figure stage (300 × 160). `route` is the reading. When it changes by a pick the top pass is dealt in
 * (passes.css); a change that is not a pick (first render, swipe, filter) swaps its print with no motion. `data-deal` alternates 1 and 2
 * so the next pick deals again; a pick while a deal is still running swaps the print and the deal settles as it was, never restarting.
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
  const k = useMemo(
    () =>
      Math.min(
        1.8,
        fitBox(300, 160, (k) => passStack(share, SIZING_ROUTE, k)),
      ),
    [share],
  )
  const figure = useMemo(() => passStack(share, route, k, topRepeat), [share, route, k, topRepeat])
  const [seen, setSeen] = useState({ route, deal: 0, dealing: false })
  let deal = seen.deal
  if (seen.route !== route) {
    // A pick mid-deal keeps the running deal (same part, new print) and lets it settle from where it is.
    deal = !picked ? 0 : seen.dealing ? seen.deal : seen.deal === 1 ? 2 : 1
    setSeen({ route, deal, dealing: deal !== 0 })
  }
  return (
    <div
      className="ov3-passes"
      data-deal={deal || undefined}
      onAnimationEnd={() => setSeen((old) => ({ ...old, dealing: false }))}
    >
      <IsoFigure figure={figure} className="iso-passes" />
    </div>
  )
}
