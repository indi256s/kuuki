import { cliff, mountains, platform, steps, twinPeak, water } from './ground'
import { curvedEave, gable, hip, pagodaTier, stilts } from './roof'
import { statue } from './object'
import type { KitModule } from './util'
import { gate, house, rampart, stiltHouse, switchbackWall, temple } from './building'
import { basalt, distanceMountains, distanceTrees, ground, sky } from './vignette'
import { karst } from './karst'
import { mesa } from './mesa'
import { peak } from './peak'
import { acacia } from './savanna'
import { volcano } from './volcano'
import { rockHill } from './rock-hill'
import { ruinedTemple } from './ruined-temple'
import { amphitheatre } from './amphitheatre'
import { rooftops } from './rooftops'
import { dunes } from './dunes'
import { pyramid, steppedPyramid } from './pyramid'
import { palace, gloriette } from './palace'
import { belfry } from './clock-tower'
import { steppedGable } from './stepped-gable'
import { bridgeC } from './bridge-c'
import { boatsC } from './boats-c'
import { hillTown } from './hill-town'
import { castle } from './castle'
import { windmill } from './windmill'
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
  acacia,
  mesa,
  karst,
  peak,
  dunes,
  rooftops,
  amphitheatre,
  pyramid,
  'stepped-pyramid': steppedPyramid,
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
  'rock-hill': rockHill,
  'ruined-temple': ruinedTemple,
  palace,
  gloriette,
  belfry,
  'stepped-gable': steppedGable,
  'bridge-c': bridgeC,
  'boats-c': boatsC,
  'hill-town': hillTown,
  castle,
  windmill,
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
