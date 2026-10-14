import { cliff, mountains, platform, steps, twinPeak, water } from './ground'
import { curvedEave, gable, hip, pagodaTier, stilts } from './roof'
import { statue } from './object'
import type { KitModule } from './util'
import { gate, house, rampart, stiltHouse, switchbackWall, temple } from './building'
import { basalt, distanceMountains, distanceTrees, ground, sky } from './vignette'
import { iceberg } from './iceberg'
import { karst } from './karst'
import { lighthouse } from './lighthouse'
import { mesa } from './mesa'
import { palm } from './palm'
import { peak } from './peak'
import { acacia } from './savanna'
import { volcano } from './volcano'
import { rockHill } from './rock-hill'
import { ruinedTemple } from './ruined-temple'
import { tableMountain } from './table-mountain'
import { bayCity } from './bay-city'
import { kasbah } from './kasbah'
import { graniteDome } from './granite-dome'
import { mokorotlo } from './mokorotlo'
import { cubeTown } from './cube-town'
import { amphitheatre } from './amphitheatre'
import { rooftops } from './rooftops'
import { atoll } from './atoll'
import { dunes } from './dunes'
import { pyramid, steppedPyramid } from './pyramid'
import { devilsTower } from './devils-tower'
import { obelisk } from './obelisk'
import { paineTowers } from './paine-towers'
import { cableCar } from './cable-car'
import { bridge } from './bridge'
import { thatchHut } from './thatch-hut'
import { chateau } from './chateau'
import { monolithGate } from './monolith-gate'
import { colonialRow } from './colonial-row'
import { bastionFort } from './bastion-fort'
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
  atoll,
  iceberg,
  lighthouse,
  palm,
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
  'devils-tower': devilsTower,
  obelisk: obelisk,
  'paine-towers': paineTowers,
  'cable-car': cableCar,
  bridge: bridge,
  'thatch-hut': thatchHut,
  chateau: chateau,
  'monolith-gate': monolithGate,
  'colonial-row': colonialRow,
  'bastion-fort': bastionFort,
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
