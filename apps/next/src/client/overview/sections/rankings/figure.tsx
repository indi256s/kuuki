import { useMemo } from 'react'
import { airportCatalog } from '../../../../lib/airport-models/catalog.generated'
import { AirportPreview } from '../../../airport-models/preview'
import { useChapter } from '../../layout/chapter-context'
import { IsoFigure } from '../../iso/iso-figure'
import { gateSign } from '../../iso/gate-sign'
import { carousel } from '../../iso/carousel'
import { fitBox } from '../../iso/scene'
import { boxK, useFigureBox, type FigureBox } from '../../layout/figure-box'
import '../../iso/gate-sign.css'
import '../../iso/carousel.css'

const fitted = new Map<string, number>()
const signK = (box: FigureBox) => {
  const id = `${box.width}x${box.height}`
  let k = fitted.get(id)
  if (k === undefined) fitted.set(id, (k = boxK(box, (k) => gateSign(k, { code: 'AAA' }))))
  return k
}

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
  const { active } = useChapter()
  const model = active ? airportCatalog.find((entry) => entry.iata === code) : undefined
  const figure = useMemo(() => carousel(k, { code }), [k, code])
  if (model)
    return (
      <div className="ov3-airport-preview">
        <AirportPreview entry={model} />
      </div>
    )
  return (
    <div data-blank={code ? undefined : ''}>
      <IsoFigure figure={figure} className="iso-carousel" />
    </div>
  )
}
