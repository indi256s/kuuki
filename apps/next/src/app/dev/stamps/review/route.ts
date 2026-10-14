import { NextResponse } from 'next/server'
import { applyUpdate, parseUpdate, serializeReview, type ReviewFile } from '../review-store'

// Development-only: saves the owner's contact-sheet marks to lib/stamp-art/review.json, the one file this route may write.
export const dynamic = 'force-dynamic'

// Shared across route reloads and tabs served by this development process.
const queue = globalThis as typeof globalThis & { stampReviewWrite?: Promise<unknown> }

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
  const operation = (queue.stampReviewWrite ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const { readFile, writeFile, rename, rm } = await import('node:fs/promises')
      const { randomUUID } = await import('node:crypto')
      const path = await reviewPath()
      const current = JSON.parse(await readFile(path, 'utf8')) as ReviewFile
      const next = applyUpdate(current, update, new Date().toISOString().slice(0, 10))
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, serializeReview(next), { flag: 'wx' })
        await rename(temporary, path)
      } finally {
        await rm(temporary, { force: true })
      }
      return NextResponse.json(next)
    })
  queue.stampReviewWrite = operation
  return operation
}
