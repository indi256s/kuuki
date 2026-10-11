import type { Makers } from '@kuuki/shared/overview/makers'
import { uldSlots, uldTrain } from '../../iso/uld'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import '../cookie.css'
import '../../iso/uld.css'

/** The Makers dolly: five cargo containers split between the known manufacturers by flights. */
export function useUldFigure(size: FigureSize, data: Makers | null) {
  const slots = uldSlots((data?.rows ?? []).filter((row) => row.key !== 'unknown'))
  return useFigure(size, slots.join(), (k) => uldTrain(slots, k))
}

/** The figure at the head of the Makers view. */
export function UldSheetFigure() {
  const { scope } = useOverview()
  const figure = useUldFigure('sheet', scope?.makers.status === 'ready' ? scope.makers.value : null)
  return (
    <div className="ov3-sheet-figure">
      <IsoFigure figure={figure} className="iso-uld" />
    </div>
  )
}
