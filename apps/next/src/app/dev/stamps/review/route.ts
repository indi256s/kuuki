import { NextResponse } from 'next/server'
import { applyUpdate, parseUpdate, serializeReview, type ReviewFile } from '../review-store'

// Development-only: saves the owner's contact-sheet marks to lib/stamp-art/review.json, the one file this route may write.
export const dynamic = 'force-dynamic'

const notFound = () => new NextResponse(null, { status: 404 })

/** The only path this module ever touches. */
async function reviewPath(): Promise<string> {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const tail = join('src', 'lib', 'stamp-art', 'review.json')
  const candidates = [join(process.cwd(), tail), join(process.cwd(), 'apps', 'next', tail)]
  return candidates.find((p) => existsSync(p)) ?? candidates[0]
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return notFound()
  const { readFile } = await import('node:fs/promises')
  const text = await readFile(await reviewPath(), 'utf8')
  return NextResponse.json(JSON.parse(text) as ReviewFile)
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return notFound()
  const update = parseUpdate(await request.json().catch(() => null))
  if (!update) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { readFile, writeFile } = await import('node:fs/promises')
  const path = await reviewPath()
  const current = JSON.parse(await readFile(path, 'utf8')) as ReviewFile
  const next = applyUpdate(current, update, new Date().toISOString().slice(0, 10))
  await writeFile(path, serializeReview(next))
  return NextResponse.json(next)
}
