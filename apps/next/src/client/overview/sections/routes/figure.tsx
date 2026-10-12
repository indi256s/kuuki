import { useMemo, useState } from 'react'
import { passStack } from '../../iso/passes'
import { fitBox } from '../../iso/scene'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import '../cookie.css'
import '../../iso/passes.css'

/** The Routes boarding-pass stack for a tile: `share` of its passes carry a red stub; the top pass prints `route`. */
export function usePassFigure(size: FigureSize, share: number, route: string) {
  return useFigure(size, `${share}|${route}`, (k) => passStack(share, route, k))
}

// Any route prints at the same width, so the scale never depends on which route is on top.
const SIZING_ROUTE = 'AAA ↔ BBB'

/**
 * The stack in the chapter card's figure stage (300 × 160). `route` is the reading. When it changes by a pick the top pass is dealt in
 * (passes.css); a change that is not a pick (first render, swipe, filter) swaps its print with no motion. `data-deal` alternates 1 and 2
 * so the same animation restarts on the next pick, and a new pick retargets instead of queueing.
 */
export function PassCardFigure({
  share,
  route,
  picked,
}: {
  share: number
  route: string
  picked: boolean
}) {
  const k = useMemo(
    () =>
      Math.min(
        1.8,
        fitBox(300, 160, (k) => passStack(share, SIZING_ROUTE, k)),
      ),
    [share],
  )
  const figure = useMemo(() => passStack(share, route, k), [share, route, k])
  const [seen, setSeen] = useState({ route, deal: 0 })
  let deal = seen.deal
  if (seen.route !== route) {
    deal = picked ? (seen.deal === 1 ? 2 : 1) : 0
    setSeen({ route, deal })
  }
  return (
    <div className="ov3-passes" data-deal={deal || undefined}>
      <IsoFigure figure={figure} className="iso-passes" />
    </div>
  )
}
