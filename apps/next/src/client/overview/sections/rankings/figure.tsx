import { useMemo } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { gateSign } from '../../iso/gate-sign'
import { fitBox } from '../../iso/scene'
import '../../iso/gate-sign.css'

let fitted: number | undefined
// The sign's geometry never depends on its code, so one scale fits every reading in the card's 300 × 160 stage.
const stageK = () =>
  (fitted ??= Math.min(
    1.8,
    fitBox(300, 160, (k) => gateSign(k, { code: 'AAA' })),
  ))

/**
 * The gate sign in the chapter card's figure stage (300 × 160). `code` is the reading's and `note` the small line under it (rank and flights): an airline code, an airport's IATA or a route (`ROV–VKO`).
 * The wrapper is keyed by the code, so a new reading remounts the figure; only after a pick (`picked`) does it carry `iso-gate-relight`, which
 * relights the sign face from dim (gate-sign.css). A first render, a swipe or a filter change swaps the code with no motion. An empty code is a dim sign.
 */
export function GateSignFigure({
  code,
  picked,
  note = '',
}: {
  code: string
  picked: boolean
  note?: string
}) {
  const k = stageK()
  const figure = useMemo(() => gateSign(k, { code, note }), [k, code, note])
  return (
    <div
      key={code}
      className={picked ? 'iso-gate-relight' : undefined}
      data-blank={code ? undefined : ''}
    >
      <IsoFigure figure={figure} className="iso-gate-pick" />
    </div>
  )
}
