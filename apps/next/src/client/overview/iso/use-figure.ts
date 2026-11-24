import { useMemo } from 'react'
import { TILE_FIGURE_HEIGHT, TILE_FIGURE_WIDTH, type TileSpan } from '../mobile/tiles'
import { fitBox, type IsoFigureData } from './scene'

export type FigureSize = TileSpan | 'sheet'
export const SHEET_K = 1

export function useFigure(
  size: FigureSize,
  key: string,
  build: (k: number) => IsoFigureData,
): IsoFigureData {
  return useMemo(
    () =>
      build(
        size === 'sheet' ? SHEET_K : fitBox(TILE_FIGURE_WIDTH[size], TILE_FIGURE_HEIGHT, build),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `build` is a fresh closure every render; `key` carries everything it reads.
    [size, key],
  )
}
