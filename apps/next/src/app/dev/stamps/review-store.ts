export type ReviewStatus = 'accepted' | 'redo'
export type ReviewEntry = { status?: ReviewStatus; note?: string; at: string }
export type ReviewFile = Record<string, ReviewEntry>

export type ReviewUpdate = {
  iso2: string
  status: ReviewStatus | null
  note?: string
}

export const NOTE_MAX = 2000

export function parseUpdate(body: unknown): ReviewUpdate | null {
  if (typeof body !== 'object' || body === null) return null
  const { iso2, status, note } = body as Record<string, unknown>
  if (typeof iso2 !== 'string' || !/^[A-Z]{2}$/.test(iso2)) return null
  if (status !== null && status !== 'accepted' && status !== 'redo') return null
  if (note !== undefined && (typeof note !== 'string' || note.length > NOTE_MAX)) return null
  return { iso2, status, note }
}

export function applyUpdate(file: ReviewFile, update: ReviewUpdate, today: string): ReviewFile {
  const next = { ...file }
  const note = update.note?.trim()
  if (update.status === null && !note) delete next[update.iso2]
  else
    next[update.iso2] = {
      ...(update.status ? { status: update.status } : {}),
      ...(note ? { note } : {}),
      at: today,
    }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
}

export const serializeReview = (file: ReviewFile): string =>
  `${JSON.stringify(
    Object.fromEntries(
      Object.entries(file).map(([k, v]) => [
        k,
        {
          ...(v.status ? { status: v.status } : {}),
          ...(v.note ? { note: v.note } : {}),
          at: v.at,
        },
      ]),
    ),
    null,
    2,
  )}\n`
