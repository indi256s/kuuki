import type { RankRow } from '@kuuki/shared/overview/rankings'
import { flapBoard } from '../../iso/board'
import { useFigure, type FigureSize } from '../../iso/use-figure'
import { IsoFigure } from '../../iso/iso-figure'
import { useOverview } from '../../store/overview-context'
import '../cookie.css'

/** The Rankings flap board: the top three airlines, each bar a share of the leader's flights. */
export function useBoardFigure(size: FigureSize, airlines: readonly RankRow[]) {
  const top = airlines[0]?.count ?? 0
  const rows = airlines
    .slice(0, 3)
    .map((row) => ({ code: row.key, share: top ? row.count / top : 0 }))
  return useFigure(size, rows.map((row) => `${row.code}:${row.share}`).join(), (k) =>
    flapBoard(rows, k),
  )
}

/** The figure at the head of the Rankings sheet. */
export function BoardSheetFigure() {
  const { scope } = useOverview()
  const figure = useBoardFigure('sheet', scope?.rankings.airlines ?? [])
  return (
    <div className="ov3-sheet-figure">
      <IsoFigure figure={figure} className="iso-board" />
    </div>
  )
}
