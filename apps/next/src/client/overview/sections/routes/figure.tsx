import { routeArrow } from '@kuuki/shared/overview/filter'
import type { Routes } from '@kuuki/shared/overview/routes'
import { passStack } from '../../iso/passes'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import '../cookie.css'
import '../../iso/passes.css'

/** The Routes boarding-pass stack: one pass per flight on the top route. */
export function usePassFigure(size: FigureSize, data: Routes | null) {
  const count = data?.top?.count ?? 1,
    route = data?.top ? routeArrow(data.top.key) : ''
  return useFigure(size, `${count}|${route}`, (k) => passStack(count, route, k))
}

/** The figure at the head of the Routes sheet. */
export function PassSheetFigure() {
  const { scope } = useOverview()
  const figure = usePassFigure(
    'sheet',
    scope?.routes.status === 'ready' ? scope.routes.value : null,
  )
  return (
    <div className="ov3-sheet-figure">
      <IsoFigure figure={figure} className="iso-passes" />
    </div>
  )
}
