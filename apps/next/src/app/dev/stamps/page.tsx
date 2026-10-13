import { notFound } from 'next/navigation'
import { StampSheet, type SheetState } from './stamps'
import type { ReviewFile } from './review-store'

// Development-only contact sheet for the passport stamps: every recipe, state strips, worst-case ring names, owner marks.
export const dynamic = 'force-dynamic'

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
  return <StampSheet initial={initial} review={review} />
}
