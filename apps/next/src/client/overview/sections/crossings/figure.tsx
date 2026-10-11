import type { Crossings } from '@kuuki/shared/overview/crossings'
import { globe } from '../../iso/globe'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import '../cookie.css'

/** The Crossings desk globe: the hourly zones reached are lit on its equator. */
export function useGlobeFigure(size: FigureSize, data: Crossings | null) {
  const offsets = (data?.offsets ?? []).filter((row) => row.hit).map((row) => row.offset)
  const equator = (data?.equator ?? 0) > 0,
    arctic = (data?.arcticCircle ?? 0) > 0
  return useFigure(size, `${offsets.join()}|${equator}|${arctic}`, (k) =>
    globe(offsets, { equator, arctic }, k),
  )
}

/** The figure at the head of the Crossings sheet. */
export function GlobeSheetFigure() {
  const { scope } = useOverview()
  const figure = useGlobeFigure(
    'sheet',
    scope?.crossings.status === 'ready' ? scope.crossings.value : null,
  )
  return (
    <div className="ov3-sheet-figure">
      <IsoFigure figure={figure} className="iso-globe" />
    </div>
  )
}
