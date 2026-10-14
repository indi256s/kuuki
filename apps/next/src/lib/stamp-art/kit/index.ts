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
import { palace, gloriette } from './palace'
import { belfry } from './clock-tower'
import { steppedGable } from './stepped-gable'
import { bridgeC } from './bridge-c'
import { boatsC } from './boats-c'
import { hillTown } from './hill-town'
import { castle } from './castle'
import { windmill } from './windmill'
import { ganvie } from './ganvie'
import { islandB } from './island-b'
import { kolmanskop } from './kolmanskop'
import { ruinWall } from './ruin-wall'
import { standingStonesB } from './standing-stones-b'
import { veranda } from './veranda'
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
import { cliffCastle } from './cliff-castle'
import { pinnacles } from './pinnacles'
import { chateauC } from './chateau-c'
import { bastionTurrets } from './bastion-turrets'
import { charlesBridge } from './charles-bridge'
import { clothHall } from './cloth-hall'
import { waterfall } from './waterfall'
import { tataSomba } from './tata-somba'
import { granaries } from './granaries'
import { monolithB } from './monolith-b'
import { jacobsLadder } from './jacobs-ladder'
import { trussBridgeB } from './truss-bridge-b'
import { waterfallA } from './waterfall-a'
import { terracesA } from './terraces-a'
import { tortoiseA } from './tortoise-a'
import { penguinA } from './penguin-a'
import { gantryA } from './gantry-a'
import { whalingChimneyA } from './whaling-chimney-a'
import { arcadeHouseA } from './arcade-house-a'
import { woodenRowA } from './wooden-row-a'
import { portonA } from './porton-a'
import { sloopA } from './sloop-a'
import { queensStaircase } from './queens-staircase'
import { craterLakeA } from './crater-lake-a'
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
  palace,
  gloriette,
  belfry,
  'stepped-gable': steppedGable,
  'bridge-c': bridgeC,
  'boats-c': boatsC,
  'hill-town': hillTown,
  castle,
  windmill,
  ganvie,
  'island-b': islandB,
  kolmanskop,
  'ruin-wall': ruinWall,
  'standing-stones-b': standingStonesB,
  veranda,
  'devils-tower': devilsTower,
  obelisk: obelisk,
  'paine-towers': paineTowers,
  'cable-car': cableCar,
  bridge: bridge,
  'thatch-hut': thatchHut,
  chateau,
  'monolith-gate': monolithGate,
  'colonial-row': colonialRow,
  'bastion-fort': bastionFort,
  'cliff-castle': cliffCastle,
  pinnacles,
  'chateau-c': chateauC,
  'bastion-turrets': bastionTurrets,
  'charles-bridge': charlesBridge,
  'cloth-hall': clothHall,
  waterfall,
  'tata-somba': tataSomba,
  granaries,
  'monolith-b': monolithB,
  'jacobs-ladder': jacobsLadder,
  'truss-bridge-b': trussBridgeB,
  'waterfall-a': waterfallA,
  'terraces-a': terracesA,
  'tortoise-a': tortoiseA,
  'arcade-house-a': arcadeHouseA,
  'wooden-row-a': woodenRowA,
  'porton-a': portonA,
  'penguin-a': penguinA,
  'gantry-a': gantryA,
  'whaling-chimney-a': whalingChimneyA,
  'sloop-a': sloopA,
  'queens-staircase': queensStaircase,
  'crater-lake-a': craterLakeA,
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
