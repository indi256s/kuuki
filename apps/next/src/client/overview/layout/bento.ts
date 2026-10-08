import type { SectionId } from '@kuuki/shared/overview/prefs'

export type BentoRow = { kind: 'full'; id: SectionId } | { kind: 'pair'; narrow: SectionId; wide: SectionId; narrowFirst: boolean }
const narrow = (id: SectionId) => id === 'manufacturers' || id === 'clock'
const wide = (id: SectionId) => id === 'fleet' || id === 'rhythm'
export function packBento(order: SectionId[], hidden: SectionId[]): BentoRow[] {
  const visible = order.filter(id => !hidden.includes(id)), rows: BentoRow[] = []
  for (let i = 0; i < visible.length; i++) {
    const id = visible[i], next = visible[i + 1]
    if (next && ((narrow(id) && wide(next)) || (wide(id) && narrow(next)))) {
      rows.push({ kind: 'pair', narrow: narrow(id) ? id : next, wide: wide(id) ? id : next, narrowFirst: narrow(id) })
      i++
    } else rows.push({ kind: 'full', id })
  }
  return rows
}
