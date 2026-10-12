// Thumbnail glyphs for the hero card's resting list: each object drawn at true size (about 28px tall), not shrunk from its big figure, so a few bold parts and 1px strokes survive.
import { Scene, type IsoFigureData, type P3 } from './scene'
import { NZ, X, cylX, cylZ, rrOn, shadowDisc, shadowRect, slabRot } from './solids'

export type HeroGlyph = 'flights' | 'km' | 'air' | 'countries' | 'airports'

/** A pin through three stubs, the top one widest, on a round base. */
function spike(s: Scene) {
  shadowDisc(s, 0, 0, 7)
  cylZ(s, 0, 0, 0, 5, 2, { top: 'top', body: 'side' }, 20)
  s.line(
    [
      [0, 0, 2],
      [0, 0, 19],
    ],
    'line',
    1,
  )
  for (const [a, z, w] of [
    [-0.12, 4, 9],
    [0.12, 8, 12],
    [-0.1, 12, 15],
  ] as const)
    slabRot(s, 0, 0, z, w, 5, 1, a)
  s.line(
    [
      [0, 0, 13],
      [0, 0, 19],
    ],
    'line',
    1,
  )
}

/** A counter housing with four windows and a knob. */
function odometer(s: Scene) {
  shadowRect(s, 0, 0, 24, 7, 1)
  s.box(0, 0, 0, 24, 7, 10)
  for (let i = 0; i < 4; i++)
    s.poly(rrOn(s, [0, 7, 10] as P3, X, NZ, 2.5 + i * 5, 2.5, 4, 5, 0.8), 'glass', 'line')
  cylX(s, 24, 3.5, 5, 2.5, 2, {}, 12)
}

/** A cabin window with its shade two thirds down. */
function cabinWindow(s: Scene) {
  s.box(0, 0, 0, 14, 3, 19)
  const F: P3 = [0, 3, 19]
  const pane = () => rrOn(s, F, X, NZ, 2.5, 2.5, 9, 14, 4)
  s.poly(pane(), 'glass', 'line')
  s.poly(
    pane().filter((p) => p[2] >= 19 - 11),
    'detail',
    'none',
  )
  s.line(
    [
      [3, 3, 19 - 11],
      [11, 3, 19 - 11],
    ],
    'line',
    1,
  )
}

/** A rounded case on two wheels with a telescopic handle: two posts and a grip bar. */
function suitcase(s: Scene) {
  shadowRect(s, 0, 0, 18, 7, 1)
  for (const x of [3, 15]) s.poly(s.circle([x, 7, 1.5], X, NZ, 0, 0, 1.5, 8), 'side', 'line')
  s.rbox(0, 0, 1.5, 18, 7, 11, 2.5, { top: 'top', wall: 'front', side: 'side' })
  s.segs(
    [
      [
        [6, 3.5, 12.5],
        [6, 3.5, 16],
      ],
      [
        [12, 3.5, 12.5],
        [12, 3.5, 16],
      ],
    ],
    'line',
    1,
  )
  s.box(5, 3, 16, 8, 1, 1.5)
}

/** A belt coming out of a flap portal with one bag on it. */
function carousel(s: Scene) {
  shadowRect(s, 0, -2, 22, 11, 1)
  s.box(-3, -3, 0, 3, 12, 9)
  s.poly(
    [
      [0, 0, 5],
      [0, 7, 4],
      [0, 7, 8],
      [0, 0, 8],
    ],
    'glass',
    'line',
  )
  s.box(0, -2, 0, 22, 2, 5)
  s.poly(
    [
      [22, 0, 0],
      [22, 7, 0],
      [22, 7, 4],
      [22, 0, 5],
    ],
    'side',
    'line',
  )
  s.poly(
    [
      [0, 0, 5],
      [22, 0, 5],
      [22, 7, 4],
      [0, 7, 4],
    ],
    'top',
    'line',
  )
  s.box(0, 7, 0, 22, 2, 4)
  s.rbox(8, 1.5, 4.5, 8, 4.5, 4, 1.5, { top: 'top', wall: 'front', side: 'side' })
}

const DRAW: Record<HeroGlyph, (s: Scene) => void> = {
  flights: spike,
  km: odometer,
  air: cabinWindow,
  countries: suitcase,
  airports: carousel,
}

/** Default k = 1: units are px, so the glyph is built at the size it is shown. */
export function heroGlyph(kind: HeroGlyph, k = 1): IsoFigureData {
  const s = new Scene(k)
  DRAW[kind](s)
  return s.done(1)
}
