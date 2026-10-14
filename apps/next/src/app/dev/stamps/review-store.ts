// Owner marks (B2) for the contact sheet: pure helpers, the route handler does the file IO.
export type ReviewStatus = 'accepted' | 'redo'
export type ReviewEntry = { status?: ReviewStatus; note?: string; at: string }
export type ReviewFile = Record<string, ReviewEntry>

export type ReviewUpdate = {
  iso2: string
  /** `null` clears the mark. */
  status: ReviewStatus | null
  note?: string
}

export const NOTE_MAX = 2000

/** Validates an untrusted request body. Returns null when anything is off. */
export function parseUpdate(body: unknown): ReviewUpdate | null {
  if (typeof body !== 'object' || body === null) return null
  const { iso2, status, note } = body as Record<string, unknown>
  if (typeof iso2 !== 'string' || !/^[A-Z]{2}$/.test(iso2)) return null
  if (status !== null && status !== 'accepted' && status !== 'redo') return null
  if (note !== undefined && (typeof note !== 'string' || note.length > NOTE_MAX)) return null
  return { iso2, status, note }
}

/** Applies one update. A cleared mark with no note removes the entry; a note alone keeps a status-less entry; keys come out sorted. */
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

/** 2-space JSON with a trailing newline; entry keys in a fixed order. */
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
