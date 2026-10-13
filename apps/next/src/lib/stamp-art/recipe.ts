import { z } from 'zod'
import { INK_NAMES } from './inks'
import { SHAPE_NAMES } from './frame'
import { isKitTag } from './kit'
import { isSignatureName } from './signatures'

const box = z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])
const params = z.record(z.string(), z.unknown())
const layer = z
  .object({
    module: z.string(),
    box,
    params: params.optional(),
    mirror: z.boolean().optional(),
  })
  .strict()

export const recipeSchema = z
  .object({
    iso2: z.string().regex(/^[A-Z]{2}$/, 'iso2 must be two uppercase letters'),
    tier: z.enum(['engraved', 'fallback']),
    shape: z.enum(SHAPE_NAMES).optional(),
    ink: z.enum(INK_NAMES).optional(),
    cluster: z.string().optional(),
    /**
     * Horizon as a fraction of the window height, 0.68-0.72 for land scenes (0.78 for a bay).
     * Backdrop modules receive it as `horizonY`; the subject base sits on it.
     */
    horizon: z.number().min(0.5).max(0.9).optional(),
    /**
     * The vignette, drawn first: sky, distance, ground. Fills the whole window (the box defaults
     * to the window box) and is clipped once by the window. Subjects stop its hatching 3 units
     * short of their silhouette.
     */
    backdrop: z.array(layer.extend({ box: box.optional() }).strict()).optional(),
    /** The subject, drawn over the backdrop. Must stay inside the window inset 6. */
    layers: z.array(layer),
    signature: z
      .array(z.object({ part: z.string(), box, params: params.optional() }).strict())
      .optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    for (const [key, list] of [
      ['backdrop', r.backdrop ?? []],
      ['layers', r.layers],
    ] as const) {
      list.forEach((l, i) => {
        if (!isKitTag(l.module)) {
          ctx.addIssue({
            code: 'custom',
            path: [key, i, 'module'],
            message: `${r.iso2}: unknown kit module "${l.module}" in ${key} ${i}`,
          })
        }
      })
    }
    r.signature?.forEach((s, i) => {
      if (!isSignatureName(s.part)) {
        ctx.addIssue({
          code: 'custom',
          path: ['signature', i, 'part'],
          message: `${r.iso2}: unknown signature part "${s.part}" in signature ${i}`,
        })
      }
    })
  })

export type Recipe = z.infer<typeof recipeSchema>

/** Validates a raw recipe. Throws with every problem listed, including unknown modules or parts. */
export function parseRecipe(raw: unknown): Recipe {
  const result = recipeSchema.safeParse(raw)
  if (!result.success) {
    const where = (raw as { iso2?: unknown } | null)?.iso2
    throw new Error(
      `Invalid stamp recipe${typeof where === 'string' ? ` ${where}` : ''}: ${result.error.issues.map((i) => i.message).join('; ')}`,
    )
  }
  return result.data
}
