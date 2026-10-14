import { notFound } from 'next/navigation'
import { StampSheet, type Row, type SheetState } from './stamps'
import type { ReviewFile } from './review-store'

// Development-only contact sheet for the passport stamps: every recipe, state strips, worst-case ring names, owner marks.
export const dynamic = 'force-dynamic'

/** Build fresh art and metadata together; no generated assets or persistent output cache. */
async function buildRows(): Promise<Row[]> {
  const { SHAPE_NAMES } = await import('../../../lib/stamp-art/frame')
  const { lintGeometry } = await import('../../../lib/stamp-art/lint')
  const { loadRecipes } = await import('../../../lib/stamp-art/recipes')
  const { buildStampIndex } = await import('../../../lib/stamp-art/stamp-index')
  const { renderEngraving } = await import('../../../lib/stamp-art/render')
  const { initRingBake, bakeRing } = await import('../../../lib/stamp-art/ring-bake')
  await initRingBake()
  const index = buildStampIndex()
  const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`
  const rows: Row[] = loadRecipes().map((recipe) => {
    const entry = index[recipe.iso2]
    return {
      iso2: recipe.iso2,
      kind: 'recipe',
      issues: lintGeometry(recipe).map((i) => i.message),
      names: entry.name,
      preview: {
        meta: { iso2: recipe.iso2, ...entry },
        engraving: entry.tier === 'engraved' ? uri(renderEngraving(recipe)) : undefined,
        rings: { [entry.shape]: uri(bakeRing(recipe.iso2, entry.shape).svg) },
      },
    }
  })
  const have = new Set(rows.map((r) => r.iso2))
  for (const shape of SHAPE_NAMES) {
    const iso2 = Object.keys(index).find((c) => !have.has(c) && index[c].shape === shape)
    if (iso2) {
      const entry = index[iso2]
      rows.push({
        iso2,
        kind: 'fallback',
        issues: [],
        names: entry.name,
        preview: { meta: { iso2, ...entry }, rings: { [shape]: uri(bakeRing(iso2, shape).svg) } },
      })
    }
  }
  const { emWidth } = await import('../../../client/stamps/ring-fit')
  for (const locale of ['en', 'ru'] as const) {
    const width = (row: Row) => emWidth(row.names[locale].toLocaleUpperCase(locale))
    const longest = [...rows].sort((a, b) => width(b) - width(a)).slice(0, 3)
    for (const row of longest) {
      for (const shape of SHAPE_NAMES) {
        try {
          row.preview.rings[shape] = uri(bakeRing(row.iso2, shape).svg)
        } catch (error) {
          throw new Error(
            `Worst-case ring ${row.iso2} (${locale}, ${shape}): ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          )
        }
      }
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
  return <StampSheet initial={initial} review={review} rows={await buildRows()} />
}
