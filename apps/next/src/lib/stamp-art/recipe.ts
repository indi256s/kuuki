import { z } from 'zod'
import { INK_NAMES } from './inks'
import { SHAPE_NAMES } from './frame'
import { isKitTag } from './kit'
import { isSignatureName } from './signatures'

const box = z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])
const params = z.record(z.string(), z.unknown())

export const recipeSchema = z
  .object({
    iso2: z.string().regex(/^[A-Z]{2}$/, 'iso2 must be two uppercase letters'),
    tier: z.enum(['engraved', 'fallback']),
    shape: z.enum(SHAPE_NAMES).optional(),
    ink: z.enum(INK_NAMES).optional(),
    cluster: z.string().optional(),
    layers: z.array(
      z
        .object({
          module: z.string(),
          box,
          params: params.optional(),
          mirror: z.boolean().optional(),
        })
        .strict(),
    ),
    signature: z
      .array(z.object({ part: z.string(), box, params: params.optional() }).strict())
      .optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    r.layers.forEach((l, i) => {
      if (!isKitTag(l.module)) {
        ctx.addIssue({
          code: 'custom',
          path: ['layers', i, 'module'],
          message: `${r.iso2}: unknown kit module "${l.module}" in layer ${i}`,
        })
      }
    })
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
