import { notFound } from 'next/navigation'
import { SHAPE_NAMES } from '../../../lib/stamp-art/frame'
import { lintGeometry } from '../../../lib/stamp-art/lint'
import { loadRecipes } from '../../../lib/stamp-art/recipes'
import { stampCodes, stampMeta } from '../../../client/stamps/stamp-meta'
import { StampSheet, type Row, type SheetState } from './stamps'
import type { ReviewFile } from './review-store'

// Development-only contact sheet for the passport stamps: every recipe, state strips, worst-case ring names, owner marks.
export const dynamic = 'force-dynamic'

/** The recipes with their geometric lint (server only: keeps the engraving kit out of the client bundle), then one fallback example per frame shape. */
function buildRows(): Row[] {
  const rows: Row[] = loadRecipes().map((r) => ({
    iso2: r.iso2,
    kind: 'recipe',
    issues: lintGeometry(r).map((i) => i.message),
  }))
  const have = new Set(rows.map((r) => r.iso2))
  for (const shape of SHAPE_NAMES) {
    const iso2 = stampCodes().find((c) => !have.has(c) && stampMeta(c).shape === shape)
    if (iso2) {
      have.add(iso2)
      rows.push({ iso2, kind: 'fallback', issues: [] })
    }
  }
  return rows
}

type Search = Partial<Record<'theme' | 'locale' | 'size' | 'imp' | 'compare' | 'filter', string>>

export default async function StampsPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const q = await searchParams
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { existsSync } = await import('node:fs')
  const tail = join('src', 'lib', 'stamp-art', 'review.json')
  const path = [join(process.cwd(), tail), join(process.cwd(), 'apps', 'next', tail)].find((p) =>
    existsSync(p),
  )
  const review = path ? (JSON.parse(await readFile(path, 'utf8')) as ReviewFile) : {}
  const initial: SheetState = {
    theme: q.theme === 'dark' ? 'dark' : 'light',
    locale: q.locale === 'ru' ? 'ru' : 'en',
    size: q.size === '96' ? 96 : 160,
    worn: q.imp !== 'off',
    compare: q.compare === '1',
    filter: ['unmarked', 'redo', 'accepted'].includes(q.filter ?? '')
      ? (q.filter as SheetState['filter'])
      : 'all',
  }
  return <StampSheet initial={initial} review={review} rows={buildRows()} />
}
