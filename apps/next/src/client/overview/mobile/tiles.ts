import type { SectionId } from '@kuuki/shared/overview/prefs'

export type TileSpan = 'half' | 'full'

export const TILE_FIGURE_WIDTH: Record<TileSpan, number> = { half: 137, full: 148 }
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
