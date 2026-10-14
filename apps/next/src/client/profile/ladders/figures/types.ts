import type { IsoFigureData } from '../../../overview/iso/scene'

/** The eight ladders that have a drawn object. Founding crew is a milestone, not a ladder, and keeps its paper stub. */
export type LadderId =
  | 'flights'
  | 'distance'
  | 'time-aloft'
  | 'countries'
  | 'airports'
  | 'continents'
  | 'airlines'
  | 'aircraft-types'

/**
 * How much of the object to draw.
 * `hero`: the full anatomy-quality drawing for the sheet (about 320 × 200 CSS px).
 * `thumb`: the same object and the same state for a 56px slot: drop parts finer than about 1px at that size (rivets, screws, speckle), keep every part that tells this rung from its neighbours.
 */
export type LadderLod = 'hero' | 'thumb'

export type LadderFigureInput = {
  /** 1-based rung whose state is drawn; 1 ≤ rung ≤ the ladder's rung count. */
  rung: number
  lod: LadderLod
  /** Flights top rung only: the holder's initials painted on the tail (1–2 upper-case letters, Latin or Cyrillic). Omitted or empty draws a plain tail. */
  initials?: string
}

/**
 * Draws one ladder's object at one rung, at scale `k` (1 iso unit = k CSS px), with the app's iso Scene.
 * Contract, checked by figures.test.ts for every rung and both lods:
 * - exactly one group with `part: 'lit'`, holding the one accent part (the thing that changed at this rung), drawn with `s.lit` or accent paints; no accent paint anywhere outside it;
 * - no text nodes, except the Flights top rung's initials (inside the tail, not in `lit`);
 * - deterministic: same input, same output (no Math.random; seed any speckle from a fixed hash);
 * - fits: geometry is built in world units, never in CSS px; the caller picks k with `fitBox`.
 */
export type LadderFigureBuilder = (k: number, input: LadderFigureInput) => IsoFigureData

export type LadderFigureDef = {
  id: LadderId
  /** Rung count: 5, or 3 for airlines and aircraft types. */
  rungs: number
  build: LadderFigureBuilder
}
