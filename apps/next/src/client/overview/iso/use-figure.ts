import { useMemo } from 'react'
import { TILE_FIGURE_HEIGHT, TILE_FIGURE_WIDTH, type TileSpan } from '../mobile/tiles'
import { fitBox, type IsoFigureData } from './scene'

/** Where a figure is drawn: a tile of that span, or the head of its sheet. */
export type FigureSize = TileSpan | 'sheet'
/** Sheet figures share one scale, so objects keep their relative sizes from sheet to sheet. */
export const SHEET_K = 1

/** Builds a figure at the size it is shown: a tile fits it to the tile's figure box, a sheet draws it at SHEET_K. `key` names the inputs `build` reads; the figure is rebuilt only when it changes. */
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
