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
import { tableMountain } from './table-mountain'
import { bayCity } from './bay-city'
import { kasbah } from './kasbah'
import { graniteDome } from './granite-dome'
import { mokorotlo } from './mokorotlo'
import { cubeTown } from './cube-town'
import { amphitheatre } from './amphitheatre'
import { rooftops } from './rooftops'
import { dunes } from './dunes'
import { pyramid, steppedPyramid } from './pyramid'
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
  'table-mountain': tableMountain,
  'bay-city': bayCity,
  kasbah,
  'granite-dome': graniteDome,
  mokorotlo,
  'cube-town': cubeTown,
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
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
