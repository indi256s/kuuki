import { useMemo } from 'react'
import { IsoFigure } from '../../iso/iso-figure'
import { gateSign } from '../../iso/gate-sign'
import { carousel } from '../../iso/carousel'
import { fitBox } from '../../iso/scene'
import { boxK, useFigureBox, type FigureBox } from '../../layout/figure-box'
import '../../iso/gate-sign.css'
import '../../iso/carousel.css'

// The sign's geometry never depends on its code, so one scale per figure box fits every reading.
const fitted = new Map<string, number>()
const signK = (box: FigureBox) => {
  const id = `${box.width}x${box.height}`
  let k = fitted.get(id)
  if (k === undefined) fitted.set(id, (k = boxK(box, (k) => gateSign(k, { code: 'AAA' }))))
  return k
}

/**
 * The gate sign in the chapter card's figure box (figure-box.ts). `code` is the reading's and `note` the small line under it (rank and flights): an airline code, an airport's IATA or a route (`ROV–VKO`).
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
  const k = signK(useFigureBox())
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

// The carousel fills its box uncapped, as it always has; one scale per box fits every code.
const carouselFitted = new Map<string, number>()
const carouselK = (box: FigureBox) => {
  const id = `${box.width}x${box.height}`
  let k = carouselFitted.get(id)
  if (k === undefined)
    carouselFitted.set(id, (k = fitBox(box.width, box.height, (k) => carousel(k, { code: 'AAA' }))))
  return k
}

export function AirportFigure({ code }: { code: string }) {
  const k = carouselK(useFigureBox())
  const figure = useMemo(() => carousel(k, { code }), [k, code])
  return (
    <div data-blank={code ? undefined : ''}>
      <IsoFigure figure={figure} className="iso-carousel" />
    </div>
  )
}
