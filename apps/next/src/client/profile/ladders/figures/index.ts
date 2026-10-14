import { aircraftTypes } from './aircraft-types'
import { airlines } from './airlines'
import { airports } from './airports'
import { continents } from './continents'
import { countries } from './countries'
import { distance } from './distance'
import { flights } from './flights'
import { timeAloft } from './time-aloft'
import type { LadderFigureDef, LadderId } from './types'

export const LADDER_FIGURES: Record<LadderId, LadderFigureDef> = {
  flights,
  distance,
  'time-aloft': timeAloft,
  countries,
  airports,
  continents,
  airlines,
  'aircraft-types': aircraftTypes,
}
