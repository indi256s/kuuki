import type { SectionId } from '@kuuki/shared/overview/prefs'

export type TileSpan = 'half' | 'full'

/** The width a tile figure is built at, in px, at a 390px viewport: a half tile's content box, and what a full tile leaves beside its text. */
export const TILE_FIGURE_WIDTH: Record<TileSpan, number> = { half: 137, full: 148 }
/** The tallest a tile figure may be, so a half tile's value lines up with its neighbour's (the figure box in cookie.css is 114px with its 2px padding). */
export const TILE_FIGURE_HEIGHT = 112

export function packTiles(visible: SectionId[]): { id: SectionId; span: TileSpan }[] {
  const tiles: ReturnType<typeof packTiles> = []
  let orphan: number | null = null
  for (const id of visible) {
    if (id === 'aircraft') {
      if (orphan !== null) tiles[orphan].span = 'full'
      orphan = null
      tiles.push({ id, span: 'full' })
    } else {
      tiles.push({ id, span: 'half' })
      orphan = orphan === null ? tiles.length - 1 : null
    }
  }
  if (orphan !== null) tiles[orphan].span = 'full'
  return tiles
}
