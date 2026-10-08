import type { SectionId } from '@kuuki/shared/overview/prefs'

export function packTiles(order: SectionId[], hidden: SectionId[]): { id: SectionId; span: 'half' | 'full' }[] {
  const tiles: ReturnType<typeof packTiles> = []
  let orphan: number | null = null
  for (const id of order.filter(id => !hidden.includes(id))) {
    if (id === 'manufacturers') {
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
