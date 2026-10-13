import { useMemo } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { gateSign } from '../../iso/gate-sign'
import { boxK, useFigureBox, type FigureBox } from '../../layout/figure-box'
import '../../iso/gate-sign.css'

// The sign's geometry never depends on its code, so one scale per figure box fits every reading.
const fitted = new Map<string, number>()
const signK = (box: FigureBox) => {
  const id = `${box.width}x${box.height}`
  let k = fitted.get(id)
  if (k === undefined) fitted.set(id, (k = boxK(box, (k) => gateSign(k, { code: 'AAA' }))))
  return k
}

/**
 * The gate sign in the chapter card's figure box (figure-box.ts). `code` is the reading's: an airline code, an airport's IATA or a route (`ROV–VKO`).
 * The wrapper is keyed by the code, so a new reading remounts the figure; only after a pick (`picked`) does it carry `iso-gate-relight`, which
 * relights the sign face from dim (gate-sign.css). A first render, a swipe or a filter change swaps the code with no motion. An empty code is a dim sign.
 */
export function GateSignFigure({ code, picked }: { code: string; picked: boolean }) {
  const k = signK(useFigureBox())
  const figure = useMemo(() => gateSign(k, { code }), [k, code])
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
