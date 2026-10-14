import { cliff, mountains, platform, steps, twinPeak, water } from './ground'
import { curvedEave, gable, hip, pagodaTier, stilts } from './roof'
import { statue } from './object'
import type { KitModule } from './util'
import { gate, house, rampart, stiltHouse, switchbackWall, temple } from './building'
import { basalt, distanceMountains, distanceTrees, ground, sky } from './vignette'
import { volcano } from './volcano'
import { colonnade, fortressWall, pediment, tower, triumphalArch } from './wall'

/** Kit modules by recipe tag. */
export const kit = {
  sky,
  'distance-mountains': distanceMountains,
  'distance-trees': distanceTrees,
  ground,
  basalt,
  water,
  mountains,
  'twin-peak': twinPeak,
  volcano,
  cliff,
  platform,
  steps,
  'fortress-wall': fortressWall,
  tower,
  hip,
  gable,
  stilts,
  'pagoda-tier': pagodaTier,
  'curved-eave': curvedEave,
  colonnade,
  pediment,
  'triumphal-arch': triumphalArch,
  statue,
  house,
  'stilt-house': stiltHouse,
  gate,
  temple,
  rampart,
  'switchback-wall': switchbackWall,
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
