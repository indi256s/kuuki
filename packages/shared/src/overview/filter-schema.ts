import {
  array,
  string,
  strictObject,
  optional,
  enum as enumOf,
  union,
  int,
  minimum,
  maximum,
  refine,
  maxLength,
} from 'zod/mini'
import { MAKER_SLOTS } from '../../../data/src/aircraft-makers'
import { periodDays } from './range'

const strings = array(string())
export const overviewFilterSchema = strictObject({
  scope: optional(enumOf(['flights', 'ground'])),
  period: optional(
    union([
      strictObject({ years: array(int().check(minimum(0), maximum(9999))) }),
      strictObject({ from: string(), to: string() }).check(
        refine((value) => periodDays(value) !== null),
      ),
    ]),
  ),
  countries: optional(strings),
  regions: optional(strings),
  airlines: optional(strings),
  aircraft: optional(strings),
  routes: optional(strings),
  airports: optional(strings),
  families: optional(strings),
  alliances: optional(array(enumOf(['star', 'oneworld', 'skyteam']))),
  makers: optional(array(enumOf(MAKER_SLOTS))),
  bodies: optional(array(enumOf(['narrow', 'wide']))),
  depHours: optional(array(int().check(minimum(0), maximum(23)))),
  arrHours: optional(array(int().check(minimum(0), maximum(23)))),
  months: optional(
    array(int().check(minimum(1), maximum(12))).check(
      maxLength(12),
      refine((values) => new Set(values).size === values.length),
    ),
  ),
  haul: optional(array(enumOf(['short', 'medium', 'long']))),
  domestic: optional(array(enumOf(['domestic', 'international']))),
  departureBands: optional(array(enumOf(['night', 'morning', 'afternoon', 'evening']))),
})
