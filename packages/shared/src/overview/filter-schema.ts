import { z } from 'zod'
import { MAKER_SLOTS } from '../../../data/src/aircraft-makers'
import { periodDays } from './range'

const strings = z.array(z.string())
export const overviewFilterSchema = z.strictObject({
  scope: z.enum(['flights', 'ground']).optional(),
  period: z
    .union([
      z.strictObject({ years: z.array(z.number().int().min(0).max(9999)) }),
      z
        .strictObject({ from: z.string(), to: z.string() })
        .refine((value) => periodDays(value) !== null),
    ])
    .optional(),
  countries: strings.optional(),
  regions: strings.optional(),
  airlines: strings.optional(),
  aircraft: strings.optional(),
  routes: strings.optional(),
  airports: strings.optional(),
  families: strings.optional(),
  alliances: z.array(z.enum(['star', 'oneworld', 'skyteam'])).optional(),
  makers: z.array(z.enum(MAKER_SLOTS)).optional(),
  bodies: z.array(z.enum(['narrow', 'wide'])).optional(),
  depHours: z.array(z.number().int().min(0).max(23)).optional(),
  arrHours: z.array(z.number().int().min(0).max(23)).optional(),
  months: z
    .array(z.number().int().min(1).max(12))
    .max(12)
    .refine((values) => new Set(values).size === values.length)
    .optional(),
  haul: z.array(z.enum(['short', 'medium', 'long'])).optional(),
  domestic: z.array(z.enum(['domestic', 'international'])).optional(),
  departureBands: z.array(z.enum(['night', 'morning', 'afternoon', 'evening'])).optional(),
})
