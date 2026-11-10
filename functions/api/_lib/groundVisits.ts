// Editable fields of a manual visit, validated the same way for create and edit.
import type { EntryMethod, GroundVisitMode } from '../../../packages/shared/src/types'
import { HttpError } from './http'

export type GroundVisitFields = {
  visitYear: number | null
  note: string | null
  entryMethod: EntryMethod
  mode: GroundVisitMode
}

/** Validates the editable fields of a ground visit; a way (`mode`) is only for a land visit. Shared by POST and PATCH. */
export function parseGroundVisitFields(fields: Record<string, unknown>): GroundVisitFields {
  const note = fields.note ?? null
  if (note != null && (typeof note !== 'string' || note.length > 200))
    throw new HttpError(400, 'note is invalid', 'INVALID')

  const entryMethod = fields.entryMethod ?? null
  if (
    entryMethod != null &&
    entryMethod !== 'air' &&
    entryMethod !== 'land' &&
    entryMethod !== 'sea'
  )
    throw new HttpError(400, 'invalid entryMethod', 'INVALID')

  const mode = fields.mode ?? null
  if (mode != null && mode !== 'rail' && mode !== 'road')
    throw new HttpError(400, 'invalid mode', 'INVALID')
  if (mode != null && entryMethod !== 'land')
    throw new HttpError(400, 'mode needs a land entry', 'INVALID')

  const visitYear = fields.visitYear ?? null
  if (
    visitYear !== null &&
    (typeof visitYear !== 'number' ||
      !Number.isInteger(visitYear) ||
      visitYear < 1800 ||
      visitYear > 2200)
  )
    throw new HttpError(400, 'visitYear is invalid', 'INVALID')
  return { visitYear, note, entryMethod, mode }
}
