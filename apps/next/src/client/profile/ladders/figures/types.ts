import type { IsoFigureData } from '../../../overview/iso/scene'

export type LadderId =
  | 'flights'
  | 'distance'
  | 'time-aloft'
  | 'countries'
  | 'airports'
  | 'continents'
  | 'airlines'
  | 'aircraft-types'

export type LadderLod = 'hero' | 'thumb'

export type LadderFigureInput = {
  rung: number
  lod: LadderLod
  initials?: string
}

export type LadderFigureBuilder = (k: number, input: LadderFigureInput) => IsoFigureData

export type LadderFigureDef = {
  id: LadderId
  rungs: number
  build: LadderFigureBuilder
}
