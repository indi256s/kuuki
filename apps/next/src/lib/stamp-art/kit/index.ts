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
import { topside } from './topside'
import { managaha } from './managaha'
import { belemTower } from './belem-tower'
import { mushroomIslets } from './mushroom-islets'
import { chateauC } from './chateau-c'
import { bastionTurrets } from './bastion-turrets'
import { charlesBridge } from './charles-bridge'
import { clothHall } from './cloth-hall'
import { junkC } from './junk-c'
import { funicularC } from './funicular-c'
import { waterWheelC } from './water-wheel-c'
import { waterfall } from './waterfall'
import { tataSomba } from './tata-somba'
import { greatHouseA } from './great-house-a'
import { millRuinA } from './mill-ruin-a'
import { citadelle } from './citadelle'
import { pitons } from './pitons'
import { ridgesA } from './ridges-a'
import { plumeA } from './plume-a'
import { eruptionA } from './eruption-a'
import { dugoutA } from './dugout-a'
import { araucariaA } from './araucaria-a'
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
import { kalandula } from './kalandula'
import { mountKenya } from './mount-kenya'
import { volcanicPlug } from './volcanic-plug'
import { naturalArch } from './natural-arch'
import { gorgeB } from './gorge-b'
import { rainforestB } from './rainforest-b'
import { riverboat } from './riverboat'
import { pirogue } from './pirogue'
import { outcropsB } from './outcrops-b'
import { sloopA } from './sloop-a'
import { queensStaircase } from './queens-staircase'
import { craterLakeA } from './crater-lake-a'
import { massifB } from './massif-b'
import { saoSebastiao } from './sao-sebastiao'
import { cleftFallsB } from './cleft-falls-b'
import { taroko } from './taroko'
import { charyn } from './charyn'
import { yurt } from './yurt'
import { paektu } from './paektu'
import { darvaza } from './darvaza'
import { arkBukhara } from './ark-bukhara'
import { tashRabat } from './tash-rabat'
import { geunjeongjeon } from './geunjeongjeon'
import { wingStationB } from './wing-station-b'
import { chimneysB } from './chimneys-b'
import { victoriaFalls } from './victoria-falls'
import { greatZimbabwe } from './great-zimbabwe'
import { baobab } from './baobab'
import { ngalawa } from './ngalawa'
import { leMorne } from './le-morne'
import { shieldB } from './shield-b'
import { bouldersB } from './boulders-b'
import { reefRingB } from './reef-ring-b'
import { stationB } from './station-b'
import { choungui } from './choungui'
import { harbourBridge } from './harbour-bridge'
import { garita } from './garita'
import { fortChristian } from './fort-christian'
import { jettyA } from './jetty-a'
import { jetA } from './jet-a'
import { schoonerA } from './schooner-a'
import { khazneh } from './khazneh'
import { dhow } from './dhow'
import { drumB } from './drum-b'
import { ziggurat } from './ziggurat'
import { pigeonRocks } from './pigeon-rocks'
import { tajMahal } from './taj-mahal'
import { sigiriya } from './sigiriya'
import { heratCitadel } from './herat-citadel'
import { ahsanManzil } from './ahsan-manzil'
import { alamgiriGate } from './alamgiri-gate'
import { persepolis } from './persepolis'
import { machapuchare } from './machapuchare'
import { bhutanHouse } from './bhutan-house'
import { kampongAyer } from './kampong-ayer'
import { shibam } from './shibam'
import { oliveB } from './olive-b'
import { hillTerracesB } from './hill-terraces-b'
import { inlandSeaB } from './inland-sea-b'
import { palmyra } from './palmyra'
import { qasrFarid } from './qasr-farid'
import { fairyChimney } from './fairy-chimney'
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
  topside,
  managaha,
  'belem-tower': belemTower,
  'mushroom-islets': mushroomIslets,
  'chateau-c': chateauC,
  'bastion-turrets': bastionTurrets,
  'charles-bridge': charlesBridge,
  'cloth-hall': clothHall,
  waterfall,
  taroko,
  charyn,
  yurt,
  paektu,
  darvaza,
  'ark-bukhara': arkBukhara,
  'tash-rabat': tashRabat,
  geunjeongjeon,
  'water-wheel-c': waterWheelC,
  'funicular-c': funicularC,
  'junk-c': junkC,
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
  kalandula: kalandula,
  'mount-kenya': mountKenya,
  'volcanic-plug': volcanicPlug,
  'natural-arch': naturalArch,
  'gorge-b': gorgeB,
  'rainforest-b': rainforestB,
  riverboat: riverboat,
  pirogue: pirogue,
  'outcrops-b': outcropsB,
  'sloop-a': sloopA,
  'victoria-falls': victoriaFalls,
  'great-zimbabwe': greatZimbabwe,
  baobab: baobab,
  ngalawa: ngalawa,
  'le-morne': leMorne,
  'shield-b': shieldB,
  'boulders-b': bouldersB,
  'reef-ring-b': reefRingB,
  'station-b': stationB,
  choungui: choungui,
  'taj-mahal': tajMahal,
  sigiriya,
  'herat-citadel': heratCitadel,
  'ahsan-manzil': ahsanManzil,
  'alamgiri-gate': alamgiriGate,
  persepolis,
  machapuchare,
  'bhutan-house': bhutanHouse,
  'kampong-ayer': kampongAyer,
  'queens-staircase': queensStaircase,
  'crater-lake-a': craterLakeA,
  'massif-b': massifB,
  'sao-sebastiao': saoSebastiao,
  'cleft-falls-b': cleftFallsB,
  'wing-station-b': wingStationB,
  'chimneys-b': chimneysB,
  'great-house-a': greatHouseA,
  'mill-ruin-a': millRuinA,
  citadelle,
  pitons,
  'ridges-a': ridgesA,
  'plume-a': plumeA,
  'eruption-a': eruptionA,
  'dugout-a': dugoutA,
  'araucaria-a': araucariaA,
  'schooner-a': schoonerA,
  'jet-a': jetA,
  'jetty-a': jettyA,
  'fort-christian': fortChristian,
  garita,
  'harbour-bridge': harbourBridge,
  khazneh,
  dhow,
  'drum-b': drumB,
  ziggurat,
  'pigeon-rocks': pigeonRocks,
  shibam,
  'olive-b': oliveB,
  'hill-terraces-b': hillTerracesB,
  'inland-sea-b': inlandSeaB,
  palmyra,
  'qasr-farid': qasrFarid,
  'fairy-chimney': fairyChimney,
} satisfies Record<string, KitModule>

export type KitTag = keyof typeof kit
export const isKitTag = (tag: string): tag is KitTag => Object.hasOwn(kit, tag)
export type { KitModule } from './util'
